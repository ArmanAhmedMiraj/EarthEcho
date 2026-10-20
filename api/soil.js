// Soil of one place from ISRIC SoilGrids 2.0 (a machine-learning soil map, 250 m), with uncertainty.
// Example: /api/soil?lat=25.75&lon=89.25
import { badRequest, cacheFor, readPoint } from "./_lib/answer.js";
import { project, readValue } from "./_lib/soilgrids.js";

// SoilGrids layer used for the farm's topsoil. The 5-15 cm layer is the one where seeds and young roots live.
const DEPTH = "5-15cm";
// SoilGrids stores whole numbers. The divisor turns them into the units farmers know.
const SCALE = { clay: 10, sand: 10, phh2o: 10, soc: 10, nitrogen: 100, cec: 10, bdod: 100 };
const PROPS = Object.keys(SCALE);
const UNITS = { clay: "%", sand: "%", phh2o: "pH", soc: "g/kg", nitrogen: "g/kg", cec: "cmol(c)/kg", bdod: "kg/dm³" };

// USDA texture triangle: sand, clay in %, silt is the rest
export function textureClass(sand, clay) {
  const silt = 100 - sand - clay;
  if (silt + 1.5 * clay < 15) return "Sand";
  if (silt + 1.5 * clay >= 15 && silt + 2 * clay < 30) return "Loamy Sand";
  if ((clay >= 7 && clay < 20 && sand > 52 && silt + 2 * clay >= 30) || (clay < 7 && silt < 50 && silt + 2 * clay >= 30)) return "Sandy Loam";
  if (clay >= 7 && clay < 27 && silt >= 28 && silt < 50 && sand <= 52) return "Loam";
  if ((silt >= 50 && clay >= 12 && clay < 27) || (silt >= 50 && silt < 80 && clay < 12)) return "Silty Loam";
  if (silt >= 80 && clay < 12) return "Silt";
  if (clay >= 20 && clay < 35 && silt < 28 && sand > 45) return "Sandy Clay Loam";
  if (clay >= 27 && clay < 40 && sand > 20 && sand <= 45) return "Clay Loam";
  if (clay >= 27 && clay < 40 && sand <= 20) return "Silty Clay Loam";
  if (clay >= 35 && sand > 45) return "Sandy Clay";
  if (clay >= 40 && silt >= 40) return "Silty Clay";
  if (clay >= 40 && sand <= 45 && silt < 40) return "Clay";
  return "Loam";
}

// the six soil types the rest of the app uses
const SIMPLE = {
  Sand: "sandy", "Loamy Sand": "sandy", "Sandy Loam": "sandyLoam", Loam: "loam", "Silty Loam": "siltLoam", Silt: "siltLoam",
  "Sandy Clay Loam": "clayLoam", "Clay Loam": "clayLoam", "Silty Clay Loam": "clayLoam", "Sandy Clay": "clay", "Silty Clay": "clay", Clay: "clay",
};

// A seeded random generator, so the same place always gives the same percentages
function random(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
// A value drawn from SoilGrids' own prediction interval. We know three points of the spread:
// 5% of values lie below `low`, about half below `mid`, and 95% below `high`. A random number between 0 and 1
// is turned into a value by drawing straight lines between those points (and between 0 or 100 and the ends).
function drawValue(u, low, mid, high) {
  if (u < 0.05) return (u / 0.05) * low;
  if (u < 0.5) return low + ((u - 0.05) / 0.45) * (mid - low);
  if (u < 0.95) return mid + ((u - 0.5) / 0.45) * (high - mid);
  return high + ((u - 0.95) / 0.05) * (Math.min(100, high * 1.15 + 5) - high);
}

const GROUP = {
  Sand: "coarse", "Loamy Sand": "coarse", "Sandy Loam": "coarse",
  Loam: "medium", "Silty Loam": "medium", Silt: "medium", "Sandy Clay Loam": "medium",
  "Clay Loam": "fine", "Silty Clay Loam": "fine", "Sandy Clay": "fine", "Silty Clay": "fine", Clay: "fine",
};

// How sure are we of the texture class? Draw 3000 plausible (sand, clay) pairs from the SoilGrids intervals and count
// how often each class and each group (coarse, medium, fine) comes out. The sand and clay errors are treated as
// independent, which is stated to the user.
function classConfidence(clay, sand, clayLow, clayHigh, sandLow, sandHigh, seed) {
  const rand = random(seed);
  const counts = {};
  const groups = {};
  let used = 0;
  for (let i = 0; i < 3000; i += 1) {
    const c = drawValue(rand(), clayLow, clay, clayHigh);
    const s = drawValue(rand(), sandLow, sand, sandHigh);
    if (c + s > 100) continue;
    const name = textureClass(s, c);
    counts[name] = (counts[name] || 0) + 1;
    groups[GROUP[name]] = (groups[GROUP[name]] || 0) + 1;
    used += 1;
  }
  const pct = (n) => Math.round((n / Math.max(1, used)) * 100);
  return {
    all: Object.fromEntries(Object.entries(counts).map(([name, n]) => [name, pct(n)])),
    alternatives: Object.entries(counts).map(([name, n]) => ({ name, share: pct(n) })).sort((a, b) => b.share - a.share).slice(0, 3),
    groups: Object.fromEntries(Object.entries(groups).map(([g, n]) => [g, pct(n)])),
  };
}

const mark = (v, cuts) => cuts.findIndex((c) => v < c); // index of the first limit above v, or -1 if above all

export default async function handler(req, res) {
  const point = readPoint(req.query || {});
  if (!point) return badRequest(res, "Give a real place: ?lat=25.75&lon=89.25");
  const [X, Y] = project(point.lat, point.lon);

  // all the reads run together (the helper keeps a few downloads going at once)
  const jobs = PROPS.map((prop) => ({ prop, stat: "mean" }));
  for (const prop of ["clay", "sand", "phh2o", "soc"]) jobs.push({ prop, stat: "Q0.05" }, { prop, stat: "Q0.95" });
  const readOne = async (job) => {
    try {
      const r = await readValue(job.prop, `${DEPTH}_${job.stat}`, X, Y);
      return { ...job, value: r ? r.value / SCALE[job.prop] : null, half: r ? r.half : null };
    } catch {
      return { ...job, value: null, half: null };
    }
  };
  let results = await Promise.all(jobs.map(readOne));
  // an empty answer can also be a dropped connection, so every empty one is asked for again (up to two more times)
  for (let round = 0; round < 2 && results.some((r) => r.value == null); round += 1) {
    await new Promise((done) => setTimeout(done, 400));
    results = await Promise.all(results.map((r) => (r.value == null ? readOne(r) : r)));
  }
  const get = (prop, stat = "mean") => {
    const r = results.find((x) => x.prop === prop && x.stat === stat);
    return r ? r.value : null;
  };
  const round = (v, d) => (v == null ? null : Number(v.toFixed(d)));

  const topsoil = {
    clay: round(get("clay"), 1), sand: round(get("sand"), 1), phh2o: round(get("phh2o"), 2),
    soc: round(get("soc"), 1), nitrogen: round(get("nitrogen"), 2), cec: round(get("cec"), 1), bdod: round(get("bdod"), 2),
  };
  if (Object.values(topsoil).every((v) => v == null)) {
    cacheFor(res, 300);
    return res.status(200).json({ ok: true, location: point, available: false, reason: "SoilGrids has no soil data here (water, ice, or built-up land)." });
  }
  const range = (prop) => {
    const low = get(prop, "Q0.05");
    const high = get(prop, "Q0.95");
    return low != null && high != null ? [round(low, 2), round(high, 2)] : null;
  };
  const intervals = { clay: range("clay"), sand: range("sand"), phh2o: range("phh2o"), soc: range("soc") };

  let texture = null;
  if (topsoil.clay != null && topsoil.sand != null) {
    const { clay, sand } = topsoil;
    const silt = Math.max(0, round(100 - clay - sand, 1));
    const name = textureClass(sand, clay);
    let alternatives = [];
    let groups = null;
    let all = {};
    if (intervals.clay && intervals.sand) {
      const seed = Math.round(point.lat * 100) * 100000 + Math.round(point.lon * 100) + 40000000;
      ({ alternatives, groups, all } = classConfidence(clay, sand, intervals.clay[0], intervals.clay[1], intervals.sand[0], intervals.sand[1], seed));
    }
    const confidence = intervals.clay && intervals.sand ? all[name] || 0 : null;
    const groupName = GROUP[name];
    const groupConfidence = groups && groups[groupName] != null ? groups[groupName] : null;
    texture = {
      clay, sand, silt, class: name, simple: SIMPLE[name] || "loam", group: groupName,
      confidence, groupConfidence, groups,
      confidenceLevel: groupConfidence == null ? null : groupConfidence >= 70 ? "high" : groupConfidence >= 50 ? "medium" : "low",
      alternatives,
    };
  }

  // fertility readings in plain classes
  const { phh2o: ph, soc, nitrogen: n, cec } = topsoil;
  const pick = (v, cuts, names) => {
    if (v == null) return null;
    const i = cuts.findIndex((c) => v < c);
    return names[i === -1 ? names.length - 1 : i];
  };
  const classes = {
    ph: pick(ph, [5.0, 5.5, 6.5, 7.5, 8.5], ["veryAcid", "acid", "slightAcid", "neutral", "alkaline", "veryAlkaline"]),
    carbon: pick(soc, [10, 20, 40], ["low", "moderate", "good", "rich"]),
    nitrogen: pick(n, [1, 2], ["low", "moderate", "good"]),
    cec: pick(cec, [10, 25], ["low", "medium", "high"]),
  };

  // when a main reading is still missing, do not let the CDN keep the answer for long
  const partial = PROPS.some((p) => topsoil[p] == null) || (texture && !intervals.clay);
  cacheFor(res, partial ? 120 : 7 * 86400); // soil does not change from week to week
  res.status(200).json({
    ok: true,
    available: true,
    partial,
    location: point,
    depth: "5-15 cm",
    topsoil,
    intervals,
    units: UNITS,
    texture,
    classes,
    widened: results.some((r) => r.stat === "mean" && r.half === 8),
    provenance: {
      name: "ISRIC SoilGrids 2.0",
      publisher: "ISRIC - World Soil Information",
      url: "https://soilgrids.org/",
      licence: "CC BY 4.0",
      resolution: "250 m",
      method:
        "A machine-learning model (quantile regression forests) trained on soil profiles from the WoSIS database and on satellite and climate layers. The range shown is SoilGrids' own 5% to 95% prediction interval.",
      note: "A model estimate for a 250 m pixel, not a laboratory test of your field. Built-up land and water are blank in SoilGrids, so the middle value of nearby pixels is used there.",
    },
  });
}
