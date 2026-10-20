// Hazards near one point, from four open sources. Each source is read on its own, so one failing never hides the others:
//   USGS earthquakes (last 30 days), GDACS alerts (UN / EU: cyclones, floods, droughts, volcanoes, fires, earthquakes),
//   NASA EONET (open natural events such as wildfires and storms) and the Open-Meteo river-flow (flood) model.
// Example: /api/disasters?lat=24&lon=90.4
import { badRequest, cacheFor, readPoint } from "./_lib/answer.js";

const DAY = 86400000;
const km = (aLat, aLon, bLat, bLon) => {
  const r = Math.PI / 180;
  const h = Math.sin(((bLat - aLat) * r) / 2) ** 2 + Math.cos(aLat * r) * Math.cos(bLat * r) * Math.sin(((bLon - aLon) * r) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
};
const day = (ms) => new Date(ms).toISOString().slice(0, 10);

async function getJson(url, ms = 15000) {
  const response = await fetch(url, { signal: AbortSignal.timeout(ms), headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function earthquakes(lat, lon) {
  const from = day(Date.now() - 30 * DAY);
  let features;
  try {
    const d = await getJson(
      `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&latitude=${lat}&longitude=${lon}&maxradiuskm=500&starttime=${from}&minmagnitude=3&orderby=magnitude&limit=60`,
    );
    features = d.features;
  } catch {
    // the search service is sometimes down: the published monthly feed (magnitude 2.5 and up) has the same events
    const d = await getJson("https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_month.geojson", 25000);
    features = d.features;
  }
  return features
    .map((f) => ({
      kind: "earthquake",
      title: f.properties.title,
      magnitude: f.properties.mag,
      time: new Date(f.properties.time).toISOString(),
      km: Math.round(km(lat, lon, f.geometry.coordinates[1], f.geometry.coordinates[0])),
      depthKm: Math.round(f.geometry.coordinates[2]),
      url: f.properties.url,
      source: "USGS",
    }))
    .filter((e) => e.km <= 500 && e.magnitude >= 3)
    .sort((a, b) => b.magnitude - a.magnitude)
    .slice(0, 8);
}

const GDACS_KIND = { TC: "cyclone", FL: "flood", DR: "drought", VO: "volcano", WF: "wildfire", EQ: "earthquake" };
const GDACS_RANGE = { TC: 1500, FL: 600, DR: 1500, VO: 800, WF: 500, EQ: 0 }; // km; earthquakes come from USGS
async function gdacs(lat, lon) {
  const d = await getJson(
    `https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?eventlist=TC,FL,DR,VO,WF&alertlevel=Green;Orange;Red&fromdate=${day(Date.now() - 45 * DAY)}&todate=${day(Date.now())}`,
    20000,
  );
  return d.features
    .map((f) => {
      const p = f.properties;
      const [x, y] = f.geometry.coordinates;
      return {
        kind: GDACS_KIND[p.eventtype],
        title: p.name,
        alert: String(p.alertlevel || "").toLowerCase(),
        country: p.country,
        from: p.fromdate,
        to: p.todate,
        km: Math.round(km(lat, lon, y, x)),
        range: GDACS_RANGE[p.eventtype],
        current: p.iscurrent === "true" || p.iscurrent === true,
        url: p.url && p.url.report,
        source: "GDACS",
      };
    })
    .filter((e) => e.kind && e.km <= e.range && e.current !== false)
    .sort((a, b) => a.km - b.km)
    .slice(0, 8);
}

const EONET_KIND = { wildfires: "wildfire", severeStorms: "storm", volcanoes: "volcano", floods: "flood", drought: "drought", landslides: "landslide", dustHaze: "dust", tempExtremes: "temperature" };
async function eonet(lat, lon) {
  const d = await getJson("https://eonet.gsfc.nasa.gov/api/v3/events?status=open&days=30&limit=300", 20000);
  return d.events
    .map((e) => {
      const g = e.geometry[e.geometry.length - 1];
      const [x, y] = g.coordinates;
      const kind = EONET_KIND[e.categories[0] && e.categories[0].id];
      return {
        kind,
        title: e.title,
        time: g.date,
        km: g.type === "Point" ? Math.round(km(lat, lon, y, x)) : null,
        size: g.magnitudeValue ? `${g.magnitudeValue} ${g.magnitudeUnit}` : null,
        url: e.link,
        source: "NASA EONET",
      };
    })
    .filter((e) => e.kind && e.km != null && e.km <= 700)
    .sort((a, b) => a.km - b.km)
    .slice(0, 8);
}

// the river-flow model: how the flow forecast for the next 16 days compares with today's flow
async function river(lat, lon) {
  const d = await getJson(
    `https://flood-api.open-meteo.com/v1/flood?latitude=${lat}&longitude=${lon}&daily=river_discharge,river_discharge_max&past_days=7&forecast_days=16`,
  );
  const flow = d.daily.river_discharge;
  const times = d.daily.time;
  const todayIndex = 7;
  const now = flow[todayIndex];
  if (now == null) return null;
  const ahead = flow.slice(todayIndex);
  const peak = Math.max(...ahead.filter((v) => v != null));
  const peakDay = times[todayIndex + ahead.indexOf(peak)];
  const typical = [...flow.filter((v) => v != null)].sort((a, b) => a - b)[Math.floor(flow.filter((v) => v != null).length / 2)];
  return { now: Number(now.toFixed(1)), peak: Number(peak.toFixed(1)), peakDay, typical: Number(typical.toFixed(1)), ratio: now > 0 ? Number((peak / now).toFixed(2)) : null, series: times.map((t, i) => ({ t, v: flow[i] })) };
}

export default async function handler(req, res) {
  const point = readPoint(req.query);
  if (!point) return badRequest(res, "Use ?lat=..&lon=.. with real coordinates.");
  const { lat, lon } = point;
  const names = ["earthquakes", "alerts", "events", "river"];
  const results = await Promise.allSettled([earthquakes(lat, lon), gdacs(lat, lon), eonet(lat, lon), river(lat, lon)]);
  const out = {};
  const failed = [];
  results.forEach((r, i) => {
    if (r.status === "fulfilled") out[names[i]] = r.value;
    else {
      out[names[i]] = names[i] === "river" ? null : [];
      failed.push(names[i]);
    }
  });
  if (failed.length) res.setHeader("Cache-Control", "no-store");
  else cacheFor(res, 1800);
  res.status(200).json({
    ok: true,
    location: point,
    ...out,
    failed,
    provenance: [
      { name: "USGS Earthquake Hazards Program", url: "https://earthquake.usgs.gov", note: "Public domain. Earthquakes of magnitude 3 and more within 500 km in the last 30 days." },
      { name: "GDACS, Global Disaster Alert and Coordination System (UN and European Commission)", url: "https://www.gdacs.org", note: "Alerts for cyclones, floods, droughts, volcanoes and fires. Colours are GDACS's own: green, orange, red." },
      { name: "NASA EONET, Earth Observatory Natural Event Tracker", url: "https://eonet.gsfc.nasa.gov", note: "Open natural events collected from public agencies: wildfires, storms, volcanoes." },
      { name: "Open-Meteo Flood API (GloFAS river-flow model)", url: "https://open-meteo.com/en/docs/flood-api", note: "Modelled river flow on a 5 km grid, not a gauge reading. Non-commercial use, CC BY 4.0." },
    ],
  });
}
