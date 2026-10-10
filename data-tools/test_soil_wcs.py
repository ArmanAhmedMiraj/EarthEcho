# test_soil_wcs.py
# Does ISRIC's SoilGrids map service (WCS) give different soils for different places?
# Waits between calls because ISRIC's fair use is 5 calls per minute.

import time

import numpy as np
import rasterio
import requests
from rasterio.io import MemoryFile

BASE = "https://maps.isric.org/mapserv?map=/map/{prop}.map"
CRS = "http://www.opengis.net/def/crs/EPSG/0/4326"

PLACES = [
    ("Rangpur", 25.75, 89.25),
    ("Kurigram chars", 25.80, 89.65),
    ("Sunamganj haor", 25.00, 91.40),
    ("Dhaka", 23.81, 90.41),
    ("Barishal", 22.70, 90.37),
    ("Satkhira coast", 22.70, 89.07),
    ("Cox's Bazar", 21.45, 91.98),
]


def usda(sand, clay):
    """Simplified USDA texture triangle (sand and clay in %)."""
    silt = 100 - sand - clay
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
    return "unclassified"


def get_value(prop, lat, lon):
    """Median of a small box around the point. Returns percent, or None."""
    half = 0.02
    url = (
        BASE.format(prop=prop)
        + f"&SERVICE=WCS&VERSION=2.0.1&REQUEST=GetCoverage&COVERAGEID={prop}_0-5cm_mean"
        + "&FORMAT=image/tiff"
        + f"&SUBSET=long({lon - half},{lon + half})&SUBSET=lat({lat - half},{lat + half})"
        + f"&SUBSETTINGCRS={CRS}&OUTPUTCRS={CRS}"
    )
    response = requests.get(url, timeout=90)
    if response.status_code != 200 or response.content[:2] not in (b"II", b"MM"):
        print(f"      {prop}: HTTP {response.status_code}, reply starts: {response.text[:160]!r}")
        return None
    with MemoryFile(response.content) as memory, memory.open() as src:
        data = src.read(1).astype("float64")
    data = data[data >= 0]  # drop no-data (negative values)
    if data.size == 0:
        print(f"      {prop}: no valid pixels")
        return None
    return float(np.median(data)) / 10  # SoilGrids stores g/kg, so divide by 10 for %


print("Testing ISRIC WCS. About 3 minutes because of the waiting.\n")
for name, lat, lon in PLACES:
    clay = get_value("clay", lat, lon)
    time.sleep(13)
    sand = get_value("sand", lat, lon)
    time.sleep(13)
    if clay is None or sand is None:
        print(f"{name:<16} FAILED")
        continue
    print(f"{name:<16} clay {clay:4.1f}%  sand {sand:4.1f}%  silt {100 - clay - sand:4.1f}%  ->  {usda(sand, clay)}")