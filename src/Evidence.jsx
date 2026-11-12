import { useEffect, useMemo, useState } from "react";
import "./evidence.css";
import Info from "./Info.jsx";
import { currentRotation, measure } from "./strategy.js";
import { BD_SEASONS, seasonLabel } from "./bdseasons.js";

const fill = (text, values) => Object.keys(values).reduce((s, k) => s.split(`{${k}}`).join(values[k]), text);
const HEAVY = 150; // mm in a month
const ERODIBLE = { siltLoam: 2, sandyLoam: 1, sandy: 1, loam: 1 };
const mean = (a) => a.reduce((s, x) => s + x, 0) / (a.length || 1);

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

// A line chart with the first and last year, the lowest and highest value, and a dashed average line
function Chart({ years, values, label, unit, fmt, yr, tone }) {
  const w = 300, h = 124, padL = 8, padR = 8, padT = 14, padB = 30;
  const min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
  const x = (i) => padL + (i / (values.length - 1)) * (w - padL - padR);
  const y = (v) => padT + (1 - (v - min) / span) * (h - padT - padB);
  const d = values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const avg = mean(values);
  const iMin = values.indexOf(min), iMax = values.indexOf(max);
  return (
    <svg className={`ev2-chart ${tone}`} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`${label}: ${yr.format(years[0])}–${yr.format(years[years.length - 1])}, ${fmt(min)}–${fmt(max)} ${unit}`}>
      <line x1={padL} x2={w - padR} y1={y(avg)} y2={y(avg)} className="avg" />
      <path d={d} fill="none" className="ln" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(iMax)} cy={y(max)} r="3.2" className="pt" /><text x={Math.min(Math.max(x(iMax), 24), w - 24)} y={y(max) - 5} textAnchor="middle">{fmt(max)}</text>
      <circle cx={x(iMin)} cy={y(min)} r="3.2" className="pt" /><text x={Math.min(Math.max(x(iMin), 24), w - 24)} y={y(min) + 12} textAnchor="middle">{fmt(min)}</text>
      <text x={padL} y={h - 4} className="yr" textAnchor="start">{yr.format(years[0])}</text>
      <text x={w - padR} y={h - 4} className="yr" textAnchor="end">{yr.format(years[years.length - 1])}</text>
    </svg>
  );
}

function Card({ t, n, q, what, children, source, getText, limitText }) {
  return (
    <article className="ev2-card">
      <header>
        <span className="ev2-n">{n}</span>
        <h4>{q}</h4>
        <Info t={t} source={source}><p>{getText}</p><p>{limitText}</p></Info>
      </header>
      <p className="ev2-what"><b>{t.ev2What}:</b> {what}</p>
      {children}
    </article>
  );
}

const Block = ({ title, tone, children }) => (
  <div className={`ev2-block ${tone || ""}`}><h5>{title}</h5>{children}</div>
);

export default function Evidence({ t, lang, locale, lat, lon, climate, rotations, field, soilData, mode, monthNames, results, country }) {
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
  const nf2 = useMemo(() => new Intl.NumberFormat(locale, { maximumFractionDigits: 2, minimumFractionDigits: 2 }), [locale]);
  const name = (c) => (lang === "bn" ? c.bn : c.en);

  // the rotations the calendar can show: the farmer's current one first, then the top suggestions
  const options = useMemo(() => {
    if (!climate) return [];
    const out = [];
    const cur = currentRotation(field, results, mode);
    if (cur && cur.steps) out.push({ label: t.ev2Current, steps: cur.steps, assumed: !!cur.assumedTiming });
    rotations.slice(0, 3).forEach((r, i) => out.push({ label: `${t.ev2Suggested} ${nf.format(i + 1)}`, steps: r.steps, assumed: false }));
    return out;
  }, [climate, field, results, mode, rotations, t, nf]);

  if (!climate || !options.length) return null;
  const opt = options[Math.min(pick, options.length - 1)];
  const m = measure(opt.steps, { climate, mode, field });
  const months = climate.months;
  const cell = Array.from({ length: 12 }, () => null);
  opt.steps.forEach((o, i) => { for (let k = 0; k < o.months; k += 1) cell[(o.at + k) % 12] = i; });
  const maxRain = Math.max(...months.map((x) => x.rainMm || 0), 1);

  // months that need attention
  const flags = [];
  const hotM = new Set(m.hot.map((x) => x.month)), coldM = new Set(m.cold.map((x) => x.month));
  const shaky = (i) => trend && trend.months && trend.months[i] && trend.months[i].cv != null && trend.months[i].cv >= 0.6 && (months[i].rainMm || 0) >= 20;
  for (let i = 0; i < 12; i += 1) {
    const f = [];
    if (cell[i] == null && (months[i].rainMm || 0) >= HEAVY) f.push("wet");
    if (hotM.has(i)) f.push("hot");
    if (coldM.has(i)) f.push("cold");
    if (cell[i] != null && shaky(i)) f.push("shaky");
    flags.push(f);
  }
  const listOf = (kind) => flags.map((f, i) => (f.includes(kind) ? monthNames[i] : null)).filter(Boolean).join(", ");
  const kinds = ["wet", "hot", "cold", "shaky"].filter((k) => listOf(k));

  const d = (field && field.details) || {};
  const sys = field && field.system && field.system.soil;
  const soilKey = d.soil || (sys && sys.key) || null;
  const risk = erosionRisk({ slope: m.slope, soilKey, bareWet: m.bareWet.length });
  const levelWord = { low: t.ev2Low, moderate: t.ev2Moderate, high: t.ev2High }[risk.level];
  const partWord = (lv) => [t.ev2Part_low, t.ev2Part_mid, t.ev2Part_high][lv];
  const partRow = (p) => {
    if (p.k === "slope") return [t.ev2Slope, p.level == null ? t.ev2SlopeNone : fill(t.ev2SlopeLine, { s: nf1.format(m.slope) }), p.level];
    if (p.k === "soil") return [t.ev2SoilK, soilKey ? (t.soilNames && t.soilNames[soilKey]) || soilKey : t.ev2SlopeNone, p.level];
    return [t.ev2BareK, fill(t.ev2BareLine, { n: nf.format(m.bareWet.length) }), p.level];
  };

  // ---- card 1: the headline in plain words ----
  const tt = trend;
  let tempHead = null, rainHead = null;
  const means = [], does = [];
  if (tt) {
    const tp = Math.abs(tt.tempTrend.perDecade);
    tempHead = tt.tempStep ? t.ev2TempStep : tt.tempTrend.clear ? fill(tt.tempTrend.perDecade > 0 ? t.ev2WarmClear : t.ev2CoolClear, { v: nf2.format(tp) }) : t.ev2TempFlat;
    const rp = Math.abs(tt.rainTrend.perDecade);
    rainHead = tt.rainStep ? fill(t.ev2RainStep, { year: yr.format(tt.rainStep.year), a: nf.format(tt.rainStep.before), b: nf.format(tt.rainStep.after) }) : tt.rainTrend.clear ? fill(tt.rainTrend.perDecade < 0 ? t.ev2RainDown : t.ev2RainUp, { v: nf.format(rp) }) : t.ev2RainFlat;
    const warm = !tt.tempStep && tt.tempTrend.clear && tt.tempTrend.perDecade > 0;
    const dry = !tt.rainStep && tt.rainTrend.clear && tt.rainTrend.perDecade < 0;
    const wet = !tt.rainStep && tt.rainTrend.clear && tt.rainTrend.perDecade > 0;
    const swing = tt.rainCv >= 0.2;
    if (warm) { means.push(t.ev2M_warm); does.push(t.ev2D_warm); }
    if (dry) { means.push(t.ev2M_dry); does.push(t.ev2D_dry); }
    if (wet) { means.push(t.ev2M_wet); does.push(t.ev2D_wet); }
    if (swing) { means.push(t.ev2M_swing); does.push(t.ev2D_swing); }
    if (!means.length) means.push(t.ev2M_flat);
  }
  const compare = (vals, unit, fmt) => {
    const k = Math.min(10, Math.floor(vals.length / 2));
    if (k < 5) return null;
    return { k, text: fill(t.ev2Compare, { a: nf.format(k), b: nf.format(k), x: fmt(mean(vals.slice(0, k))), y: fmt(mean(vals.slice(-k))), u: unit }) };
  };
  const tcmp = tt ? compare(tt.temp, "°C", (v) => nf1.format(v)) : null;
  const rcmp = tt ? compare(tt.rain, "mm", (v) => nf.format(v)) : null;
  const nasaGet = `${t.ev2Auto} ${t.ev2GetTrend}`;

  return (
    <section className="ev2-wrap" aria-labelledby="ev-title">
      <h3 id="ev-title">{t.ev2Title}</h3>
      <p className="muted small">{t.ev2Intro}</p>
      <div className="ev2-cards">

      {/* 1. Is the weather changing here? */}
      <Card t={t} n="1" q={t.ev2C1Q} what={t.ev2C1What} source="NASA POWER" getText={nasaGet} limitText={t.ev2LimitTrend}>
        {state === "loading" && <p className="muted small">{t.ev2Loading}</p>}
        {state === "error" && <p className="warn small">{t.ev2Failed}</p>}
        {tt && (
          <>
            <div className="ev2-two">
              <div className="ev2-metric">
                <h5>{t.ev2Temp}</h5>
                <p className={`ev2-head ${tt.tempTrend.clear && !tt.tempStep ? (tt.tempTrend.perDecade > 0 ? "up" : "down") : "flat"}`}>{tempHead}</p>
                <Chart years={tt.years} values={tt.temp} label={t.ev2Temp} unit="°C" fmt={(v) => nf1.format(v)} yr={yr} tone="temp" />
                <p className="small muted">{tt.tempTrend.clear && !tt.tempStep ? t.ev2Clear : tt.tempStep ? "" : t.ev2Unclear}</p>
                {tcmp && <p className="small">{tcmp.text}</p>}
              </div>
              <div className="ev2-metric">
                <h5>{t.ev2Rain}</h5>
                <p className={`ev2-head ${tt.rainTrend.clear && !tt.rainStep ? (tt.rainTrend.perDecade < 0 ? "down" : "up") : "flat"}`}>{rainHead}</p>
                <Chart years={tt.years} values={tt.rain} label={t.ev2Rain} unit="mm" fmt={(v) => nf.format(v)} yr={yr} tone="rain" />
                <p className="small muted">{tt.rainTrend.clear && !tt.rainStep ? t.ev2Clear : tt.rainStep ? "" : t.ev2Unclear}</p>
                {rcmp && <p className="small">{rcmp.text}</p>}
              </div>
            </div>
            <div className="ev2-tiles">
              <div><span>{t.ev2Driest} · {yr.format(tt.driest)}</span><b>{nf.format(tt.driestMm)} mm</b></div>
              <div><span>{t.ev2Wettest} · {yr.format(tt.wettest)}</span><b>{nf.format(tt.wettestMm)} mm</b></div>
              <div><span>{t.ev2Avg}</span><b>{nf.format(Math.round(mean(tt.rain)))} mm</b></div>
            </div>
            <p className="small">{fill(t.ev2Swing, { cv: nf.format(Math.round(tt.rainCv * 100)) })}</p>
            <div className="ev2-two">
              <Block title={t.ev2Means} tone="means"><ul>{means.map((x, i) => <li key={i}>{x}</li>)}</ul></Block>
              {does.length > 0 && <Block title={t.ev2Do} tone="do"><ul>{does.map((x, i) => <li key={i}>{x}</li>)}</ul></Block>}
            </div>
          </>
        )}
      </Card>

      {/* 2. When is my field bare or at risk? */}
      <Card t={t} n="2" q={t.ev2C2Q} what={t.ev2C2What} source="NASA POWER · FAO EcoCrop" getText={`${t.ev2Auto} ${t.ev2GetCal}`} limitText={t.ev2LimitCal}>
        <label className="ev-pick">{t.ev2Which}
          <select value={pick} onChange={(e) => setPick(Number(e.target.value))}>
            {options.map((o, i) => <option key={i} value={i}>{o.label}: {o.steps.map((s) => name(s.crop)).join(" → ")}</option>)}
          </select>
        </label>
        {country === "BD" && (
          <div className="ev-seasons" aria-hidden="true">
            {BD_SEASONS.map((s, i) => <span key={i} className={`ev-s ${s.key}`} style={{ gridColumn: `${s.from + 1} / ${s.to + 2}` }}>{t[`bdSeason_${s.key}`]}</span>)}
          </div>
        )}
        <div className="ev-cal" role="img" aria-label={t.ev2C2Q}>
          {months.map((mo, i) => (
            <div className={`ev-m${cell[i] == null ? " bare" : ` c${cell[i] % 6}`}`} key={i}>
              <span className="ev-mn">{monthNames[i]}</span>
              <span className="ev-mm">{nf.format(Math.round(mo.rainMm || 0))}</span>
              <span className="ev-bar"><i style={{ height: `${Math.round(((mo.rainMm || 0) / maxRain) * 100)}%` }} className={(mo.rainMm || 0) >= HEAVY ? "heavy" : ""} /></span>
              <span className="ev-fl" aria-hidden="true">{flags[i].includes("wet") ? "💧" : ""}{flags[i].includes("hot") ? "🔥" : ""}{flags[i].includes("cold") ? "❄" : ""}{flags[i].includes("shaky") ? "?" : ""}</span>
            </div>
          ))}
        </div>
        <details className="ev2-key">
          <summary>{t.ev2Key}</summary>
          <ul className="small">
            <li><span className="ev2-sw crop" />{t.ev2K_crop}</li>
            <li><span className="ev2-sw bare" />{t.ev2K_bare}</li>
            <li><span className="ev2-sw bar" />{t.ev2K_bar}</li>
            <li>{t.ev2K_wet}</li><li>{t.ev2K_hot}</li><li>{t.ev2K_cold}</li><li>{t.ev2K_shaky}</li>
          </ul>
        </details>
        <Block title={t.ev2Summary}>
          <ul className="ev-list small">
            <li>{m.bare.length ? fill(t.ev2Bare, { n: nf.format(m.bare.length), months: m.bare.map((i) => monthNames[i]).join(", ") }) : t.ev2NoBare}</li>
            {listOf("wet") && <li>{fill(t.ev2WetBare, { months: listOf("wet") })}</li>}
            {listOf("hot") && <li>{fill(t.ev2Hot, { months: listOf("hot") })}</li>}
            {listOf("cold") && <li>{fill(t.ev2Cold, { months: listOf("cold") })}</li>}
            {listOf("shaky") && <li>{fill(t.ev2Shaky, { months: listOf("shaky") })}</li>}
            {!kinds.length && <li>{t.ev2NoFlags}</li>}
          </ul>
        </Block>
        {(kinds.length > 0 || m.bare.length > 0) && (
          <Block title={t.ev2Do} tone="do">
            <ul>
              {kinds.map((k) => <li key={k}>{t[`ev2A_${k}`]}</li>)}
              {m.bare.length > 0 && m.bareWet.length < m.bare.length && <li>{t.ev2A_bare}</li>}
            </ul>
          </Block>
        )}
        {country === "BD" && (
          <>
            <ul className="ev-list small">
              {opt.steps.map((o, i) => <li key={i}>{fill(t.bdLine, { crop: name(o.crop), m: monthNames[o.at % 12], season: seasonLabel(o.crop, o.at, t) })}</li>)}
            </ul>
            <p className="muted small">{t.bdNote}</p>
          </>
        )}
        {opt.assumed && <p className="muted small">{t.stNoteAssumed}</p>}
      </Card>

      {/* 3. Will the soil wash away? */}
      <Card t={t} n="3" q={t.ev2C3Q} what={t.ev2C3What} source="NASA · Soil Map" getText={`${t.ev2Auto} ${t.ev2GetEro}`} limitText={t.ev2LimitEro}>
        <div className={`ev2-meter ${risk.level}`}>
          <span>{t.ev2EroLevel}</span>
          <div className="ev2-seg" aria-hidden="true"><i className={risk.level === "low" ? "on" : ""} /><i className={risk.level === "moderate" ? "on" : ""} /><i className={risk.level === "high" ? "on" : ""} /></div>
          <b>{levelWord}</b>
        </div>
        <ul className="ev2-parts">
          {risk.parts.map((p) => {
            const [label, value, lv] = partRow(p);
            return (
              <li key={p.k}>
                <span>{label}</span><em>{value}</em>
                <i className={`dots l${lv == null ? "x" : lv}`} aria-hidden="true"><b /><b /><b /></i>
                <small>{lv == null ? "" : partWord(lv)}</small>
              </li>
            );
          })}
        </ul>
        {risk.known < 3 && <p className="muted small">{t.ev2EroMissing}</p>}
        <div className="ev2-two">
          <Block title={t.ev2Means} tone="means"><p>{t[`ev2EroMeans_${risk.level}`]}</p></Block>
          <Block title={t.ev2Do} tone="do"><p>{risk.level === "low" ? t.ev2EroDo_low : t.ev2EroDo_high}</p></Block>
        </div>
      </Card>
      </div>
    </section>
  );
}
