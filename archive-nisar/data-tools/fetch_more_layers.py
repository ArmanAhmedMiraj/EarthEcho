# fetch_more_layers.py
# Reads three more layers from NASA for every date, for the river window only:
#   hv    HV brightness (the cross-polarized radar channel)
#   looks how many independent looks were averaged for each pixel
#   mask  the file's quality / validity mask
# They are saved next to the HH windows we already have, in data-raw/ (ignored by Git).
# Safe to re-run: dates that are already saved are skipped.

import csv
import time
from pathlib import Path

import earthaccess
import h5py
import numpy as np
from pyproj import Transformer

TRACK = "069"
FRAME = "014"

# Same river box as before (longitude, latitude).
LON_MIN, LON_MAX = 89.68, 89.88
LAT_MIN, LAT_MAX = 24.30, 24.50

GROUP = "science/LSAR/GCOV/grids/frequencyA"
LAYERS = {"hv": "HVHV", "looks": "numberOfLooks", "mask": "mask"}

PROJECT = Path(__file__).resolve().parent.parent
CSV_PATH = PROJECT / "notes" / "jamuna_gcov_scenes.csv"
RAW_DIR = PROJECT / "data-raw" / "jamuna_windows"


def pick_scenes():
    """One scene per date for our track and frame, from the CSV made by find_scenes.py."""
    by_date = {}
    with open(CSV_PATH, newline="", encoding="utf-8") as file:
        for row in csv.DictReader(file):
            if row["track"] != TRACK or row["frame"] != FRAME:
                continue
            try:
                size = float(row["size_gb"])
            except ValueError:
                size = 0.0
            score = (row["frame_coverage"] == "Full", size)
            best = by_date.get(row["date"])
            if best is None or score > best[0]:
                by_date[row["date"]] = (score, row)
    return [by_date[d][1] for d in sorted(by_date)]


def window_indices(x, y, transformer):
    xs, ys = transformer.transform(
        [LON_MIN, LON_MAX, LON_MAX, LON_MIN],
        [LAT_MIN, LAT_MIN, LAT_MAX, LAT_MAX],
    )
    cols = sorted([int(np.abs(x - min(xs)).argmin()), int(np.abs(x - max(xs)).argmin())])
    rows = sorted([int(np.abs(y - min(ys)).argmin()), int(np.abs(y - max(ys)).argmin())])
    return rows[0], rows[1] + 1, cols[0], cols[1] + 1


def main():
    scenes = pick_scenes()
    print(f"{len(scenes)} dates for track {TRACK}, frame {FRAME}.")
    print("Signing in to NASA Earthdata (uses the login saved earlier)...")
    earthaccess.login(persist=True)

    for number, row in enumerate(scenes, start=1):
        date = row["date"]
        cache = RAW_DIR / f"extra_{date}_t{TRACK}_f{FRAME}.npz"
        hh_cache = RAW_DIR / f"{date}_t{TRACK}_f{FRAME}.npz"
        if cache.exists():
            print(f"[{number}/{len(scenes)}] {date}: already saved, skipping")
            continue

        started = time.time()
        print(f"[{number}/{len(scenes)}] {date} ...", end=" ", flush=True)
        try:
            files = earthaccess.open([row["url"]])
            with h5py.File(files[0], "r") as h5:
                x = h5[GROUP + "/xCoordinates"][:]
                y = h5[GROUP + "/yCoordinates"][:]
                epsg = int(h5[GROUP + "/projection"][()])
                transformer = Transformer.from_crs("EPSG:4326", f"EPSG:{epsg}", always_xy=True)
                r0, r1, c0, c1 = window_indices(x, y, transformer)
                data = {name: h5[GROUP + "/" + layer][r0:r1, c0:c1] for name, layer in LAYERS.items()}
        except Exception as error:
            print("FAILED:", error)
            continue

        # The new layers must line up exactly with the HH window we already saved.
        same_shape = True
        if hh_cache.exists():
            same_shape = np.load(hh_cache)["power"].shape == data["hv"].shape

        np.savez_compressed(cache, **data)

        hv = data["hv"].astype("float32")
        looks = data["looks"].astype("float32")
        mask_values, mask_counts = np.unique(data["mask"], return_counts=True)
        mask_text = ", ".join(
            f"{int(v)}:{c / data['mask'].size * 100:.1f}%" for v, c in zip(mask_values, mask_counts)
        )
        print(f"ok ({time.time() - started:.0f} s)")
        print(f"      same shape as HH window: {same_shape}")
        print(f"      HV valid pixels: {np.isfinite(hv).mean() * 100:.1f}%   "
              f"looks min/median/max: {np.nanmin(looks):.1f} / {np.nanmedian(looks):.1f} / {np.nanmax(looks):.1f}")
        print(f"      mask values (value:share): {mask_text}")

    print()
    print("Done. Saved layers are in:", RAW_DIR)


if __name__ == "__main__":
    main()