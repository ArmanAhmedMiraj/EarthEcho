// What the NASA map layers offer: the dates that really exist and the colour table of each layer.
// Example: /api/layers
// The dates come from NASA GIBS itself, so the time slider never lands on a missing picture.
// Fast way: ask GIBS for each layer's own date list (DescribeDomains, about 0.3 s each, all three at once).
// Slow fallback: the full capabilities file (about 6 MB, 8 to 12 s), used only if the fast way fails.
import { cacheFor } from "./_lib/answer.js";
import { loadColormap } from "./_lib/gibs.js";

const DOMAINS = "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/wmts.cgi?SERVICE=WMTS&request=DescribeDomains&version=1.0.0&TileMatrix=0&TileRow=0&TileCol=0";
const CAPS = "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/wmts.cgi?SERVICE=WMTS&request=GetCapabilities";

const LAYERS = [
  { id: "ndvi", layer: "MODIS_Terra_L3_NDVI_Monthly", set: "GoogleMapsCompatible_Level7", colormap: "MODIS_L3_NDVI.xml", keep: 24, show: [0, 1], unit: "NDVI", convert: (v) => v },
  { id: "lst", layer: "MODIS_Terra_L3_Land_Surface_Temp_8Day_Day", set: "GoogleMapsCompatible_Level7", colormap: "MODIS_Land_Surface_Temp.xml", keep: 36, show: [10, 50], unit: "°C", convert: (v) => v - 273.15 },
  { id: "smap", layer: "SMAP_L4_Analyzed_Surface_Soil_Moisture", set: "GoogleMapsCompatible_Level6", colormap: "SMAP_Analyzed_Soil_Moisture.xml", keep: 60, show: [0, 0.6], unit: "m³/m³", convert: (v) => v },
];

// "2026-01-09/2026-11-01/P8D" -> list of ISO dates
export function expand(range) {
  const [from, to, step] = range.split("/");
  if (!to || !step || from.includes("T")) return [];
  const m = /^P(\d+)([DM])$/.exec(step);
  if (!m) return [];
  const n = Number(m[1]);
  const out = [];
  let d = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  for (let guard = 0; d <= end && guard < 5000; guard += 1) {
    out.push(d.toISOString().slice(0, 10));
    d = m[2] === "D" ? new Date(d.getTime() + n * 86400000) : new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));
  }
  return out;
}

function block(xml, id) {
  const i = xml.indexOf(`<ows:Identifier>${id}</ows:Identifier>`);
  if (i < 0) return null;
  return xml.slice(i, xml.indexOf("</Layer>", i));
}

async function getText(url, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const r = await fetch(url, { signal: controller.signal });
    if (!r.ok) throw new Error(`NASA GIBS answered ${r.status}`);
    return await r.text();
  } finally {
    clearTimeout(timer);
  }
}

// layer id -> list of date ranges, from the small per-layer answer
async function fastRanges() {
  const out = {};
  await Promise.all(LAYERS.map(async (L) => {
    const xml = await getText(`${DOMAINS}&layer=${L.layer}&tilematrixset=${L.set}`, 8000);
    const dom = /<Domain>(.*?)<\/Domain>/.exec(xml);
    if (!dom) throw new Error("no date list");
    out[L.id] = { set: L.set, ranges: dom[1].split(",") };
  }));
  return out;
}

// the same, from the big capabilities file
async function slowRanges() {
  const xml = await getText(CAPS, 25000);
  const out = {};
  for (const L of LAYERS) {
    const b = block(xml, L.layer);
    if (!b) continue;
    const set = (/<TileMatrixSet>(GoogleMapsCompatible_Level\d+)<\/TileMatrixSet>/.exec(b) || [])[1];
    if (!set) continue;
    out[L.id] = { set, ranges: [...b.matchAll(/<Value>(.*?)<\/Value>/g)].map((x) => x[1]) };
  }
  return out;
}

export default async function handler(req, res) {
  let found;
  try {
    found = await fastRanges();
  } catch {
    try {
      found = await slowRanges();
    } catch (error) {
      return res.status(502).json({ ok: false, error: `NASA GIBS did not answer (${error.message}).` });
    }
  }

  const layers = [];
  const tables = await Promise.all(LAYERS.map((L) => loadColormap(L.colormap).catch(() => null)));
  LAYERS.forEach((L, i) => {
    const f = found[L.id];
    const table = tables[i];
    if (!f || !table) return;
    const maxZ = Number(f.set.replace("GoogleMapsCompatible_Level", ""));
    // only the last few ranges are needed, so older history is not expanded
    const dates = f.ranges.slice(-4).flatMap(expand);
    const unique = [...new Set(dates)].sort().slice(-L.keep);
    if (!unique.length) return;
    // colour table: [r, g, b, value in the unit shown], one row per colour step
    const lut = [];
    for (const [rgb, range] of table) {
      const [r, g, bl] = rgb.split(",").map(Number);
      const mid = range.high == null ? range.low : (range.low + range.high) / 2;
      lut.push([r, g, bl, Number(L.convert(mid).toFixed(3))]);
    }
    layers.push({ id: L.id, layer: L.layer, set: f.set, maxZ, dates: unique, unit: L.unit, show: L.show, lut });
  });
  if (!layers.length) return res.status(502).json({ ok: false, error: "NASA GIBS sent no usable layers." });

  cacheFor(res, 6 * 3600);
  res.status(200).json({
    ok: true,
    layers,
    source: { name: "NASA GIBS (Global Imagery Browse Services)", url: "https://earthdata.nasa.gov/gibs", note: "MODIS Terra and SMAP Level 4 pictures, as ready-made map tiles." },
  });
}
