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
