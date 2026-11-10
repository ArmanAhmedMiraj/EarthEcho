import { useMemo } from "react";
import "./strategy.css";
import { currentRotation, explain, measure, profitOf } from "./strategy.js";

const fill = (text, values) => Object.keys(values).reduce((s, k) => s.split(`{${k}}`).join(values[k]), text);

// Choose the alternatives to show: the best fit, the one that builds the soil most, the one that saves most water.
// Each is a different rotation; if there are fewer than three distinct ones, fewer are shown.
function pickAlternatives(list) {
  const out = [];
  const take = (role, sorted) => {
    const hit = sorted.find((x) => !out.some((o) => o.item === x));
    if (hit) out.push({ role, item: hit });
  };
  take("Fit", [...list].sort((a, b) => b.m.mean - a.m.mean));
  take("Soil", [...list].sort((a, b) => b.m.legumes.length - a.m.legumes.length || b.m.usedCount - a.m.usedCount || b.m.mean - a.m.mean));
  take("Water", [...list].filter((x) => x.m.mean >= 0.5).sort((a, b) => a.m.gap - b.m.gap || b.m.mean - a.m.mean));
  return out;
}

export default function StrategyCompare({ t, lang, locale, results, rotations, climate, mode, field, soilData, monthNames, valueOf }) {
  const data = useMemo(() => {
    if (!results || !climate) return null;
    const name = (c) => (lang === "bn" ? c.bn : c.en);
    const nf = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
    const num = (n) => nf.format(Math.round(n));
    const pct = (s) => `${nf.format(Math.round(s * 100))}%`;
    const month = (i) => monthNames[((i % 12) + 12) % 12];

    // soil line and how sure it is
    const d = (field && field.details) || {};
    const sys = field && field.system && field.system.soil;
    const soilName = (key) => (t.soilNames && t.soilNames[key]) || key;
    let soilLine = null, soilLevel = null;
    if (d.soil) { soilLine = fill(t.stEvSoil, { name: soilName(d.soil) }); soilLevel = "entered"; }
    else if (sys && sys.key) {
      soilLevel = sys.level || null;
      const word = sys.level ? { high: t.confHigh, medium: t.confMedium, low: t.confLow }[sys.level] : null;
      soilLine = word ? fill(t.stEvSoilEst, { name: soilName(sys.key), level: word }) : fill(t.stEvSoilPlain, { name: soilName(sys.key) });
    }

    const profitFor = (steps) => {
      const inputs = {};
      steps.forEach((o) => { inputs[o.crop.id] = { yield: valueOf(o.crop.id, "yield"), price: valueOf(o.crop.id, "price"), cost: valueOf(o.crop.id, "cost") }; });
      return profitOf({ steps }, inputs);
    };
    const base = { t, name, month, num, pct, soilLine, soilLevel };
    const build = (steps, extra = {}) => {
      const m = measure(steps, { climate, mode, field });
      const profit = profitFor(steps);
      const text = explain({ ...m, assumedTiming: !!extra.assumedTiming }, { ...base, profit, isCurrent: !!extra.isCurrent }, extra.baseline || null);
      return { m, profit, text };
    };

    const cur = currentRotation(field, results, mode);
    let current = null;
    if (cur && cur.steps) {
      const b = build(cur.steps, { isCurrent: true, assumedTiming: true });
      current = { role: "Current", ...b, steps: cur.steps };
    }
    const alts = pickAlternatives(rotations.map((r) => ({ r, m: measure(r.steps, { climate, mode, field }) }))).map(({ role, item }) => {
      const b = build(item.r.steps, { baseline: current ? current.m : null });
      return { role, ...b, steps: item.r.steps };
    });
    return { current, alts, unknown: cur && cur.unknown, noCurrent: !cur, name, num, pct, month };
  }, [results, rotations, climate, mode, field, soilData, lang, locale, monthNames, t, valueOf]);

  if (!data) return null;
  const { current, alts, unknown, noCurrent, name, num, pct, month } = data;
  const cols = [current, ...alts].filter(Boolean);
  const roleLabel = (r) => t[`stRole${r}`];
  const yn = (b) => (b ? t.stYes : t.stNo);
  const profitCell = (c) => (c.profit.complete ? num(c.profit.total) : "–");
  const rows = [
    [t.stRowCrops, (c) => c.steps.map((o) => name(o.crop)).join(" → ")],
    [t.stRowFit, (c) => pct(c.m.mean)],
    [t.stRowUse, (c) => `${num(c.m.usedCount)} / 12`],
    [t.stRowBare, (c) => (c.m.bare.length ? `${num(c.m.bare.length)} (${c.m.bare.map(month).join(", ")})` : "0")],
    [t.stRowLegume, (c) => yn(c.m.legumes.length > 0)],
    [t.stRowFamilies, (c) => num(c.m.families)],
    [t.stRowGap, (c) => (c.m.haveClimate ? num(c.m.gap) : "–")],
    [t.stRowProfit, profitCell],
  ];
  const sections = [["why", t.stSecWhy], ["evidence", t.stSecEvidence], ["benefits", t.stSecBenefits], ["gaps", t.stSecGaps], ["risks", t.stSecRisks]];

  return (
    <section className="st-wrap" aria-labelledby="st-title">
      <h3 id="st-title">{t.stTitle}</h3>
      <p className="muted small">{t.stIntro}</p>
      {noCurrent && <p className="st-note">{t.stNoCurrent}</p>}
      {unknown && <p className="st-note">{fill(t.stCurrentUnknown, { crop: unknown })}</p>}

      <div className="st-scroll" tabIndex={0} role="region" aria-label={t.stTitle}>
        <table className="st-table">
          <thead>
            <tr>
              <td />
              {cols.map((c) => (
                <th key={c.role} scope="col" className={c.role === "Current" ? "cur" : ""}>{roleLabel(c.role)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, fn]) => (
              <tr key={label}>
                <th scope="row">{label}</th>
                {cols.map((c) => <td key={c.role} className={c.role === "Current" ? "cur" : ""}>{fn(c)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {current && <p className="muted small">{t.stNoteAssumed}</p>}

      {cols.map((c, i) => (
        <details className={`st-card ${c.role === "Current" ? "cur" : ""}`} key={c.role} open={i === 0}>
          <summary>
            <span className="st-role">{roleLabel(c.role)}</span>
            <span className="st-chain">{c.text.crops}</span>
          </summary>
          <div className="st-grid">
            {sections.map(([key, title]) => (
              <div className={`st-sec ${key}`} key={key}>
                <h4>{title}</h4>
                <ul>{c.text[key].map((line, n) => <li key={n}>{line}</li>)}</ul>
              </div>
            ))}
          </div>
        </details>
      ))}
    </section>
  );
}
