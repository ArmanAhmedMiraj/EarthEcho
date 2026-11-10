// Compare rotation strategies: the farmer's current rotation and some alternatives.
// For each strategy we work out numbers from the climate (NASA POWER monthly averages), the EcoCrop scores and the soil,
// then write them as five short lists: why it was suggested, the evidence, the benefits, the information gaps and the risks
// that a farmer or agriculture officer must check. These are simple rules of ours, not a yield model, and the page says so.
import { findCrop } from "./suitability.js";
import { isLegume, profitOf } from "./rotation.js";

const fill = (text, values) => Object.keys(values).reduce((s, k) => s.split(`{${k}}`).join(values[k]), text);
const HEAVY_RAIN_MM = 150; // a month this wet leaves a bare field open to washing away
const SLOPE_STEEP = 3; // percent

// The months (0..11) the field is occupied by a list of steps ({ at, months })
function occupied(steps) {
  const used = new Set();
  steps.forEach((o) => { for (let k = 0; k < o.months; k += 1) used.add((o.at + k) % 12); });
  return used;
}

// The farmer's current rotation, from what they entered in My Farm: the crop grown before and the crop growing now.
// The sowing months were not asked, so each crop is placed in its best month for this place (the page says so).
export function currentRotation(field, results, mode) {
  const d = (field && field.details) || {};
  if (!d.currentCrop) return null;
  const now = results.find((r) => findCrop([r.crop], d.currentCrop));
  if (!now) return { unknown: d.currentCrop };
  const before = String(d.previousCrops || "")
    .split(/[,;/\n،→]+/)
    .map((x) => x.trim())
    .filter(Boolean)
    .map((x) => results.find((r) => findCrop([r.crop], x)))
    .filter((r) => r && r.crop.id !== now.crop.id);
  const picks = [];
  if (before[0]) picks.push(before[0]);
  picks.push(now);
  const steps = picks.map((r) => ({ crop: r.crop, at: r[mode].month, months: r.cycle, score: r[mode].best }));
  return { steps, assumedTiming: true, onlyOne: steps.length === 1 };
}

// Numbers for one strategy
export function measure(steps, ctx) {
  const { climate, mode, field } = ctx;
  const months = climate.months;
  const used = occupied(steps);
  const usedCount = Math.min(12, used.size);
  const bare = Array.from({ length: 12 }, (_, i) => i).filter((i) => !used.has(i));
  const mean = steps.reduce((s, o) => s + o.score, 0) / steps.length;
  const legumes = steps.filter((o) => isLegume(o.crop));
  const families = new Set(steps.map((o) => o.crop.family)).size;
  let repeat = 0;
  if (steps.length > 1) for (let i = 0; i < steps.length; i += 1) if (steps[i].crop.family === steps[(i + 1) % steps.length].crop.family) repeat += 1;
  const monoculture = steps.length === 1;

  let rain = 0, need = 0, gap = 0, tMin = Infinity, tMax = -Infinity, haveClimate = true;
  const hot = [], cold = [];
  steps.forEach((o) => {
    // water the crop likes over its season: the middle of the EcoCrop "optimal rainfall" range; rain over the same months
    const cropNeed = (o.crop.r[1] + o.crop.r[2]) / 2;
    let cropRain = 0;
    for (let k = 0; k < o.months; k += 1) {
      const m = months[(o.at + k) % 12];
      if (!m || m.tmean == null || m.rainMm == null) { haveClimate = false; continue; }
      rain += m.rainMm;
      cropRain += m.rainMm;
      tMin = Math.min(tMin, m.tmean);
      tMax = Math.max(tMax, m.tmean);
      if (m.tmean >= o.crop.t[3] - 3) hot.push({ crop: o.crop, month: (o.at + k) % 12, t: m.tmean, limit: o.crop.t[3] });
      if (m.tmean <= o.crop.t[0] + 2) cold.push({ crop: o.crop, month: (o.at + k) % 12, t: m.tmean, limit: o.crop.t[0] });
    }
    need += cropNeed;
    gap += Math.max(0, cropNeed - cropRain);
  });
  const bareWet = bare.filter((i) => months[i] && months[i].rainMm >= HEAVY_RAIN_MM);
  const slope = field && field.system && field.system.slopePct != null ? field.system.slopePct : null;
  return {
    steps, mean, used, usedCount, bare, bareWet, legumes, families, repeat, monoculture,
    rain: Math.round(rain), need: Math.round(need), gap: Math.round(gap),
    tMin: Number.isFinite(tMin) ? tMin : null, tMax: Number.isFinite(tMax) ? tMax : null,
    hot, cold, haveClimate, slope, mode,
  };
}

// The five lists, written in the app's language. ctx.t = text table, ctx.name(crop), ctx.month(i), ctx.num(n), ctx.pct(score)
export function explain(m, ctx, base) {
  const { t, name, month, num, pct } = ctx;
  const list = (arr) => arr.map((x) => month(x)).join(", ");
  const crops = m.steps.map((o) => name(o.crop)).join(" → ");
  const why = [], evidence = [], benefits = [], gaps = [], risks = [];

  // ---- why it was suggested ----
  if (ctx.isCurrent) why.push(t.stWhyCurrent);
  else why.push(fill(t.stWhyFit, { p: pct(m.mean) }));
  if (m.legumes.length) why.push(fill(t.stWhyLegume, { crop: m.legumes.map((o) => name(o.crop)).join(", ") }));
  if (m.usedCount >= 10) why.push(fill(t.stWhyCover, { n: num(m.usedCount) }));
  if (m.steps.length > 1 && m.repeat === 0) why.push(fill(t.stWhyFamilies, { n: num(m.families) }));
  if (m.haveClimate && m.need > 0 && m.gap <= 0.25 * m.need) why.push(t.stWhyRain);

  // ---- evidence ----
  if (m.haveClimate && m.tMin != null) {
    evidence.push(fill(t.stEvClimate, { a: num(m.tMin), b: num(m.tMax), rain: num(m.rain) }));
    evidence.push(fill(m.gap > 0 ? t.stEvGap : t.stEvNoGap, { gap: num(m.gap), need: num(m.need), rain: num(m.rain) }));
  }
  evidence.push(fill(t.stEvScores, { list: m.steps.map((o) => `${name(o.crop)} ${pct(o.score)}`).join(" · ") }));
  if (ctx.soilLine) evidence.push(ctx.soilLine);
  if (m.slope != null) evidence.push(fill(t.stEvSlope, { s: num(m.slope) }));

  // ---- benefits ----
  if (m.legumes.length) benefits.push(t.stBenN);
  if (m.usedCount >= 10) benefits.push(t.stBenCover);
  if (m.steps.length > 1 && m.repeat === 0) benefits.push(t.stBenPest);
  if (base && m.haveClimate && base.haveClimate && base.gap - m.gap >= 30) benefits.push(fill(t.stBenWater, { n: num(base.gap - m.gap) }));
  if (ctx.profit && ctx.profit.complete) benefits.push(fill(t.stBenProfit, { n: num(ctx.profit.total) }));
  if (benefits.length === 0) benefits.push(t.stBenNone);

  // ---- information gaps ----
  gaps.push(t.stGapClimate);
  if (ctx.soilLevel === "low" || ctx.soilLevel == null) gaps.push(t.stGapSoil);
  if (ctx.isCurrent && m.assumedTiming) gaps.push(t.stGapTiming);
  if (!ctx.profit || !ctx.profit.complete) gaps.push(t.stGapProfit);
  gaps.push(t.stGapLocal);

  // ---- risks that need local review ----
  const first = (arr) => arr[0];
  if (m.hot.length) risks.push(fill(t.stRiskHot, { crop: name(first(m.hot).crop), months: list([...new Set(m.hot.map((h) => h.month))]), t: num(first(m.hot).t), limit: num(first(m.hot).limit) }));
  if (m.cold.length) risks.push(fill(t.stRiskCold, { crop: name(first(m.cold).crop), months: list([...new Set(m.cold.map((h) => h.month))]), t: num(first(m.cold).t) }));
  if (m.gap > 0 && m.mode === "rainfed" && m.haveClimate && m.gap > 0.25 * m.need) risks.push(fill(t.stRiskDry, { gap: num(m.gap) }));
  if (m.gap > 0 && m.mode === "irrigated" && m.haveClimate && m.gap > 0.25 * m.need) risks.push(fill(t.stRiskWater, { gap: num(m.gap) }));
  if (m.bareWet.length) risks.push(fill(t.stRiskBareWet, { months: list(m.bareWet) }) + (m.assumedTiming ? ` ${t.stRiskAssumed}` : "") + (m.slope != null && m.slope >= SLOPE_STEEP ? ` ${t.stRiskSteep}` : ""));
  else if (m.bare.length >= 3) risks.push(fill(t.stRiskBare, { n: num(m.bare.length), months: list(m.bare) }));
  if (m.repeat > 0) risks.push(t.stRiskRepeat);
  if (m.monoculture) risks.push(t.stRiskMono);
  if (!m.legumes.length) risks.push(t.stRiskNoLegume);
  risks.push(t.stRiskCheck);

  return { crops, why, evidence, benefits, gaps, risks };
}

export { profitOf };
