// Crop suitability, worked out the way the FAO EcoCrop method does it (Hackett, 1991):
// every crop has a range of temperature, rainfall and soil pH it can live in, and a smaller range where it does best.
// For each possible sowing month we check the months the crop would be growing, and the score is set by the
// factor that is worst (the "limiting factor"). A score is between 0 (impossible) and 1 (ideal).

const BASE = import.meta.env.BASE_URL;
let cache = null;

export function loadCropTable() {
  if (!cache) {
    cache = fetch(`${BASE}crops/ecocrop.json`)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
  }
  return cache;
}

// 0 below a, rises to 1 at b, stays 1 until c, falls to 0 at d
export function trapezoid(x, a, b, c, d) {
  if (x == null || Number.isNaN(x)) return null;
  if (x <= a || x >= d) return 0;
  if (x < b) return (x - a) / (b - a);
  if (x <= c) return 1;
  return (d - x) / (d - c);
}

// the soil texture letters (L light, M medium, H heavy) a soil type covers
const SOIL_CODES = { sandy: ["L"], sandyLoam: ["L", "M"], loam: ["M"], siltLoam: ["M"], clayLoam: ["M", "H"], clay: ["H"] };
const GROUP_CODES = { coarse: ["L"], medium: ["M"], fine: ["H"] };

function textureFactor(crop, soilCodes) {
  if (!soilCodes) return null;
  if (crop.text.includes("W")) return 1;
  const best = crop.text.filter((c) => c !== "O");
  if (soilCodes.some((c) => best.includes(c))) return 1;
  if (crop.textr.includes("W") || soilCodes.some((c) => crop.textr.includes(c))) return 0.8;
  return 0.5;
}

// How many months a crop occupies the field. EcoCrop gives the shortest and the longest cycle; the longest is often
// for a different season or variety (maize: 65 to 365 days), so we assume the shortest cycle plus a quarter of the range.
// This is our own assumption and the page says so.
export function cycleMonths(crop) {
  const days = crop.gmin + 0.25 * Math.max(0, crop.gmax - crop.gmin);
  return Math.min(12, Math.max(1, Math.round(days / 30)));
}

// one scenario of the soil: a pH and a set of texture letters (either may be missing)
function scoreMonths(crop, months, ph, codes) {
  const n = cycleMonths(crop);
  // The soil is an estimate with a wide range, so it can lower a score by at most half. Only a pH outside the crop's
  // absolute limits sets the score to zero. Temperature and rain are not softened, as in the FAO method.
  const phFactor = ph == null ? null : ph <= crop.ph[0] || ph >= crop.ph[3] ? 0 : 0.5 + 0.5 * trapezoid(ph, ...crop.ph);
  const texFactor = textureFactor(crop, codes);
  const rainfed = [];
  const irrigated = [];
  const detail = [];
  for (let s = 0; s < 12; s += 1) {
    let tempFactor = 1;
    let rainTotal = 0;
    let tMin = Infinity;
    let tMax = -Infinity;
    for (let k = 0; k < n; k += 1) {
      const m = months[(s + k) % 12];
      tempFactor = Math.min(tempFactor, trapezoid(m.tmean, ...crop.t));
      rainTotal += m.rainMm;
      tMin = Math.min(tMin, m.tmean);
      tMax = Math.max(tMax, m.tmean);
    }
    const rainFactor = trapezoid(rainTotal, ...crop.r);
    const soilParts = [phFactor, texFactor].filter((v) => v != null);
    const soil = soilParts.length ? Math.min(...soilParts) : 1;
    irrigated.push(Math.min(tempFactor, soil));
    rainfed.push(Math.min(tempFactor, rainFactor, soil));
    detail.push({ tempFactor, rainFactor, phFactor, texFactor, rainTotal, tMin, tMax });
  }
  return { rainfed, irrigated, detail };
}

const best = (list) => list.reduce((b, v, i) => (v > b.score ? { score: v, month: i } : b), { score: -1, month: 0 });

// the weighted average, and the 10th and 90th percentile, of a list of [value, weight]
function spread(pairs) {
  const sorted = pairs.slice().sort((a, b) => a[0] - b[0]);
  const total = sorted.reduce((t, p) => t + p[1], 0) || 1;
  const mean = sorted.reduce((t, p) => t + p[0] * p[1], 0) / total;
  const at = (q) => {
    let run = 0;
    for (const [v, w] of sorted) {
      run += w / total;
      if (run >= q - 1e-9) return v;
    }
    return sorted[sorted.length - 1][0];
  };
  return { mid: mean, low: at(0.1), high: at(0.9) };
}

// Scores every crop for this place.
//   months: 12 × { tmean, rainMm }   (climate normals)
//   soil:   { ph, phLow, phHigh, simple, groups }   (any part may be missing)
// SoilGrids gives a range for pH and a chance for each texture group, so each crop is scored under every plausible
// soil and the answer is the probability-weighted average with a 10% to 90% range.
export function evaluateCrops(crops, months, soil, now = new Date()) {
  const thisMonth = now.getMonth();
  const hasPh = soil && soil.ph != null;
  const phScenarios = !hasPh
    ? [[null, 1]]
    : soil.phLow != null && soil.phHigh != null
      ? [[soil.phLow, 0.25], [soil.ph, 0.5], [soil.phHigh, 0.25]]
      : [[soil.ph, 1]];
  let texScenarios = [[null, 1]];
  if (soil && soil.groups && Object.keys(soil.groups).length) {
    const total = Object.values(soil.groups).reduce((t, v) => t + v, 0) || 1;
    texScenarios = Object.entries(soil.groups).filter(([g]) => GROUP_CODES[g]).map(([g, share]) => [GROUP_CODES[g], share / total]);
  } else if (soil && soil.simple) texScenarios = [[SOIL_CODES[soil.simple], 1]];

  return crops.map((crop) => {
    // the main picture: the most likely pH and texture
    const main = scoreMonths(crop, months, hasPh ? soil.ph : null, soil && soil.simple ? SOIL_CODES[soil.simple] : null);
    const bestR = [];
    const bestI = [];
    const nowR = [];
    const nowI = [];
    for (const [ph, wp] of phScenarios) {
      for (const [codes, wt] of texScenarios) {
        const alt = scoreMonths(crop, months, ph, codes);
        const w = wp * wt;
        bestR.push([best(alt.rainfed).score, w]);
        bestI.push([best(alt.irrigated).score, w]);
        nowR.push([Math.max(alt.rainfed[thisMonth], alt.rainfed[(thisMonth + 1) % 12]), w]);
        nowI.push([Math.max(alt.irrigated[thisMonth], alt.irrigated[(thisMonth + 1) % 12]), w]);
      }
    }
    const r = spread(bestR);
    const i = spread(bestI);
    return {
      crop,
      months: main,
      rainfed: { best: r.mid, month: best(main.rainfed).month, low: r.low, high: r.high, now: spread(nowR).mid },
      irrigated: { best: i.mid, month: best(main.irrigated).month, low: i.low, high: i.high, now: spread(nowI).mid },
      cycle: cycleMonths(crop),
    };
  });
}

export const rating = (score) => (score >= 0.75 ? "veryGood" : score >= 0.5 ? "good" : score >= 0.25 ? "marginal" : "poor");

// which factor holds the score down in the chosen window
export function limiting(detail, irrigated) {
  const list = [
    ["temp", detail.tempFactor],
    ["rain", irrigated ? null : detail.rainFactor],
    ["ph", detail.phFactor],
    ["texture", detail.texFactor],
  ].filter(([, v]) => v != null);
  return list.reduce((a, b) => (b[1] < a[1] ? b : a));
}

// sowing months close to the best one (within 10 percent), as month numbers
export function bestMonths(scores) {
  const top = Math.max(...scores);
  if (top < 0.25) return [];
  return scores.map((v, i) => (v >= top * 0.9 ? i : -1)).filter((i) => i >= 0);
}

// the soil the engine uses, taken from the SoilGrids reading
export function soilInput(soilData) {
  if (!soilData || !soilData.available) return null;
  const iv = soilData.intervals || {};
  const tex = soilData.texture;
  return {
    ph: soilData.topsoil.phh2o,
    phLow: iv.phh2o ? iv.phh2o[0] : null,
    phHigh: iv.phh2o ? iv.phh2o[1] : null,
    simple: tex ? tex.simple : null,
    groups: tex && tex.groups ? tex.groups : null,
  };
}

