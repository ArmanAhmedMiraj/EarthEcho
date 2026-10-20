// Everything the Weather page needs, from Open-Meteo (weather model data) in one go, plus air quality.
// Open-Meteo: https://open-meteo.com (CC BY 4.0, free for non-commercial use).

const FORECAST = "https://api.open-meteo.com/v1/forecast";
const AIR = "https://air-quality-api.open-meteo.com/v1/air-quality";

async function getJson(url, ms = 20000, tries = 3) {
  for (let i = 1; i < tries; i++) {
    try {
      return await getJsonOnce(url, ms);
    } catch {
      await new Promise((r) => setTimeout(r, 700 * i)); // a short pause, then ask again
    }
  }
  return getJsonOnce(url, ms);
}

async function getJsonOnce(url, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

const CURRENT =
  "temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,cloud_cover,pressure_msl," +
  "wind_speed_10m,wind_direction_10m,wind_gusts_10m,uv_index,is_day,soil_moisture_0_to_1cm,soil_temperature_0cm";
const HOURLY = "temperature_2m,precipitation,precipitation_probability,wind_speed_10m,wind_gusts_10m,weather_code,is_day";
const DAILY =
  "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max," +
  "wind_speed_10m_max,wind_gusts_10m_max,uv_index_max,et0_fao_evapotranspiration,sunrise,sunset";

export async function fetchWeatherPlus(lat, lon) {
  const url =
    `${FORECAST}?latitude=${lat}&longitude=${lon}&current=${CURRENT}&hourly=${HOURLY}&daily=${DAILY}` +
    `&timezone=auto&past_days=7&forecast_days=16&forecast_hours=48`;
  const [data, air] = await Promise.all([
    getJson(url),
    getJson(`${AIR}?latitude=${lat}&longitude=${lon}&current=pm2_5,us_aqi&timezone=auto`).catch(() => null),
  ]);

  const d = data.daily;
  const all = d.time.map((date, i) => ({
    date,
    code: d.weather_code[i],
    tmax: d.temperature_2m_max[i],
    tmin: d.temperature_2m_min[i],
    rain: d.precipitation_sum[i],
    chance: d.precipitation_probability_max[i],
    wind: d.wind_speed_10m_max[i],
    gust: d.wind_gusts_10m_max[i],
    uv: d.uv_index_max[i],
    et0: d.et0_fao_evapotranspiration[i],
    sunrise: d.sunrise[i],
    sunset: d.sunset[i],
  }));
  const h = data.hourly;
  // forecast_hours counts from the current hour, so the list already starts "now"
  const hours = h.time.map((time, i) => ({
    time,
    temp: h.temperature_2m[i],
    rain: h.precipitation[i],
    chance: h.precipitation_probability[i],
    wind: h.wind_speed_10m[i],
    gust: h.wind_gusts_10m[i],
    code: h.weather_code[i],
    day: h.is_day[i] === 1,
  }));
  return {
    fetchedAt: Date.now(),
    elevation: data.elevation,
    timezone: data.timezone,
    current: data.current,
    past: all.slice(0, 7),
    days: all.slice(7),
    hours,
    air: air && air.current ? { aqi: air.current.us_aqi, pm25: air.current.pm2_5 } : null,
  };
}

// WMO weather codes -> a short key (the page turns the key into words) and a symbol
export function describeCode(code, day = true) {
  if (code === 0) return { key: "clear", icon: day ? "☀️" : "🌙" };
  if (code === 1) return { key: "mostlyClear", icon: day ? "🌤️" : "🌙" };
  if (code === 2) return { key: "partlyCloudy", icon: "⛅" };
  if (code === 3) return { key: "overcast", icon: "☁️" };
  if (code === 45 || code === 48) return { key: "fog", icon: "🌫️" };
  if (code >= 51 && code <= 57) return { key: "drizzle", icon: "🌦️" };
  if (code >= 61 && code <= 67) return { key: "rain", icon: "🌧️" };
  if (code >= 71 && code <= 77) return { key: "snow", icon: "🌨️" };
  if (code >= 80 && code <= 82) return { key: "showers", icon: "🌦️" };
  if (code === 85 || code === 86) return { key: "snow", icon: "🌨️" };
  if (code >= 95) return { key: "thunder", icon: "⛈️" };
  return { key: "unknown", icon: "🌡️" };
}

// compass word for a wind direction in degrees (where the wind comes from)
export function compass(deg) {
  if (deg == null) return "";
  const names = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return names[Math.round(deg / 45) % 8];
}

export function aqiClass(aqi) {
  if (aqi == null) return null;
  return aqi <= 50 ? "good" : aqi <= 100 ? "moderate" : aqi <= 150 ? "sensitive" : aqi <= 200 ? "unhealthy" : aqi <= 300 ? "veryUnhealthy" : "hazardous";
}

// Warnings from the forecast numbers. These are simple thresholds on model data, not official warnings.
export function buildAlerts(plus) {
  const alerts = [];
  const week = plus.days.slice(0, 7);
  const dayName = (d) => d.date;
  const push = (id, level, days, extra = {}) => alerts.push({ id, level, days: days.map(dayName), ...extra });

  const heavy = week.filter((d) => d.rain != null && d.rain >= 50);
  if (heavy.length) push("heavyRain", heavy.some((d) => d.rain >= 100) ? "severe" : "warning", heavy.map((d) => d), { value: Math.max(...heavy.map((d) => d.rain)) });
  const hotDays = week.filter((d) => d.tmax != null && d.tmax >= 38);
  if (hotDays.length) push("heat", hotDays.some((d) => d.tmax >= 41) ? "severe" : "warning", hotDays, { value: Math.max(...hotDays.map((d) => d.tmax)) });
  const frost = week.filter((d) => d.tmin != null && d.tmin <= 0);
  const cold = week.filter((d) => d.tmin != null && d.tmin > 0 && d.tmin <= 4);
  if (frost.length) push("frost", "warning", frost, { value: Math.min(...frost.map((d) => d.tmin)) });
  else if (cold.length) push("cold", "watch", cold, { value: Math.min(...cold.map((d) => d.tmin)) });
  const windy = week.filter((d) => d.gust != null && d.gust >= 60);
  if (windy.length) push("wind", windy.some((d) => d.gust >= 90) ? "severe" : "warning", windy, { value: Math.max(...windy.map((d) => d.gust)) });
  const storms = week.filter((d) => d.code >= 95);
  if (storms.length) push("thunder", "watch", storms);
  const sum = (list) => list.reduce((s, d) => s + (d.rain || 0), 0);
  if (sum(week) < 5 && sum(plus.past) < 5) push("dry", "watch", []);
  if (plus.air && plus.air.aqi != null && plus.air.aqi >= 151) push("air", plus.air.aqi >= 201 ? "warning" : "watch", [], { value: plus.air.aqi });
  const order = { severe: 0, warning: 1, watch: 2 };
  return alerts.sort((a, b) => order[a.level] - order[b.level]);
}

// Calm, dry hours in daylight for spraying: wind under 12 km/h, gusts under 20, no rain now or in the next 3 hours.
export function sprayWindows(hours) {
  const ok = hours.map((hr, i) => {
    const ahead = hours.slice(i, i + 4);
    return (
      hr.day &&
      hr.wind != null && hr.wind <= 12 &&
      (hr.gust == null || hr.gust <= 20) &&
      ahead.every((x) => (x.rain || 0) < 0.1 && (x.chance == null || x.chance < 40))
    );
  });
  const blocks = [];
  let start = null;
  ok.forEach((good, i) => {
    if (good && start === null) start = i;
    if ((!good || i === ok.length - 1) && start !== null) {
      const end = good && i === ok.length - 1 ? i : i - 1;
      if (end - start + 1 >= 2) blocks.push({ from: hours[start].time, to: hours[end].time, hours: end - start + 1 });
      start = null;
    }
  });
  return blocks.sort((a, b) => b.hours - a.hours).slice(0, 3).sort((a, b) => (a.from < b.from ? -1 : 1));
}
