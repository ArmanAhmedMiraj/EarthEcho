# plan_bangladesh.py
# EarthEcho - plan the Bangladesh-wide radar run.
#   1. Reads the footprint of every frame and reports how much of Bangladesh each track covers.
#   2. Tests the real download speed with a 100 MB piece of ONE file (not the whole file).
# It saves nothing except a small test file that is deleted at the end.

import re
import time
from collections import defaultdict
from pathlib import Path

import earthaccess
import numpy as np
from matplotlib.path import Path as PolyPath

BOX = (88.0, 20.6, 92.7, 26.7)  # west, south, east, north
START, END = "2026-06-17", "2026-10-09"
DATASET = "C2854338529-ASF"     # NISAR_L2_GCOV_PROVISIONAL_V1

print("Signing in to NASA Earthdata (uses the login saved earlier)...")
earthaccess.login(persist=True)

print("Searching ...")
granules = earthaccess.search_data(
    concept_id=DATASET, bounding_box=BOX, temporal=(START, END), count=2000
)
print(f"{len(granules)} files found")


def polygon_of(granule):
    try:
        geometry = granule["umm"]["SpatialExtent"]["HorizontalSpatialDomain"]["Geometry"]
        points = geometry["GPolygons"][0]["Boundary"]["Points"]
        return [(p["Longitude"], p["Latitude"]) for p in points]
    except Exception:
        return None


def size_gb_of(granule):
    try:
        total = 0.0
        for item in granule["umm"]["DataGranule"]["ArchiveAndDistributionInformation"]:
            unit = item.get("SizeUnit", "MB")
            size = item.get("Size", item.get("SizeInBytes", 0)) or 0
            if "SizeInBytes" in item and "Size" not in item:
                total += size / 1e9
            elif unit.upper().startswith("GB"):
                total += size
            elif unit.upper().startswith("MB"):
                total += size / 1000.0
            elif unit.upper().startswith("KB"):
                total += size / 1e6
            else:
                total += size / 1e9
        return total
    except Exception:
        return 0.0


# group files by track + direction + frame
frames = defaultdict(list)
for g in granules:
    name = g["meta"].get("native-id", "")
    m = re.search(r"_(\d{3})_([AD])_(\d{3})_", name)
    d = re.search(r"_(20\d{6})T", name)
    poly = polygon_of(g)
    if not m or not d or not poly:
        continue
    frames[(m.group(1), m.group(2), m.group(3))].append(
        {"date": d.group(1), "poly": poly, "granule": g, "size": size_gb_of(g)}
    )

# grid of test points over the Bangladesh box
lon_grid, lat_grid = np.meshgrid(np.linspace(88.1, 92.6, 90), np.linspace(20.7, 26.6, 118))
points = np.column_stack([lon_grid.ravel(), lat_grid.ravel()])


def covered(keys):
    """Share of grid points inside at least one frame of the given tracks."""
    hit = np.zeros(len(points), dtype=bool)
    for key in frames:
        if (key[0], key[1]) in keys:
            hit |= PolyPath(frames[key][0]["poly"]).contains_points(points)
    return hit.mean() * 100


tracks = defaultdict(list)
for key, items in frames.items():
    tracks[(key[0], key[1])].append((key[2], len({i["date"] for i in items}), items[0]["size"]))

print("\n=== Each track: share of the Bangladesh box it covers ===")
print("track dir  frames  dates  GB/file  covers")
for t in sorted(tracks):
    info = tracks[t]
    dates = min(n for _, n, _ in info)
    size = np.mean([s for _, _, s in info])
    print(f"{t[0]}   {t[1]}    {len(info):4d}   {dates:5d}  {size:7.1f}  {covered({t}):5.1f}%")

asc = {t for t in tracks if t[1] == "A"}
desc = {t for t in tracks if t[1] == "D"}
print(f"\nAll ascending tracks together : {covered(asc):.1f}% of the box")
print(f"All descending tracks together: {covered(desc):.1f}% of the box")
print(f"Everything together           : {covered(asc | desc):.1f}% of the box")

# greedy pick: fewest tracks that cover the most
chosen, remaining = set(), set(tracks)
print("\nGreedy choice (each step adds the track that covers the most new area):")
while remaining:
    best = max(remaining, key=lambda t: covered(chosen | {t}))
    gain = covered(chosen | {best}) - covered(chosen)
    if gain < 2.0:
        break
    chosen.add(best)
    remaining.remove(best)
    print(f"   + track {best[0]} {best[1]}  -> total {covered(chosen):.1f}%")

# ---- download speed test: first 100 MB of one file ----
print("\nDownload speed test (100 MB of one file) ...")
test = None
for key in sorted(frames):
    if key[0] == "069" and key[2] == "014":
        test = frames[key][0]["granule"]
        break
if test is None:
    test = next(iter(frames.values()))[0]["granule"]
links = [u for u in test.data_links() if u.endswith(".h5")]
if not links:
    print("No .h5 link found. Send me this output.")
    raise SystemExit
session = earthaccess.get_requests_https_session()
started = time.time()
response = session.get(links[0], headers={"Range": "bytes=0-99999999"}, stream=True, timeout=120)
received = 0
for chunk in response.iter_content(chunk_size=1024 * 1024):
    received += len(chunk)
seconds = time.time() - started
speed = received / 1e6 / max(seconds, 0.001)
print(f"Status {response.status_code}: got {received / 1e6:.0f} MB in {seconds:.0f} s = {speed:.1f} MB/s")
if speed > 0:
    print(f"A 7 GB file would take about {7000 / speed / 60:.0f} minutes at this speed.")