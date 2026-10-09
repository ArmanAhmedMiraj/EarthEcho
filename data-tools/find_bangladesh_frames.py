# find_bangladesh_frames.py
# EarthEcho - which NISAR GCOV frames cover all of Bangladesh, and how big are they?
# This script only SEARCHES. It downloads nothing.

import csv
import re
from collections import defaultdict
from pathlib import Path

import earthaccess

# West, South, East, North - a box around all of Bangladesh.
BOX = (88.0, 20.6, 92.7, 26.7)
START, END = "2026-06-17", "2026-10-09"

PROJECT = Path(__file__).resolve().parent.parent
OUT = PROJECT / "notes" / "bangladesh_gcov_frames.csv"

print("Signing in to NASA Earthdata (uses the login saved earlier)...")
earthaccess.login(persist=True)

print("\nLooking for NISAR GCOV datasets...")
datasets = earthaccess.search_datasets(keyword="NISAR GCOV", count=20)
gcov = []
for ds in datasets:
    short = ds["umm"].get("ShortName", "?")
    concept = ds["meta"].get("concept-id", "?")
    print(f"   {short}   [{concept}]")
    if "GCOV" in short.upper():
        gcov.append((short, concept))

if not gcov:
    print("No GCOV dataset found. Send me this output.")
    raise SystemExit

rows = []
for short, concept in gcov:
    print(f"\nSearching {short} over Bangladesh ...")
    try:
        granules = earthaccess.search_data(
            concept_id=concept, bounding_box=BOX, temporal=(START, END), count=2000
        )
    except Exception as error:
        print("   search failed:", error)
        continue
    print(f"   {len(granules)} files found")
    for g in granules:
        name = g["meta"].get("native-id", "")
        match = re.search(r"_(\d{3})_([AD])_(\d{3})_", name)
        date_match = re.search(r"_(20\d{6})T", name)
        try:
            size_gb = g.size() / 1024.0
        except Exception:
            size_gb = 0.0
        rows.append({
            "dataset": short,
            "track": match.group(1) if match else "?",
            "direction": match.group(2) if match else "?",
            "frame": match.group(3) if match else "?",
            "date": date_match.group(1) if date_match else "?",
            "size_gb": round(size_gb, 2),
            "name": name,
        })

if not rows:
    print("\nNo files found. Send me this output.")
    raise SystemExit

groups = defaultdict(list)
for r in rows:
    groups[(r["track"], r["direction"], r["frame"])].append(r)

print("\n=== Frames that touch Bangladesh (track, direction, frame) ===")
print("track dir frame  dates  size per file (GB)  first date -> last date")
for key in sorted(groups):
    items = groups[key]
    dates = sorted({i["date"] for i in items})
    size = sum(i["size_gb"] for i in items) / max(len(items), 1)
    print(f"{key[0]}   {key[1]}   {key[2]}   {len(dates):4d}   {size:12.1f}        {dates[0]} -> {dates[-1]}")

OUT.parent.mkdir(exist_ok=True)
with open(OUT, "w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
    writer.writeheader()
    writer.writerows(rows)
print(f"\nSaved the full list to: {OUT}")