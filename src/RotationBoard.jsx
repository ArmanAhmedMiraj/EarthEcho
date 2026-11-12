import { useMemo, useState } from "react";
import "./board.css";
import Info from "./Info.jsx";
import SheetButton from "./PlanSheet.jsx";
import { strategySheet } from "./sheetData.js";
import { explain } from "./strategy.js";
import { strategyPayload, uncertainty } from "./trust.js";
import { historyOf, historyPatch } from "./history.js";
import { findCrop } from "./suitability.js";
import { ANNUAL } from "./rotation.js";
import { STRATEGIES } from "./rotationBoard.js";
import { YearWheel, WHEEL_COLORS } from "./Visuals.jsx";

const fill = (text, values) => Object.keys(values).reduce((s, k) => s.split(`{${k}}`).join(values[k]), text);
const IRRIGATION = ["none", "canal", "tubewell", "pump", "drip", "other"];
// soil health is a rule-based index, shown from 10 to 95 so it never looks like a measurement of 0 or 100
const pts = (v) => Math.round(10 + 85 * Math.max(0, Math.min(1, v)));
const SOILS = ["sandy", "sandyLoam", "loam", "siltLoam", "clayLoam", "clay"];

// ---------- small pieces ----------
function Chip({ kind, children, title }) {
  return <span className={`rb-chip ${kind}`} title={title}>{children}</span>;
}

// A pick (or the crop growing now) as a row of months
function Timeline({ steps, monthNames, name }) {
  const cells = Array.from({ length: 12 }, () => null);
  steps.forEach((o, i) => { for (let k = 0; k < o.months; k += 1) cells[(o.at + k) % 12] = i; });
  return (
    <div className="rt-tl" aria-hidden="true">
      {monthNames.map((m) => <span className="m" key={m}>{m}</span>)}
      {cells.map((c, i) => (c == null ? <span className="rt-empty" key={i} /> : <span className={`rt-seg c${c}`} key={i}>{cells[i - 1] === c && i > 0 ? "" : name(steps[c].crop)}</span>))}
    </div>
  );
}

// ---------- the plot card: everything read from the other tabs, with inline editors ----------
function PlotCard({ t, lang, locale, field, results, mode, climate, soilKey, soilSrc, onFieldChange, monthNames, assumedWater }) {
  const d = (field && field.details) || {};
  const sys = (field && field.system) || {};
  const name = (c) => (lang === "bn" ? c.bn : c.en);
  const crops = useMemo(() => results.filter((r) => ANNUAL.includes(r.crop.group) && r.cycle <= 8).map((r) => r.crop).sort((a, b) => name(a).localeCompare(name(b), locale)), [results, lang]); // eslint-disable-line react-hooks/exhaustive-deps
  const cropValue = (text) => {
    const hit = text ? findCrop(crops, text) : null;
    return hit ? hit.id : "";
  };
  const hist = historyOf(d);
  const before = hist.find((h) => h.crop.trim()) || null;
  const set = (patch) => onFieldChange && onFieldChange(patch);
  const nf = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const rainYear = climate ? climate.months.reduce((s, m) => s + (m.rainMm || 0), 0) : null;
  const tAvg = climate ? climate.months.reduce((s, m) => s + (m.tmean || 0), 0) / 12 : null;
  const cropSelect = (value, onPick, extraValue) => (
    <select value={cropValue(value)} onChange={(e) => onPick(e.target.value)}>
      <option value="">{t.rbChoose}</option>
      {crops.map((c) => <option key={c.id} value={c.id}>{name(c)}</option>)}
      {extraValue && !cropValue(extraValue) && <option value="">{extraValue}</option>}
    </select>
  );
  const pickName = (id) => { const c = crops.find((x) => x.id === id); return c ? c.en : ""; };
  const soilLabel = (k) => (t.soilNames && t.soilNames[k]) || t[`irSoil_${k}`] || k;
  const sysSoil = sys.soil || null;
  const soilWord = d.soil ? t.rbSoilYou : sysSoil ? (sysSoil.source === "satellite" ? t.rbSoilSat : sysSoil.source === "map" ? t.rbSoilFrom : t.rbSoilRegion) : t.rbSoilRegion;
  const missing = [];
  if (!d.currentCrop) missing.push(t.rbMissingCrop);
  if (!before) missing.push(t.rbMissingBefore);
  if (!d.irrigation) missing.push(t.rbMissingWater);

  return (
    <section className="rb-plot" aria-labelledby="rb-plot-h">
      <div className="rb-plot-head">
        <h3 id="rb-plot-h">{t.rbPlotTitle}</h3>
        <span className="rb-plot-name">{field ? field.name : ""}{field && field.path ? <span className="muted small"> · {field.path}</span> : null}</span>
      </div>
      <p className="muted small">{t.rbEditNote}</p>
      <div className="rb-plot-grid">
        <label>
          <span>{t.rbGrowing} <Chip kind={d.currentCrop ? "you" : "est"}>{t.rbFromFarm}</Chip></span>
          {cropSelect(d.currentCrop, (id) => set({ currentCrop: pickName(id) }), d.currentCrop)}
        </label>
        <label>
          <span>{t.rbSown} <Chip kind={d.currentSowMonth !== "" && d.currentSowMonth != null ? "you" : "est"}>{d.currentSowMonth !== "" && d.currentSowMonth != null ? t.rbYouSet : t.rbAssumed}</Chip></span>
          <select value={d.currentSowMonth != null ? String(d.currentSowMonth) : ""} onChange={(e) => set({ currentSowMonth: e.target.value })}>
            <option value="">{t.rbChoose}</option>
            {monthNames.map((m, i) => <option key={m} value={String(i)}>{m}</option>)}
          </select>
        </label>
        <label>
          <span>{t.rbBefore} <Chip kind={before ? "you" : "est"}>{t.rbFromFarm}</Chip></span>
          {cropSelect(before ? before.crop : "", (id) => {
            const rows = hist.length ? hist.map((h, i) => ({ ...h })) : [{ crop: "", sowMonth: "", year: "" }];
            const first = rows.findIndex((h) => h.crop.trim());
            const at = first < 0 ? 0 : first;
            rows[at] = { ...rows[at], crop: pickName(id) };
            set(historyPatch(rows));
          }, before ? before.crop : "")}
        </label>
        <label>
          <span>{t.rbWater} <Chip kind={d.irrigation ? "you" : "est"}>{d.irrigation ? t.rbFromFarm : t.rbAssumed}</Chip></span>
          <select value={d.irrigation || ""} onChange={(e) => set({ irrigation: e.target.value })}>
            <option value="">{t.rbChoose}</option>
            {IRRIGATION.map((k) => <option key={k} value={k}>{t[`fdIrr_${k}`]}</option>)}
          </select>
        </label>
        <label>
          <span>{t.rbSoil} <Chip kind={d.soil ? "you" : "nasa"}>{d.soil ? t.rbFromFarm : t.rbFromSoil}</Chip></span>
          <select value={d.soil || ""} onChange={(e) => set({ soil: e.target.value })}>
            <option value="">{fill(t.rbSoilAuto, { soil: soilKey ? soilLabel(soilKey) : "–" })}</option>
            {SOILS.map((k) => <option key={k} value={k}>{soilLabel(k)}</option>)}
          </select>
          <span className="small muted">{soilWord}{!d.soil && sysSoil && sysSoil.confidence != null ? ` · ${fill(t.rbSoilConf, { n: nf.format(sysSoil.confidence) })}` : ""}</span>
        </label>
        <label>
          <span>{t.rbNext} <Chip kind={d.plannedCrop ? "you" : "est"}>{t.rbFromFarm}</Chip></span>
          {cropSelect(d.plannedCrop, (id) => set({ plannedCrop: pickName(id) }), d.plannedCrop)}
        </label>
      </div>
      <p className="rb-facts small">
        {rainYear != null && <span><Chip kind="nasa">{t.rbFromNasa}</Chip> {t.rbRain}: {fill(t.rbRainVal, { mm: nf.format(Math.round(rainYear)), t: new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(tAvg) })}</span>}
        {sys.slopePct != null && <span> · {t.shSlope}: {new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(sys.slopePct)} %</span>}
      </p>
      {assumedWater && <p className="small warn">{t.rbAssumeWater}</p>}
      {missing.length > 0 && <p className="rb-missing small"><b>{t.rbMissingTitle}:</b> {missing.join(", ")}.</p>}
    </section>
  );
}

// ---------- the money sums of one rotation ----------
function MoneyEditor({ t, locale, parts, inputs, setInput, resetCrop, name, cur, share, setShare, monthNames }) {
  const nf = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const nf1 = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
  const chipFor = (src) => <Chip kind={src === "you" ? "you" : src === "market" ? "nasa" : "est"} title={t[`rbSrc${src === "you" ? "You" : src === "market" ? "Market" : "Est"}Help`]}>{t[`rbSrc${src === "you" ? "You" : src === "market" ? "Market" : "Est"}`]}</Chip>;
  const total = parts.reduce((s, p) => s + p.profit, 0);
  const cell = (p, field) => {
    const typed = inputs[p.crop.id] && inputs[p.crop.id][field] != null && inputs[p.crop.id][field] !== "" ? inputs[p.crop.id][field] : "";
    const shown = p[field].v;
    return (
      <div className="rb-money-cell" data-label={t[`rbMoney${field[0].toUpperCase()}${field.slice(1)}`]}>
        <input inputMode="decimal" type="number" min="0" step="any" value={typed} placeholder={nf1.format(shown)} aria-label={`${name(p.crop)} ${t[`rbMoney${field[0].toUpperCase()}${field.slice(1)}`]}`} onChange={(e) => setInput(p.crop.id, field, e.target.value)} />
        <span className="rb-src">{chipFor(p[field].src)}</span>
        {field === "price" && p.price.market && <span className="small muted rb-from">{fill(t.rbPriceFrom, { market: p.price.market.market, km: nf.format(p.price.market.km), month: p.price.market.lastMonth })}</span>}
      </div>
    );
  };
  return (
    <div className="rb-money">
      <h4>{t.rbMoneyTitle} <Info t={t} source="WFP · UN OCHA">
        <p>{t.rbInfoPrice}</p><p>{t.rbInfoYield}</p><p>{t.rbInfoCost}</p><p>{t.rbInfoLimits}</p>
      </Info></h4>
      <p className="small muted">{t.rbMoneyHelp} {fill(t.rbMoneyCur, { cur })}</p>
      <div className="rb-money-rows">
        {parts.map((p) => {
          const has = inputs[p.crop.id] && ["yield", "price", "cost"].some((f) => inputs[p.crop.id][f] != null && inputs[p.crop.id][f] !== "");
          return (
            <div className="rb-money-row" key={p.crop.id}>
              <div className="rb-money-crop"><b>{name(p.crop)}</b>{has && <button type="button" className="fd-link" onClick={() => resetCrop(p.crop.id)}>{t.rbReset}</button>}</div>
              {cell(p, "yield")}
              {cell(p, "price")}
              {cell(p, "cost")}
              <div className="rb-money-cell rb-profit" data-label={t.rbMoneyProfit}><b className={p.profit < 0 ? "neg" : ""}>{nf.format(Math.round(p.profit))}</b></div>
            </div>
          );
        })}
      </div>
      <p className="rb-money-total"><b>{t.rbMoneyTotal}:</b> {nf.format(Math.round(total))} {cur}</p>
      <label className="rb-share small">{t.rbShare} <Info t={t}><p>{t.rbShareHelp}</p></Info>
        <input type="number" min="10" max="100" step="5" value={Math.round(share * 100)} onChange={(e) => { const v = Number(e.target.value); if (v >= 10 && v <= 100) setShare(v / 100); }} /> %
      </label>
    </div>
  );
}

// ---------- numbers and sentences of one rotation (shared by the card and its detail panel) ----------
function pickInfo({ t, x, goal, board, nf, name, monthNames }) {
  const cur = board.current;
  const m = x.m;
  const month = (i) => monthNames[((i % 12) + 12) % 12];
  const top = [...x.money.parts].sort((a, b) => b.profit - a.profit)[0];
  const rough = x.money.rough > 0.5 ? ` (${t.rbRough})` : "";
  const why = [];
  if (goal === "water") {
    const dv = cur && cur.m.gap - m.gap >= 30 ? fill(t.rbR_water_vs, { d: nf.format(Math.round(cur.m.gap - m.gap)) }) : "";
    why.push(fill(t.rbR_water_gap, { gap: nf.format(Math.round(m.gap)), vs: dv }));
    why.push(fill(t.rbR_water_crops, { crops: x.steps.map((o) => name(o.crop)).join(", ") }));
  } else if (goal === "income") {
    why.push(fill(t.rbR_income, { n: nf.format(Math.round(x.money.total)), rough }));
    if (top) why.push(fill(t.rbR_income_top, { crop: name(top.crop), n: nf.format(Math.round(top.profit)) }));
  } else if (goal === "soil") {
    m.legumes.forEach((o) => why.push(fill(t.rbR_soil_leg, { crop: name(o.crop) })));
    why.push(fill(t.rbR_soil_cover, { n: nf.format(Math.min(12, m.usedCount)) }));
    if (x.fam && x.fam.run.length) why.push(fill(t.rbR_soil_fam_bad, { crop: name(m.steps[0].crop) }));
    else why.push(fill(t.rbR_soil_fam, { n: nf.format(m.families) }));
  } else {
    why.push(fill(t.rbR_risk, { h: nf.format(m.hot.length + m.cold.length), w: nf.format(m.bareWet.length), g: nf.format(Math.round(m.gap)) }));
  }
  why.push(fill(t.rbR_fit, { list: x.steps.map((o) => `${name(o.crop)} ${nf.format(Math.round(o.score * 100))}%`).join(", ") }));
  const deltas = [];
  if (cur) {
    const dw = Math.round(cur.m.gap - m.gap);
    deltas.push({ k: "w", good: dw >= 0, text: Math.abs(dw) < 20 ? t.rbWaterSame : dw > 0 ? fill(t.rbWaterLess, { n: nf.format(dw) }) : fill(t.rbWaterMore, { n: nf.format(-dw) }) });
    const dp = Math.round(x.money.total - cur.money.total);
    deltas.push({ k: "p", good: dp >= 0, text: Math.abs(dp) < Math.max(1, Math.abs(cur.money.total)) * 0.03 ? t.rbProfitSame : dp > 0 ? fill(t.rbProfitUp, { n: nf.format(dp) }) : fill(t.rbProfitDown, { n: nf.format(-dp) }) });
    const a = pts(cur.soil), b = pts(x.soil);
    deltas.push({ k: "s", good: b >= a, text: Math.abs(b - a) < 4 ? fill(t.rbSoilSame, { a: nf.format(a) }) : b > a ? fill(t.rbSoilUp, { a: nf.format(a), b: nf.format(b) }) : fill(t.rbSoilDown, { a: nf.format(a), b: nf.format(b) }) });
    if (Math.abs(x.risk - cur.risk) >= 0.08) deltas.push({ k: "r", good: x.risk > cur.risk, text: x.risk > cur.risk ? t.rbRiskUp : t.rbRiskDown });
  }
  const first = [...x.steps].sort((a, b) => ((a.at % 12) - new Date().getMonth() + 12) % 12 - ((b.at % 12) - new Date().getMonth() + 12) % 12)[0];
  return { why, deltas, first, rough, month, cur };
}

// the long text, tables and trust box of one rotation (built only when asked for)
function buildC({ t, x, goal, board, ctx, field, soilLine, name, nf, monthNames, mode }) {
  const m = x.m, cur = board.current;
  const month = (i) => monthNames[((i % 12) + 12) % 12];
  const num = (n) => nf.format(Math.round(n));
  const pct = (s) => `${nf.format(Math.round(s * 100))}%`;
  const profitObj = { complete: x.money.parts.every((p) => p.price.src !== "est"), total: x.money.total, parts: x.money.parts };
  const text = explain({ ...m, assumedTiming: false }, { t, name, month, num, pct, soilLine: soilLine.text, soilLevel: soilLine.level, profit: profitObj, isCurrent: false, fam: x.fam }, cur ? cur.m : null);
  const trust = uncertainty(m, { field, profit: profitObj, isCurrent: false, timingKnown: false, scenarioOn: ctx.scenarioOn, mode });
  return { role: goal, steps: x.steps, m, profit: profitObj, text, fam: x.fam, trust };
}

// ---------- one choice: a compact card (the long text opens in the panel under the cards) ----------
function PickCard({ t, lang, locale, x, idx, goal, board, ctx, onExplain, field, country, mode, monthNames, name, sameAs, soilLine, onPanel, onMoney, panelOpen }) {
  const nf = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const m = x.m;
  const { why, deltas, first, rough, month, cur } = pickInfo({ t, x, goal, board, nf, name, monthNames });
  const cells = Array.from({ length: 12 }, () => null);
  x.steps.forEach((o, i) => { for (let k = 0; k < o.months; k += 1) cells[(o.at + k) % 12] = i; });
  const sections = [["why", t.stSecWhy], ["evidence", t.stSecEvidence], ["benefits", t.stSecBenefits], ["gaps", t.stSecGaps], ["risks", t.stSecRisks]];
  const tableRows = [
    [t.stRowCrops, (c) => c.steps.map((o) => name(o.crop)).join(" → "), ["est"]],
    [t.stRowFit, (c) => `${nf.format(Math.round(c.m.mean * 100))}%`, ["nasa", "est"]],
    [t.stRowUse, (c) => `${nf.format(c.m.usedCount)} / 12`, ["est"]],
    [t.stRowGap, (c) => (c.m.haveClimate ? nf.format(Math.round(c.m.gap)) : "–"), ["nasa", "est"]],
    [t.stRowProfit, (c) => nf.format(Math.round(c.profit.total)), ["you", "est"]],
  ];
  const roleLabel = () => t[`rbS_${goal}`];
  const mk = () => buildC({ t, x, goal, board, ctx, field, soilLine, name, nf, monthNames, mode });
  return (
    <article className={`rb-pick${panelOpen ? " open" : ""}`}>
      <header className="rb-pick-head">
        <span className="rb-pick-n">{fill(t.rbPick, { n: idx + 1 })} · {fill(t.rbMFit + " {p}%", { p: nf.format(Math.round(x.fit * 100)) })}</span>
        <h4>{x.steps.map((o) => name(o.crop)).join(" → ")}</h4>
      </header>
      <div className="rb-bar" role="img" aria-label={x.steps.map((o) => `${name(o.crop)}: ${monthNames[o.at % 12]} · ${o.months}`).join("; ")}>
        {cells.map((c, i) => <span key={i} className={c == null ? "empty" : ""} style={c == null ? undefined : { background: WHEEL_COLORS[c % WHEEL_COLORS.length] }} title={`${monthNames[i]}${c == null ? "" : ` · ${name(x.steps[c].crop)}`}`} />)}
      </div>
      {sameAs && <p className="small muted">{fill(t.rbSameAs, { s: t[`rbS_${sameAs}`] })}</p>}
      <dl className="rb-metrics">
        <div><dt>{t.rbMWater}</dt><dd>{fill(t.rbMMm, { n: nf.format(Math.round(m.gap)) })}</dd></div>
        <div><dt>{t.rbMProfit}</dt><dd>{nf.format(Math.round(x.money.total))}{rough ? <i> {t.rbRough}</i> : null}</dd></div>
        <div><dt>{t.rbMSoil}</dt><dd>{fill(t.rbMOutOf, { n: nf.format(pts(x.soil)) })}</dd></div>
        <div><dt>{t.rbMUse}</dt><dd>{fill(t.rbMMonths, { n: nf.format(Math.min(12, m.usedCount)) })}</dd></div>
      </dl>
      <p className="rb-why1">{why[0]}</p>
      {cur ? <p className="rb-deltas">{deltas.map((dl) => <span key={dl.k} className={`rb-delta ${dl.good ? "good" : "bad"}`}>{dl.good ? "▲" : "▼"} {dl.text}</span>)}</p> : <p className="small muted">{t.rbNoNow}</p>}
      <p className="small muted rb-next">{fill(t.rbNextStep, { crop: name(first.crop), month: month(first.at) })}</p>
      <div className="rb-acts">
        <button type="button" className="tab" onClick={() => onMoney(idx)}>{t.orbMoneyBtn}</button>
        <button type="button" className="tab" aria-expanded={panelOpen} onClick={() => onPanel(idx)}>{t.orbEvidenceBtn}</button>
        <SheetButton t={t} lang={lang} build={() => { const c = mk(); return strategySheet({ c, t, field, locale, nf: new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }), name, month, tableRows, sections, roleLabel, mode, country }); }} />
        {onExplain && (
          <button type="button" className="btn ex-btn" onClick={() => { const c = mk(); onExplain({
            question: fill(t.exQuestion, { crops: c.text.crops }),
            strategy: strategyPayload(c, { mode, scenario: ctx.scenario, prio: [goal], baseline: cur ? { m: cur.m, steps: cur.steps, profit: { complete: false, total: cur.money.total } } : null, name, monthNames }),
          }); }}>{t.exButton}</button>
        )}
      </div>
    </article>
  );
}

// the full reasons, evidence, gaps and trust box of the opened rotation
function PickPanel({ t, x, goal, board, ctx, field, soilLine, name, nf, monthNames, mode, onClose }) {
  const c = useMemo(() => buildC({ t, x, goal, board, ctx, field, soilLine, name, nf, monthNames, mode }), []); // eslint-disable-line react-hooks/exhaustive-deps
  const { why } = pickInfo({ t, x, goal, board, nf, name, monthNames });
  const sections = [["why", t.stSecWhy], ["evidence", t.stSecEvidence], ["benefits", t.stSecBenefits], ["gaps", t.stSecGaps], ["risks", t.stSecRisks]];
  return (
    <section className="rb-panel" aria-label={t.orbEvidenceBtn}>
      <div className="rb-panel-head"><h4>{fill(t.rbReasonTitle, { s: t[`rbS_${goal}`] })}: {x.steps.map((o) => name(o.crop)).join(" → ")}</h4><button type="button" className="tab" onClick={onClose}>{t.navClose}</button></div>
      <ul className="rb-panel-why">{why.map((w, i) => <li key={i}>{w}</li>)}</ul>
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
      </div>
    </section>
  );
}

// ---------- the whole board ----------
export default function RotationBoard({ t, lang, locale, board, results, field, mode, monthNames, ctx, onExplain, country, moneyProps, soilLine, plotSlot, controlsSlot, notes, tools }) {
  const nf = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const name = (c) => (lang === "bn" ? c.bn : c.en);
  const best = board.best;
  const [goal, setGoal] = useState(null);
  const [panel, setPanel] = useState(null); // index of the choice whose long text is open
  const [moneyIdx, setMoneyIdx] = useState(0);
  const active = goal || best.id;
  const pickGoal = (s) => { setGoal(s); setPanel(null); setMoneyIdx(0); };
  const picks = board.strategies[active] || [];
  const cur = board.current;
  const bestTop = board.strategies[best.id] && board.strategies[best.id][0];

  const benefit = [];
  if (cur && bestTop) {
    if (best.id === "water") benefit.push(fill(t.rbBenefitWater, { n: nf.format(Math.max(0, Math.round(cur.m.gap - bestTop.m.gap))) }));
    if (best.id === "soil") benefit.push(fill(t.rbBenefitSoil, { a: nf.format(pts(cur.soil)), b: nf.format(pts(bestTop.soil)) }));
    if (best.id === "income") benefit.push(fill(t.rbBenefitIncome, { n: nf.format(Math.max(0, Math.round(bestTop.money.total - cur.money.total))) }));
    if (best.id === "risk") benefit.push(t.rbBenefitRisk);
    if (best.keep) benefit.length = 0;
  }
  const whyBest = [];
  if (cur) {
    if (best.id === "water") whyBest.push(fill(t.rbCurWhy_water, { gap: nf.format(Math.round(cur.m.gap)) }));
    if (best.id === "soil") {
      const reasons = [];
      if (!cur.m.legumes.length) reasons.push(t.rbCurSoilNoLeg);
      if (cur.fam && cur.fam.run.length) reasons.push(t.rbCurSoilFam);
      if (cur.m.bare.length >= 3) reasons.push(fill(t.rbCurSoilBare, { n: nf.format(cur.m.bare.length) }));
      whyBest.push(fill(t.rbCurWhy_soil, { n: nf.format(pts(cur.soil)), reasons: reasons.length ? reasons.join(", ") : t.rbCurSoilOk }));
    }
    if (best.id === "income") whyBest.push(fill(t.rbCurWhy_income, { n: nf.format(Math.round(cur.money.total)), rough: cur.money.rough > 0.5 ? ` (${t.rbRough})` : "" }));
    if (best.id === "risk") whyBest.push(fill(t.rbCurWhy_risk, { k: nf.format(cur.m.hot.length + cur.m.cold.length), w: nf.format(cur.m.bareWet.length) }));
  }
  const needsMax = Math.max(0.01, ...STRATEGIES.map((s) => (best.needs && best.needs[s]) || 0));
  const chain = bestTop ? bestTop.steps.map((o) => name(o.crop)).join(", ") : "";
  const moneyPick = picks[moneyIdx] || picks[0];
  const goTo = (id) => { const el = document.getElementById(id); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); };

  return (
    <>
      <section className={`rb-hero ${best.keep ? "keep" : ""}`} aria-labelledby="rb-best-h">
        {bestTop && (
          <div className="rb-wheel">
            <YearWheel steps={bestTop.steps.map((o) => ({ start: o.at, len: o.months }))} months={monthNames.map((m) => Array.from(m)[0])} centre={t[`rbS_${best.id}`]} label={bestTop.steps.map((o) => name(o.crop)).join(" → ")} />
            <ul>{bestTop.steps.map((o, i) => <li key={i}><i style={{ background: WHEEL_COLORS[i % WHEEL_COLORS.length] }} />{name(o.crop)} <span className="small muted">{monthNames[o.at % 12]} · {o.months}</span></li>)}</ul>
          </div>
        )}
        <div className="rb-hero-body">
          <span className="rb-hero-tag">{t.rbSBest}</span>
          <h3 id="rb-best-h">{t[`rbS_${best.id}`]}{chain ? `: ${chain}` : ""}</h3>
          <p className="rb-hero-lead">{t[`rbD_${best.id}`]}</p>
          {best.noCurrent && <p className="small warn">{t.rbBestNoCur}</p>}
          {best.keep && bestTop && <p className="small">{fill(t.rbBestKeep, { name: bestTop.steps.map((o) => name(o.crop)).join(" → ") })}</p>}
          {whyBest.map((w, i) => <p key={`w${i}`}><b>{t.rbBestWhy}:</b> {w}</p>)}
          {benefit.map((w, i) => <p key={`b${i}`}><b>{t.rbBestBenefit}:</b> {w}</p>)}
          {!best.noCurrent && (
            <div className="rb-needs">
              <h5>{t.rbNeedsTitle} <Info t={t}><p>{t.rbNeedsHelp}</p><p>{t.rbLogicAll}</p></Info></h5>
              {STRATEGIES.map((s) => (
                <div className="rb-need" key={s}>
                  <span>{t[`rbNeed_${s}`]}</span>
                  <i><b style={{ width: `${Math.round((((best.needs && best.needs[s]) || 0) / needsMax) * 100)}%` }} /></i>
                </div>
              ))}
            </div>
          )}
          <button type="button" className="tab" onClick={() => { pickGoal(best.id); goTo("rb-goals"); }}>{t.rbShow}</button>
        </div>
      </section>

      {plotSlot}

      <section id="rb-goals" className="rb-goals" aria-labelledby="rb-goals-h">
        <div className="rb-goals-head">
          <h3 id="rb-goals-h">{t.rbGoalTitle} <Info t={t}><p>{t.rbLogicWater}</p><p>{t.rbLogicIncome}</p><p>{t.rbLogicSoil}</p><p>{t.rbLogicRisk}</p><p>{t.rbLogicAll}</p></Info></h3>
          {controlsSlot}
        </div>
        <p className="muted small">{t.rbGoalHint}</p>
        {notes}
        <div className="rb-tabs" role="tablist">
          {STRATEGIES.map((s) => (
            <button key={s} role="tab" type="button" aria-selected={active === s} className={`rb-tab ${active === s ? "on" : ""}`} onClick={() => pickGoal(s)}>
              <b>{t[`rbS_${s}`]}{best.id === s ? ` · ${t.rbSBest}` : ""}</b>
              <span>{t[`rbD_${s}`]}</span>
            </button>
          ))}
        </div>
        {picks.length === 0 && <p className="warn">{t.rbNoRotations}</p>}
        <div className="rb-picks">
          {picks.map((x, i) => {
            const key = x.steps.map((o) => o.crop.id).join(">");
            const same = i === 0 ? STRATEGIES.find((s) => s !== active && board.strategies[s][0] && board.strategies[s][0].steps.map((o) => o.crop.id).join(">") === key) : null;
            return <PickCard key={`${active}-${key}`} t={t} lang={lang} locale={locale} x={x} idx={i} goal={active} board={board} ctx={ctx} onExplain={onExplain} field={field} country={country} mode={mode} monthNames={monthNames} name={name} sameAs={same} soilLine={soilLine} panelOpen={panel === i} onPanel={(n) => setPanel(panel === n ? null : n)} onMoney={(n) => { setMoneyIdx(n); goTo("rb-money"); }} />;
          })}
        </div>
        {panel != null && picks[panel] && <PickPanel key={`${active}-${panel}`} t={t} x={picks[panel]} goal={active} board={board} ctx={ctx} field={field} soilLine={soilLine} name={name} nf={nf} monthNames={monthNames} mode={mode} onClose={() => setPanel(null)} />}
      </section>

      <div className="rb-tools">
        {moneyPick && (
          <section id="rb-money" className="rb-tool rb-tool-money">
            <p className="small muted">{fill(t.orbMoneyFor, { crops: moneyPick.steps.map((o) => name(o.crop)).join(" → ") })}</p>
            <MoneyEditor t={t} locale={locale} parts={moneyPick.money.parts} name={name} monthNames={monthNames} {...moneyProps} />
          </section>
        )}
        {tools}
      </div>
    </>
  );
}

export { PlotCard };
