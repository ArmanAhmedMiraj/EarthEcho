// Dry spells at one point over the last 90 days: days in a row with almost no rain (NASA POWER daily rain),
// next to the soil moisture NASA's SMAP satellite measured over the same days (read through NASA GIBS).
// Example: /api/dryspell?lat=25.75&lon=89.25
import { badRequest, cacheFor, fetchJson, readPoint } from "./_lib/answer.js";
import { dayBack, loadColormap, readTilePixel, valueOf } from "./_lib/gibs.js";

const DAYS = 90;
const WET_MM = 1; // a day with less than this much rain counts as a dry day
const MIN_SPELL = 5; // fewer dry days in a row than this is not listed as a spell
const STEP = 3; // one soil reading every three days
const ymd = (d) => d.toISOString().slice(0, 10).replaceAll("-", "");
const iso = (k) => `${k.slice(0, 4)}-${k.slice(4, 6)}-${k.slice(6, 8)}`;
const clean = (v) => (typeof v === "number" && v > -990 ? v : null);

export function spellsOf(days) {
  // days: [{date, rain}] oldest first, rain may be null (not yet available)
  const rows = days.filter((d) => d.rain != null);
  const runs = [];
  let cur = null;
  rows.forEach((d) => {
    if (d.rain < WET_MM) { if (!cur) cur = { start: d.date, end: d.date, days: 0 }; cur.end = d.date; cur.days += 1; }
    else if (cur) { runs.push(cur); cur = null; }
  });
  const ongoing = cur ? { ...cur } : null;
  if (cur) runs.push(cur);
  const longest = runs.reduce((b, r) => (!b || r.days > b.days ? r : b), null);
  const last = rows.length ? rows[rows.length - 1].date : null;
  const wet = rows.filter((d) => d.rain >= WET_MM);
  return {
    lastDate: last,
    ongoing: ongoing && ongoing.days > 0 ? ongoing : null,
    lastWetDate: wet.length ? wet[wet.length - 1].date : null,
    longest,
    spells: runs.filter((r) => r.days >= MIN_SPELL).sort((a, b) => b.days - a.days).slice(0, 5).sort((a, b) => (a.start < b.start ? -1 : 1)),
    wetDays: wet.length,
    totalMm: Math.round(rows.reduce((s, d) => s + d.rain, 0)),
    last30Mm: Math.round(rows.slice(-30).reduce((s, d) => s + d.rain, 0)),
    daysUsed: rows.length,
  };
}

async function soilSeries(lat, lon) {
  const table = await loadColormap("SMAP_Analyzed_Soil_Moisture.xml");
  const jobs = [];
  for (let back = 1; back <= DAYS; back += STEP) jobs.push(back);
  const out = await Promise.allSettled(jobs.map(async (back) => {
    const date = dayBack(back);
    const colour = await readTilePixel("SMAP_L4_Analyzed_Root_Zone_Soil_Moisture", date, lat, lon, { set: "2km", level: 5 });
    if (!colour || !table.has(colour)) return null;
    return { date, root: Number(valueOf(table.get(colour)).mid.toFixed(3)) };
  }));
  return out.filter((r) => r.status === "fulfilled" && r.value).map((r) => r.value).sort((a, b) => (a.date < b.date ? -1 : 1));
}

async function rainSeries(lat, lon) {
  const end = new Date(), start = new Date(end.getTime() - (DAYS - 1) * 86400000);
  const url = "https://power.larc.nasa.gov/api/temporal/daily/point?parameters=PRECTOTCORR&community=AG" +
    `&longitude=${lon}&latitude=${lat}&start=${ymd(start)}&end=${ymd(end)}&format=JSON`;
  const raw = await fetchJson(url);
  const p = raw && raw.properties && raw.properties.parameter && raw.properties.parameter.PRECTOTCORR;
  if (!p) throw new Error("unexpected answer");
  return Object.keys(p).sort().map((k) => ({ date: iso(k), rain: clean(p[k]) }));
}

export default async function handler(req, res) {
  const point = readPoint(req.query || {});
  if (!point) return badRequest(res, "Give a real place: ?lat=25.75&lon=89.25");
  const [rain, soil] = await Promise.allSettled([rainSeries(point.lat, point.lon), soilSeries(point.lat, point.lon)]);
  if (rain.status === "rejected" && soil.status === "rejected") return res.status(502).json({ ok: false, error: "NASA did not answer." });
  const days = rain.status === "fulfilled" ? rain.value : null;
  cacheFor(res, 3 * 3600);
  res.status(200).json({
    ok: true,
    location: point,
    wetMm: WET_MM,
    minSpell: MIN_SPELL,
    rain: days,
    dry: days ? spellsOf(days) : null,
    soil: soil.status === "fulfilled" ? soil.value : null,
    provenance: {
      rain: { name: "NASA POWER daily rain (PRECTOTCORR)", note: `A day with less than ${WET_MM} mm of rain counts as a dry day. The newest days are not in the data yet.`, licence: "NASA open data" },
      soil: { name: "SMAP Level 4 root-zone soil moisture (m³/m³)", note: "Read from NASA GIBS pictures, one value every three days. About 9 km across, so it describes the area, not one field.", licence: "NASA open data" },
      fetchedAt: new Date().toISOString(),
    },
  });
}
