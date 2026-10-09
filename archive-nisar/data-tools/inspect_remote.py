# inspect_remote.py
# Opens ONE NISAR GCOV file over the internet WITHOUT downloading all 7 GB.
# It (1) prints the file's structure, (2) finds the Jamuna river window inside
# the file, (3) reads only that window, (4) times the read, and (5) saves a
# preview picture so we can see the river.

import csv
import time
from pathlib import Path

import earthaccess
import h5py
import matplotlib

matplotlib.use("Agg")  # draw pictures straight to files, no pop-up window
import matplotlib.pyplot as plt
import numpy as np
from pyproj import Transformer

# ---- Which file to open (taken from the list find_scenes.py saved) ----
TRACK = "069"
FRAME = "014"
DATE = "2026-06-18"

# ---- Jamuna river box (same box used for the search). Longitude, latitude. ----
LON_MIN, LON_MAX = 89.68, 89.88
LAT_MIN, LAT_MAX = 24.30, 24.50

PROJECT = Path(__file__).resolve().parent.parent
CSV_PATH = PROJECT / "notes" / "jamuna_gcov_scenes.csv"
OUT_DIR = PROJECT / "data-processed"
OUT_DIR.mkdir(exist_ok=True)


def pick_row():
    """Finds the chosen scene in the CSV list made by find_scenes.py."""
    with open(CSV_PATH, newline="", encoding="utf-8") as file:
        for row in csv.DictReader(file):
            if row["track"] == TRACK and row["frame"] == FRAME and row["date"] == DATE:
                return row
    return None


def choose_grid(grids):
    """Picks the main radar-brightness grid (HH polarization of frequency A if present)."""
    for ending in ("HHHH", "VVVV", "HVHV"):
        for grid in grids:
            if "frequencyA" in grid[0] and grid[0].endswith(ending):
                return grid
    for grid in grids:
        if "frequencyA" in grid[0]:
            return grid
    return grids[0] if grids else None


def main():
    row = pick_row()
    if row is None:
        print("That scene is not in the CSV. Check TRACK, FRAME and DATE at the top.")
        return

    print("Scene:", row["name"])
    print("Size on the server (GB):", row["size_gb"])
    url = row["url"]
    print("Data URL:", url)
    if not url.lower().endswith((".h5", ".hdf5")):
        print("WARNING: this link does not end in .h5, so it may not be the main data file.")

    print()
    print("Signing in to NASA Earthdata. If asked, type your username and password here.")
    earthaccess.login(strategy="interactive", persist=True)

    print("Opening the remote file (no full download)...")
    started = time.time()
    files = earthaccess.open([url])
    if not files:
        print("Could not open the file. Send me every line printed above.")
        return

    with h5py.File(files[0], "r") as h5:
        print(f"File opened in {time.time() - started:.1f} s")

        # Walk through the file once, collecting the big grids and key small items.
        grids = []
        small_items = []
        key_names = (
            "xCoordinates", "yCoordinates", "projection",
            "xCoordinateSpacing", "yCoordinateSpacing", "listOfPolarizations",
        )

        def visit(name, obj):
            if isinstance(obj, h5py.Dataset):
                if obj.ndim == 2 and min(obj.shape) >= 1000:
                    grids.append((name, obj.shape, str(obj.dtype), obj.chunks))
                if name.split("/")[-1] in key_names:
                    small_items.append(name)

        h5.visititems(visit)

        print()
        print("Big 2D grids in this file (name, shape, type, chunk shape):")
        for grid in grids:
            print("  ", grid)
        print()
        print("Key small items:")
        for name in small_items:
            item = h5[name]
            if item.ndim == 1 and item.shape[0] > 6:
                data = item[:]
                print(f"   {name}: {item.shape[0]} values, first {data[0]}, last {data[-1]}")
            else:
                print(f"   {name}: {item[()]}")

        chosen = choose_grid(grids)
        if chosen is None:
            print("No big grid found. Send me the printout above.")
            return
        grid_name = chosen[0]
        print()
        print("Using grid:", grid_name)

        group = grid_name.rsplit("/", 1)[0]
        x = h5[group + "/xCoordinates"][:]
        y = h5[group + "/yCoordinates"][:]

        projection = h5[group + "/projection"]
        epsg = None
        try:
            epsg = int(projection[()])
        except Exception:
            pass
        if not epsg or epsg < 1000:
            epsg = int(np.asarray(projection.attrs.get("epsg_code", 0)))
        print("Map projection (EPSG code):", epsg)

        # Convert the river box from longitude/latitude into the file's own map coordinates.
        transformer = Transformer.from_crs("EPSG:4326", f"EPSG:{epsg}", always_xy=True)
        xs, ys = transformer.transform(
            [LON_MIN, LON_MAX, LON_MAX, LON_MIN],
            [LAT_MIN, LAT_MIN, LAT_MAX, LAT_MAX],
        )
        x_low, x_high = min(xs), max(xs)
        y_low, y_high = min(ys), max(ys)

        inside = (
            x.min() <= x_low and x_high <= x.max()
            and y.min() <= y_low and y_high <= y.max()
        )
        print("River box fully inside this frame:", inside)
        if not inside:
            print("The box is not fully inside this frame. Send me the lines above.")
            return

        cols = sorted([int(np.abs(x - x_low).argmin()), int(np.abs(x - x_high).argmin())])
        rows = sorted([int(np.abs(y - y_low).argmin()), int(np.abs(y - y_high).argmin())])
        r0, r1 = rows[0], rows[1] + 1
        c0, c1 = cols[0], cols[1] + 1
        print(f"River window: rows {r0}-{r1}, columns {c0}-{c1}  ->  {r1 - r0} x {c1 - c0} pixels")

        if (r1 - r0) > 6000 or (c1 - c0) > 6000:
            print("That window is unexpectedly large, so I stopped. Send me the lines above.")
            return

        print("Reading only the river window from the remote file...")
        started = time.time()
        block = h5[grid_name][r0:r1, c0:c1]
        elapsed = time.time() - started
        megabytes = block.nbytes / 1e6
        print(f"Read {block.shape} ({megabytes:.1f} MB) in {elapsed:.1f} s "
              f"= {megabytes / max(elapsed, 0.001):.2f} MB/s")

        data = block.astype("float32")
        valid = np.isfinite(data) & (data > 0)
        print(f"Valid pixels: {valid.mean() * 100:.1f}%")
        if not valid.any():
            print("No valid pixels in the window. Send me the lines above.")
            return

        # Convert to decibels (dB), the usual scale for radar brightness. Water is dark.
        db = np.full(data.shape, np.nan, dtype="float32")
        db[valid] = 10.0 * np.log10(data[valid])
        low, high = np.nanpercentile(db, [2, 98])
        print(f"Brightness range used for the picture: {low:.1f} to {high:.1f} dB")

        if y[0] < y[-1]:  # make sure north is at the top of the picture
            db = db[::-1]

        picture = OUT_DIR / f"preview_t{TRACK}_f{FRAME}_{DATE}.png"
        plt.imsave(picture, db, cmap="gray", vmin=low, vmax=high)
        print("Preview picture saved to:", picture)


if __name__ == "__main__":
    main()