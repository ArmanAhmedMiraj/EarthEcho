# test_thresholds.py
# Compares several water thresholds on two dates, using the river windows that
# process_jamuna.py already saved. Needs no internet. Saves one picture.

import warnings
from pathlib import Path

import matplotlib

matplotlib.use("Agg")  # draw pictures straight to a file
import matplotlib.pyplot as plt
import numpy as np

warnings.filterwarnings("ignore", category=RuntimeWarning)

TRACK = "069"
FRAME = "014"
DATES = ["2026-07-24", "2026-10-04"]          # a wet-season date and the latest date
THRESHOLDS = [-12.0, -15.0, -18.0, -21.0]     # brightness values to compare (dB)
BLOCK = 2                                      # same pixel averaging as before
PIXEL_KM2 = (10.0 * BLOCK / 1000.0) ** 2       # area of one averaged pixel

PROJECT = Path(__file__).resolve().parent.parent
RAW_DIR = PROJECT / "data-raw" / "jamuna_windows"
OUT_FILE = PROJECT / "data-processed" / "jamuna" / "threshold_test.png"


def load_db(date):
    """Loads one saved river window and returns it in decibels (dB)."""
    path = RAW_DIR / f"{date}_t{TRACK}_f{FRAME}.npz"
    power = np.load(path)["power"]
    power = np.where(power > 0, power, np.nan)
    h = (power.shape[0] // BLOCK) * BLOCK
    w = (power.shape[1] // BLOCK) * BLOCK
    blocks = power[:h, :w].reshape(h // BLOCK, BLOCK, w // BLOCK, BLOCK)
    mean = np.nanmean(blocks, axis=(1, 3))
    db = np.full(mean.shape, np.nan, dtype="float32")
    good = np.isfinite(mean) & (mean > 0)
    db[good] = 10.0 * np.log10(mean[good])
    return db


def blue_overlay(mask):
    """A transparent picture that is blue only where mask is True."""
    rgba = np.zeros(mask.shape + (4,), dtype=np.uint8)
    rgba[mask] = (30, 136, 229, 200)
    return rgba


def main():
    columns = 1 + len(THRESHOLDS)
    figure, axes = plt.subplots(
        len(DATES), columns, figsize=(4.2 * columns, 4.4 * len(DATES))
    )
    axes = np.atleast_2d(axes)

    print("Date         threshold (dB)   open water (km2)   share of the box")
    for row, date in enumerate(DATES):
        db = load_db(date)
        valid = np.isfinite(db)

        axes[row, 0].imshow(db, cmap="gray", vmin=-22, vmax=2)
        axes[row, 0].set_title(f"{date}\nradar brightness only", fontsize=10)

        for column, threshold in enumerate(THRESHOLDS, start=1):
            water = valid & (db < threshold)
            area = float(water.sum()) * PIXEL_KM2
            share = float(water.sum()) / max(int(valid.sum()), 1) * 100
            print(f"{date}   {threshold:>10.1f}   {area:>16.1f}   {share:>10.0f}%")
            axes[row, column].imshow(db, cmap="gray", vmin=-22, vmax=2)
            axes[row, column].imshow(blue_overlay(water))
            axes[row, column].set_title(
                f"water if below {threshold:.0f} dB\n{area:.0f} km2 ({share:.0f}%)",
                fontsize=10,
            )

    for axis in axes.ravel():
        axis.axis("off")
    figure.tight_layout()
    figure.savefig(OUT_FILE, dpi=75)
    plt.close(figure)
    print()
    print("Saved:", OUT_FILE)


if __name__ == "__main__":
    main()