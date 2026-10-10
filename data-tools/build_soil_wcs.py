# build_soil_wcs.py
# EarthEcho Farm - build a small soil-texture map of Bangladesh from ISRIC SoilGrids 2.0
# (0-5 cm clay and sand, via ISRIC's WCS map service, CC BY 4.0).
# This is a model estimate, not a field measurement.
#
# Downloads 1 x 1 degree tiles slowly (ISRIC fair use is 5 calls per minute),
# saves each tile in data-raw/soil/wcs so a re-run resumes, and writes public/soil_bd.json.

import json
import time
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import rasterio
import requests
from matplotlib.patches import Patch

PROJECT = Path(__file__).resolve().parent.parent
CACHE = PROJECT / "data-raw" / "soil" / "wcs"
OUT = PROJECT / "public" / "soil_bd.json"
PICTURE = PROJECT / "data-raw" / "soil" / "soil_check.png"
CACHE.mkdir(parents=True, exist_ok=True)
OUT.parent.mkdir(parents=True, exist_ok=True)

LON_TILES = range(88, 93)   # tiles cover 88 to 93 east
LAT_TILES = range(20, 27)   # tiles cover 20 to 27 north
PAUSE = 13                  # seconds between calls
CELL = 0.02                 # output cell size in degrees (about 2 km)
HALF_WINDOW = 4             # median over about +/- 4 pixels around each cell centre

BASE = "https://maps.isric.org/mapserv?map=/map/{prop}.map"
CRS = "http://www.opengis.net/def/crs/EPSG/0/4326"

CLASSES = ["", "Clay", "Silty Clay", "Sandy Clay", "Clay Loam", "Silty Clay Loam",
           "Sandy Clay Loam", "Loam", "Silty Loam", "Sandy Loam", "Silt", "Loamy Sand", "Sand"]


def usda(sand, clay):
    """Simplified USDA texture triangle (sand and clay in %)."""
    silt = max(0.0, 100 - sand - clay)
    if silt + 1.5 * clay < 15:
        return "Sand"
    if silt + 1.5 * clay >= 15 and silt + 2 * clay < 30:
        return "Loamy Sand"
    if (7 <= clay < 20 and sand > 52 and silt + 2 * clay >= 30) or (clay < 7 and silt < 50 and silt + 2 * clay >= 30):
        return "Sandy Loam"
    if 7 <= clay < 27 and 28 <= silt < 50 and sand <= 52:
        return "Loam"
    if (silt >= 50 and 12 <= clay < 27) or (50 <= silt < 80 and clay < 12):
        return "Silty Loam"
    if silt >= 80 and clay < 12:
        return "Silt"
    if 20 <= clay < 35 and silt < 28 and sand > 45:
        return "Sandy Clay Loam"
    if 27 <= clay < 40 and 20 < sand <= 45:
        return "Clay Loam"
    if 27 <= clay < 40 and sand <= 20:
        return "Silty Clay Loam"
    if clay >= 35 and sand > 45:
        return "Sandy Clay"
    if clay >= 40 and silt >= 40:
        return "Silty Clay"
    if clay >= 40 and sand <= 45 and silt < 40:
        return "Clay"
    return ""


def fetch_tile(prop, lat0, lon0):
    path = CACHE / f"{prop}_{lat0}_{lon0}.tif"
    if path.exists():
        return path
    url = (
        BASE.format(prop=prop)
        + f"&SERVICE=WCS&VERSION=2.0.1&REQUEST=GetCoverage&COVERAGEID={prop}_0-5cm_mean"
        + "&FORMAT=image/tiff"
        + f"&SUBSET=long({lon0},{lon0 + 1})&SUBSET=lat({lat0},{lat0 + 1})"
        + f"&SUBSETTINGCRS={CRS}&OUTPUTCRS={CRS}"
    )
    for attempt in range(1, 4):
        try:
            response = requests.get(url, timeout=180)
            if response.status_code == 200 and response.content[:2] in (b"II", b"MM"):
                path.write_bytes(response.content)
                time.sleep(PAUSE)
                return path
            print(f"      {prop} {lat0}N {lon0}E attempt {attempt}: HTTP {response.status_code}, "
                  f"reply starts {response.text[:120]!r}")
        except Exception as error:
            print(f"      {prop} {lat0}N {lon0}E attempt {attempt}: {type(error).__name__}")
        time.sleep(20)
    return None


def load_tile(path):
    with rasterio.open(path) as src:
        array = src.read(1).astype("float32")
        transform = src.transform
        nodata = src.nodata
    if nodata is not None:
        array[array == nodata] = np.nan
    array[array <= 0] = np.nan  # zero or negative = missing, never real clay or sand
    return array, transform, nodata


def sample(array, transform, lon, lat):
    col = int((lon - transform.c) / transform.a)
    row = int((lat - transform.f) / transform.e)
    r0, r1 = max(0, row - HALF_WINDOW), min(array.shape[0], row + HALF_WINDOW + 1)
    c0, c1 = max(0, col - HALF_WINDOW), min(array.shape[1], col + HALF_WINDOW + 1)
    if r0 >= r1 or c0 >= c1:
        return np.nan
    block = array[r0:r1, c0:c1]
    values = block[np.isfinite(block)]
    return float(np.median(values)) / 10 if values.size >= 3 else np.nan  # g/kg to %


# ---- 1. download tiles ----
total = len(LON_TILES) * len(LAT_TILES) * 2
print(f"Downloading up to {total} tiles, about {total * (PAUSE + 3) / 60:.0f} minutes. "
      "You can stop with Ctrl+C and run it again to resume.\n")
tiles = {}
failed = []
done = 0
for lat0 in LAT_TILES:
    for lon0 in LON_TILES:
        for prop in ("clay", "sand"):
            done += 1
            path = fetch_tile(prop, lat0, lon0)
            if path is None:
                failed.append(f"{prop} {lat0}N {lon0}E")
                continue
            array, transform, nodata = load_tile(path)
            tiles[(prop, lat0, lon0)] = (array, transform)
            valid = np.isfinite(array).mean() * 100
            print(f"[{done}/{total}] {prop:<4} {lat0}N {lon0}E  size {array.shape}  "
                  f"valid {valid:5.1f}%  nodata={nodata}", flush=True)

# ---- 2. build the grid ----
lons = np.arange(88.01, 92.8, CELL)
lats = np.arange(26.79, 20.5, -CELL)
grid = np.zeros((len(lats), len(lons)), dtype="int32")
name_to_index = {n: i for i, n in enumerate(CLASSES) if n}

print("\nBuilding the grid ...")
for i, lat in enumerate(lats):
    lat0 = int(np.floor(lat))
    for j, lon in enumerate(lons):
        lon0 = int(np.floor(lon))
        clay_tile = tiles.get(("clay", lat0, lon0))
        sand_tile = tiles.get(("sand", lat0, lon0))
        if not clay_tile or not sand_tile:
            continue
        clay = sample(clay_tile[0], clay_tile[1], lon, lat)
        sand = sample(sand_tile[0], sand_tile[1], lon, lat)
        if np.isfinite(clay) and np.isfinite(sand):
            grid[i, j] = name_to_index.get(usda(sand, clay), 0)

lut = np.array(["0"] + [chr(96 + k) for k in range(1, 13)])
rows = ["".join(r) for r in lut[grid]]
result = {
    "source": "ISRIC SoilGrids 2.0, 0-5 cm clay and sand, 250 m, CC BY 4.0. Model estimate.",
    "lon0": float(lons[0]), "lat0": float(lats[0]), "dlon": CELL, "dlat": -CELL,
    "cols": int(grid.shape[1]), "rows": int(grid.shape[0]),
    "classes": CLASSES, "grid": rows,
}
OUT.write_text(json.dumps(result), encoding="utf-8")
print(f"Saved {OUT}  ({OUT.stat().st_size / 1e3:.0f} KB, {grid.shape[0]} x {grid.shape[1]} cells)")

# ---- 3. checks ----
counts = np.bincount(grid.ravel(), minlength=13)
land = int(counts[1:].sum())
print(f"\nCells with soil data: {land} of {grid.size}")
for k in range(1, 13):
    if counts[k]:
        print(f"   {CLASSES[k]:<18} {counts[k] / max(land, 1) * 100:5.1f}%")
if failed:
    print("\nTiles that failed (ocean tiles may fail normally; run again to retry):")
    for item in failed:
        print("   ", item)


def look(lat, lon):
    col0 = round((lon - result["lon0"]) / CELL)
    row0 = round((lat - result["lat0"]) / -CELL)
    for radius in range(0, 6):
        for dr in range(-radius, radius + 1):
            for dc in range(-radius, radius + 1):
                if max(abs(dr), abs(dc)) != radius:
                    continue
                r, c = row0 + dr, col0 + dc
                if 0 <= r < grid.shape[0] and 0 <= c < grid.shape[1] and grid[r, c]:
                    return CLASSES[grid[r, c]] + ("" if radius == 0 else f" (nearest, {radius} cells away)")
    return "no data"


print("\nSpot checks:")
for place, lat, lon in (
    ("Rangpur", 25.75, 89.25), ("Dhaka", 23.81, 90.41), ("Barishal", 22.70, 90.37),
    ("Kurigram chars", 25.80, 89.65), ("Bogura", 24.85, 89.37), ("Sunamganj haor", 25.00, 91.40),
    ("Chandpur", 23.23, 90.66), ("Satkhira coast", 22.70, 89.07), ("Cox's Bazar", 21.45, 91.98),
    ("Dinajpur", 25.63, 88.64), ("Bhola", 22.69, 90.65), ("Sylhet", 24.90, 91.87),
):
    print(f"   {place:<16} {look(lat, lon)}")

cmap = plt.get_cmap("tab20", 13)
figure, axis = plt.subplots(figsize=(7, 9))
axis.imshow(np.ma.masked_equal(grid, 0), cmap=cmap, vmin=0, vmax=12,
            extent=[lons[0] - CELL / 2, lons[-1] + CELL / 2, lats[-1] - CELL / 2, lats[0] + CELL / 2],
            interpolation="nearest")
present = [k for k in range(1, 13) if (grid == k).any()]
axis.legend(handles=[Patch(color=cmap(k), label=CLASSES[k]) for k in present], loc="lower left", fontsize=8)
axis.set_title("SoilGrids soil texture, 0-5 cm (white = no data)")
figure.tight_layout()
figure.savefig(PICTURE, dpi=90)
print("\nPicture saved:", PICTURE)