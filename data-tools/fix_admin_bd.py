# fix_admin_bd.py
# EarthEcho Farm - make the division and country outlines match the district outlines,
# and fix a source typo. Safe to run more than once.
#
# Reads:  data-raw/admin (original downloads), public/admin (files made by build_admin_bd.py)
# Writes: public/admin/divisions.json, country.json, search_index.json

import json
from collections import defaultdict
from pathlib import Path

from shapely.geometry import mapping, shape
from shapely.ops import unary_union

PROJECT = Path(__file__).resolve().parent.parent
RAW = PROJECT / "data-raw" / "admin"
OUT = PROJECT / "public" / "admin"

NAME_FIX = {"Rajshani": "Rajshahi"}
OLD_NAME = {new: old for old, new in NAME_FIX.items()}


def read(path):
    return json.loads(path.read_text(encoding="utf-8"))


def write(path, obj):
    path.write_text(json.dumps(obj, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")


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


def raw_by_name(level):
    result = {}
    for feature in read(RAW / f"BGD_{level}.geojson")["features"]:
        geom = shape(feature["geometry"])
        if not geom.is_valid:
            geom = geom.buffer(0)
        result[(feature["properties"].get("shapeName") or "").strip()] = geom
    return result


def dissolve(geoms):
    # buffer out and back in so hairline gaps between neighbours close up
    return unary_union([g.buffer(0.0004) for g in geoms]).buffer(-0.0004)


print("Reading the original district and division outlines ...")
district_geoms = raw_by_name("ADM2")
division_geoms = raw_by_name("ADM1")
print(f"   {len(district_geoms)} districts, {len(division_geoms)} divisions in the originals")

divisions = read(OUT / "divisions.json")
districts = read(OUT / "districts.json")
division_name = {f["properties"]["id"]: f["properties"]["name"] for f in divisions["features"]}

members = defaultdict(list)
member_names = defaultdict(list)
print("\nChecking each district against the old division outline:")
problems = 0
for feature in districts["features"]:
    props = feature["properties"]
    geom = district_geoms.get(props["name"])
    if geom is None:
        print(f"   MISSING original shape for district {props['name']}")
        continue
    members[props["parent"]].append(geom)
    member_names[props["parent"]].append(props["name"])
    shown = division_name[props["parent"]]
    old_outline = division_geoms.get(OLD_NAME.get(shown, shown))
    if old_outline is not None and not old_outline.contains(geom.representative_point()):
        problems += 1
        print(f"   {props['name']} district is assigned to {shown}, but its middle is outside the old {shown} outline")
if problems == 0:
    print("   all districts sit inside their old division outline")

print("\nBuilding division outlines from their districts ...")
new_props = {}
all_division_geoms = []
for feature in divisions["features"]:
    props = feature["properties"]
    geom = dissolve(members[props["id"]])
    all_division_geoms.append(geom)
    props["name"] = NAME_FIX.get(props["name"], props["name"])
    point = geom.representative_point()
    minx, miny, maxx, maxy = geom.bounds
    props["lat"], props["lon"] = round(point.y, 4), round(point.x, 4)
    props["bbox"] = [round(minx, 4), round(miny, 4), round(maxx, 4), round(maxy, 4)]
    feature["geometry"] = geometry_json(geom, 0.002)
    new_props[props["id"]] = props
    print(f"   {props['name']:<11} {len(members[props['id']]):>2} districts, {len(geom.geoms) if hasattr(geom, 'geoms') else 1} separate parts")
write(OUT / "divisions.json", divisions)

country = dissolve(all_division_geoms)
write(OUT / "country.json", {"type": "Feature", "properties": {"name": "Bangladesh"},
                              "geometry": geometry_json(country, 0.003)})
print(f"\nCountry outline rebuilt, bounds {[round(v, 2) for v in country.bounds]}")

index = read(OUT / "search_index.json")
for entry in index:
    for old, new in NAME_FIX.items():
        entry["n"] = entry["n"].replace(old, new)
        entry["p"] = entry["p"].replace(old, new)
    if entry["l"] == "division" and entry["i"] in new_props:
        p = new_props[entry["i"]]
        entry["y"], entry["x"], entry["b"] = p["lat"], p["lon"], p["bbox"]
write(OUT / "search_index.json", index)

print("\nFile sizes:")
for name in ("country.json", "divisions.json", "districts.json", "search_index.json"):
    print(f"   {name:<20} {(OUT / name).stat().st_size / 1e6:.2f} MB")
print("\nDone. Division names now:", ", ".join(sorted(p["name"] for p in new_props.values())))