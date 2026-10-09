# test_farm_data.py
# EarthEcho Farm - do the three data sources we need actually work?
# Tests one point in northern Bangladesh. Downloads only a few kilobytes.

import time

import requests

LON, LAT = 89.25, 25.75  # near Rangpur


def run(name, url, params, show):
    print(f"\n=== {name} ===")
    started = time.time()
    try:
        response = requests.get(url, params=params, timeout=60)
        print(f"status {response.status_code} in {time.time() - started:.1f} s")
        response.raise_for_status()
        show(response.json())
    except Exception as error:
        print("FAILED:", error)


# 1. Soil: sand, silt and clay from ISRIC SoilGrids
def show_soil(data):
    for layer in data["properties"]["layers"]:
        mean = layer["depths"][0]["values"]["mean"]
        print(f"   {layer['name']}: {mean} (top 0-5 cm, SoilGrids units)")


run(
    "Soil (ISRIC SoilGrids)",
    "https://rest.isric.org/soilgrids/v2.0/properties/query",
    [("lon", LON), ("lat", LAT), ("property", "sand"), ("property", "silt"),
     ("property", "clay"), ("depth", "0-5cm"), ("value", "mean")],
    show_soil,
)


# 2. NASA POWER: recent rain and temperature
def show_power(data):
    series = data["properties"]["parameter"]
    for name, values in series.items():
        days = list(values.items())[-3:]
        print(f"   {name}, last days: {days}")


run(
    "Weather history (NASA POWER)",
    "https://power.larc.nasa.gov/api/temporal/daily/point",
    {"parameters": "PRECTOTCORR,T2M", "community": "AG", "longitude": LON,
     "latitude": LAT, "start": "20260925", "end": "20261005", "format": "JSON"},
    show_power,
)


# 3. Forecast: next 16 days of temperature, rain, rain chance and evapotranspiration
def show_forecast(data):
    daily = data["daily"]
    print(f"   days returned: {len(daily['time'])}")
    for i in range(min(4, len(daily["time"]))):
        print(f"   {daily['time'][i]}: max {daily['temperature_2m_max'][i]} C, "
              f"rain {daily['precipitation_sum'][i]} mm, "
              f"chance {daily['precipitation_probability_max'][i]} %, "
              f"ET0 {daily['et0_fao_evapotranspiration'][i]} mm")


run(
    "Forecast (Open-Meteo)",
    "https://api.open-meteo.com/v1/forecast",
    {"latitude": LAT, "longitude": LON, "forecast_days": 16, "timezone": "auto",
     "daily": "temperature_2m_max,temperature_2m_min,precipitation_sum,"
              "precipitation_probability_max,et0_fao_evapotranspiration"},
    show_forecast,
)