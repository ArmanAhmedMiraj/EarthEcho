import { useMemo } from "react";
import "./strategy.css";
import { currentRotation, explain, matchScore, measure, priorityParts, profitOf } from "./strategy.js";
import { strategyPayload, uncertainty } from "./trust.js";
import { recentFamily } from "./history.js";
import "./trust.css";
import SheetButton from "./PlanSheet.jsx";
import TradeOff from "./TradeOff.jsx";
import { strategySheet } from "./sheetData.js";

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

export default function StrategyCompare({ t, lang, locale, results, rotations, pool, prio = [], climate, mode, field, soilData, monthNames, valueOf, scenarioOn = false, scenario = { rain: 0, temp: 0 }, onExplain = null, country = null }) {
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
      const fam = recentFamily(field, results, steps, !!extra.isCurrent);
      const text = explain({ ...m, assumedTiming: !!extra.assumedTiming }, { ...base, profit, isCurrent: !!extra.isCurrent, fam }, extra.baseline || null);
      return { m, profit, text, fam, trust: uncertainty(m, { field, profit, isCurrent: !!extra.isCurrent, timingKnown: !!extra.isCurrent && extra.assumedTiming === false, scenarioOn, mode }) };
    };

    const cur = currentRotation(field, results, mode);
    let current = null;
    if (cur && cur.steps) {
      const b = build(cur.steps, { isCurrent: true, assumedTiming: cur.assumedTiming });
      current = { role: "Current", ...b, steps: cur.steps, assumedTiming: cur.assumedTiming };
    }
    // every candidate rotation, measured, with its profit and its priority scores
    const measured = (pool && pool.length ? pool : rotations).map((r) => ({ r, m: measure(r.steps, { climate, mode, field }), profit: profitFor(r.steps) }));
    const stats = measured.map((x) => ({ gap: x.m.gap, profit: x.profit.complete ? x.profit.total : 0 }));
    measured.forEach((x) => { x.parts = priorityParts(x.m, x.profit, stats); x.match = matchScore(x.m, x.parts, prio); });

    let picks;
    if (prio.length) {
      const top = [...measured].sort((a, b) => b.match - a.match).slice(0, 3);
      picks = top.map((item, i) => ({ role: i === 0 ? "Match" : "Match2", item }));
    } else {
      picks = pickAlternatives(measured);
    }
    if (current) current.parts = priorityParts(current.m, current.profit, stats);
    const money = (n) => num(n);
    const alts = picks.map(({ role, item }) => {
      const b = build(item.r.steps, { baseline: current ? current.m : null });
      if (prio.length) {
        const extra = [];
        const was = current ? current.m.gap : null;
        prio.forEach((p) => {
          if (p === "water") extra.push(fill(t.stPrWater, { gap: num(item.m.gap), vs: was != null && was - item.m.gap >= 30 ? fill(t.stPrWaterVs, { d: num(was - item.m.gap) }) : "" }));
          if (p === "income") extra.push(item.profit.complete ? fill(t.stPrIncome, { n: money(item.profit.total) }) : t.stPrIncomeNo);
          if (p === "soil") extra.push(fill(t.stPrSoil, { n: num(item.m.usedCount), f: num(item.m.families), leg: item.m.legumes.length ? t.stPrLegume : "" }));
          if (p === "risk") extra.push(fill(t.stPrRisk, { k: num(item.m.hot.length + item.m.cold.length), w: num(item.m.bareWet.length) }));
        });
        b.text.why = [...extra, ...b.text.why];
      }
      return { role, ...b, steps: item.r.steps, parts: item.parts };
    });
    return { current, alts, unknown: cur && cur.unknown, noCurrent: !cur, name, num, pct, month };
  }, [results, rotations, pool, prio, climate, mode, field, soilData, lang, locale, monthNames, t, valueOf, scenarioOn]);

  if (!data) return null;
  const { current, alts, unknown, noCurrent, name, num, pct, month } = data;
  const cols = [current, ...alts].filter(Boolean);
  const roleLabel = (r) => t[`stRole${r}`];
  const yn = (b) => (b ? t.stYes : t.stNo);
  const profitCell = (c) => (c.profit.complete ? num(c.profit.total) : "–");
  const soilYou = !!(field && field.details && field.details.soil);
  const tagOf = (k) => <span key={k} className={`src-tag ${k}`} title={t[`srcHelp_${k}`]}>{t[`src_${k}`]}</span>;
  const rows = [
    [t.stRowCrops, (c) => c.steps.map((o) => name(o.crop)).join(" → "), ["est"]],
    [mode === "irrigated" ? t.stRowFitIrr : t.stRowFit, (c) => pct(c.m.mean), soilYou ? ["nasa", "you", "est"] : ["nasa", "est"]],
    [t.stRowFitRain, (c) => {
      const scores = c.steps.map((o) => { const r = results.find((x) => x.crop.id === o.crop.id); return r ? r.rainfed.best : null; });
      return scores.some((v) => v == null) ? "–" : pct(scores.reduce((a, b) => a + b, 0) / scores.length);
    }, ["nasa", "est"]],
    [t.stRowUse, (c) => `${num(c.m.usedCount)} / 12`, ["est"]],
    [t.stRowBare, (c) => (c.m.bare.length ? `${num(c.m.bare.length)} (${c.m.bare.map(month).join(", ")})` : "0"), ["est"]],
    [t.stRowLegume, (c) => yn(c.m.legumes.length > 0), ["est"]],
    [t.stRowFamilies, (c) => num(c.m.families), ["est"]],
    [t.stRowFamRecent, (c) => (!c.fam || !c.fam.known ? "–" : c.fam.run.length ? fill(t.stFamYes, { crops: [...new Set(c.fam.run.map((x) => name(x)))].join(", ") }) : t.stNo), ["you"]],
    [t.stRowGap, (c) => (c.m.haveClimate ? num(c.m.gap) : "–"), ["nasa", "est"]],
    [t.stRowProfit, profitCell, ["you", "est"]],
    [t.trSure, (c) => t[`trLevel_${c.trust.level}`], ["est"]],
  ];
  const sections = [["why", t.stSecWhy], ["evidence", t.stSecEvidence], ["benefits", t.stSecBenefits], ["gaps", t.stSecGaps], ["risks", t.stSecRisks]];

  return (
    <section className="st-wrap" aria-labelledby="st-title">
      <h3 id="st-title">{t.stTitle}</h3>
      <p className="muted small">{t.stIntro}</p>
      {noCurrent && <p className="st-note">{t.stNoCurrent}</p>}
      {unknown && <p className="st-note">{fill(t.stCurrentUnknown, { crop: unknown })}</p>}

      <p className="small src-legend"><b>{t.srcLegendTitle}</b> {["nasa", "est", "you"].map((k) => <span key={k}>{tagOf(k)} {t[`srcHelp_${k}`]} </span>)}</p>
      <div className="st-scroll" tabIndex={0} role="region" aria-label={t.stTitle}>
        <table className="st-table">
          <thead>
            <tr>
              <td />
              {cols.map((c) => (
                <th key={c.role} scope="col" className={c.role === "Current" ? "cur" : ""}>{roleLabel(c.role)}{c.role === "Current" && <span className="src-tags">{tagOf("you")}</span>}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, fn, tags]) => (
              <tr key={label}>
                <th scope="row">{label}{tags && <span className="src-tags">{tags.map(tagOf)}</span>}</th>
                {cols.map((c) => <td key={c.role} className={c.role === "Current" ? "cur" : ""}>{fn(c)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {current && current.assumedTiming && <p className="muted small">{t.stNoteAssumed}</p>}
      <TradeOff t={t} cols={cols} roleLabel={roleLabel} num={num} haveIncome={cols.some((c) => c.parts && c.parts.income != null)} />

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
          <div className={`tr-box ${c.trust.level}`}>
            <h4>{t.trTitle}: <span className="tr-pill">{t[`trLevel_${c.trust.level}`]}</span></h4>
            <p className="small">{t[`trLead_${c.trust.level}`]}</p>
            <ul className="tr-list">
              {c.trust.factors.map((f) => (
                <li key={f.key} className={f.state}><span className="tr-mark" aria-hidden="true">{{ ok: "✓", assumed: "~", missing: "✗" }[f.state]}</span><b>{t[`trState_${f.state}`]}:</b> {t[`trF_${f.key}_${f.state}`]}</li>
              ))}
              {c.trust.sensitive.map((k) => <li key={k} className="assumed"><span className="tr-mark" aria-hidden="true">!</span>{t[`trS_${k}`]}</li>)}
            </ul>
            <p className="small"><b>{t.trImprove}</b> {t.trImproveBody}</p>
          </div>
          <div className="ex-box">
            <SheetButton t={t} lang={lang} build={() => strategySheet({ c, t, field, locale, nf: new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }), name, month, tableRows: rows, sections, roleLabel, mode, country })} />
            <p className="muted small">{t.shOpenNote}</p>
          </div>
          {onExplain && (
            <div className="ex-box">
              <button type="button" className="tab ex-btn" onClick={() => onExplain({
                question: fill(t.exQuestion, { crops: c.text.crops }),
                strategy: strategyPayload(c, { mode, scenario, prio, baseline: current, name, monthNames }),
              })}>{t.exButton}</button>
              <p className="muted small">{t.exNote}</p>
            </div>
          )}
        </details>
      ))}
    </section>
  );
}
