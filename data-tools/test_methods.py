# test_methods.py
# Tests two ways to map river water on two dates (July 24 and October 4):
#   1. Groups pixels into 3 classes using BOTH HH and HV brightness, separately
#      for each date, so the method adapts to each date's brightness.
#   2. A change map: how much darker or brighter the later date is.
# HH comes from the windows already saved. HV is read from NASA the first time
# (about 40 seconds per date) and then saved too. Saves two pictures.

import csv
import warnings
from pathlib import Path

import earthaccess
import h5py
import matplotlib

matplotlib.use("Agg")  # draw pictures straight to files, no pop-up window
import matplotlib.pyplot as plt
import numpy as np
from pyproj import Transformer

warnings.filterwarnings("ignore", category=RuntimeWarning)

TRACK = "069"
FRAME = "014"
DATE_EARLY = "2026-07-24"
DATE_LATE = "2026-10-04"

LON_MIN, LON_MAX = 89.68, 89.88
LAT_MIN, LAT_MAX = 24.30, 24.50

GROUP = "science/LSAR/GCOV/grids/frequencyA"
BLOCK = 2
PIXEL_KM2 = (10.0 * BLOCK / 1000.0) ** 2

PROJECT = Path(__file__).resolve().parent.parent
CSV_PATH = PROJECT / "notes" / "jamuna_gcov_scenes.csv"
RAW_DIR = PROJECT / "data-raw" / "jamuna_windows"
OUT_DIR = PROJECT / "data-processed" / "jamuna"
OUT_DIR.mkdir(parents=True, exist_ok=True)

CLASS_COLORS = np.array(
    [[30, 136, 229],    # class 0: darkest in both HH and HV (water candidate)
     [200, 200, 200],   # class 1: middle
     [95, 95, 95]],     # class 2: brightest
    dtype=np.uint8,
)


def find_scene(date):
    with open(CSV_PATH, newline="", encoding="utf-8") as file:
        for row in csv.DictReader(file):
            if row["track"] == TRACK and row["frame"] == FRAME and row["date"] == date:
                return row
    raise RuntimeError(f"{date} not found in the CSV")


def load_hh(date):
    return np.load(RAW_DIR / f"{date}_t{TRACK}_f{FRAME}.npz")["power"]


def load_hv(date):
    """Returns the HV window, reading it from NASA the first time only."""
    cache = RAW_DIR / f"hv_{date}_t{TRACK}_f{FRAME}.npz"
    if cache.exists():
        return np.load(cache)["power"]

    row = find_scene(date)
    print(f"  reading HV for {date} from NASA ...", flush=True)
    files = earthaccess.open([row["url"]])
    if not files:
        raise RuntimeError("could not open the remote file")
    with h5py.File(files[0], "r") as h5:
        x = h5[GROUP + "/xCoordinates"][:]
        y = h5[GROUP + "/yCoordinates"][:]
        epsg = int(h5[GROUP + "/projection"][()])
        transformer = Transformer.from_crs("EPSG:4326", f"EPSG:{epsg}", always_xy=True)
        xs, ys = transformer.transform(
            [LON_MIN, LON_MAX, LON_MAX, LON_MIN],
            [LAT_MIN, LAT_MIN, LAT_MAX, LAT_MAX],
        )
        cols = sorted([int(np.abs(x - min(xs)).argmin()), int(np.abs(x - max(xs)).argmin())])
        rows = sorted([int(np.abs(y - min(ys)).argmin()), int(np.abs(y - max(ys)).argmin())])
        r0, r1, c0, c1 = rows[0], rows[1] + 1, cols[0], cols[1] + 1
        power = h5[GROUP + "/HVHV"][r0:r1, c0:c1].astype("float32")
    np.savez(cache, power=power)
    return power


def to_db(power):
    """Averages BLOCK x BLOCK pixels, then converts to decibels."""
    power = np.where(power > 0, power, np.nan)
    h = (power.shape[0] // BLOCK) * BLOCK
    w = (power.shape[1] // BLOCK) * BLOCK
    blocks = power[:h, :w].reshape(h // BLOCK, BLOCK, w // BLOCK, BLOCK)
    mean = np.nanmean(blocks, axis=(1, 3))
    db = np.full(mean.shape, np.nan, dtype="float32")
    good = np.isfinite(mean) & (mean > 0)
    db[good] = 10.0 * np.log10(mean[good])
    return db


def kmeans_three_classes(hh_db, hv_db):
    """Splits pixels into 3 classes using HH and HV together. Class 0 is darkest."""
    valid = np.isfinite(hh_db) & np.isfinite(hv_db)
    features = np.stack([hh_db[valid], hv_db[valid]], axis=1)

    sample = features[:: max(1, len(features) // 200000)]
    order = np.argsort(sample.sum(axis=1))
    centers = np.array([sample[order[int(len(order) * q)]] for q in (0.05, 0.5, 0.95)])

    for _ in range(30):
        distance = ((sample[:, None, :] - centers[None, :, :]) ** 2).sum(axis=2)
        labels = distance.argmin(axis=1)
        new_centers = np.array([
            sample[labels == k].mean(axis=0) if np.any(labels == k) else centers[k]
            for k in range(3)
        ])
        if np.allclose(new_centers, centers, atol=0.01):
            break
        centers = new_centers

    # Put the classes in order from darkest to brightest.
    centers = centers[np.argsort(centers.sum(axis=1))]

    distance = ((features[:, None, :] - centers[None, :, :]) ** 2).sum(axis=2)
    classes = np.full(hh_db.shape, -1, dtype=np.int8)
    classes[valid] = distance.argmin(axis=1)
    return classes, centers


def class_picture(classes):
    rgb = np.full(classes.shape + (3,), 255, dtype=np.uint8)
    for k in range(3):
        rgb[classes == k] = CLASS_COLORS[k]
    return rgb


def main():
    print("Signing in to NASA Earthdata (uses the login saved earlier)...")
    earthaccess.login(persist=True)

    dates = [DATE_EARLY, DATE_LATE]
    hh_list, hv_list = [], []
    for date in dates:
        print(date)
        hh_list.append(to_db(load_hh(date)))
        hv_list.append(to_db(load_hv(date)))

    print()
    print("Brightness of each class (average dB) and how much of the box it covers:")
    figure, axes = plt.subplots(2, 3, figsize=(15, 9))
    for row, (date, hh, hv) in enumerate(zip(dates, hh_list, hv_list)):
        classes, centers = kmeans_three_classes(hh, hv)
        valid = classes >= 0
        for k in range(3):
            share = float((classes == k).sum()) / max(int(valid.sum()), 1) * 100
            area = float((classes == k).sum()) * PIXEL_KM2
            print(f"  {date}  class {k}:  HH {centers[k][0]:6.1f}   HV {centers[k][1]:6.1f}"
                  f"   {share:4.0f}% of the box   {area:6.1f} km2")

        axes[row, 0].imshow(hh, cmap="gray", vmin=-22, vmax=2)
        axes[row, 0].set_title(f"{date}\nHH brightness", fontsize=10)
        axes[row, 1].imshow(hv, cmap="gray", vmin=-32, vmax=-8)
        axes[row, 1].set_title("HV brightness", fontsize=10)
        axes[row, 2].imshow(class_picture(classes))
        axes[row, 2].set_title(
            "3 classes from HH + HV\nblue = darkest (water candidate)", fontsize=10
        )
    for axis in axes.ravel():
        axis.axis("off")
    figure.tight_layout()
    figure.savefig(OUT_DIR / "methods_test.png", dpi=75)
    plt.close(figure)

    # Change map: positive (blue) means the LATER date is darker than the earlier one.
    darker_by = hh_list[0] - hh_list[1]
    k = 4
    h = (darker_by.shape[0] // k) * k
    w = (darker_by.shape[1] // k) * k
    smooth = np.nanmean(darker_by[:h, :w].reshape(h // k, k, w // k, k), axis=(1, 3))

    figure, axes = plt.subplots(1, 3, figsize=(15, 5.4))
    axes[0].imshow(hh_list[0], cmap="gray", vmin=-22, vmax=2)
    axes[0].set_title(f"{DATE_EARLY} (HH)", fontsize=10)
    axes[1].imshow(hh_list[1], cmap="gray", vmin=-22, vmax=2)
    axes[1].set_title(f"{DATE_LATE} (HH)", fontsize=10)
    shown = axes[2].imshow(smooth, cmap="RdBu", vmin=-8, vmax=8)
    axes[2].set_title(
        f"Change {DATE_EARLY} to {DATE_LATE}\nblue = darker later, red = brighter later",
        fontsize=10,
    )
    figure.colorbar(shown, ax=axes[2], fraction=0.046, label="dB")
    for axis in axes:
        axis.axis("off")
    figure.tight_layout()
    figure.savefig(OUT_DIR / "difference_test.png", dpi=75)
    plt.close(figure)

    print()
    print("Saved:", OUT_DIR / "methods_test.png")
    print("Saved:", OUT_DIR / "difference_test.png")


if __name__ == "__main__":
    main()