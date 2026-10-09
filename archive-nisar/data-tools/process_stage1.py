# process_stage1.py
# EarthEcho - Jamuna river, stage 1 of the accuracy plan.
#
# What it does (all from files already on this computer, no internet needed):
#   1. Loads the saved river windows (HH, HV and "number of looks") for every date.
#   2. Fixes scene-wide brightness shifts between dates, using pixels that barely
#      change over the whole season (buildings, embankments).
#   3. Measures the real speckle noise level from the flattest patches.
#   4. Averages dates into periods to reduce speckle noise.
#   5. Tests every pixel for a SIGNIFICANT change between periods (99% level) instead
#      of using a guessed cutoff, removes isolated specks, and uses HV as a second opinion.
#   6. Saves pictures, a noise check and meta.json to data-processed/jamuna_v3/.
#
# How to read the change pictures:
#   blue   = darker in the later period (smoother or wetter-looking surface, e.g. more water)
#   orange = brighter in the later period (rougher or drier surface, e.g. sand, growing crops)
#   strong colour = HH and HV agree, pale colour = only HH shows the change.
# Radar brightness alone cannot prove the cause, so the app must say "likely", not "certain".

import csv
import json
import warnings
from datetime import date as Date
from pathlib import Path

import matplotlib

matplotlib.use("Agg")  # draw pictures straight to files, no pop-up window
import matplotlib.pyplot as plt
import numpy as np
from PIL import Image
from pyproj import Transformer

warnings.filterwarnings("ignore", category=RuntimeWarning)

# ---------------- Settings you may change ----------------
PLACE_ID = "jamuna-bangladesh"
TRACK, FRAME, DIRECTION = "069", "014", "A"

BLOCK = 2        # average BLOCK x BLOCK pixels first (2 -> 20 m pixels)
SMOOTH = 1       # extra smoothing window in pixels (1 = none, 3 = a little more)
Z_SCORE = 2.58   # 99% confidence (two-sided)
FULL_DB = 6.0    # changes of this size or more get the strongest colour

# Dates are averaged inside each period. Periods are compared with each other.
PERIODS = [
    ("Jun 18 + Jun 30", ["2026-06-18", "2026-06-30"]),
    ("Jul 12 + Jul 24", ["2026-07-12", "2026-07-24"]),
    ("Aug 17 + Aug 29", ["2026-08-17", "2026-08-29"]),
    ("Sep 10 + Sep 22", ["2026-09-10", "2026-09-22"]),
    ("Oct 4", ["2026-10-04"]),
]
# Which periods to compare (indexes into PERIODS).
PAIRS = [(0, 1), (1, 2), (2, 3), (3, 4), (0, 2), (1, 4), (0, 4)]
# ---------------------------------------------------------

PROJECT = Path(__file__).resolve().parent.parent
RAW_DIR = PROJECT / "data-raw" / "jamuna_windows"
OUT_DIR = PROJECT / "data-processed" / "jamuna_v3"
OUT_DIR.mkdir(parents=True, exist_ok=True)

DB_PER_NEPER = 10.0 / np.log(10.0)  # converts natural-log units to decibels
DARKER_COLOR = (30, 136, 229)       # blue
BRIGHTER_COLOR = (242, 142, 43)     # orange (a blue/orange pair is colour-blind safe)


# ---------------------------------------------------------------- helpers
def trigamma(x):
    """Trigamma function. Used to predict how noisy a radar ratio is (x = number of looks)."""
    total = 0.0
    while x < 6.0:
        total += 1.0 / (x * x)
        x += 1.0
    inv = 1.0 / x
    inv2 = inv * inv
    total += (inv + inv2 / 2.0 + inv * inv2 / 6.0 - inv * inv2 * inv2 / 30.0
              + inv * inv2 ** 3 / 42.0 - inv * inv2 ** 4 / 30.0)
    return total


def block_mean(values, k):
    """Averages k x k pixel blocks (ignores empty pixels)."""
    h = (values.shape[0] // k) * k
    w = (values.shape[1] // k) * k
    return np.nanmean(values[:h, :w].reshape(h // k, k, w // k, k), axis=(1, 3))


def box_mean(values, n):
    """Average over an n x n window (n odd), ignoring empty pixels."""
    pad = n // 2
    valid = np.isfinite(values)
    filled = np.where(valid, values, 0.0).astype("float64")
    counts = valid.astype("float64")

    def window_sum(array):
        padded = np.pad(array, ((pad + 1, pad), (pad + 1, pad)))
        cumulative = padded.cumsum(axis=0).cumsum(axis=1)
        return (cumulative[n:, n:] - cumulative[:-n, n:]
                - cumulative[n:, :-n] + cumulative[:-n, :-n])

    total = window_sum(filled)
    count = window_sum(counts)
    return np.where(count > 0, total / np.maximum(count, 1), np.nan)


def to_db(lin):
    db = np.full(lin.shape, np.nan, dtype="float32")
    good = np.isfinite(lin) & (lin > 0)
    db[good] = 10.0 * np.log10(lin[good])
    return db


def load_date(day):
    hh = np.load(RAW_DIR / f"{day}_t{TRACK}_f{FRAME}.npz")
    extra = np.load(RAW_DIR / f"extra_{day}_t{TRACK}_f{FRAME}.npz")
    return {
        "hh": hh["power"].astype("float32"),
        "hv": extra["hv"].astype("float32"),
        "looks": extra["looks"].astype("float32"),
        "x": hh["x"], "y": hh["y"], "epsg": int(hh["epsg"]),
    }


def prepare(power, height, width):
    """Power window -> averaged linear intensity."""
    power = power[:height, :width]
    power = np.where(power > 0, power, np.nan)
    lin = block_mean(power, BLOCK)
    if SMOOTH > 1:
        lin = box_mean(lin, SMOOTH)
    return lin.astype("float32")


def estimate_enl(lin):
    """Estimates the real number of looks from the flattest 24x24-pixel patches."""
    k = 24
    h = (lin.shape[0] // k) * k
    w = (lin.shape[1] // k) * k
    blocks = lin[:h, :w].reshape(h // k, k, w // k, k)
    mean = np.nanmean(blocks, axis=(1, 3))
    var = np.nanvar(blocks, axis=(1, 3))
    ok = np.isfinite(mean) & (mean > 0)
    cv2 = var[ok] / (mean[ok] ** 2)
    return {p: 1.0 / float(np.percentile(cv2, p)) for p in (2, 5, 10)}


def make_overlay(diff, final, confirmed, threshold):
    top = max(FULL_DB, threshold + 3.0)
    strength = np.clip((np.abs(diff) - threshold) / (top - threshold), 0, 1)
    alpha = np.where(final, 90 + 130 * strength, 0)
    alpha = np.where(final & ~confirmed, alpha * 0.65, alpha)
    rgba = np.zeros(diff.shape + (4,), dtype=np.uint8)
    rgba[final & (diff < 0), :3] = DARKER_COLOR
    rgba[final & (diff > 0), :3] = BRIGHTER_COLOR
    rgba[..., 3] = np.nan_to_num(alpha).astype(np.uint8)
    return rgba


# ------------------------------------------------------------------- main
def main():
    all_dates = [d for _, dates in PERIODS for d in dates]
    missing = []
    for d in all_dates:
        for name in (f"{d}_t{TRACK}_f{FRAME}.npz", f"extra_{d}_t{TRACK}_f{FRAME}.npz"):
            if not (RAW_DIR / name).exists():
                missing.append(name)
    if missing:
        print("These saved files are missing. Run process_jamuna.py and fetch_more_layers.py first:")
        for name in missing:
            print("  ", name)
        return

    print(f"Loading {len(all_dates)} dates from disk ...")
    data = {d: load_date(d) for d in all_dates}
    height = min(v["hh"].shape[0] for v in data.values())
    width = min(v["hh"].shape[1] for v in data.values())
    looks_file = float(np.nanmedian(data[all_dates[0]]["looks"]))
    print(f"Window size {height} x {width} pixels. Number of looks stored in the files: about {looks_file:.1f}")

    lin_hh = {d: prepare(data[d]["hh"], height, width) for d in all_dates}
    lin_hv = {d: prepare(data[d]["hv"], height, width) for d in all_dates}
    db_hh = {d: to_db(lin_hh[d]) for d in all_dates}
    db_hv = {d: to_db(lin_hv[d]) for d in all_dates}

    # ---- 1. Fix scene-wide brightness shifts using pixels that barely change ----
    stack_hh = np.stack([db_hh[d] for d in all_dates])
    stack_hv = np.stack([db_hv[d] for d in all_dates])
    mean_hh = np.nanmean(stack_hh, axis=0)
    std_hh = np.nanstd(stack_hh, axis=0)
    mean_hv = np.nanmean(stack_hv, axis=0)
    candidates = np.isfinite(mean_hh) & (mean_hh > -12.0)
    cut = np.nanpercentile(std_hh[candidates], 10)
    stable = candidates & (std_hh <= cut)
    print(f"\nStable reference pixels: {int(stable.sum())} ({stable.mean() * 100:.1f}% of the window)")
    print("Brightness offset of each date relative to the average (dB). Near 0 = no calibration problem.")
    print("date          HH offset   HV offset")
    for i, d in enumerate(all_dates):
        off_hh = float(np.nanmedian(stack_hh[i][stable] - mean_hh[stable]))
        off_hv = float(np.nanmedian(stack_hv[i][stable] - mean_hv[stable]))
        print(f"{d}   {off_hh:+8.2f}   {off_hv:+8.2f}")
        lin_hh[d] = lin_hh[d] * 10.0 ** (-off_hh / 10.0)
        lin_hv[d] = lin_hv[d] * 10.0 ** (-off_hv / 10.0)
    del stack_hh, stack_hv

    # ---- 2. Measure the real number of looks ----
    estimates = [estimate_enl(lin_hh[d]) for d in all_dates]
    first = estimates[0]
    print("\nNumber of looks measured from the flattest patches (first date):")
    print(f"  using the 2% / 5% / 10% flattest patches: {first[2]:.1f} / {first[5]:.1f} / {first[10]:.1f}")
    enl_raw = float(np.median([e[5] for e in estimates]))
    enl = float(np.clip(enl_raw, looks_file, 80.0))
    note = "" if enl == enl_raw else f"  (limited from {enl_raw:.1f} to stay between the file value and 80)"
    print(f"Number of looks used for the significance test: {enl:.1f}{note}")

    # ---- 3. Average dates inside each period ----
    composites = []
    for label, dates in PERIODS:
        composites.append({
            "label": label, "dates": dates,
            "hh": to_db(np.mean([lin_hh[d] for d in dates], axis=0)),
            "hv": to_db(np.mean([lin_hv[d] for d in dates], axis=0)),
            "looks": enl * len(dates),
        })

    # ---- 4. Where is the picture on the map? ----
    x, y, epsg = data[all_dates[0]]["x"], data[all_dates[0]]["y"], data[all_dates[0]]["epsg"]
    spacing = float(abs(x[1] - x[0]))
    half = spacing / 2.0
    used_h = (height // BLOCK) * BLOCK
    used_w = (width // BLOCK) * BLOCK
    x_left, x_right = float(x[0] - half), float(x[used_w - 1] + half)
    y_top, y_bottom = float(y[0] + half), float(y[used_h - 1] - half)
    to_lonlat = Transformer.from_crs(f"EPSG:{epsg}", "EPSG:4326", always_xy=True)
    corners = [
        list(to_lonlat.transform(x_left, y_top)), list(to_lonlat.transform(x_right, y_top)),
        list(to_lonlat.transform(x_right, y_bottom)), list(to_lonlat.transform(x_left, y_bottom)),
    ]
    corners = [[round(lon, 6), round(lat, 6)] for lon, lat in corners]
    lons = [c[0] for c in corners]
    lats = [c[1] for c in corners]
    bounds = [min(lons), min(lats), max(lons), max(lats)]  # west, south, east, north

    for old in list(OUT_DIR.glob("*.png")) + list(OUT_DIR.glob("*.json")):
        old.unlink()

    # ---- 5. Radar brightness picture for every date ----
    sample = np.concatenate([db_hh[d][np.isfinite(db_hh[d])][::25] for d in all_dates])
    low, high = [float(v) for v in np.percentile(sample, [2, 98])]
    radar = []
    for d in all_dates:
        db = to_db(lin_hh[d])  # after the brightness fix
        gray = np.clip((np.nan_to_num(db, nan=low) - low) / (high - low), 0, 1)
        Image.fromarray((gray * 255).astype(np.uint8)).save(OUT_DIR / f"sar_{d}.png", optimize=True)
        radar.append({"date": d, "sar": f"sar_{d}.png"})

    # ---- 6. Significant-change pictures ----
    print("\nChange test (99% confidence). 'measured' = real spread of the differences in the data.")
    print("pair                                   threshold  predicted noise  measured    darker  brighter  both channels")
    changes, shown, diagnostics = [], [], None
    for a, b in PAIRS:
        A, B = composites[a], composites[b]
        sigma = DB_PER_NEPER * float(np.sqrt(trigamma(A["looks"]) + trigamma(B["looks"])))
        threshold = Z_SCORE * sigma

        diff_hh = B["hh"] - A["hh"]  # later minus earlier
        diff_hv = B["hv"] - A["hv"]
        measured = 1.4826 * float(np.nanmedian(np.abs(diff_hh - np.nanmedian(diff_hh))))

        sig_hh = np.isfinite(diff_hh) & (np.abs(diff_hh) > threshold)
        final = sig_hh & (box_mean(sig_hh.astype("float32"), 3) >= 0.33)  # drops isolated specks
        sig_hv = np.isfinite(diff_hv) & (np.abs(diff_hv) > threshold)
        confirmed = final & sig_hv & (np.sign(diff_hv) == np.sign(diff_hh))

        valid = np.isfinite(diff_hh)
        darker = float((final & (diff_hh < 0)).sum()) / valid.sum() * 100
        brighter = float((final & (diff_hh > 0)).sum()) / valid.sum() * 100
        both = float(confirmed.sum()) / max(int(final.sum()), 1) * 100

        name = f"change_{a + 1}_to_{b + 1}.png"
        overlay = make_overlay(diff_hh, final, confirmed, threshold)
        Image.fromarray(overlay).save(OUT_DIR / name, optimize=True)
        shown.append((A["label"], B["label"], overlay, A["hh"]))
        if diagnostics is None:
            diagnostics = (diff_hh, sigma, measured, A["label"], B["label"])

        text = f"{A['label']} -> {B['label']}"
        print(f"{text:<38} {threshold:7.1f} dB  {sigma:10.2f} dB  {measured:7.2f} dB  {darker:6.1f}%  {brighter:7.1f}%  {both:9.0f}%")
        changes.append({
            "from": A["label"], "to": B["label"], "from_dates": A["dates"], "to_dates": B["dates"],
            "file": name, "threshold_db": round(threshold, 2),
            "predicted_noise_db": round(sigma, 2), "measured_spread_db": round(measured, 2),
            "darker_percent": round(darker, 1), "brighter_percent": round(brighter, 1),
            "hv_agrees_percent": round(both, 0),
        })

    # ---- 7. meta.json for the app ----
    meta = {
        "place_id": PLACE_ID, "title": "Jamuna river, Bangladesh",
        "change_type": "river and monsoon surface change",
        "source": "NASA-ISRO NISAR L2 GCOV, PROVISIONAL (CRID P05023), L-band HH and HV",
        "track": TRACK, "frame": FRAME, "direction": DIRECTION,
        "pixel_size_m": spacing * BLOCK, "corners_lonlat": corners,
        "bounds_west_south_east_north": bounds,
        "brightness_stretch_db": [round(low, 2), round(high, 2)],
        "method": {
            "periods": [{"label": c["label"], "dates": c["dates"]} for c in composites],
            "number_of_looks_used": round(enl, 1), "confidence_level": 0.99,
            "steps": ["scene-wide brightness correction using stable pixels",
                      "dates averaged into periods", "per-pixel significance test",
                      "isolated pixels removed", "HV used as second opinion"],
        },
        "legend": {
            "darker": "Darker in the later period: smoother or wetter-looking surface (for example more water).",
            "brighter": "Brighter in the later period: rougher or drier surface (for example exposed sand or growing crops).",
            "strong_colour": "HH and HV radar channels agree.", "pale_colour": "Only the HH channel shows the change.",
        },
        "dates": radar, "changes": changes,
        "note": ("Radar brightness change, not a direct flood map. The cause is likely, not certain. "
                 "NISAR data is PROVISIONAL and not yet fully validated."),
    }
    with open(OUT_DIR / "meta.json", "w", encoding="utf-8") as file:
        json.dump(meta, file, indent=2)

    # ---- 8. Check pictures for us ----
    columns = 4
    rows_count = int(np.ceil(len(shown) / columns))
    figure, axes = plt.subplots(rows_count, columns, figsize=(15, 4.4 * rows_count))
    axes = np.atleast_1d(axes).ravel()
    for axis in axes:
        axis.axis("off")
    for axis, (first_label, last_label, overlay, base) in zip(axes, shown):
        axis.imshow(base, cmap="gray", vmin=low, vmax=high)
        axis.imshow(overlay)
        axis.set_title(f"{first_label}  ->  {last_label}", fontsize=9)
    figure.tight_layout()
    figure.savefig(OUT_DIR / "check_stage1.png", dpi=70)
    plt.close(figure)

    diff_hh, sigma, measured, first_label, last_label = diagnostics
    values = diff_hh[np.isfinite(diff_hh)]
    values = values[np.abs(values) < 12]
    figure, axis = plt.subplots(figsize=(8, 4))
    axis.hist(values, bins=200, density=True, color="#8aa0c8", label="measured differences")
    grid = np.linspace(-12, 12, 400)
    for width_db, color, text in ((sigma, "#f28e2b", "predicted noise"),
                                  (measured, "#1e88e5", "measured spread")):
        axis.plot(grid, np.exp(-grid ** 2 / (2 * width_db ** 2)) / (width_db * np.sqrt(2 * np.pi)),
                  color=color, linewidth=2, label=f"{text} {width_db:.2f} dB")
    axis.set_xlabel(f"brightness change {first_label} -> {last_label} (dB)")
    axis.set_ylabel("share of pixels")
    axis.legend()
    figure.tight_layout()
    figure.savefig(OUT_DIR / "noise_check.png", dpi=100)
    plt.close(figure)

    total = sum(f.stat().st_size for f in OUT_DIR.iterdir()) / 1e6
    print(f"\nSaved {len(list(OUT_DIR.iterdir()))} files ({total:.1f} MB) to: {OUT_DIR}")
    print("Open check_stage1.png and noise_check.png in that folder and send them to me.")


if __name__ == "__main__":
    main()