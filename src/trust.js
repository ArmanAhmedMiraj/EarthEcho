// How sure are we about a strategy? A plain count of what was measured, what was assumed and what is missing.
// It is a guide to where the weak points are. It is not a statistical confidence interval.
//
// Each factor: { key, state: "ok" | "assumed" | "missing", weight }. The level comes from the weight of what is not "ok".

export function uncertainty(m, { field, profit, isCurrent, timingKnown = false, scenarioOn, mode }) {
  const d = (field && field.details) || {};
  const sys = field && field.system && field.system.soil;
  const factors = [];
  const add = (key, state, weight) => factors.push({ key, state, weight });

  // soil
  if (d.soil) add("soil", "ok", 2);
  else if (sys && sys.key) add("soil", sys.level === "high" || sys.level === "medium" ? "ok" : "assumed", 2);
  else add("soil", "missing", 2);

  // sowing months: entered by the farmer for the current rotation, otherwise suggestions
  add("timing", timingKnown ? "ok" : "assumed", isCurrent ? 2 : 1);

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
// Keys are plain words (the model must not show code-like names to the farmer), crop and month names are in the app's language.
const INPUT_WORDS = {
  soil: "soil type", timing: "sowing months", water: "how the field gets water", slope: "slope of the field", profit: "yield, price and cost",
  climate: "climate (monthly averages for a cell about 55 km wide)", cropdata: "crop needs (general FAO EcoCrop limits, not the local variety)", scenario: "the what-if sliders",
};
const WEAK_WORDS = {
  weakFit: "at least one crop fits this place only moderately",
  tempEdge: "two or more crop months are close to the crop's heat or cold limit",
  rainShort: "rain covers well under half of what the crops like and the field relies on rain",
  waterNeed: "crops need much more water than rain gives, so irrigation water must be available",
  bareWet: "the field is bare in two or more very wet months, so soil can wash away",
};
const SURE_WORDS = { high: "fairly sure", medium: "somewhat sure", low: "not very sure" };

export function strategyPayload(c, { mode, scenario, prio, baseline, name, monthNames }) {
  const m = c.m;
  const mn = (i) => monthNames[((i % 12) + 12) % 12];
  const months = (arr) => arr.map(mn);
  const isCurrent = c.role === "Current";
  const out = {
    this_is: isCurrent ? (c.assumedTiming ? "the farmer's current rotation (some sowing months are assumed, not entered by the farmer)" : "the farmer's current rotation (sowing months entered by the farmer)") : "a suggested alternative rotation",
    water_mode: mode === "irrigated" ? "irrigated" : "rain-fed",
    crops: c.steps.map((o) => ({ name: name(o.crop), english_name: o.crop.en, sowing_month: mn(o.at), months_in_field: o.months, fit_percent: Math.round(o.score * 100) })),
    bare_months: months(m.bare),
    bare_months_with_very_heavy_rain: months(m.bareWet),
    includes_a_legume: m.legumes.length > 0,
    number_of_crop_families: m.families,
    water_the_crops_like_mm: m.need,
    rain_in_the_crop_months_mm: m.rain,
    water_gap_mm: m.gap,
    water_gap_meaning: mode === "irrigated"
      ? "the field is irrigated, so this is roughly how much water would have to come from irrigation, not a rain failure"
      : "the field depends on rain, so this is the shortfall of rain against what the crops like",
    months_near_heat_limit: [...new Set(m.hot.map((x) => mn(x.month)))],
    months_near_cold_limit: [...new Set(m.cold.map((x) => mn(x.month)))],
    slope_percent: m.slope,
    profit_total: c.profit && c.profit.complete ? Math.round(c.profit.total) : null,
    farmer_priorities: prio && prio.length ? prio : null,
    what_if_sliders: scenario && (scenario.rain !== 0 || scenario.temp !== 0) ? { rain_change_percent: scenario.rain, warming_c: scenario.temp } : null,
    how_sure_the_app_is: SURE_WORDS[c.trust.level],
    assumed_inputs: c.trust.factors.filter((f) => f.state === "assumed").map((f) => INPUT_WORDS[f.key] || f.key),
    missing_inputs: c.trust.factors.filter((f) => f.state === "missing").map((f) => INPUT_WORDS[f.key] || f.key),
    weak_points: c.trust.sensitive.map((k) => WEAK_WORDS[k] || k),
  };
  if (baseline && !isCurrent) out.current_rotation_water_gap_mm = baseline.m.gap;
  return out;
}
