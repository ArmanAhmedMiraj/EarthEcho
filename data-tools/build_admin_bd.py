# build_admin_bd.py
# EarthEcho Farm - build small Bangladesh boundary files (division, district, upazila/thana, union).
#
# Source: geoBoundaries gbOpen (CC BY 4.0), https://www.geoboundaries.org
# The source files do not say which district an upazila belongs to, so the script works that out
# by checking which parent polygon contains a point inside each child.
#
# Writes to public/admin:
#   country.json, divisions.json, districts.json, upazilas.json   (shapes + names)
#   unions/<districtId>.json                                      (unions of one district)
#   search_index.json                                             (names for the search box)

import json
import time
from collections import defaultdict
from pathlib import Path

import requests
from shapely import STRtree
from shapely.geometry import Point, mapping, shape
from shapely.ops import unary_union

PROJECT = Path(__file__).resolve().parent.parent
RAW = PROJECT / "data-raw" / "admin"
OUT = PROJECT / "public" / "admin"
RAW.mkdir(parents=True, exist_ok=True)
(OUT / "unions").mkdir(parents=True, exist_ok=True)

API = "https://www.geoboundaries.org/api/current/gbOpen/BGD/{level}/"
TOLERANCE = {"ADM0": 0.003, "ADM1": 0.002, "ADM2": 0.0012, "ADM3": 0.0006, "ADM4": 0.0004}
PREFIX = {"ADM1": "B", "ADM2": "Z", "ADM3": "U", "ADM4": "N"}
LEVEL_NAME = {"ADM1": "division", "ADM2": "district", "ADM3": "upazila", "ADM4": "union"}


def download(level):
    path = RAW / f"BGD_{level}.geojson"
    if path.exists() and path.stat().st_size > 1000:
        print(f"{level}: already downloaded ({path.stat().st_size / 1e6:.1f} MB)")
        return path
    print(f"{level}: asking geoBoundaries ...")
    meta = requests.get(API.format(level=level), timeout=90).json()
    if isinstance(meta, list):
        meta = meta[0]
    print(f"   source: {meta.get('boundarySource')}  | licence: {meta.get('boundaryLicense')}  "
          f"| year: {meta.get('boundaryYearRepresented')}")
    url = meta.get("gjDownloadURL")
    if not url:
        raise RuntimeError(f"{level}: no download link in the reply: {str(meta)[:200]}")
    for attempt in range(1, 4):
        try:
            response = requests.get(url, timeout=600)
            response.raise_for_status()
            path.write_bytes(response.content)
            print(f"   downloaded {len(response.content) / 1e6:.1f} MB")
            return path
        except Exception as error:
            print(f"   attempt {attempt} failed: {type(error).__name__}")
            time.sleep(10)
    raise RuntimeError(f"{level}: download failed")


def load(level):
    data = json.loads(download(level).read_text(encoding="utf-8"))
    items = []
    for feature in data["features"]:
        geom = shape(feature["geometry"])
        if not geom.is_valid:
            geom = geom.buffer(0)
        name = (feature["properties"].get("shapeName") or "").strip() or "Unnamed"
        items.append({"name": name, "geom": geom})
    items.sort(key=lambda item: item["name"])
    if level in PREFIX:
        for i, item in enumerate(items, start=1):
            item["id"] = f"{PREFIX[level]}{i}"
            item["level"] = LEVEL_NAME[level]
    return items


def rnd(value):
    if isinstance(value, float):
        return round(value, 4)
    if isinstance(value, (list, tuple)):
        return [rnd(v) for v in value]
    return value


def geometry_json(geom, tolerance):
    simple = geom.simplify(tolerance, preserve_topology=True)
    if simple.is_empty:
        simple = geom
    m = mapping(simple)
    return {"type": m["type"], "coordinates": rnd(m["coordinates"])}


def assign_parents(children, parents):
    tree = STRtree([p["geom"] for p in parents])
    loose = 0
    for child in children:
        point = child["geom"].representative_point()
        hits = tree.query(point, predicate="intersects")
        if len(hits):
            index = int(hits[0])
        else:
            index = int(tree.nearest(point))
            loose += 1
        child["parent"] = parents[index]["id"]
    return loose


def write(path, obj):
    path.write_text(json.dumps(obj, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")


# ---- load every level ----
country_items = []
raw0 = json.loads(download("ADM0").read_text(encoding="utf-8"))
country_geom = unary_union([shape(f["geometry"]).buffer(0) for f in raw0["features"]])

levels = {}
for level in ("ADM1", "ADM2", "ADM3", "ADM4"):
    try:
        levels[level] = load(level)
        print(f"{level}: {len(levels[level])} {LEVEL_NAME[level]}s")
    except Exception as error:
        print(f"{level}: not available ({error})")

if not {"ADM1", "ADM2", "ADM3"} <= set(levels):
    print("\nDivisions, districts or upazilas are missing. Send me this output.")
    raise SystemExit

print("\nDivisions:", ", ".join(item["name"] for item in levels["ADM1"]))

# ---- work out parents ----
by_id = {}
for level in levels:
    for item in levels[level]:
        by_id[item["id"]] = item

pairs = [("ADM2", "ADM1"), ("ADM3", "ADM2"), ("ADM4", "ADM3")]
for child_level, parent_level in pairs:
    if child_level in levels:
        loose = assign_parents(levels[child_level], levels[parent_level])
        print(f"{LEVEL_NAME[child_level]} -> {LEVEL_NAME[parent_level]}: parents set "
              f"({loose} had to be matched to the nearest because no polygon contained them)")


def path_of(item, include_self=False):
    names = [item["name"]] if include_self else []
    current = item
    while current.get("parent"):
        current = by_id[current["parent"]]
        names.append(current["name"])
    return ", ".join(names)


# ---- write files ----
def feature(item, tolerance, extra=None):
    geom = item["geom"]
    point = geom.representative_point()  # always inside the shape, unlike the centre
    minx, miny, maxx, maxy = geom.bounds
    props = {
        "id": item["id"], "name": item["name"], "parent": item.get("parent"),
        "lat": round(point.y, 4), "lon": round(point.x, 4),
        "bbox": [round(minx, 4), round(miny, 4), round(maxx, 4), round(maxy, 4)],
    }
    if extra:
        props.update(extra)
    return {"type": "Feature", "properties": props, "geometry": geometry_json(geom, tolerance)}


write(OUT / "country.json", {"type": "Feature", "properties": {"name": "Bangladesh"},
                              "geometry": geometry_json(country_geom, TOLERANCE["ADM0"])})
for level, filename in (("ADM1", "divisions"), ("ADM2", "districts"), ("ADM3", "upazilas")):
    write(OUT / f"{filename}.json", {
        "type": "FeatureCollection",
        "features": [feature(item, TOLERANCE[level]) for item in levels[level]],
    })

if "ADM4" in levels:
    per_district = defaultdict(list)
    for union in levels["ADM4"]:
        district_id = by_id[union["parent"]]["parent"]
        per_district[district_id].append(feature(union, TOLERANCE["ADM4"], {"district": district_id}))
    for district_id, features in per_district.items():
        write(OUT / "unions" / f"{district_id}.json", {"type": "FeatureCollection", "features": features})

search = []
for level in levels:
    for item in levels[level]:
        point = item["geom"].representative_point()
        minx, miny, maxx, maxy = item["geom"].bounds
        search.append({"l": item["level"], "i": item["id"], "n": item["name"], "p": path_of(item),
                       "y": round(point.y, 4), "x": round(point.x, 4),
                       "b": [round(minx, 4), round(miny, 4), round(maxx, 4), round(maxy, 4)]})
write(OUT / "search_index.json", search)

# ---- checks ----
deepest = levels.get("ADM4") or levels["ADM3"]
tree = STRtree([item["geom"] for item in deepest])


def locate(lat, lon):
    hits = tree.query(Point(lon, lat), predicate="intersects")
    if not len(hits):
        return "outside the data"
    item = deepest[int(hits[0])]
    return f"{item['name']}, {path_of(item)}"


print("\nSpot checks (place -> union/upazila, upazila, district, division):")
for name, lat, lon in (("Rangpur", 25.7439, 89.2752), ("Dhaka", 23.8103, 90.4125),
                       ("Barishal", 22.7010, 90.3535), ("Cox's Bazar", 21.4272, 92.0058),
                       ("Sylhet", 24.8949, 91.8687), ("Khulna", 22.8456, 89.5403),
                       ("Mymensingh", 24.7471, 90.4203), ("Kurigram", 25.8054, 89.6361)):
    print(f"   {name:<12} {locate(lat, lon)}")

files = sorted(OUT.rglob("*.json"), key=lambda p: p.stat().st_size, reverse=True)
total = sum(p.stat().st_size for p in files)
print(f"\nFiles written: {len(files)}, total {total / 1e6:.1f} MB. Biggest:")
for p in files[:6]:
    print(f"   {p.relative_to(OUT)}  {p.stat().st_size / 1e6:.2f} MB")
print("\nBoundaries: geoBoundaries gbOpen (CC BY 4.0).")