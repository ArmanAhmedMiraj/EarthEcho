import { useEffect, useMemo, useState } from "react";
import { currentRotation, measure } from "./strategy.js";

const fill = (text, values) => Object.keys(values).reduce((s, k) => s.split(`{${k}}`).join(values[k]), text);
const HEAVY = 150; // mm in a month
const ERODIBLE = { siltLoam: 2, sandyLoam: 1, sandy: 1, loam: 1 };

// A simple rule-of-thumb for washing-away risk. It is NOT a soil-loss model (RUSLE); it counts three plain things.
export function erosionRisk({ slope, soilKey, bareWet }) {
  const parts = [];
  let points = 0;
  if (slope != null) { const p = slope >= 8 ? 2 : slope >= 3 ? 1 : 0; points += p; parts.push({ k: "slope", level: p }); }
  else parts.push({ k: "slope", level: null });
  if (soilKey) { const p = ERODIBLE[soilKey] || 0; points += p; parts.push({ k: "soil", level: p }); }
  else parts.push({ k: "soil", level: null });
  const b = bareWet >= 3 ? 2 : bareWet >= 1 ? 1 : 0;
  points += b; parts.push({ k: "bare", level: b });
  const known = parts.filter((x) => x.level != null).length;
  return { level: points >= 4 ? "high" : points >= 2 ? "moderate" : "low", points, parts, known };
}

function Spark({ years, values, label, unit, fmt }) {
  const w = 220, h = 54, pad = 4;
  const min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
  const x = (i) => pad + (i / (values.length - 1)) * (w - 2 * pad);
  const y = (v) => h - pad - ((v - min) / span) * (h - 2 * pad);
  const d = values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  return (
    <svg className="ev-spark" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`${label}: ${years[0]}–${years[years.length - 1]}, ${fmt(min)}–${fmt(max)} ${unit}`}>
      <path d={d} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <circle cx={x(values.length - 1)} cy={y(values[values.length - 1])} r="3" fill="currentColor" />
    </svg>
  );
}

export default function Evidence({ t, lang, locale, lat, lon, climate, rotations, field, soilData, mode, monthNames, results }) {
  const [trend, setTrend] = useState(null);
  const [state, setState] = useState("loading");
  const [pick, setPick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState("loading");
    fetch(`/api/trend?lat=${lat}&lon=${lon}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => { if (cancelled) return; if (d.ok) { setTrend(d); setState("ok"); } else setState("error"); })
      .catch(() => { if (!cancelled) setState("error"); });
    return () => { cancelled = true; };
  }, [lat, lon]);

  const nf = useMemo(() => new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }), [locale]);
  const yr = useMemo(() => new Intl.NumberFormat(locale, { useGrouping: false }), [locale]);
  const nf1 = useMemo(() => new Intl.NumberFormat(locale, { maximumFractionDigits: 1, minimumFractionDigits: 1 }), [locale]);
  const nf2 = useMemo(() => new Intl.NumberFormat(locale, { maximumFractionDigits: 2, minimumFractionDigits: 2, signDisplay: "exceptZero" }), [locale]);
  const name = (c) => (lang === "bn" ? c.bn : c.en);

  // the strategies the calendar can show: the farmer's current one first, then the top suggestions
  const options = useMemo(() => {
    if (!climate) return [];
    const out = [];
    const cur = currentRotation(field, results, mode);
    if (cur && cur.steps) out.push({ label: t.evCurrent, steps: cur.steps, assumed: !!cur.assumedTiming });
    rotations.slice(0, 3).forEach((r, i) => out.push({ label: `${t.evSuggested} ${nf.format(i + 1)}`, steps: r.steps, assumed: false }));
    return out;
  }, [climate, field, results, mode, rotations, t, nf]);

  if (!climate || !options.length) return null;
  const opt = options[Math.min(pick, options.length - 1)];
  const m = measure(opt.steps, { climate, mode, field });
  const months = climate.months;
  const cell = Array.from({ length: 12 }, () => null);
  opt.steps.forEach((o, i) => { for (let k = 0; k < o.months; k += 1) cell[(o.at + k) % 12] = i; });
  const maxRain = Math.max(...months.map((x) => x.rainMm || 0), 1);

  // months that need attention, each with the plain reason
  const flags = [];
  const hotM = new Set(m.hot.map((x) => x.month)), coldM = new Set(m.cold.map((x) => x.month));
  const shaky = (i) => trend && trend.months[i] && trend.months[i].cv != null && trend.months[i].cv >= 0.6 && (months[i].rainMm || 0) >= 20;
  for (let i = 0; i < 12; i += 1) {
    const f = [];
    if (cell[i] == null && (months[i].rainMm || 0) >= HEAVY) f.push("wet");
    if (hotM.has(i)) f.push("hot");
    if (coldM.has(i)) f.push("cold");
    if (cell[i] != null && shaky(i)) f.push("shaky");
    flags.push(f);
  }
  const listOf = (kind) => flags.map((f, i) => (f.includes(kind) ? monthNames[i] : null)).filter(Boolean).join(", ");

  const d = (field && field.details) || {};
  const sys = field && field.system && field.system.soil;
  const soilKey = d.soil || (sys && sys.key) || null;
  const risk = erosionRisk({ slope: m.slope, soilKey, bareWet: m.bareWet.length });
  const levelWord = { low: t.evLow, moderate: t.evModerate, high: t.evHigh }[risk.level];
  const partLine = (p) => {
    if (p.k === "slope") return p.level == null ? t.evSlopeUnknown : fill(t.evSlopeLine, { s: nf1.format(m.slope), w: [t.evFactorLow, t.evFactorMid, t.evFactorHigh][p.level] });
    if (p.k === "soil") return p.level == null ? t.evSoilUnknown : fill(t.evSoilLine, { name: (t.soilNames && t.soilNames[soilKey]) || soilKey, w: [t.evFactorLow, t.evFactorMid, t.evFactorHigh][p.level] });
    return fill(t.evBareLine, { n: nf.format(m.bareWet.length), w: [t.evFactorLow, t.evFactorMid, t.evFactorHigh][p.level], months: m.bareWet.length ? ` (${m.bareWet.map((i) => monthNames[i]).join(", ")})` : "" });
  };

  const tt = trend;
  const sign = (v) => nf2.format(v);
  const tempText = tt && (tt.tempStep ? t.evStepTemp : tt.tempTrend.clear ? fill(t.evTempClear, { v: sign(tt.tempTrend.perDecade) }) : fill(t.evTempNone, { v: sign(tt.tempTrend.perDecade) }));
  const rainText = tt && (tt.rainStep
    ? fill(t.evStepRain, { year: yr.format(tt.rainStep.year), a: nf.format(tt.rainStep.before), b: nf.format(tt.rainStep.after) })
    : tt.rainTrend.clear ? fill(t.evRainClear, { v: nf.format(tt.rainTrend.perDecade) }) : fill(t.evRainNone, { v: nf.format(tt.rainTrend.perDecade) }));

  return (
    <section className="ev-wrap" aria-labelledby="ev-title">
      <h3 id="ev-title">{t.evTitle}</h3>
      <p className="muted small">{t.evIntro}</p>

      <div className="ev-card">
        <h4>{t.evTrendTitle}</h4>
        {state === "loading" && <p className="muted small">{t.evLoading}</p>}
        {state === "error" && <p className="warn small">{t.evFailed}</p>}
        {tt && (
          <>
            <div className="ev-two">
              <div>
                <strong>{t.evTemp}</strong>
                <Spark years={tt.years} values={tt.temp} label={t.evTemp} unit="°C" fmt={(v) => nf1.format(v)} />
                <p className="small">{tempText}</p>
              </div>
              <div>
                <strong>{t.evRain}</strong>
                <Spark years={tt.years} values={tt.rain} label={t.evRain} unit="mm" fmt={(v) => nf.format(v)} />
                <p className="small">{rainText}</p>
              </div>
            </div>
            <p className="small">{fill(t.evVar, { cv: nf.format(Math.round(tt.rainCv * 100)), dry: nf.format(tt.driestMm), dryY: yr.format(tt.driest), wet: nf.format(tt.wettestMm), wetY: yr.format(tt.wettest) })}{tt.rainStep ? t.evVarStep : ""}</p>
            <p className="muted small">{fill(t.evSource, { a: yr.format(tt.from), b: yr.format(tt.to) })}</p>
          </>
        )}
      </div>

      <div className="ev-card">
        <h4>{t.evCalTitle}</h4>
        <label className="ev-pick">{t.evWhich}
          <select value={pick} onChange={(e) => setPick(Number(e.target.value))}>
            {options.map((o, i) => <option key={i} value={i}>{o.label}: {o.steps.map((s) => name(s.crop)).join(" → ")}</option>)}
          </select>
        </label>
        <div className="ev-cal" role="img" aria-label={t.evCalTitle}>
          {months.map((mo, i) => (
            <div className={`ev-m${cell[i] == null ? " bare" : ` c${cell[i] % 6}`}`} key={i}>
              <span className="ev-mn">{monthNames[i]}</span>
              <span className="ev-bar"><i style={{ height: `${Math.round(((mo.rainMm || 0) / maxRain) * 100)}%` }} className={(mo.rainMm || 0) >= HEAVY ? "heavy" : ""} /></span>
              <span className="ev-fl" aria-hidden="true">{flags[i].includes("wet") ? "💧" : ""}{flags[i].includes("hot") ? "🔥" : ""}{flags[i].includes("cold") ? "❄" : ""}{flags[i].includes("shaky") ? "?" : ""}</span>
            </div>
          ))}
        </div>
        <p className="muted small">{t.evLegend}</p>
        <ul className="ev-list small">
          <li>{m.bare.length ? fill(t.evBare, { n: nf.format(m.bare.length), months: m.bare.map((i) => monthNames[i]).join(", ") }) : t.evNoBare}</li>
          {listOf("wet") && <li>{fill(t.evWetBare, { months: listOf("wet") })}</li>}
          {listOf("hot") && <li>{fill(t.evHot, { months: listOf("hot") })}</li>}
          {listOf("cold") && <li>{fill(t.evCold, { months: listOf("cold") })}</li>}
          {listOf("shaky") && <li>{fill(t.evShaky, { months: listOf("shaky") })}</li>}
          {!listOf("wet") && !listOf("hot") && !listOf("cold") && !listOf("shaky") && <li>{t.evNoFlags}</li>}
        </ul>
        {opt.assumed && <p className="muted small">{t.stNoteAssumed}</p>}
      </div>

      <div className="ev-card">
        <h4>{t.evEroTitle}: <span className={`ev-risk ${risk.level}`}>{levelWord}</span></h4>
        <ul className="ev-list small">{risk.parts.map((p) => <li key={p.k}>{partLine(p)}</li>)}</ul>
        {risk.known < 3 && <p className="muted small">{t.evEroMissing}</p>}
        <p className="small">{risk.level === "low" ? t.evEroHelpLow : t.evEroHelp}</p>
        <p className="muted small">{t.evEroCaveat}</p>
      </div>
    </section>
  );
}
