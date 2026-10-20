// Local food-market prices near one point, from the WFP food price database (WFP VAM, shared on the Humanitarian Data Exchange).
// Market prices that WFP monitors are retail or wholesale prices in towns, not what the farmer is paid at the farm gate.
// Example: /api/markets?country=BD&lat=24&lon=90.4
import { badRequest, cacheFor, readPoint } from "./_lib/answer.js";

// the app's country code -> the data set on HDX
const DATASETS = { BD: "bangladesh", IND: "india", PAK: "pakistan", NPL: "nepal", MMR: "myanmar", BTN: "bhutan" };

// commodity words -> crop id of the planner (first match wins)
const CROP_WORDS = [
  ["rice", /\brice\b/i], ["wheat", /^wheat$|wheat \(|\bwheat\b(?! flour)/i], ["maize", /\bmaize\b|\bcorn\b/i], ["lentil", /lentil|masur|dal \(masoor/i],
  ["chickpea", /chickpea|gram \(chana\)/i], ["mungbean", /\bmung|green gram/i], ["urd", /\burd\b|black gram|mash/i], ["potato", /potato/i],
  ["onion", /onion/i], ["tomato", /tomato/i], ["eggplant", /eggplant|brinjal|aubergine/i], ["cabbage", /cabbage/i], ["cauliflower", /cauliflower/i],
  ["okra", /okra|ladies/i], ["carrot", /carrot/i], ["garlic", /garlic/i], ["chilli", /chil+i/i], ["pumpkin", /pumpkin/i], ["bottlegourd", /gourd \(bottle\)|bottle gourd/i],
  ["snakegourd", /snake gourd/i], ["bittergourd", /bitter gourd|gourd \(bitter\)/i], ["cucumber", /cucumber/i], ["spinach", /spinach/i], ["radish", /radish/i],
  ["groundnut", /groundnut|peanut/i], ["sesame", /sesame/i], ["mustard", /mustard/i], ["soybean", /soy.?bean(?!.*oil)/i], ["sweetpotato", /sweet potato/i],
  ["banana", /banana/i], ["papaya", /papaya/i], ["ginger", /ginger/i], ["turmeric", /turmeric/i], ["coriander", /coriander/i], ["sorghum", /sorghum|jowar/i],
  ["pearlmillet", /pearl millet|bajra/i], ["fingermillet", /finger millet|ragi/i], ["cassava", /cassava/i], ["pea", /\bpeas?\b/i],
];
const cropOf = (name) => (CROP_WORDS.find(([, re]) => re.test(name)) || [null])[0];

// how many kilograms one price unit is (only weight units; anything else has no price per kg)
const KG = { kg: 1, "100 kg": 100, "50 kg": 50, "25 kg": 25, "10 kg": 10, "5 kg": 5, mt: 1000, quintal: 100, "100 kg ": 100 };
const kgOf = (unit) => KG[String(unit).trim().toLowerCase()] || null;

const hav = (aLat, aLon, bLat, bLon) => {
  const r = Math.PI / 180;
  const h = Math.sin(((bLat - aLat) * r) / 2) ** 2 + Math.cos(aLat * r) * Math.cos(bLat * r) * Math.sin(((bLon - aLon) * r) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
};

// a CSV line to fields (handles "quoted, fields")
function fields(line) {
  const out = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (q) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i += 1; } else q = false;
      } else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { out.push(cur); cur = ""; } else cur += ch;
  }
  out.push(cur);
  return out;
}

const cache = new Map(); // country -> { at, rows }
async function loadRows(country) {
  const hit = cache.get(country);
  if (hit && Date.now() - hit.at < 6 * 3600 * 1000) return hit.rows;
  const meta = await fetch(`https://data.humdata.org/api/3/action/package_show?id=wfp-food-prices-for-${DATASETS[country]}`, { signal: AbortSignal.timeout(15000) }).then((r) => r.json());
  const resource = meta.result.resources.find((r) => /food prices/i.test(r.name) && /csv/i.test(r.format)) || meta.result.resources[0];
  const text = await fetch(resource.url, { signal: AbortSignal.timeout(40000), redirect: "follow" }).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.text();
  });
  const lines = text.split(/\r?\n/);
  const head = fields(lines[0]);
  const ix = Object.fromEntries(head.map((h, i) => [h, i]));
  const from = new Date(Date.now() - 16 * 31 * 86400000).toISOString().slice(0, 10);
  const rows = [];
  for (let i = 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line || line[0] === "#") continue;
    if (line.slice(0, 10) < from) continue; // old rows are skipped before the (slower) full parse
    const f = fields(line);
    const price = Number(f[ix.price]);
    if (!Number.isFinite(price) || price <= 0) continue;
    rows.push({
      date: f[ix.date], admin1: f[ix.admin1], market: f[ix.market], lat: Number(f[ix.latitude]), lon: Number(f[ix.longitude]),
      commodity: f[ix.commodity], unit: f[ix.unit], type: f[ix.pricetype], currency: f[ix.currency], price, usd: Number(f[ix.usdprice]),
    });
  }
  cache.set(country, { at: Date.now(), rows, updated: meta.result.last_modified });
  return rows;
}

export default async function handler(req, res) {
  const country = String(req.query.country || "").toUpperCase();
  const point = readPoint(req.query);
  if (!point) return badRequest(res, "Use ?lat=..&lon=.. with real coordinates.");
  if (!DATASETS[country]) {
    cacheFor(res, 86400);
    return res.status(200).json({ ok: true, available: false, reason: "country", items: [] });
  }
  try {
    const rows = await loadRows(country);
    const latest = rows.reduce((m, r) => (r.date > m ? r.date : m), "0000");
    const recentFrom = new Date(new Date(latest).getTime() - 120 * 86400000).toISOString().slice(0, 10);

    // group by commodity + unit + price type, then by market
    const groups = new Map();
    for (const r of rows) {
      if (r.date.slice(0, 7) < new Date(new Date(latest).getTime() - 13 * 31 * 86400000).toISOString().slice(0, 7)) continue;
      const key = `${r.commodity}|${r.unit}|${r.type}`;
      if (!groups.has(key)) groups.set(key, new Map());
      const g = groups.get(key);
      if (!g.has(r.market)) g.set(r.market, []);
      g.get(r.market).push(r);
    }
    const items = [];
    for (const [key, markets] of groups) {
      const [commodity, unit, type] = key.split("|");
      let best = null;
      for (const [market, list] of markets) {
        const newest = list.reduce((m, r) => (r.date > m ? r.date : m), "0000");
        if (newest < recentFrom) continue; // that market stopped reporting
        const km = Math.round(hav(point.lat, point.lon, list[0].lat, list[0].lon));
        if (!Number.isFinite(km)) continue;
        if (!best || km < best.km) best = { market, km, list, admin1: list[0].admin1 };
      }
      if (!best) continue;
      const byMonth = new Map();
      for (const r of best.list) {
        const m = r.date.slice(0, 7);
        if (!byMonth.has(m)) byMonth.set(m, []);
        byMonth.get(m).push(r.price);
      }
      const series = [...byMonth.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([m, v]) => ({ m, p: Number((v.reduce((a, b) => a + b, 0) / v.length).toFixed(2)) }));
      const last = series[series.length - 1];
      const before = (n) => { const target = new Date(`${last.m}-01`); target.setMonth(target.getMonth() - n); const k = target.toISOString().slice(0, 7); const f = series.find((s) => s.m === k); return f ? f.p : null; };
      const kg = kgOf(unit);
      const ch = (old) => (old ? Number((((last.p - old) / old) * 100).toFixed(1)) : null);
      items.push({
        commodity, unit, type, crop: cropOf(commodity), market: best.market, admin1: best.admin1, km: best.km,
        currency: best.list[0].currency, last: last.p, lastMonth: last.m, perKg: kg ? Number((last.p / kg).toFixed(2)) : null,
        change3: ch(before(3)), change12: ch(before(12)), series,
      });
    }
    items.sort((a, b) => (b.crop ? 1 : 0) - (a.crop ? 1 : 0) || a.commodity.localeCompare(b.commodity));
    const nearest = [...new Map(items.map((i) => [i.market, i.km])).entries()].sort((a, b) => a[1] - b[1]).slice(0, 3).map(([name, km]) => ({ name, km }));
    cacheFor(res, 12 * 3600);
    res.status(200).json({
      ok: true,
      available: true,
      country,
      latest,
      nearest,
      items,
      provenance: {
        name: "WFP Food Prices, via the Humanitarian Data Exchange (UN OCHA)",
        url: `https://data.humdata.org/dataset/wfp-food-prices-for-${DATASETS[country]}`,
        licence: "CC BY-IGO",
        note: "Prices WFP monitors in local markets (mostly retail). The farmer's farm-gate price is usually lower. The nearest market that reported recently is used for each item.",
      },
    });
  } catch (e) {
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({ ok: true, available: false, reason: "busy", items: [] });
  }
}
