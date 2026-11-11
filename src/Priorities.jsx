import { PRIORITIES } from "./strategy.js";

// "What matters most to you?" The farmer picks any of four priorities; the suggestions are re-ordered to match.
export default function Priorities({ t, prio, onChange }) {
  const toggle = (id) => onChange(prio.includes(id) ? prio.filter((p) => p !== id) : [...prio, id]);
  return (
    <section className="pr-wrap" aria-labelledby="pr-title">
      <h3 id="pr-title">{t.prTitle}</h3>
      <p className="muted small">{t.prHelp}</p>
      <div className="sc-presets" role="group" aria-label={t.prTitle}>
        {PRIORITIES.map((id) => (
          <button key={id} type="button" className="chip" aria-pressed={prio.includes(id)} onClick={() => toggle(id)}>
            {prio.includes(id) ? "✓ " : ""}{t[`pr_${id}`]}
          </button>
        ))}
        <button type="button" className="chip" disabled={!prio.length} onClick={() => onChange([])}>{t.prClear}</button>
      </div>
      {prio.includes("income") && <p className="small muted">{t.prIncomeNote}</p>}
    </section>
  );
}
