// River and rain watch for one river and the places upstream of it.
// Flow: the GloFAS river model, read through Open-Meteo (a 5 km grid, daily). Rain: NASA POWER (satellite-corrected, what fell)
// and Open-Meteo (what is forecast). Every reading is compared with the same place's own record, so "high" means high for that river.
import { RIVERS, STATIONS, kmBetween, nearestRiver } from "./basins.js";
import { fetchJson } from "./answer.js";

const FLOOD = "https://flood-api.open-meteo.com/v1/flood";
const HEAVY = 64.5, VERY_HEAVY = 115.6; // mm in a day: India Met Department's "heavy" and "very heavy" classes
const MIN_FLOOD_FLOW = 100; // below this a river is a stream: flow alone says little, so rain decides
const DAY = 86400000;
const round = (v, d = 0) => (v == null ? null : Number(v.toFixed(d)));
const isoDay = (ms) => new Date(ms).toISOString().slice(0, 10);
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
const quantile = (a, q) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : null; };

// the model grid cell near a point that holds the real river: the cell with the most water in a small block (3 x 3, or 5 x 5 for the river near you)
async function snap(lat, lon, r = 1) {
  const L = [], O = [];
  for (let i = -r; i <= r; i += 1) for (let j = -r; j <= r; j += 1) { L.push((lat + i * 0.05).toFixed(3)); O.push((lon + j * 0.05).toFixed(3)); }
  const d = await fetchJson(`${FLOOD}?latitude=${L}&longitude=${O}&daily=river_discharge&past_days=7&forecast_days=16`, 9000);
  const cells = (Array.isArray(d) ? d : [d]).map((c, i) => ({ lat: Number(L[i]), lon: Number(O[i]), time: c.daily.time, flow: c.daily.river_discharge }));
  const mean = (c) => { const v = c.flow.filter((x) => x != null); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : -1; };
  return cells.reduce((b, c) => (mean(c) > mean(b) ? c : b), cells[0]);
}

const histories = new Map(); // kept while the server stays warm
async function history(lat, lon) {
  const key = `${lat},${lon}`;
  if (!histories.has(key)) {
    const to = new Date().getUTCFullYear() - 1;
    histories.set(key, fetchJson(`${FLOOD}?latitude=${lat}&longitude=${lon}&daily=river_discharge&start_date=1990-01-01&end_date=${to}-12-31`, 12000)
      .then((d) => {
        const maxima = new Map(), byDay = new Map();
        d.daily.time.forEach((t, i) => {
          const v = d.daily.river_discharge[i];
          if (v == null) return;
          const y = t.slice(0, 4);
          if (!maxima.has(y) || v > maxima.get(y)) maxima.set(y, v);
          const md = t.slice(5);
          if (!byDay.has(md)) byDay.set(md, []);
          byDay.get(md).push(v);
        });
        const peaks = [...maxima.values()];
        return { q2: median(peaks), q5: quantile(peaks, 0.8), byDay, years: peaks.length };
      }));
    histories.get(key).catch(() => histories.delete(key));
  }
  return histories.get(key);
}

// what is usual for a date: the middle of the flows seen within a few days of the same date in the past years
function usualFor(hist, dateStr) {
  const t = Date.parse(`${dateStr}T00:00:00Z`);
  const vals = [];
  for (let k = -3; k <= 3; k += 1) {
    const list = hist.byDay.get(isoDay(t + k * DAY).slice(5));
    if (list) vals.push(...list);
  }
  return median(vals);
}

// where a flow sits: normal, high, flood (a typical yearly flood) or severe (a rare flood)
const zoneOf = (v, hist) => (v < hist.q2 * 0.5 ? "normal" : v < hist.q2 ? "high" : v < hist.q5 ? "flood" : "severe");

export function flowSummary(cell, hist) {
  const todayI = 7;
  const flow = cell.flow;
  const now = flow[todayI];
  if (now == null) return null;
  const ahead = flow.slice(todayI).map((v, i) => ({ v, i })).filter((p) => p.v != null);
  const top = ahead.reduce((b, p) => (p.v > b.v ? p : b), ahead[0]);
  const back3 = flow[todayI - 3], fwd3 = flow[todayI + 3];
  const base = Math.max(now, 1);
  let trend = "steady";
  if (fwd3 != null) trend = fwd3 > now * 1.1 ? "rising" : fwd3 < now * 0.9 ? "falling" : "steady";
  else if (back3 != null) trend = now > back3 * 1.1 ? "rising" : now < back3 * 0.9 ? "falling" : "steady";
  const rising = top.v >= base * 1.25 && top.i > 0;
  let level = "calm";
  if (hist && hist.q2 >= MIN_FLOOD_FLOW) {
    if (top.v >= hist.q5) level = "alert";
    else if (top.v >= hist.q2 || (top.v >= hist.q2 * 0.8 && rising)) level = "watch";
  }
  const usualNow = hist ? usualFor(hist, cell.time[todayI]) : null;
  return {
    now: round(now, now < 10 ? 1 : 0), peak: round(top.v, top.v < 10 ? 1 : 0), peakDay: cell.time[todayI + top.i], trend, rising, level,
    usual: round(usualNow, usualNow != null && usualNow < 10 ? 1 : 0),
    q2: hist ? round(hist.q2, 0) : null, q5: hist ? round(hist.q5, 0) : null,
    zoneNow: hist ? zoneOf(now, hist) : null, zonePeak: hist ? zoneOf(top.v, hist) : null,
    series: cell.time.map((t, i) => ({ t, v: round(cell.flow[i], cell.flow[i] != null && cell.flow[i] < 10 ? 1 : 0), u: hist ? round(usualFor(hist, t), 0) : null })),
  };
}

// rain: what NASA's satellite rain data says fell in the last week, and what the forecast says for the next days
async function rain(lat, lon) {
  const end = new Date(), start = new Date(end.getTime() - 6 * DAY);
  const ymd = (d) => isoDay(d.getTime()).replaceAll("-", "");
  const [nasa, fc] = await Promise.allSettled([
    fetchJson(`https://power.larc.nasa.gov/api/temporal/daily/point?parameters=PRECTOTCORR&community=AG&longitude=${lon}&latitude=${lat}&start=${ymd(start)}&end=${ymd(end)}&format=JSON`, 8000),
    fetchJson(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=precipitation_sum&past_days=3&forecast_days=4&timezone=Asia%2FDhaka`, 8000),
  ]);
  let nasaMm = null, nasaDays = 0;
  if (nasa.status === "fulfilled") {
    const p = nasa.value && nasa.value.properties && nasa.value.properties.parameter && nasa.value.properties.parameter.PRECTOTCORR;
    if (p) { const v = Object.values(p).filter((x) => typeof x === "number" && x > -990); nasaDays = v.length; nasaMm = v.length ? round(v.reduce((s, x) => s + x, 0), 0) : null; }
  }
  let past3 = null, next3 = null, peak = null, peakDay = null;
  if (fc.status === "fulfilled") {
    const t = fc.value.daily.time, v = fc.value.daily.precipitation_sum;
    const sum = (a, b) => v.slice(a, b).reduce((s, x) => s + (x || 0), 0);
    past3 = round(sum(0, 3), 0); next3 = round(sum(3, 7), 0);
    v.forEach((x, i) => { if (i >= 2 && x != null && (peak == null || x > peak)) { peak = x; peakDay = t[i]; } });
    peak = round(peak, 0);
  }
  const level = peak == null ? "calm" : peak >= VERY_HEAVY ? "alert" : peak >= HEAVY ? "watch" : "calm";
  return { nasaMm, nasaDays, past3, next3, peak, peakDay, level };
}

const WORSE = { calm: 0, watch: 1, alert: 2 };
const worst = (...l) => l.reduce((b, x) => (WORSE[x] > WORSE[b] ? x : b), "calm");
const addDays = (dateStr, n) => isoDay(Date.parse(`${dateStr}T00:00:00Z`) + n * DAY);

// one upstream place
async function station(id) {
  const s = STATIONS[id];
  const [cell, rn] = await Promise.allSettled([snap(s.lat, s.lon).then(async (c) => ({ c, h: await history(c.lat, c.lon).catch(() => null) })), rain(s.lat, s.lon)]);
  const flow = cell.status === "fulfilled" ? flowSummary(cell.value.c, cell.value.h) : null;
  const r = rn.status === "fulfilled" ? rn.value : null;
  const flowLevel = flow ? flow.level : "calm";
  const rainLevel = r ? r.level : "calm";
  const level = worst(flowLevel, rainLevel);
  // when the extra water is due: the day of the highest flow (or the heaviest rain), plus the usual travel time
  let reason = null, base = null;
  if (level !== "calm") {
    if (WORSE[flowLevel] >= WORSE[rainLevel]) { reason = "flow"; base = flow.peakDay; }
    else { reason = "rain"; base = r.peakDay; }
  }
  const eta = base ? { from: addDays(base, s.lead[0]), to: addDays(base, s.lead[1]), base } : null;
  return {
    id, ...s, level, reason, eta,
    flow: flow ? { ...flow, series: flow.series.map((p) => p.v) } : null,
    rain: r, failed: [flow ? null : "flow", r ? null : "rain"].filter(Boolean),
  };
}

// events (floods, storms, landslides) reported inside the wider river basin, with the closest watched place
const BASIN = { south: 20, north: 32, west: 82, east: 98 };
async function basinEvents(stations) {
  const near = (lat, lon) => stations.reduce((b, s) => { const k = kmBetween(lat, lon, s.lat, s.lon); return !b || k < b.km ? { id: s.id, km: Math.round(k) } : b; }, null);
  const inside = (lat, lon) => lat >= BASIN.south && lat <= BASIN.north && lon >= BASIN.west && lon <= BASIN.east;
  const [g, e] = await Promise.allSettled([
    fetchJson(`https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?eventlist=TC,FL&alertlevel=Green;Orange;Red&fromdate=${isoDay(Date.now() - 20 * DAY)}&todate=${isoDay(Date.now())}`, 10000),
    fetchJson("https://eonet.gsfc.nasa.gov/api/v3/events?status=open&days=20&limit=300", 10000),
  ]);
  const out = [];
  if (g.status === "fulfilled") {
    for (const f of g.value.features || []) {
      const p = f.properties, [x, y] = f.geometry.coordinates;
      if (!inside(y, x) || (p.iscurrent === "false" || p.iscurrent === false)) continue;
      out.push({ kind: p.eventtype === "TC" ? "cyclone" : "flood", title: p.name, alert: String(p.alertlevel || "").toLowerCase(), source: "GDACS", url: p.url && p.url.report, date: p.fromdate, lat: y, lon: x, near: near(y, x) });
    }
  }
  const KIND = { floods: "flood", severeStorms: "storm", landslides: "landslide" };
  if (e.status === "fulfilled") {
    for (const ev of e.value.events || []) {
      const kind = KIND[ev.categories[0] && ev.categories[0].id];
      const geo = ev.geometry[ev.geometry.length - 1];
      if (!kind || geo.type !== "Point") continue;
      const [x, y] = geo.coordinates;
      if (!inside(y, x)) continue;
      out.push({ kind, title: ev.title, source: "NASA EONET", url: ev.link, date: geo.date, lat: y, lon: x, near: near(y, x) });
    }
  }
  return { list: out.slice(0, 8), failed: g.status === "rejected" && e.status === "rejected" };
}

export async function riverWatch(lat, lon) {
  const found = nearestRiver(lat, lon);
  const river = RIVERS[found.id];
  const [local, ...ups] = await Promise.allSettled([
    snap(found.lat, found.lon, 2).then(async (c) => ({ c, h: await history(c.lat, c.lon).catch(() => null) })),
    ...river.chain.map((id) => station(id)),
  ]);
  const stations = ups.filter((u) => u.status === "fulfilled").map((u) => u.value);
  const ev = await basinEvents(stations.length ? stations : river.chain.map((id) => ({ id, ...STATIONS[id] }))).catch(() => ({ list: [], failed: true }));
  const flow = local.status === "fulfilled" ? flowSummary(local.value.c, local.value.h) : null;
  // the overall picture, nearest-to-you first when two places are equally bad
  const overall = worst(flow ? flow.level : "calm", ...stations.map((s) => s.level));
  const rainNow = await rain(lat, lon).catch(() => null);
  return {
    river: { id: found.id, km: Math.round(found.km), reach: { lat: found.lat, lon: found.lon }, line: river.reach, within: found.km <= 60 },
    flow, stations, events: ev.list, eventsFailed: ev.failed, overall, here: rainNow,
    lines: Object.fromEntries(Object.entries(RIVERS).map(([id, r]) => [id, r.reach])),
    failed: [local.status === "rejected" ? "flow" : null, stations.length < river.chain.length ? "stations" : null].filter(Boolean),
    asOf: new Date().toISOString(),
  };
}

// any place on Earth: the river model cell with the most water near it, compared with that cell's own record
export async function localRiver(lat, lon) {
  const [c, here] = await Promise.allSettled([
    snap(lat, lon, 2).then(async (cell) => ({ cell, hist: await history(cell.lat, cell.lon).catch(() => null) })),
    rain(lat, lon),
  ]);
  const flow = c.status === "fulfilled" ? flowSummary(c.value.cell, c.value.hist) : null;
  return { flow, here: here.status === "fulfilled" ? here.value : null, failed: flow ? [] : ["flow"], asOf: new Date().toISOString() };
}
