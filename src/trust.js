// How sure are we about a strategy? A plain count of what was measured, what was assumed and what is missing.
// It is a guide to where the weak points are. It is not a statistical confidence interval.
//
// Each factor: { key, state: "ok" | "assumed" | "missing", weight }. The level comes from the weight of what is not "ok".

export function uncertainty(m, { field, profit, isCurrent, scenarioOn, mode }) {
  const d = (field && field.details) || {};
  const sys = field && field.system && field.system.soil;
  const factors = [];
  const add = (key, state, weight) => factors.push({ key, state, weight });

  // soil
  if (d.soil) add("soil", "ok", 2);
  else if (sys && sys.key) add("soil", sys.level === "high" || sys.level === "medium" ? "ok" : "assumed", 2);
  else add("soil", "missing", 2);

  // sowing months: the app does not ask for them, so they are always suggestions
  add("timing", "assumed", isCurrent ? 2 : 1);

  // water supply
  add("water", d.irrigation ? "ok" : "assumed", 1);

  // slope
  add("slope", m.slope != null ? "ok" : "missing", 1);

  // prices and yields
  add("profit", profit && profit.complete ? "ok" : "missing", 1);

  // always true: monthly averages for a wide area, and crop ranges that are general, not local varieties
  add("climate", "assumed", 1);
  add("cropdata", "assumed", 1);

  if (scenarioOn) add("scenario", "assumed", 1);

  // how much this particular strategy leans on things the app cannot see
  const sensitive = [];
  if (m.steps.some((o) => o.score < 0.6)) sensitive.push("weakFit");
  if (m.hot.length + m.cold.length >= 2) sensitive.push("tempEdge");
  if (m.haveClimate && m.need > 0 && m.gap > 0.5 * m.need) sensitive.push(mode === "rainfed" ? "rainShort" : "waterNeed");
  if (m.bareWet.length >= 2) sensitive.push("bareWet");

  const points = factors.filter((f) => f.state !== "ok").reduce((s, f) => s + f.weight, 0) + sensitive.length;
  const level = points <= 4 ? "high" : points <= 8 ? "medium" : "low";
  return { level, factors, sensitive, points };
}

// What is sent to the assistant when the farmer asks it to explain one strategy. Short on purpose (the server keeps 4000 characters).
// English crop and month names are used here so the model stays on the numbers; it answers in the farmer's language.
const MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function strategyPayload(c, { mode, scenario, prio, baseline }) {
  const m = c.m;
  const months = (arr) => arr.map((i) => MONTHS_EN[((i % 12) + 12) % 12]);
  const out = {
    which: c.role === "Current" ? "the farmer's current rotation (sowing months assumed)" : "a suggested alternative rotation",
    waterMode: mode,
    crops: c.steps.map((o) => ({ crop: o.crop.en, sow: MONTHS_EN[o.at % 12], months: o.months, fitPct: Math.round(o.score * 100) })),
    bareMonths: months(m.bare),
    bareInVeryWetMonths: months(m.bareWet),
    hasLegume: m.legumes.length > 0,
    cropFamilies: m.families,
    waterNeededMm: m.need,
    rainDuringCropsMm: m.rain,
    waterGapMm: m.gap,
    waterGapMeaning: mode === "irrigated" ? "the field is irrigated, so this is roughly how much water would have to come from irrigation, not a rain failure" : "the field depends on rain, so this is the shortfall of rain against what the crops like",
    hotMonths: [...new Set(m.hot.map((x) => MONTHS_EN[x.month]))],
    coldMonths: [...new Set(m.cold.map((x) => MONTHS_EN[x.month]))],
    slopePct: m.slope,
    profitTotal: c.profit && c.profit.complete ? Math.round(c.profit.total) : null,
    farmerPriorities: prio && prio.length ? prio : null,
    whatIfSliders: scenario && (scenario.rain !== 0 || scenario.temp !== 0) ? { rainChangePct: scenario.rain, warmingC: scenario.temp } : null,
    howSure: c.trust.level,
    assumedInputs: c.trust.factors.filter((f) => f.state === "assumed").map((f) => f.key),
    missingInputs: c.trust.factors.filter((f) => f.state === "missing").map((f) => f.key),
    weakPoints: c.trust.sensitive,
  };
  if (baseline && c.role !== "Current") out.currentRotationWaterGapMm = baseline.m.gap;
  return out;
}
