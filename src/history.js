// The seasons a field had before now: crop, sowing month and year, newest first.
// The farmer types them in My Farm. They are used to see whether a crop of the same plant family keeps coming back,
// which lets pests and diseases build up. Nothing here is a forecast.
import { findCrop } from "./suitability.js";

export const MAX_SEASONS = 6;

const monthText = (v) => {
  const n = Number(v);
  return v !== "" && v != null && Number.isInteger(n) && n >= 0 && n <= 11 ? String(n) : "";
};
const rowClean = (r) => ({
  crop: String((r && r.crop) || "").slice(0, 60),
  sowMonth: monthText(r && r.sowMonth),
  year: String((r && r.year) || "").replace(/\D/g, "").slice(0, 4),
});

// The list of past seasons. Fields saved before this list existed carry the older "grown before" text; it is read as seasons.
export function historyOf(details) {
  const d = details || {};
  if (Array.isArray(d.history)) return d.history.slice(0, MAX_SEASONS).map(rowClean);
  const names = String(d.previousCrops || "").split(/[,;/\n،→]+/).map((x) => x.trim()).filter(Boolean).slice(0, MAX_SEASONS);
  return names.map((crop, i) => rowClean({ crop, sowMonth: i === 0 ? d.previousSowMonth : "" }));
}

// What to save in the field's details. The older keys are kept in step so every part of the app that reads them still works.
export function historyPatch(rows) {
  const list = rows.slice(0, MAX_SEASONS).map(rowClean);
  const named = list.filter((r) => r.crop.trim());
  return {
    history: list,
    previousCrops: named.map((r) => r.crop.trim()).join(", "),
    previousSowMonth: list[0] && list[0].crop.trim() ? list[0].sowMonth : "",
  };
}

// Does the first crop of a strategy (or the crop growing now) belong to the same plant family as the crops grown just before it?
// isCurrent: look at the crop growing now against the past seasons. Otherwise look at the strategy's first crop against
// the crop growing now and then the past seasons. Returns { known, run } where run lists the crops in the unbroken run, newest first.
export function recentFamily(field, results, steps, isCurrent) {
  const d = (field && field.details) || {};
  const rows = historyOf(d);
  const hit = (name) => { const r = results.find((x) => findCrop([x.crop], name)); return r ? r.crop : null; };
  const past = rows.filter((r) => r.crop.trim()).map((r) => hit(r.crop));
  const now = d.currentCrop ? hit(d.currentCrop) : null;
  const hasNow = !!String(d.currentCrop || "").trim();
  if (!steps || !steps.length) return { known: false, run: [] };
  const subject = isCurrent ? steps[steps.length - 1].crop : steps[0].crop;
  const recent = isCurrent ? past : [...(hasNow ? [now] : []), ...past];
  const known = recent.length > 0;
  const run = [];
  for (const c of recent) {
    if (c && c.family === subject.family) run.push(c);
    else break;
  }
  return { known, run };
}
