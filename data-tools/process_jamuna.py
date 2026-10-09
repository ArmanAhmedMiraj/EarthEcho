# process_jamuna.py  (version 2)
# Builds the EarthEcho "Jamuna river" demo layers from NISAR PROVISIONAL GCOV data.
#
# What changed from version 1:
#   Our tests showed that a single "water" brightness cutoff is unreliable here
#   (the river looks different on different dates, and the floodplain changes a lot).
#   So this version does NOT claim a flood area. It makes two honest layers that
#   need no cutoff:
#     1. radar brightness pictures for every date (the real data, for a before/after slider)
#     2. change pictures in dB (later date minus earlier date), with small changes hidden
#
# How to read the change pictures:
#   blue   = darker in the later image   (smoother or wetter-looking surface, e.g. more water)
#   orange = brighter in the later image (rougher or drier surface, e.g. exposed sand, growing crops)
# Radar brightness alone cannot prove the cause, so the app must say "likely", not "certain".
#
# It reads only the river window from each remote file (no 7 GB downloads) and caches
# the windows in data-raw/ (ignored by Git), so re-running is fast and works offline.

import csv
import json
import time
import warnings
from datetime import date as Date
from pathlib import Path

import earthaccess
import h5py
import matplotlib

matplotlib.use("Agg")  # draw pictures straight to files, no pop-up window
import matplotlib.pyplot as plt
import numpy as np
from PIL import Image
from pyproj import Transformer

warnings.filterwarnings("ignore", category=RuntimeWarning)

# ---------------- Settings you may change ----------------
PLACE_ID = "jamuna-bangladesh"
TRACK = "069"
FRAME = "014"
DIRECTION = "A"

# River box (longitude, latitude). Same box used for the search.
LON_MIN, LON_MAX = 89.68, 89.88
LAT_MIN, LAT_MAX = 24.30, 24.50

GROUP = "science/LSAR/GCOV/grids/frequencyA"
GRID = GROUP + "/HHHH"

BLOCK = 2         # average BLOCK x BLOCK pixels (2 -> 20 m pixels)
NOISE_DB = 2.0    # changes smaller than this are hidden (speckle noise level)
FULL_DB = 6.0     # changes of this size or more get the strongest colour
STRONG_DB = 3.0   # used only for the "percent changed" numbers

# Extra long-range pairs (earlier date, later date) besides every neighbouring pair.
EXTRA_PAIRS = [
    ("2026-06-18", "2026-07-24"),   # water rising through the monsoon
    ("2026-07-24", "2026-10-04"),   # water falling after the monsoon
    ("2026-06-18", "2026-10-04"),   # the whole period
]
# ---------------------------------------------------------

PROJECT = Path(__file__).resolve().parent.parent
CSV_PATH = PROJECT / "notes" / "jamuna_gcov_scenes.csv"
RAW_DIR = PROJECT / "data-raw" / "jamuna_windows"
OUT_DIR = PROJECT / "data-processed" / "jamuna"
RAW_DIR.mkdir(parents=True, exist_ok=True)
OUT_DIR.mkdir(parents=True, exist_ok=True)

DARKER_COLOR = (30, 136, 229)    # blue
BRIGHTER_COLOR = (242, 142, 43)  # orange  (a blue/orange pair is colour-blind safe)


def clean_old_outputs():
    """Removes pictures made by earlier versions and by our test scripts."""
    patterns = ["water_*.png", "water_frequency.png", "change_*.png", "sar_*.png",
                "contact_sheet.png", "threshold_check.png", "*_test.png",
                "check_radar.png", "check_changes.png"]
    for pattern in patterns:
        for old in OUT_DIR.glob(pattern):
            old.unlink()


def pick_scenes():
    """Reads the CSV from find_scenes.py and returns one scene per date."""
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
    """Finds which rows/columns of the big grid cover the river box."""
    xs, ys = transformer.transform(
        [LON_MIN, LON_MAX, LON_MAX, LON_MIN],
        [LAT_MIN, LAT_MIN, LAT_MAX, LAT_MAX],
    )
    inside = (
        x.min() <= min(xs) and max(xs) <= x.max()
        and y.min() <= min(ys) and max(ys) <= y.max()
    )
    if not inside:
        return None
    cols = sorted([int(np.abs(x - min(xs)).argmin()), int(np.abs(x - max(xs)).argmin())])
    rows = sorted([int(np.abs(y - min(ys)).argmin()), int(np.abs(y - max(ys)).argmin())])
    return rows[0], rows[1] + 1, cols[0], cols[1] + 1


def fetch_window(row):
    """Returns the river window for one date (from cache, or read from NASA)."""
    cache = RAW_DIR / f"{row['date']}_t{TRACK}_f{FRAME}.npz"
    if cache.exists():
        saved = np.load(cache)
        return {"power": saved["power"], "x": saved["x"], "y": saved["y"],
                "epsg": int(saved["epsg"]), "source": "cache"}

    files = earthaccess.open([row["url"]])
    if not files:
        raise RuntimeError("could not open the remote file")
    with h5py.File(files[0], "r") as h5:
        x = h5[GROUP + "/xCoordinates"][:]
        y = h5[GROUP + "/yCoordinates"][:]
        epsg = int(h5[GROUP + "/projection"][()])
        transformer = Transformer.from_crs("EPSG:4326", f"EPSG:{epsg}", always_xy=True)
        indices = window_indices(x, y, transformer)
        if indices is None:
            raise RuntimeError("river box is not fully inside this frame")
        r0, r1, c0, c1 = indices
        power = h5[GRID][r0:r1, c0:c1].astype("float32")

    window = {"power": power, "x": x[c0:c1], "y": y[r0:r1], "epsg": epsg, "source": "NASA"}
    np.savez(cache, power=power, x=window["x"], y=window["y"], epsg=epsg)
    return window


def block_mean(values, k):
    """Averages k x k pixel blocks (ignores empty pixels)."""
    h = (values.shape[0] // k) * k
    w = (values.shape[1] // k) * k
    return np.nanmean(values[:h, :w].reshape(h // k, k, w // k, k), axis=(1, 3))


def smooth2(values):
    """Averages 2 x 2 blocks of a dB picture (pads with empty pixels if the size is odd)."""
    pad_h = values.shape[0] % 2
    pad_w = values.shape[1] % 2
    if pad_h or pad_w:
        values = np.pad(values, ((0, pad_h), (0, pad_w)), constant_values=np.nan)
    h, w = values.shape
    return np.nanmean(values.reshape(h // 2, 2, w // 2, 2), axis=(1, 3))


def save_rgba(path, rgba):
    Image.fromarray(rgba).save(path, optimize=True)


def change_overlay(change):
    """Transparent picture: blue where darker, orange where brighter, nothing for small changes."""
    values = np.nan_to_num(change, nan=0.0)
    magnitude = np.abs(values)
    visible = np.isfinite(change) & (magnitude >= NOISE_DB)
    strength = np.clip((magnitude - NOISE_DB) / (FULL_DB - NOISE_DB), 0, 1)
    rgba = np.zeros(change.shape + (4,), dtype=np.uint8)
    darker = visible & (values < 0)
    brighter = visible & (values > 0)
    rgba[darker, :3] = DARKER_COLOR
    rgba[brighter, :3] = BRIGHTER_COLOR
    rgba[..., 3] = np.where(visible, (120 + 115 * strength), 0).astype(np.uint8)
    return rgba


def main():
    scenes = pick_scenes()
    if not scenes:
        print("No scenes for this track/frame in the CSV. Run find_scenes.py first.")
        return
    print(f"{len(scenes)} dates to process for track {TRACK}, frame {FRAME}.")

    print("Signing in to NASA Earthdata (uses the login saved earlier)...")
    earthaccess.login(persist=True)

    # ---- 1. Read every date ----
    windows = []
    for number, row in enumerate(scenes, start=1):
        started = time.time()
        print(f"[{number}/{len(scenes)}] {row['date']} ...", end=" ", flush=True)
        try:
            window = fetch_window(row)
        except Exception as error:
            print("FAILED:", error)
            continue
        window["date"] = row["date"]
        window["scene"] = row["name"]
        windows.append(window)
        print(f"ok ({window['source']}, {time.time() - started:.0f} s)")
    if not windows:
        print("Nothing could be read. Send me the lines above.")
        return

    height = min(w["power"].shape[0] for w in windows)
    width = min(w["power"].shape[1] for w in windows)
    if len({round(float(w["x"][0]), 1) for w in windows}) > 1:
        print("WARNING: the dates do not share exactly the same grid. Tell me this.")

    # ---- 2. Average pixels and convert to dB ----
    dbs = []
    for window in windows:
        power = np.where(window["power"][:height, :width] > 0, window["power"][:height, :width], np.nan)
        mean = block_mean(power, BLOCK)
        db = np.full(mean.shape, np.nan, dtype="float32")
        good = np.isfinite(mean) & (mean > 0)
        db[good] = 10.0 * np.log10(mean[good])
        dbs.append(db)

    # ---- 3. One shared brightness stretch for the radar pictures ----
    sample = np.concatenate([d[np.isfinite(d)][::25] for d in dbs])
    low, high = [float(v) for v in np.percentile(sample, [2, 98])]
    print(f"Brightness stretch: {low:.1f} to {high:.1f} dB")

    # ---- 4. Where is the picture on the map? ----
    x, y = windows[0]["x"], windows[0]["y"]
    spacing = float(abs(x[1] - x[0]))
    half = spacing / 2.0
    used_h = (height // BLOCK) * BLOCK
    used_w = (width // BLOCK) * BLOCK
    if not y[0] > y[1]:
        print("WARNING: rows run south to north; the pictures may be upside down. Tell me this.")
    x_left, x_right = float(x[0] - half), float(x[used_w - 1] + half)
    y_top, y_bottom = float(y[0] + half), float(y[used_h - 1] - half)
    to_lonlat = Transformer.from_crs(f"EPSG:{windows[0]['epsg']}", "EPSG:4326", always_xy=True)
    corners = [
        list(to_lonlat.transform(x_left, y_top)),      # top-left
        list(to_lonlat.transform(x_right, y_top)),     # top-right
        list(to_lonlat.transform(x_right, y_bottom)),  # bottom-right
        list(to_lonlat.transform(x_left, y_bottom)),   # bottom-left
    ]
    corners = [[round(lon, 6), round(lat, 6)] for lon, lat in corners]
    lons = [c[0] for c in corners]
    lats = [c[1] for c in corners]
    bounds = [min(lons), min(lats), max(lons), max(lats)]  # west, south, east, north

    clean_old_outputs()

    # ---- 5. Radar brightness picture for every date ----
    radar = []
    for window, db in zip(windows, dbs):
        gray = np.clip((np.nan_to_num(db, nan=low) - low) / (high - low), 0, 1)
        Image.fromarray((gray * 255).astype(np.uint8)).save(
            OUT_DIR / f"sar_{window['date']}.png", optimize=True)
        radar.append({
            "date": window["date"],
            "sar": f"sar_{window['date']}.png",
            "valid_percent": round(float(np.isfinite(db).mean()) * 100, 1),
            "scene": window["scene"],
        })

    # ---- 6. Change pictures: every neighbouring pair + the long-range pairs ----
    index = {w["date"]: i for i, w in enumerate(windows)}
    pairs = [(windows[i]["date"], windows[i + 1]["date"]) for i in range(len(windows) - 1)]
    for first, last in EXTRA_PAIRS:
        if first in index and last in index and (first, last) not in pairs:
            pairs.append((first, last))

    changes = []
    overlays = []
    for first, last in pairs:
        diff = smooth2(dbs[index[last]] - dbs[index[first]])  # later minus earlier
        overlay = change_overlay(diff)
        file_name = f"change_{first}_to_{last}.png"
        save_rgba(OUT_DIR / file_name, overlay)
        valid = np.isfinite(diff)
        days = (Date.fromisoformat(last) - Date.fromisoformat(first)).days
        changes.append({
            "from": first, "to": last, "days": days, "file": file_name,
            "darker_percent": round(float((diff[valid] <= -STRONG_DB).mean()) * 100, 1),
            "brighter_percent": round(float((diff[valid] >= STRONG_DB).mean()) * 100, 1),
        })
        overlays.append((first, last, overlay))

    # ---- 7. meta.json for the app ----
    meta = {
        "place_id": PLACE_ID,
        "title": "Jamuna river, Bangladesh",
        "change_type": "river and monsoon surface change",
        "source": "NASA-ISRO NISAR L2 GCOV, PROVISIONAL (CRID P05023), L-band HH",
        "track": TRACK, "frame": FRAME, "direction": DIRECTION,
        "pixel_size_m": spacing * BLOCK,
        "corners_lonlat": corners,
        "bounds_west_south_east_north": bounds,
        "brightness_stretch_db": [round(low, 2), round(high, 2)],
        "noise_floor_db": NOISE_DB,
        "full_colour_db": FULL_DB,
        "legend": {
            "darker": "Darker in the later image: smoother or wetter-looking surface (for example more water).",
            "brighter": "Brighter in the later image: rougher or drier surface (for example exposed sand or growing crops).",
        },
        "dates": radar,
        "changes": changes,
        "note": (
            "Radar brightness change, not a direct flood map. The cause is likely, not certain. "
            "NISAR data is PROVISIONAL and not yet fully validated."
        ),
    }
    with open(OUT_DIR / "meta.json", "w", encoding="utf-8") as file:
        json.dump(meta, file, indent=2)

    # ---- 8. Two check pictures for us ----
    columns = 3
    rows_count = int(np.ceil(len(radar) / columns))
    figure, axes = plt.subplots(rows_count, columns, figsize=(13, 4.2 * rows_count))
    axes = np.atleast_1d(axes).ravel()
    for axis in axes:
        axis.axis("off")
    for axis, entry, db in zip(axes, radar, dbs):
        axis.imshow(db, cmap="gray", vmin=low, vmax=high)
        axis.set_title(entry["date"], fontsize=10)
    figure.tight_layout()
    figure.savefig(OUT_DIR / "check_radar.png", dpi=70)
    plt.close(figure)

    columns = 4
    rows_count = int(np.ceil(len(overlays) / columns))
    figure, axes = plt.subplots(rows_count, columns, figsize=(15, 4.4 * rows_count))
    axes = np.atleast_1d(axes).ravel()
    for axis in axes:
        axis.axis("off")
    for axis, (first, last, overlay) in zip(axes, overlays):
        base = dbs[index[first]]
        axis.imshow(base, cmap="gray", vmin=low, vmax=high)
        axis.imshow(overlay, extent=(0, base.shape[1], base.shape[0], 0))
        axis.set_title(f"{first} to {last}", fontsize=10)
    figure.tight_layout()
    figure.savefig(OUT_DIR / "check_changes.png", dpi=70)
    plt.close(figure)

    # ---- 9. Summary ----
    print()
    print("Change pair                        days   darker (%)   brighter (%)")
    for item in changes:
        print(f"{item['from']} to {item['to']}   {item['days']:>4}   {item['darker_percent']:>9}   {item['brighter_percent']:>11}")
    total = sum(f.stat().st_size for f in OUT_DIR.iterdir()) / 1e6
    print()
    print(f"Saved {len(list(OUT_DIR.iterdir()))} files ({total:.1f} MB) to: {OUT_DIR}")
    print("Open check_radar.png and check_changes.png in that folder and send them to me.")


if __name__ == "__main__":
    main()