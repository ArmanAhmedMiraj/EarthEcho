# download_bangladesh.py
# EarthEcho - Bangladesh-wide radar, stage A (download and shrink).
#
# For tracks 069, 170 and 141 it takes every frame that touches Bangladesh and, for each
# frame, the EARLIEST and the LATEST date. It downloads the file, shrinks HH and HV to
# 40 m pixels, saves a small .npz, then DELETES the big file.
#
# It can be stopped at any time. Run the same command again and it continues where it left off.
#
#   python data-tools\download_bangladesh.py          (all 12 frames)
#   python data-tools\download_bangladesh.py 019      (extra: another track, e.g. 019)

import json
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import earthaccess
import h5py
import numpy as np

BOX = (88.0, 20.6, 92.7, 26.7)   # west, south, east, north
DATASET = "C2854338529-ASF"      # NISAR_L2_GCOV_PROVISIONAL_V1
TRACKS = sys.argv[1:] or ["069", "170", "141"]
BLOCK = 4                        # 10 m x 4 = 40 m pixels
STREAMS = 4                      # parallel pieces per download
PIECES = 16                      # each file is cut into this many byte ranges

PROJECT = Path(__file__).resolve().parent.parent
TEMP = PROJECT / "data-raw" / "bd_temp"
OUT = PROJECT / "data-raw" / "bangladesh"
PROGRESS = OUT / "progress.json"
TEMP.mkdir(parents=True, exist_ok=True)
OUT.mkdir(parents=True, exist_ok=True)

done = json.loads(PROGRESS.read_text()) if PROGRESS.exists() else {}


def save_progress():
    PROGRESS.write_text(json.dumps(done, indent=1))


def block_mean(values, k):
    h = (values.shape[0] // k) * k
    w = (values.shape[1] // k) * k
    values = values[:h, :w].astype("float32")
    values = np.where(values > 0, values, np.nan)
    return np.nanmean(values.reshape(h // k, k, w // k, k), axis=(1, 3))


def download(link, target, size):
    """Downloads one file as several parallel byte ranges."""
    session = earthaccess.get_requests_https_session()
    step = size // PIECES + 1
    ranges = [(i * step, min(size, (i + 1) * step) - 1) for i in range(PIECES)]
    with open(target, "wb") as f:
        f.truncate(size)

    def get(r):
        for attempt in range(4):
            try:
                resp = session.get(link, headers={"Range": f"bytes={r[0]}-{r[1]}"}, timeout=300)
                resp.raise_for_status()
                with open(target, "r+b") as f:
                    f.seek(r[0])
                    f.write(resp.content)
                return len(resp.content)
            except Exception:
                time.sleep(5 * (attempt + 1))
        raise RuntimeError("download piece failed")

    with ThreadPoolExecutor(max_workers=STREAMS) as pool:
        return sum(pool.map(get, ranges))


def file_size(link):
    session = earthaccess.get_requests_https_session()
    resp = session.get(link, headers={"Range": "bytes=0-0"}, timeout=120)
    return int(resp.headers["Content-Range"].split("/")[-1])


print("Signing in to NASA Earthdata (uses the login saved earlier)...")
earthaccess.login(persist=True)

print("Searching ...")
granules = earthaccess.search_data(
    concept_id=DATASET, bounding_box=BOX, temporal=("2026-06-17", "2026-10-09"), count=2000
)
frames = {}
for g in granules:
    name = g["meta"].get("native-id", "")
    m = re.search(r"_(\d{3})_([AD])_(\d{3})_", name)
    d = re.search(r"_(20\d{6})T", name)
    if not m or not d or m.group(1) not in TRACKS:
        continue
    frames.setdefault(m.groups(), []).append((d.group(1), g))

jobs = []
for key in sorted(frames):
    items = sorted(frames[key], key=lambda x: x[0])
    for label, (date, g) in (("start", items[0]), ("end", items[-1])):
        jobs.append((key, label, date, g))

print(f"{len(jobs)} files to process ({len(frames)} frames, 2 dates each)")
started_all = time.time()

for n, (key, label, date, g) in enumerate(jobs, 1):
    tag = f"t{key[0]}_{key[1]}_f{key[2]}_{label}_{date}"
    if done.get(tag) == "ok":
        print(f"[{n}/{len(jobs)}] {tag}: already done")
        continue
    links = [u for u in g.data_links() if u.endswith(".h5")]
    if not links:
        print(f"[{n}/{len(jobs)}] {tag}: no file link, skipped")
        done[tag] = "no link"
        save_progress()
        continue
    temp_file = TEMP / f"{tag}.h5"
    t0 = time.time()
    try:
        size = file_size(links[0])
        print(f"[{n}/{len(jobs)}] {tag}: downloading {size / 1e9:.1f} GB ...", flush=True)
        download(links[0], temp_file, size)
        t1 = time.time()
        with h5py.File(temp_file, "r") as h:
            grid = h["science/LSAR/GCOV/grids/frequencyA"]
            hh = block_mean(grid["HHHH"][:], BLOCK)
            hv = block_mean(grid["HVHV"][:], BLOCK) if "HVHV" in grid else np.full_like(hh, np.nan)
            x = grid["xCoordinates"][::BLOCK].astype("float64")
            y = grid["yCoordinates"][::BLOCK].astype("float64")
            epsg = int(grid["projection"][()])
        np.savez_compressed(
            OUT / f"{tag}.npz",
            hh=hh.astype("float32"), hv=hv.astype("float32"),
            x=x[: hh.shape[1]], y=y[: hh.shape[0]], epsg=epsg, pixel_m=10 * BLOCK,
        )
        done[tag] = "ok"
        print(f"      done: download {(t1 - t0) / 60:.0f} min, shrink {(time.time() - t1) / 60:.0f} min", flush=True)
    except Exception as error:
        done[tag] = f"failed: {error}"
        print(f"      FAILED: {error}", flush=True)
    finally:
        if temp_file.exists():
            temp_file.unlink()
        save_progress()

ok = sum(1 for v in done.values() if v == "ok")
print(f"\nFinished in {(time.time() - started_all) / 3600:.1f} hours. {ok} files ok, "
      f"{len(done) - ok} failed or skipped.")
print("If some failed, run the same command again: it retries only those.")