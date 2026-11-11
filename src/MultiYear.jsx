import { useMemo, useState } from "react";
import { currentRotation } from "./strategy.js";
import { planYears, startSequence } from "./multiyear.js";

const fill = (text, values) => Object.keys(values).reduce((s, k) => s.split(`{${k}}`).join(values[k]), text);

// "Plan ahead": three or four years of crops, one after the other. A starting plan to talk through, not a forecast.
export default function MultiYear({ t, lang, locale, results, pool, field, mode, monthNames }) {
  const [years, setYears] = useState(3);
  const nf = useMemo(() => new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }), [locale]);
  const name = (c) => (lang === "bn" ? c.bn : c.en);
  const month = (i) => monthNames[((i % 12) + 12) % 12];

  const plan = useMemo(() => {
    if (!results || !pool || !pool.length) return null;
    const cur = currentRotation(field, results, mode);
    const start = startSequence(field, results);
    const last = cur && cur.steps ? cur.steps[cur.steps.length - 1] : null;
    const p = planYears(pool, { start, years, current: cur && cur.steps ? cur.steps : null, afterMonth: last ? (last.at + last.months) % 12 : null });
    return p ? { ...p, start, hasCurrent: !!(cur && cur.steps) } : null;
  }, [results, pool, field, mode, years]);

  if (!plan) return null;

  // every placed crop with a colour number, in the order first met
  const all = plan.rows.flat();
  const colour = new Map();
  all.forEach((o) => { if (!colour.has(o.crop.id)) colour.set(o.crop.id, colour.size % 8); });
  const rowSegments = (y) => all
    .map((o) => {
      const from = Math.max(o.rel, y * 12), to = Math.min(o.rel + o.months, y * 12 + 12);
      return to > from ? { o, col: from - y * 12 + 1, span: to - from, cont: o.rel < y * 12 } : null;
    })
    .filter(Boolean);
  const range = (o) => `${month(o.abs)}–${month(o.abs + o.months - 1)}`;
  const startList = plan.start.map((c) => name(c)).join(" → ");
  const backNames = [...new Set(plan.returns.map((c) => name(c)))].join(", ");

  return (
    <section className="my-wrap" aria-labelledby="my-title">
      <h3 id="my-title">{fill(t.mpTitle, { n: nf.format(plan.years) })}</h3>
      <p className="muted small">{t.mpIntro}</p>
      <div className="my-pick" role="group" aria-label={t.mpPick}>
        {[3, 4].map((n) => (
          <button key={n} type="button" className={`sy-chip ${years === n ? "on" : ""}`} aria-pressed={years === n} onClick={() => setYears(n)}>{fill(t.mpYears, { n: nf.format(n) })}</button>
        ))}
      </div>
      <p className="small">{plan.start.length ? fill(t.mpStart, { list: startList }) : t.mpStartNone}</p>
      <p className="small">{fill(t.mpStartsIn, { m: month(plan.origin) })}</p>

      <div className="my-grid" role="img" aria-label={t.mpGridAria}>
        <div className="my-row my-head" aria-hidden="true">
          <span className="my-lab" />
          <div className="my-cells">{Array.from({ length: 12 }, (_, i) => <span key={i}>{month(plan.origin + i)}</span>)}</div>
        </div>
        {plan.rows.map((_, y) => (
          <div className="my-row" key={y}>
            <span className="my-lab">{fill(t.mpYear, { n: nf.format(y + 1) })}</span>
            <div className="my-cells">
              {rowSegments(y).map((s, k) => (
                <span key={k} className={`my-seg c${colour.get(s.o.crop.id)} ${s.cont ? "cont" : ""}`} style={{ gridColumn: `${s.col} / span ${s.span}` }} title={`${name(s.o.crop)} (${range(s.o)})`}>
                  {s.cont ? "… " : ""}{name(s.o.crop)}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      <h4>{t.mpWords}</h4>
      <ul className="my-words small">
        {plan.rows.map((placed, y) => (
          <li key={y}><b>{fill(t.mpYear, { n: nf.format(y + 1) })}:</b> {placed.map((o) => `${name(o.crop)} (${range(o)})`).join(" → ")}</li>
        ))}
      </ul>

      <h4>{t.mpChecks}</h4>
      <ul className="my-checks small">
        <li className={plan.returns.length ? "warn" : "ok"}>
          <span aria-hidden="true">{plan.returns.length ? "!" : "✓"}</span>{" "}
          {plan.returns.length ? fill(t.mpFamBad, { n: nf.format(plan.returns.length), total: nf.format(plan.seasons), list: backNames }) : fill(t.mpFamOk, { total: nf.format(plan.seasons) })}
        </li>
        <li><span aria-hidden="true">{plan.legumeYears ? "✓" : "!"}</span> {fill(t.mpLegume, { a: nf.format(plan.legumeYears), n: nf.format(plan.years) })}</li>
        <li><span aria-hidden="true">i</span> {fill(t.mpCover, { list: plan.monthsInYear.map((n) => nf.format(n)).join(", ") })}</li>
        {plan.baseline && (
          <li><span aria-hidden="true">i</span> {fill(t.mpBase, { a: nf.format(plan.baseline.back.length), at: nf.format(plan.baseline.seasons), b: nf.format(plan.returns.length), bt: nf.format(plan.seasons) })}</li>
        )}
      </ul>
      <p className="muted small">{t.mpCaveat}</p>
    </section>
  );
}
