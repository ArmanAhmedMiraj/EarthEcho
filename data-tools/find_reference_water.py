# find_reference_water.py
# Looks for NASA's ready-made OPERA surface-water maps (from Sentinel-1 radar and from
# Landsat/Sentinel-2 optical images) over the Jamuna river box, on dates close to our
# NISAR dates. We would use them only as an INDEPENDENT CHECK of our own maps, never
# as the data shown in the app. It only SEARCHES. Nothing is downloaded.

import csv
from datetime import date
from pathlib import Path

import earthaccess

# Same river box as before (west, south, east, north).
BOX = (89.68, 24.30, 89.88, 24.50)
START, END = "2026-06-10", "2026-10-09"

NISAR_DATES = [
    "2026-06-18", "2026-06-30", "2026-07-12", "2026-07-24", "2026-08-17",
    "2026-08-29", "2026-09-10", "2026-09-22", "2026-10-04",
]

PRODUCTS = {
    "DSWx-S1 (Sentinel-1 radar)": "OPERA_L3_DSWX-S1_V1",
    "DSWx-HLS (Landsat/Sentinel-2 optical)": "OPERA_L3_DSWX-HLS_V1",
}

NOTES = Path(__file__).resolve().parent.parent / "notes"
NOTES.mkdir(exist_ok=True)


def granule_date(granule):
    """Returns the acquisition date (YYYY-MM-DD) of a search result."""
    try:
        return granule["umm"]["TemporalExtent"]["RangeDateTime"]["BeginningDateTime"][:10]
    except Exception:
        return ""


def main():
    print("Signing in to NASA Earthdata (uses the login saved earlier)...")
    earthaccess.login(persist=True)

    print()
    print("Datasets whose description mentions OPERA DSWx:")
    try:
        for dataset in earthaccess.search_datasets(keyword="OPERA DSWx", count=15):
            summary = dataset.summary()
            print("  ", summary.get("short-name"), "|", summary.get("version"))
    except Exception as error:
        print("   (could not list datasets:", error, ")")

    rows = []
    for label, short_name in PRODUCTS.items():
        print()
        print(f"=== {label}   [{short_name}] ===")
        try:
            results = earthaccess.search_data(
                short_name=short_name,
                bounding_box=BOX,
                temporal=(START, END),
                count=400,
            )
        except Exception as error:
            print("Search failed:", error)
            continue

        dates = sorted({granule_date(g) for g in results if granule_date(g)})
        print(f"{len(results)} tiles found on {len(dates)} different dates.")
        if not dates:
            continue
        print("Dates:", ", ".join(dates))

        print("Closest reference date for each NISAR date:")
        for nisar_date in NISAR_DATES:
            target = date.fromisoformat(nisar_date)
            best = min(dates, key=lambda d: abs((date.fromisoformat(d) - target).days))
            gap = abs((date.fromisoformat(best) - target).days)
            print(f"   NISAR {nisar_date}  ->  {best}  ({gap} days apart)")
            rows.append({"product": short_name, "nisar_date": nisar_date,
                         "reference_date": best, "days_apart": gap})

        try:
            sizes = [g.size() for g in results[:20]]
            print(f"Typical tile size: about {sorted(sizes)[len(sizes) // 2]:.0f} MB")
        except Exception:
            pass

    path = NOTES / "reference_water_matches.csv"
    with open(path, "w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(
            file, fieldnames=["product", "nisar_date", "reference_date", "days_apart"])
        writer.writeheader()
        writer.writerows(rows)
    print()
    print("Saved:", path)


if __name__ == "__main__":
    main()