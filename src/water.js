// Water countdown: how many days until the field needs irrigation.
// Upland crops (potato, mustard, mungbean): a soil "water tank" in mm. Each day ETc (crop water use) takes water out
// and effective rain puts it back. Irrigate when the tank has lost the share the crop can lose without stress (FAO-56).
// Rice: the depth of standing water. Each day crop use and seepage take water out and rain puts it back.
// Simple rules, not an AI model. Every number below has a source in WATER_SOURCES.

const RICE_CROPS = ["boro", "boroSalt", "taman", "aus"];
export const isRice = (crop) => RICE_CROPS.includes(crop);
export const isUpland = (crop) => ["potato", "mustard", "mungbean"].includes(crop);

// Crop coefficient Kc at four stages: 0 just planted, 1 growing fast, 2 full size and flowering, 3 ripening.
// ini, mid and end are from FAO-56 Table 12. The growing stage is the middle of ini and mid (a straight line between them).
// Where the table gives a range (rice end 0.90-0.60, mustard mid 1.0-1.15, mungbean end 0.60-0.35) the middle is used.
const KC = {
  rice: { ini: 1.05, mid: 1.2, end: 0.75 },
  potato: { ini: 0.5, mid: 1.15, end: 0.75 },
  mustard: { ini: 0.35, mid: 1.075, end: 0.35 },
  mungbean: { ini: 0.4, mid: 1.05, end: 0.475 },
};

// Rooting depth Zr (m) and allowed depletion p for upland crops, FAO-56 Table 22 (the smaller Zr, which is the
// value for irrigation scheduling): potato 0.4 / 0.35, rapeseed (for mustard) 1.0 / 0.60, green gram (for mungbean) 0.6 / 0.45.
const UPLAND = {
  potato: { kc: KC.potato, zr: 0.4, p: 0.35 },
  mustard: { kc: KC.mustard, zr: 1.0, p: 0.6 },
  mungbean: { kc: KC.mungbean, zr: 0.6, p: 0.45 },
};

// Water the soil can hold for plants, mm per metre of soil. Loamy sand 90 is the FAO-56 example (used for sandy and
// sandy loam); the rest are field capacity minus wilting point from the Saxton and Rawls table: loam 0.16,
// silt loam 0.17, clay loam 0.17 and silty clay loam 0.14 (clay loam type 0.15), clay 0.12.
export const SOIL_AW = { sandy: 90, sandyLoam: 90, loam: 160, siltLoam: 170, clayLoam: 150, clay: 120 };

// Water lost by seepage and percolation from a rice field, mm per day (FAO): heavy clay 4, average 6, sandy 8.
export const SOIL_PERC = { sandy: 8, sandyLoam: 8, loam: 6, siltLoam: 6, clayLoam: 6, clay: 4 };

const FALLBACK_ET0 = 4; // mm per day, used only when a day has no ET0 value
const RICE_CAP = 100; // mm: the bunds are assumed to hold about 10 cm, extra rain runs off

export const WATER_SOURCES = [
  { id: "W1", by: "FAO", title: "Irrigation and Drainage Paper 56, Table 12: single crop coefficients (Kc)", url: "https://www.fao.org/4/x0490e/x0490e0b.htm" },
  { id: "W2", by: "FAO", title: "Irrigation and Drainage Paper 56, Table 22: rooting depth and allowed depletion; soil water examples", url: "https://www.fao.org/4/x0490e/x0490e0e.htm" },
  { id: "W3", by: "Minnesota Stormwater Manual (Saxton and Rawls, 2006)", title: "Soil water storage properties by soil texture", url: "https://stormwater.pca.state.mn.us/index.php/Soil_water_storage_properties" },
  { id: "W4", by: "FAO", title: "Water requirements of rice: seepage and percolation by soil", url: "https://www.fao.org/3/S2022E/s2022e08.htm" },
  { id: "W5", by: "WOCAT", title: "Alternate wetting and drying (AWD) in rice, Bangladesh", url: "https://qcat.wocat.net/en/wocat/technologies/view/permalink/4671" },
  { id: "W6", by: "Bangladesh Agricultural University", title: "Seepage and percolation loss in a rice field (1 to 8.5 mm per day)", url: "https://jsau.sau.ac.bd/?p=302" },
  { id: "W7", by: "Open-Meteo", title: "Weather API: rain and FAO-56 reference evapotranspiration (ET0)", url: "https://open-meteo.com/en/docs" },
];

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

// Rain that already fell is counted in full. Forecast rain (today and later) is counted only when the chance of rain
// is 50 percent or more, so an unlikely shower does not delay your irrigation. This is a rule of mine, not from a source.
export const LIKELY = 50;
export const rainCounted = (d, future) => {
  const mm = d.rain || 0;
  if (!future) return mm;
  return d.chance != null && d.chance < LIKELY ? 0 : mm;
};

export function kcFor(model, stage) {
  const k = model === "rice" ? KC.rice : KC[model];
  if (stage <= 0) return k.ini;
  if (stage === 1) return (k.ini + k.mid) / 2;
  if (stage === 2) return k.mid;
  return k.end;
}

// Rain under 5 mm in a day mostly dries off the leaves and soil, above that 80 percent is counted.
// This is a simple rule of mine, not a figure from a source.
export const effectiveRain = (mm) => (mm != null && mm >= 5 ? 0.8 * mm : 0);

// Which stage a crop is in today, from where today sits between planting and harvest (0..24 half-month line).
export function stageFromProgress(fraction) {
  if (fraction < 0.2) return 0;
  if (fraction < 0.45) return 1;
  if (fraction < 0.8) return 2;
  return 3;
}

// What is probably growing in the field today, taken from the rotation steps and harvest dates.
export function guessField(flow, now, SLOTS = 24) {
  for (const s of flow) {
    let a = s.plant;
    let b = s.harvest;
    let pos = now;
    if (b > SLOTS && pos < a) pos += SLOTS; // a crop that runs past 31 December
    if (pos >= a && pos < b) {
      return { crop: s.crop, stage: stageFromProgress((pos - a) / Math.max(0.01, b - a)) };
    }
  }
  return { crop: null, stage: 1 };
}

// ---- upland crops ----
// since = days since the field was last irrigated or soaked by heavy rain (0 to 7); null means more than 7 days.
export function uplandCountdown({ crop, stage, soil, since, past = [], days = [] }) {
  const m = UPLAND[crop];
  const aw = SOIL_AW[soil] || SOIL_AW.loam;
  const taw = aw * m.zr;
  const raw = m.p * taw;
  const kc = kcFor(crop, stage);
  const base = { kind: "upland", taw, raw, kc, soilKnown: !!SOIL_AW[soil] };
  if (since == null) return { ...base, status: "check", rows: [] };

  const series = [...past, ...days];
  const t0 = past.length; // today
  const start = t0 - since;
  if (start < 0 || days.length === 0) return { ...base, status: "check", rows: [] };

  let dr = 0;
  let drToday = 0;
  let first = null;
  const rows = [];
  for (let i = start; i < series.length; i++) {
    const d = series[i];
    if (i === t0) drToday = dr;
    const etc = (d.et0 != null ? d.et0 : FALLBACK_ET0) * kc;
    const counted = rainCounted(d, i >= t0);
    const eff = effectiveRain(counted);
    dr = clamp(dr + etc - eff, 0, taw);
    if (i >= t0) {
      const day = i - t0;
      rows.push({ date: d.date, rain: d.rain || 0, counted: counted > 0 || !(d.rain > 0), etc, eff, level: 1 - dr / taw, low: dr >= raw });
      if (first == null && dr >= raw) first = day;
    }
  }
  const status = drToday >= raw ? "now" : first == null ? "none" : first === 0 ? "today" : "later";
  return {
    ...base,
    status,
    inDays: first,
    leftNow: 1 - drToday / taw, // share of the plant-available water still in the soil this morning
    giveMm: raw, // water to put back when the crop is at the limit
    rainSoon: rainSoon(rows),
    rows,
  };
}

// ---- rice: standing water ----
// standing = mm of water on the field on the day the farmer last looked (0 = wet mud, null = dry and cracking).
// ago = how many days ago that was (0 to 7), null when it was longer ago.
export function riceCountdown({ crop, stage, soil, standing, ago = 0, past = [], days = [] }) {
  const kc = kcFor("rice", stage);
  const perc = SOIL_PERC[soil] != null ? SOIL_PERC[soil] : 6;
  const base = { kind: "rice", kc, perc, soilKnown: SOIL_PERC[soil] != null };
  if (ago == null) return { ...base, status: "stale", rows: [] };
  if (days.length === 0) return { ...base, status: "check", rows: [] };
  if (standing == null && ago === 0) return { ...base, status: "now", rows: [], leftNow: 0 };

  const series = [...past, ...days];
  const t0 = past.length;
  const start = t0 - ago;
  if (start < 0) return { ...base, status: "stale", rows: [] };

  let h = standing == null ? 0 : standing;
  let hToday = h;
  let first = null;
  const rows = [];
  for (let i = start; i < series.length; i++) {
    const d = series[i];
    if (i === t0) hToday = h;
    const etc = (d.et0 != null ? d.et0 : FALLBACK_ET0) * kc;
    const counted = rainCounted(d, i >= t0);
    h = Math.min(RICE_CAP, h + counted - etc - perc);
    if (i >= t0) {
      const day = i - t0;
      rows.push({ date: d.date, rain: d.rain || 0, counted: counted > 0 || !(d.rain > 0), etc, level: clamp(h, 0, RICE_CAP) / RICE_CAP, low: h <= 0, mm: Math.max(0, h) });
      if (first == null && h <= 0) first = day;
    }
  }
  const dryToday = hToday <= 0;
  const status = dryToday ? "now" : first == null ? "none" : first === 0 ? "today" : "later";
  return { ...base, status, inDays: first, leftNow: Math.max(0, hToday), rainSoon: rainSoon(rows), rows };
}

// Rain (mm) counted in the next 3 days, shown to the farmer so they see why the countdown moved.
function rainSoon(rows) {
  return rows.slice(0, 3).reduce((sum, r) => sum + (r.counted ? r.rain : 0), 0);
}