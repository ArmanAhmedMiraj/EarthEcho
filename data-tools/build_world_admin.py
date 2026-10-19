"""
Build the administrative boundary files for the countries after Bangladesh.

Source: geoBoundaries gbOpen (open licences, listed per country in the output manifest).
Run:  python data-tools/build_world_admin.py [download-folder]

What it does, in order:
  1. downloads each boundary level as GeoJSON (cached in the download folder),
  2. simplifies the shapes so they are light enough for a phone,
  3. finds each area's parent (the bigger area that contains its middle point),
  4. writes small JSON files under public/admin/world/<ISO>/ plus a manifest and a search index.
"""
import json, os, sys, time, unicodedata, urllib.request
from collections import defaultdict
from shapely.geometry import shape, mapping
from shapely.strtree import STRtree

OUT = os.path.join(os.path.dirname(__file__), "..", "public", "admin", "world")
CACHE = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "data-raw", "geoboundaries")
SRC = "https://media.githubusercontent.com/media/wmgeolab/geoBoundaries/main/releaseData/gbOpen/{c}/{l}/geoBoundaries-{c}-{l}_simplified.geojson"
SPLIT_OVER = 1_300_000  # a level bigger than this (bytes) is split into one file per top-level area

# level names are shown to the farmer, so they use each country's own words
COUNTRIES = {
    "IND": dict(name="India", centre=(22.9, 79.0),
        levels=[("ADM1", "State / Union territory", 0.012, "CC BY 2.5 IN", "DataMeet India community, Election Commission of India"),
                ("ADM2", "District", 0.006, "ODbL 1.0", "Pathways Data Pvt. Ltd., lgdirectory.gov.in"),
                ("ADM3", "Sub-district / Tehsil / Block", 0.004, "ODbL 1.0", "Pathways Data Pvt. Ltd., lgdirectory.gov.in")]),
    "PAK": dict(name="Pakistan", centre=(30.0, 69.4),
        levels=[("ADM1", "Province / Territory", 0.01, "Public domain", "geoBoundaries, Wikipedia"),
                ("ADM2", "District", 0.005, "Public domain", "geoBoundaries, Wikipedia"),
                ("ADM3", "Tehsil", 0.004, "ODbL 1.0", "Pathways Data Pvt. Ltd., Pakistan Bureau of Statistics")]),
    "NPL": dict(name="Nepal", centre=(28.3, 84.1),
        levels=[("ADM1", "Province", 0.008, "CC BY 3.0 IGO", "Survey Department of Nepal, OCHA FISS"),
                ("ADM2", "District", 0.004, "Public domain", "geoBoundaries, Wikimedia Commons"),
                ("ADM3", "Local level (municipality)", 0.003, "CC BY-SA 4.0", "Open Data Nepal, Ministry of Federal Affairs and General Administration")]),
    "MMR": dict(name="Myanmar", centre=(19.7, 96.1),
        levels=[("ADM1", "State / Region", 0.01, "CC BY 4.0", "Myanmar Analytics Project, geoBoundaries"),
                ("ADM2", "District", 0.005, "CC BY 4.0", "Myanmar Analytics Project, USAID/Burma"),
                ("ADM3", "Township", 0.004, "CC BY 4.0", "The Myanmar Analytics Project, USAID")]),
    "BTN": dict(name="Bhutan", centre=(27.4, 90.4),
        levels=[("ADM1", "Dzongkhag", 0.005, "CC BY 3.0", "geoBoundaries, Wikimedia Commons (author Babbage)"),
                ("ADM2", "Gewog", 0.003, "CC BY 3.0 IGO", "OCHA ROAP")]),
    "USA": dict(name="United States", centre=(39.5, -98.35),
        levels=[("ADM1", "State", 0.015, "Public domain", "United States Census Bureau, MAF/TIGER"),
                ("ADM2", "County", 0.006, "Public domain", "United States Census Bureau, MAF/TIGER"),
                ("ZIP", "ZIP code area (ZCTA)", 0.006, "Public domain", "United States Census Bureau, 2020 ZIP Code Tabulation Areas (cartographic boundary, 1:500k)")]),
}

def read_zcta():
    """US ZIP code areas from the Census Bureau shapefile (pip install pyshp). Pass its folder as the 2nd argument."""
    import shapefile
    folder = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(__file__), "..", "data-raw", "zcta")
    r = shapefile.Reader(os.path.join(folder, "cb_2020_us_zcta520_500k.shp"))
    feats = []
    for sr in r.shapeRecords():
        feats.append({"type": "Feature", "properties": {"shapeName": sr.record["ZCTA5CE20"]}, "geometry": sr.shape.__geo_interface__})
    return {"features": feats}

def download(code, level):
    if level == "ZIP":
        return read_zcta()
    os.makedirs(CACHE, exist_ok=True)
    path = os.path.join(CACHE, f"{code}_{level}.geojson")
    if not os.path.exists(path):
        for attempt in range(3):
            try:
                data = urllib.request.urlopen(SRC.format(c=code, l=level), timeout=180).read()
                if data[:1] == b"{":
                    open(path, "wb").write(data)
                    break
            except Exception as error:
                print("  retry", code, level, error)
                time.sleep(2)
        else:
            raise SystemExit(f"could not download {code} {level}")
    return json.load(open(path, encoding="utf-8"))

def fold(text):
    return "".join(c for c in unicodedata.normalize("NFKD", text) if not unicodedata.combining(c)).lower()

def clean(geom, tol):
    g = geom.simplify(tol, preserve_topology=True)
    if g.is_empty:
        g = geom
    return g

def round_coords(obj, nd=4):
    if isinstance(obj, (list, tuple)):
        return [round_coords(x, nd) for x in obj] if obj and isinstance(obj[0], (list, tuple)) else [round(obj[0], nd), round(obj[1], nd)]
    return obj

def to_feature(props, geom):
    m = mapping(geom)
    return {"type": "Feature", "properties": props, "geometry": {"type": m["type"], "coordinates": round_coords(m["coordinates"])}}

def parent_of(point, parents, tree, geoms):
    hits = tree.query(point, predicate="intersects")
    if len(hits):
        return parents[int(hits[0])]
    nearest = tree.nearest(point)
    return parents[int(nearest)]

def write(path, obj):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))
    return os.path.getsize(path)

def main():
    manifest = {"countries": []}
    for code, cfg in COUNTRIES.items():
        print(code, cfg["name"])
        base = os.path.join(OUT, code)
        # the country outline
        outline = download(code, "ADM0")["features"]
        from shapely.ops import unary_union
        whole = unary_union([shape(f["geometry"]) for f in outline])
        b = whole.bounds
        write(os.path.join(base, "country.json"), {"type": "Feature", "properties": {"id": code, "name": cfg["name"]},
              "geometry": to_feature({}, clean(whole, 0.03))["geometry"]})

        previous = None  # (ids, geoms, tree) of the level above
        level_info, search = [], []
        top_of = {}  # id of any area -> id of its top-level (ADM1) ancestor
        for depth, (adm, label, tol, lic, src) in enumerate(cfg["levels"], start=1):
            raw = download(code, adm)["features"]
            ids, geoms, feats = [], [], []
            for n, f in enumerate(raw):
                g = shape(f["geometry"])
                if not g.is_valid:
                    g = g.buffer(0)
                ident = f"{code}-{depth}-{n + 1}"
                ids.append(ident)
                geoms.append(g)
            tree = STRtree(geoms)
            for ident, g, f in zip(ids, geoms, raw):
                pt = g.representative_point()
                parent = None
                if previous:
                    parent = parent_of(pt, previous[0], previous[2], previous[1])
                top = ident if depth == 1 else top_of[parent]
                top_of[ident] = top
                bb = g.bounds
                props = {"id": ident, "name": (f["properties"].get("shapeName") or "Unnamed").strip(), "parent": parent,
                         "lat": round(pt.y, 4), "lon": round(pt.x, 4), "bbox": [round(v, 4) for v in bb], "top": top}
                feats.append((props, clean(g, tol)))
            # path text for search ("State › District")
            for p, _ in feats:
                search.append({"l": depth, "i": p["id"], "n": p["name"], "s": fold(p["name"]), "y": p["lat"], "x": p["lon"], "b": p["bbox"], "p": p["parent"]})
            fc = {"type": "FeatureCollection", "features": [to_feature(p, g) for p, g in feats]}
            size = len(json.dumps(fc, separators=(",", ":"), ensure_ascii=False))
            files = []
            if size > SPLIT_OVER and depth > 1:
                groups = defaultdict(list)
                for ft in fc["features"]:
                    groups[ft["properties"]["top"]].append(ft)
                for top, items in groups.items():
                    write(os.path.join(base, f"L{depth}", f"{top}.json"), {"type": "FeatureCollection", "features": items})
                layout = "byTop"
            else:
                write(os.path.join(base, f"L{depth}.json"), fc)
                layout = "all"
            level_info.append({"key": f"L{depth}", "label": label, "licence": lic, "source": src, "count": len(feats), "layout": layout, "names": {p["id"]: p["name"] for p, _ in feats}, "bytes": size})
            print(f"  L{depth} {label}: {len(feats)} areas, {size/1e6:.2f} MB, {layout}")
            previous = (ids, geoms, tree)

        # path text for the search index, built once all levels are known
        name_of = {e["i"]: e["n"] for e in search}
        parent_of_id = {e["i"]: e["p"] for e in search}
        for e in search:
            parts, cur = [], parent_of_id[e["i"]]
            while cur:
                parts.append(name_of[cur])
                cur = parent_of_id[cur]
            e["p"] = " › ".join(reversed(parts))
        write(os.path.join(base, "search.json"), search)
        manifest["countries"].append({
            "iso": code, "name": cfg["name"], "centre": {"lat": cfg["centre"][0], "lon": cfg["centre"][1]},
            "bbox": [round(v, 3) for v in b],
            "levels": [{k: v for k, v in li.items() if k != "names"} for li in level_info],
            "dataset": "geoBoundaries gbOpen (wmgeolab/geoBoundaries)",
        })
    write(os.path.join(OUT, "manifest.json"), manifest)
    lines = ["# Boundary sources", "", "Shapes come from geoBoundaries (gbOpen), simplified for the web. Credit the sources below.",
             "Boundaries are shown only to locate farms. They do not state any political position.", ""]
    for c in manifest["countries"]:
        lines.append(f"## {c['name']}")
        for lv in c["levels"]:
            lines.append(f"- {lv['label']}: {lv['licence']}. Source: {lv['source']}")
        lines.append("")
    open(os.path.join(OUT, "ATTRIBUTION.md"), "w", encoding="utf-8").write("\n".join(lines))
    print("done")

main()
