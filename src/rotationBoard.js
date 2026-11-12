// The strategy engine of the rotation planner.
// 1. Candidate rotations come from the FAO EcoCrop fit (planRotations), for rain-only and irrigated years, all crops, field crops and vegetables.
// 2. Each candidate is measured on the PLOT: water beyond rain, soil health, profit, risk, and the plant families grown before.
// 3. Each strategy ranks the candidates by its own recipe, so the crops and the order really change.
// 4. The best strategy is the one that gives this plot the most of what it needs most, compared with the rotation it has now.
// These are simple rules of ours, not a yield model.
import { planRotations, isLegume, ANNUAL } from "./rotation.js";
import { currentRotation, measure } from "./strategy.js";
import { recentFamily } from "./history.js";
import { rotationProfit } from "./econ.js";

export const STRATEGIES = ["water", "income", "soil", "risk"];
const clamp = (x, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, x));
const HEAVY = new Set(["cereal", "vegetable", "cash", "fibre", "root"]);
const MIN_FIT = 0.55;

// how healthy the rotation is for the soil (0..1)
export function soilIndex(m, fam) {
  let s = 0;
  s += m.legumes.length >= 2 ? 0.4 : m.legumes.length === 1 ? 0.33 : 0;
  s += 0.2 * (m.usedCount / 12);
  s += 0.12 * Math.min(1, m.families / 3);
  s += fam && fam.known ? (fam.run.length === 0 ? 0.2 : 0) : 0.1;
  const heavy = m.steps.filter((o) => HEAVY.has(o.crop.group) && !isLegume(o.crop)).length;
  s += heavy <= m.legumes.length + 1 ? 0.1 : 0;
  s -= m.repeat > 0 ? 0.15 : 0;
  s += m.legumes.length && m.bareWet.length === 0 ? 0.05 : 0;
  return clamp(s);
}
function riskIndex(m) {
  const dry = m.haveClimate && m.need > 0 ? clamp(m.gap / m.need) : 0;
  const penalty = 0.45 * Math.min(1, (m.hot.length + m.cold.length) / 6) + 0.25 * Math.min(1, m.bareWet.length / 4) + 0.1 * Math.min(1, m.repeat) + 0.2 * dry * (m.mode === "rainfed" ? 1.5 : 0.5);
  return 1 - Math.min(1, penalty);
}

function candidates(results, kind, keepId) {
  const seen = new Map();
  const add = (list) => list.forEach((r) => { const k = r.steps.map((o) => `${o.crop.id}@${o.start}`).join(">"); if (!seen.has(k)) seen.set(k, r); });
  const kinds = kind === "all" ? ["all", "field", "vegetable"] : [kind];
  for (const mode of ["irrigated", "rainfed"]) for (const k of kinds) add(planRotations(results, mode, k, 30, keepId));
  return [...seen.values()];
}

// results: evaluateCrops output; climate: { months }; mode: "irrigated" | "rainfed"; econCtx for prices
export function buildBoard({ results, climate, field, mode, kind = "all", keepId = null, econCtx }) {
  const byId = new Map(results.map((r) => [r.crop.id, r]));
  const rows = candidates(results, kind, keepId).map((r) => {
    // fit under the plot's own water situation
    const steps = r.steps.map((o) => { const sc = byId.get(o.crop.id).months[mode][o.start]; return { ...o, score: sc }; });
    const m = measure(steps, { climate, mode, field });
    const fam = recentFamily(field, results, steps, false);
    const money = rotationProfit(steps, econCtx);
    return { r: { ...r, steps }, steps, m, fam, money, soil: soilIndex(m, fam), risk: riskIndex(m), fit: m.mean };
  }).filter((x) => x.steps.every((o) => o.score > 0));
  if (!rows.length) return null;
  const maxGap = Math.max(1, ...rows.map((x) => x.m.gap));
  const maxNeed = Math.max(1, ...rows.map((x) => x.m.need));
  const maxProfit = Math.max(1, ...rows.map((x) => x.money.total));
  const minProfit = Math.min(0, ...rows.map((x) => x.money.total));
  rows.forEach((x) => {
    x.water = 0.8 * (1 - x.m.gap / maxGap) + 0.2 * (1 - x.m.need / maxNeed);
    x.income = clamp((x.money.total - minProfit) / (maxProfit - minProfit || 1));
    // crops people trade in the nearest market are familiar: a small bonus
    x.known = x.steps.filter((o) => econCtx.market && econCtx.market[o.crop.id]).length / x.steps.length;
    x.score = {
      water: 0.2 * x.fit + 0.6 * x.water + 0.1 * x.risk + 0.1 * x.soil,
      income: 0.2 * x.fit + 0.65 * x.income + 0.1 * x.risk + 0.05 * x.water,
      soil: 0.2 * x.fit + 0.65 * x.soil + 0.1 * x.risk + 0.05 * x.income,
      risk: 0.2 * x.fit + 0.6 * x.risk + 0.1 * x.soil + 0.1 * x.water,
    };
    // a plot with no irrigation cannot make up a water shortage, so every goal drops rotations that need water beyond the rain
    const dryShare = mode === "rainfed" && x.m.need > 0 ? clamp(x.m.gap / x.m.need) : 0;
    for (const k of Object.keys(x.score)) x.score[k] += 0.05 * x.known - 0.35 * dryShare;
  });

  // what the plot grows now (the baseline to beat)
  const cur = currentRotation(field, results, mode);
  let current = null;
  if (cur && cur.steps) {
    const steps = cur.steps;
    const m = measure(steps, { climate, mode, field });
    const fam = recentFamily(field, results, steps, true);
    const money = rotationProfit(steps, econCtx);
    current = { steps, m, fam, money, soil: soilIndex(m, fam), risk: riskIndex(m), fit: m.mean, water: 0.8 * (1 - m.gap / maxGap) + 0.2 * (1 - m.need / maxNeed), income: clamp((money.total - minProfit) / (maxProfit - minProfit || 1)), assumedTiming: cur.assumedTiming };
  }

  // top three for each strategy; the lists are built so that a rotation is not the first pick of two strategies when a near equal exists
  const pickedFirst = new Set();
  const strategies = {};
  for (const id of STRATEGIES) {
    const good = rows.filter((x) => x.fit >= MIN_FIT);
    const pool = good.length >= 3 ? good : rows;
    const sorted = [...pool].sort((a, b) => b.score[id] - a.score[id]);
    const out = [];
    for (const x of sorted) {
      if (out.length === 3) break;
      const key = x.steps.map((o) => o.crop.id).join(">");
      // different strategies should lead with different rotations unless one is clearly the best
      if (out.length === 0 && pickedFirst.has(key) && sorted[1] && sorted[0].score[id] - sorted[1].score[id] < 0.04) continue;
      if (out.some((y) => y.steps.filter((o) => x.steps.some((p) => p.crop.id === o.crop.id)).length >= Math.min(2, y.steps.length, x.steps.length))) continue;
      out.push(x);
    }
    if (out[0]) pickedFirst.add(out[0].steps.map((o) => o.crop.id).join(">"));
    strategies[id] = out;
  }

  // the best strategy for this plot: what the plot needs most, times how much the strategy's top rotation improves it
  let best = null;
  if (current) {
    const needs = {
      water: clamp(current.m.need > 0 ? current.m.gap / current.m.need : 0) * (mode === "rainfed" ? 1.2 : 0.8),
      soil: 1 - current.soil,
      income: 0.55,
      risk: 1 - current.risk,
    };
    const gain = (id, top) => {
      if (id === "water") return clamp((current.m.gap - top.m.gap) / Math.max(current.m.gap, 1));
      if (id === "soil") return clamp(top.soil - current.soil);
      if (id === "income") return clamp((top.money.total - current.money.total) / Math.max(Math.abs(current.money.total), top.money.total, 1));
      return clamp(top.risk - current.risk);
    };
    const rank = STRATEGIES.filter((id) => strategies[id][0]).map((id) => ({ id, needs: needs[id], gain: gain(id, strategies[id][0]), benefit: needs[id] * gain(id, strategies[id][0]) + 0.1 * strategies[id][0].fit }))
      .sort((a, b) => b.benefit - a.benefit);
    best = { id: rank[0].id, rank, needs, keep: rank[0].gain < 0.05 };
  } else {
    // nothing grown now: the strongest need from the plot's own conditions
    const typical = rows[0];
    const water = mode === "rainfed" ? 0.8 : 0.4;
    const rank = STRATEGIES.map((id) => ({ id, benefit: id === "water" ? water : id === "soil" ? 0.6 : id === "income" ? 0.55 : 0.3, gain: 0.5, needs: 0.5 })).sort((a, b) => b.benefit - a.benefit);
    best = { id: rank[0].id, rank, needs: {}, keep: false, noCurrent: true, typical: !!typical };
  }
  return { rows, current, strategies, best, maxGap };
}
