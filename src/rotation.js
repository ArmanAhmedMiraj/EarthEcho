// Rotation planner for any place. It reuses the FAO EcoCrop scores (suitability.js): a crop can be sown in a month if its score
// for that month is good enough, and it then occupies the field for its growing cycle.
// A rotation is 1 to 3 crops, one after another, that fit inside 12 months. Rules, in order of weight:
//   crops that suit the place (average score), the field is in use for most of the year, a legume is in the cycle (it adds
//   nitrogen), and the same plant family does not follow itself (this lowers disease and pest build-up).
// These are rules of thumb of ours, not a model of yield. The page says so.

const ANNUAL = ["cereal", "pulse", "oilseed", "vegetable", "root", "fibre", "cash"];
const MIN_SCORE = 0.5;
const MAX_GAP = 2; // months the field may stand empty between two crops
const LEGUME = "Leguminosae";

// Rough world-average yields in tonnes per hectare, rounded (FAO statistics, public). They are only a starting point
// for the profit sums: yield changes with country, variety and care, so the page asks the farmer to enter their own.
export const TYPICAL_YIELD = {
  rice: 4.7, wheat: 3.5, maize: 5.8, barley: 3, sorghum: 1.5, pearlmillet: 1, lentil: 1.2, chickpea: 1.1, mungbean: 0.9,
  pea: 1.8, soybean: 2.8, groundnut: 1.7, sesame: 0.5, sunflower: 2, mustard: 2, potato: 21, tomato: 37, eggplant: 27,
  cabbage: 27, cauliflower: 20, onion: 19, garlic: 17, okra: 7.5, carrot: 30, sweetpotato: 12, cassava: 11, sugarcane: 72,
};

export const isLegume = (crop) => crop.family === LEGUME && ["pulse", "oilseed"].includes(crop.group);

// kind: "all", "field" (grains, pulses, oilseeds, roots, fibre, cash) or "vegetable"
export function planRotations(results, mode, kind = "all") {
  const key = mode === "rainfed" ? "rainfed" : "irrigated";
  // every way to sow one crop: { crop, start, months, score }
  const options = [];
  for (const r of results) {
    if (!ANNUAL.includes(r.crop.group) || r.cycle > 8) continue;
    if (kind === "vegetable" && r.crop.group !== "vegetable") continue;
    if (kind === "field" && r.crop.group === "vegetable") continue;
    const scores = r.months[key];
    for (let s = 0; s < 12; s += 1) {
      if (scores[s] >= MIN_SCORE) options.push({ crop: r.crop, start: s, months: r.cycle, score: scores[s] });
    }
  }
  // the best few sowings for each starting month keep the search small
  const byStart = Array.from({ length: 12 }, (_, s) => options.filter((o) => o.start === s).sort((a, b) => b.score - a.score).slice(0, 8));

  const found = new Map();
  const consider = (steps) => {
    const ids = steps.map((o) => o.crop.id).sort().join("+");
    const used = steps.reduce((sum, o) => sum + o.months, 0);
    const mean = steps.reduce((sum, o) => sum + o.score, 0) / steps.length;
    const legume = steps.some((o) => isLegume(o.crop)) ? 1 : 0;
    const families = new Set(steps.map((o) => o.crop.family)).size / steps.length;
    let repeat = 0;
    for (let i = 0; i < steps.length; i += 1) if (steps[i].crop.family === steps[(i + 1) % steps.length].crop.family && steps.length > 1) repeat += 1;
    const score = 0.5 * mean + 0.25 * Math.min(1, used / 12) + 0.15 * legume + 0.1 * families - 0.15 * repeat;
    const prev = found.get(ids);
    if (!prev || score > prev.score) found.set(ids, { steps, score, mean, legume: !!legume, used, repeat });
  };

  const walk = (steps, endMonth, origin) => {
    consider(steps);
    if (steps.length >= 3) return;
    for (let gap = 0; gap <= MAX_GAP; gap += 1) {
      const s = (endMonth + gap) % 12;
      for (const o of byStart[s]) {
        const offset = endMonth + gap; // months since the origin
        if (offset + o.months > origin + 12) continue;
        if (steps.some((p) => p.crop.id === o.crop.id)) continue;
        walk([...steps, { ...o, at: offset }], offset + o.months, origin);
      }
    }
  };
  for (let a = 0; a < 12; a += 1) {
    for (const o of byStart[a].slice(0, 5)) walk([{ ...o, at: a }], a + o.months, a);
  }
  // the best six that differ from each other: a new one may share at most one crop with those already chosen
  const sorted = [...found.values()].sort((x, y) => y.score - x.score || y.used - x.used);
  const picked = [];
  for (const cand of sorted) {
    const ids = new Set(cand.steps.map((o) => o.crop.id));
    const clash = picked.some((p) => p.steps.filter((o) => ids.has(o.crop.id)).length >= Math.min(2, p.steps.length, cand.steps.length));
    if (!clash) picked.push(cand);
    if (picked.length === 6) break;
  }
  return picked;
}

// Profit per hectare per year for a rotation, from the farmer's own numbers: { [cropId]: { yield, price, cost } }
// yield in t/ha, price in money per kg, cost in money per ha for the crop. Missing numbers give no total.
export function profitOf(rotation, inputs) {
  let total = 0;
  const parts = rotation.steps.map((o) => {
    const v = inputs[o.crop.id] || {};
    const y = Number(v.yield), p = Number(v.price), c = Number(v.cost);
    const ok = Number.isFinite(y) && y > 0 && Number.isFinite(p) && p > 0 && Number.isFinite(c) && c >= 0 && v.cost !== "" && v.cost != null;
    const revenue = ok ? y * 1000 * p : null;
    const profit = ok ? revenue - c : null;
    if (profit != null) total += profit;
    return { crop: o.crop, revenue, profit };
  });
  return { parts, complete: parts.every((p) => p.profit != null), total };
}
