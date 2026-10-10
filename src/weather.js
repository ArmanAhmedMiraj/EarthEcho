const GEOCODE = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST = "https://api.open-meteo.com/v1/forecast";
const POWER = "https://power.larc.nasa.gov/api/temporal/monthly/point";

async function getJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

export async function searchPlace(query, lang) {
  const url = `${GEOCODE}?name=${encodeURIComponent(query)}&count=6&language=${lang}&format=json`;
  const data = await getJson(url);
  return (data.results || []).map((r) => ({
    name: [r.name, r.admin1, r.country].filter(Boolean).join(", "),
    lat: r.latitude,
    lon: r.longitude,
  }));
}

// 16 days ahead, plus the last 7 days (what really fell and evaporated), so the water countdown can look back.
const PAST_DAYS = 7;

export async function fetchForecast(lat, lon) {
  const daily =
    "temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,et0_fao_evapotranspiration";
  const url = `${FORECAST}?latitude=${lat}&longitude=${lon}&daily=${daily}&timezone=auto&past_days=${PAST_DAYS}&forecast_days=16&current=precipitation,temperature_2m`;
  const data = await getJson(url);
  const d = data.daily;
  const all = d.time.map((date, i) => ({
    date,
    tmax: d.temperature_2m_max[i],
    tmin: d.temperature_2m_min[i],
    rain: d.precipitation_sum[i],
    chance: d.precipitation_probability_max[i],
    et0: d.et0_fao_evapotranspiration[i],
  }));
  // the first PAST_DAYS entries are days gone by; "days" stays what it always was: today and the days ahead
  const c = data.current || null;
  return {
    past: all.slice(0, PAST_DAYS),
    days: all.slice(PAST_DAYS),
    // what is happening right now: rain in the last hour (mm) and the temperature
    current: c ? { rain: c.precipitation, temp: c.temperature_2m, time: c.time } : null,
  };
}

const average = (list) => (list.length ? list.reduce((a, b) => a + b, 0) / list.length : null);

// Typical rain and temperature for each calendar month, from NASA POWER (last 10 full years).
export async function fetchHistory(lat, lon) {
  const end = new Date().getFullYear() - 1;
  const start = end - 9;
  const url =
    `${POWER}?parameters=PRECTOTCORR,T2M&community=AG&longitude=${lon}&latitude=${lat}` +
    `&start=${start}&end=${end}&format=JSON`;
  const { properties } = await getJson(url);
  const rain = properties.parameter.PRECTOTCORR;
  const temp = properties.parameter.T2M;

  const months = Array.from({ length: 12 }, () => ({ rain: [], temp: [] }));
  for (const [key, value] of Object.entries(rain)) {
    const year = Number(key.slice(0, 4));
    const month = Number(key.slice(4, 6));
    if (month < 1 || month > 12 || !(value >= 0)) continue; // month 13 = yearly average, -999 = missing
    months[month - 1].rain.push(value * new Date(year, month, 0).getDate()); // mm per day to mm per month
  }
  for (const [key, value] of Object.entries(temp)) {
    const month = Number(key.slice(4, 6));
    if (month < 1 || month > 12 || !(value > -90)) continue;
    months[month - 1].temp.push(value);
  }
  return {
    years: `${start}–${end}`,
    months: months.map((m) => ({ rainMm: average(m.rain), tempC: average(m.temp) })),
  };
}