import { findCrop } from "./suitability.js";

const fill = (text, values) => Object.keys(values).reduce((s, k) => s.split(`{${k}}`).join(values[k]), text);

// "Your field": the crops the farmer entered in My Farm, rated for this place. Shown on the Suitability and Rotation tabs.
// results = evaluateCrops(...) and mode = "irrigated" | "rainfed".
export default function FieldNote({ t, lang, field, results, mode, locale }) {
  if (!field) return null;
  const d = field.details || {};
  const pct = (v) => `${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(Math.round(v * 100))}%`;
  const find = (text) => (text ? results.find((r) => findCrop([r.crop], text)) : null);
  const now = find(d.currentCrop);
  const next = find(d.plannedCrop);
  const nameOf = (r) => (lang === "bn" ? r.crop.bn : r.crop.en);
  const line = (label, typed, hit) => (
    <li>
      <b>{label}</b>: {hit ? nameOf(hit) : typed}
      {hit
        ? <span className="small muted"> · {fill(t.fdFitLine, { best: pct(hit[mode].best), now: pct(hit[mode].now) })}</span>
        : <span className="small muted"> · {t.fdNoRating}</span>}
    </li>
  );
  const same = now && next && now.crop.id === next.crop.id;
  return (
    <div className="fd-note">
      <strong>{fill(t.fdNoteTitle, { name: field.name })}</strong>
      {!d.currentCrop && !d.plannedCrop ? (
        <p className="small muted">{t.fdNoteEmpty}</p>
      ) : (
        <ul>
          {d.currentCrop && line(t.fdCurrentCrop, d.currentCrop, now)}
          {d.plannedCrop && line(t.fdPlannedCrop, d.plannedCrop, next)}
        </ul>
      )}
      {same && <p className="small warn">{t.fdSameCrop}</p>}
    </div>
  );
}
