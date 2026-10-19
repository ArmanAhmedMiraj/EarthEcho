// Shared helpers for every API in this folder.
// Files that start with "_" are not public APIs; they are only imported by the others.

export const NASA_POWER_SOURCE = {
  id: "nasa-power-daily",
  name: "NASA POWER, daily data (v2.10)",
  publisher: "NASA Langley Research Center",
  url: "https://power.larc.nasa.gov/docs/",
  licence: "NASA open data. Please credit NASA POWER.",
  resolution: "About 0.5° × 0.625° per cell (roughly 55 km)",
  note: "Soil wetness is a NASA model estimate (MERRA-2) for a large cell. It is not a measurement of one field.",
};

// Read ?lat=..&lon=.. and refuse anything that is not a real place on Earth.
export function readPoint(query) {
  const lat = Number(query.lat);
  const lon = Number(query.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return null;
  }
  // two decimals is about 1 km: enough, and it lets nearby requests share one cached answer
  return { lat: Number(lat.toFixed(2)), lon: Number(lon.toFixed(2)) };
}

export function badRequest(res, message) {
  res.status(400).json({ ok: false, error: message });
}

// Ask the browser and Vercel's network to keep the answer for a while, so NASA is not asked twice.
export function cacheFor(res, seconds) {
  res.setHeader("Cache-Control", `public, s-maxage=${seconds}, stale-while-revalidate=86400`);
}

// fetch() with a time limit, so a slow server never hangs our page
export async function fetchJson(url, ms = 20000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`Source answered ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}