# test_parallel_download.py
# EarthEcho - how fast are several downloads at the same time, and is there enough disk space?
# Downloads only 100 MB pieces and throws them away.

import re
import shutil
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import earthaccess

BOX = (88.0, 20.6, 92.7, 26.7)   # west, south, east, north
DATASET = "C2854338529-ASF"      # NISAR_L2_GCOV_PROVISIONAL_V1
PIECE = 100_000_000              # bytes per test download

drive = Path(__file__).resolve().anchor
total, used, free = shutil.disk_usage(drive)
print(f"Disk {drive}: {free / 1e9:.0f} GB free of {total / 1e9:.0f} GB")

print("\nSigning in to NASA Earthdata (uses the login saved earlier)...")
earthaccess.login(persist=True)

granules = earthaccess.search_data(
    concept_id=DATASET, bounding_box=BOX, temporal=("2026-06-17", "2026-07-02"), count=300
)
picked = {}
for g in granules:
    name = g["meta"].get("native-id", "")
    m = re.search(r"_(\d{3})_([AD])_(\d{3})_", name)
    if m and m.group(1) in ("069", "170", "141") and m.groups() not in picked:
        links = [u for u in g.data_links() if u.endswith(".h5")]
        if links:
            picked[m.groups()] = links[0]
links = list(picked.values())
print(f"{len(links)} different frames available for the test")
if len(links) < 8:
    print("Fewer than 8 frames, the 8-stream test will reuse files.")


def fetch(args):
    link, start = args
    session = earthaccess.get_requests_https_session()
    response = session.get(
        link, headers={"Range": f"bytes={start}-{start + PIECE - 1}"}, stream=True, timeout=180
    )
    received = 0
    for chunk in response.iter_content(chunk_size=1024 * 1024):
        received += len(chunk)
    return received


offset = 500_000_000
for streams in (1, 4, 8):
    jobs = [(links[i % len(links)], offset + i * PIECE) for i in range(streams)]
    offset += 2_000_000_000  # new part of the files each round, so nothing is cached
    started = time.time()
    with ThreadPoolExecutor(max_workers=streams) as pool:
        received = sum(pool.map(fetch, jobs))
    seconds = time.time() - started
    speed = received / 1e6 / max(seconds, 0.001)
    print(f"{streams} at the same time: {received / 1e6:.0f} MB in {seconds:.0f} s = {speed:.1f} MB/s in total")