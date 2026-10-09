# find_scenes.py  (version 3)
# Searches NASA's archive for NISAR GCOV files over the Jamuna river box and
# prints which track/frame combinations repeat, and on which dates.
# It only SEARCHES. It does not download any radar data.

import csv
from collections import defaultdict
from datetime import date
from pathlib import Path

import asf_search as asf

# Search box around the Jamuna river near Sirajganj, Bangladesh.
# WKT order is: longitude latitude.
AREA = "POLYGON((89.68 24.30, 89.88 24.30, 89.88 24.50, 89.68 24.50, 89.68 24.30))"

START = "2026-06-17"  # PROVISIONAL products start on this date
END = "2026-10-09"

# PROVISIONAL products carry this processing code in their file names.
# Filtering on it keeps us from mixing in the older BETA products.
PROVISIONAL_CODE = "P05023"

# Known permanent NISAR data gap (no data exists between these dates).
GAP_START = "2026-07-27"
GAP_END = "2026-08-10"

# Version 1 stopped at 500 results. This limit is much higher on purpose.
MAX_RESULTS = 5000

NOTES_DIR = Path(__file__).resolve().parent.parent / "notes"
NOTES_DIR.mkdir(exist_ok=True)


def parse_name(name):
    """Reads cycle, track, direction, frame and date out of a NISAR file name."""
    parts = name.split("_")
    info = {
        "cycle": parts[4],
        "track": parts[5],
        "direction": parts[6],
        "frame": parts[7],
        "date": "",
    }
    for part in parts:
        if len(part) == 15 and part[8] == "T" and part[:8].isdigit():
            info["date"] = f"{part[:4]}-{part[4:6]}-{part[6:8]}"
            break
    return info


def size_in_gb(value):
    """Returns the size in GB of the main data file.

    For NISAR the 'bytes' field is usually a dictionary of file name -> details,
    not a single number, so this handles both shapes safely.
    """
    if isinstance(value, (int, float)):
        return round(value / 1e9, 2)
    if isinstance(value, dict):
        sizes = []
        h5_sizes = []
        for file_name, details in value.items():
            if isinstance(details, dict):
                number = details.get("bytes", 0)
            else:
                number = details
            if not isinstance(number, (int, float)):
                continue
            sizes.append(number)
            if str(file_name).lower().endswith((".h5", ".hdf5")):
                h5_sizes.append(number)
        chosen = h5_sizes or sizes
        if chosen:
            return round(max(chosen) / 1e9, 2)
    return 0.0


def run_search(only_gcov):
    """Runs the archive search. If only_gcov is True, asks the server for GCOV only."""
    options = dict(
        dataset=asf.DATASET.NISAR,
        intersectsWith=AREA,
        start=START,
        end=END,
        maxResults=MAX_RESULTS,
    )
    if only_gcov:
        options["processingLevel"] = "GCOV"
    return asf.search(**options)


def day_gaps(dates):
    """Returns the number of days between consecutive dates, e.g. [12, 12, 24]."""
    days = [date.fromisoformat(d) for d in dates]
    return [(days[i + 1] - days[i]).days for i in range(len(days) - 1)]


def main():
    print("Searching NASA's archive (this lists files only, nothing is downloaded)...")

    results = []
    try:
        results = run_search(only_gcov=True)
        print(f"Search asking for GCOV only returned {len(results)} files.")
    except Exception as error:
        print("The GCOV-only search was not accepted:", error)

    if not results:
        print("Trying again without the GCOV filter (slower, but should work)...")
        try:
            results = run_search(only_gcov=False)
            print(f"Search for all product types returned {len(results)} files.")
        except Exception as error:
            print("The search failed:", error)
            return

    if len(results) >= MAX_RESULTS:
        print("WARNING: the search hit the limit, so the list may still be cut off.")

    rows = []
    for result in results:
        props = result.properties
        name = props.get("sceneName") or props.get("fileID") or ""
        if "_GCOV_" not in name or PROVISIONAL_CODE not in name:
            continue
        info = parse_name(name)
        info["name"] = name
        info["url"] = props.get("url", "")
        info["size_gb"] = size_in_gb(props.get("bytes"))
        info["frame_coverage"] = props.get("frameCoverage", "")
        info["start_time"] = props.get("startTime", "")
        rows.append(info)

    print(f"Provisional GCOV scenes found: {len(rows)}   (Vertex showed 38 for this area)")
    if not rows:
        print("None matched. Send me the lines above so I can adjust the filter.")
        return

    all_dates = sorted(row["date"] for row in rows)
    print(f"Date range covered: {all_dates[0]} to {all_dates[-1]}")

    # Group by track + frame + direction, because only identical ones can be compared.
    groups = defaultdict(list)
    for row in rows:
        groups[(row["track"], row["frame"], row["direction"])].append(row)

    print()
    print("Track / Frame / Direction -> how many dates, and which")
    for key, members in sorted(groups.items(), key=lambda item: -len(item[1])):
        dates = sorted(set(m["date"] for m in members))
        coverage = sorted(set(str(m["frame_coverage"]) for m in members))
        sizes = sorted(set(m["size_gb"] for m in members))
        print(f"  Track {key[0]}  Frame {key[1]}  {key[2]}  ->  {len(dates)} dates")
        print("     dates:", ", ".join(dates))
        print("     days between passes:", day_gaps(dates))
        print("     frame coverage:", coverage, "| file size (GB):", sizes)
        inside_gap = [d for d in dates if GAP_START <= d <= GAP_END]
        if inside_gap:
            print("     WARNING: dates inside the known data gap:", inside_gap)

    csv_path = NOTES_DIR / "jamuna_gcov_scenes.csv"
    fields = ["date", "track", "frame", "direction", "cycle", "frame_coverage",
              "size_gb", "start_time", "name", "url"]
    with open(csv_path, "w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=fields)
        writer.writeheader()
        for row in sorted(rows, key=lambda r: (r["track"], r["frame"], r["date"])):
            writer.writerow({k: row[k] for k in fields})
    print()
    print("Full list saved to:", csv_path)


if __name__ == "__main__":
    main()