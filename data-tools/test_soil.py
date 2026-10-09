# test_soil.py
# EarthEcho Farm - can we get soil texture from ISRIC SoilGrids reliably?
# One property per request, long wait, retries, three places in Bangladesh.

import time

import requests

PLACES = {
    "Rangpur": (89.25, 25.75),
    "Dhaka": (90.41, 23.81),
    "Barishal": (90.37, 22.70),
}
URL = "https://rest.isric.org/soilgrids/v2.0/properties/query"

for place, (lon, lat) in PLACES.items():
    print(f"\n=== {place} ===")
    for prop in ("sand", "silt", "clay"):
        value = None
        for attempt in range(1, 4):
            started = time.time()
            try:
                response = requests.get(
                    URL,
                    params={"lon": lon, "lat": lat, "property": prop,
                            "depth": "0-5cm", "value": "mean"},
                    timeout=180,
                )
                seconds = time.time() - started
                if response.status_code == 200:
                    layer = response.json()["properties"]["layers"][0]
                    value = layer["depths"][0]["values"]["mean"]
                    print(f"   {prop}: {value} (attempt {attempt}, {seconds:.0f} s)")
                    break
                print(f"   {prop}: status {response.status_code} (attempt {attempt}, {seconds:.0f} s)")
            except Exception as error:
                print(f"   {prop}: {type(error).__name__} (attempt {attempt}, {time.time() - started:.0f} s)")
            time.sleep(5)
        if value is None:
            print(f"   {prop}: GAVE UP after 3 attempts")