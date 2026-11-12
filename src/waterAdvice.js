import { moistureClass } from "./soilNames.js";

// One plain answer for "do I need to irrigate?", from three things: days without rain, how wet the root zone is,
// and the rain expected in the next 7 days. The soil word uses the same wetness rule as the Soil page.
export function rootWetness(series, soilKey) {
  const s = Array.isArray(series) ? series : [];
  if (!s.length) return null;
  const latest = s[s.length - 1];
  const key = moistureClass(latest.root, soilKey || "loam");
  const back = s.length > 5 ? s[s.length - 5] : null;
  const diff = back ? latest.root - back.root : null;
  return { key, value: latest.root, date: latest.date, from: back ? back.root : null, trend: diff == null ? null : Math.abs(diff) < 0.01 ? "flat" : diff > 0 ? "up" : "down" };
}

export function irrigationAdvice({ run, rain7, wet }) {
  const dryRun = run || 0;
  const rain = rain7 == null ? 0 : rain7;
  if (wet && wet.key === "wet") return "drain";
  if (wet && wet.key === "nearFull") return "ok";
  if (rain >= 20) return "wait";
  if (wet && wet.key === "dry") return rain >= 10 ? "wait" : "now";
  if (wet && wet.key === "moist") return wet.trend === "down" && dryRun >= 5 && rain < 10 ? "soon" : "ok";
  return dryRun >= 7 && rain < 10 ? "soon" : "ok";
}
