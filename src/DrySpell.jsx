import { useEffect, useMemo, useState } from "react";
import Info from "./Info.jsx";
import { rootWetness, irrigationAdvice } from "./waterAdvice.js";

const fill = (text, values) => Object.keys(values).reduce((s, k) => s.split(`{${k}}`).join(values[k]), text);

// "Dry spells": days in a row with almost no rain over the last 90 days (NASA POWER), next to the soil moisture SMAP measured (NASA).
// It describes what has happened. It is not a forecast.
export default function DrySpell({ t, locale, lat, lon, soilKey, rain7, onGo }) {
  const [data, setData] = useState(null);
  const [state, setState] = useState("loading");

  useEffect(() => {
    let cancelled = false;
    setState("loading");
    fetch(`/api/dryspell?lat=${lat}&lon=${lon}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => { if (cancelled) return; if (d.ok) { setData(d); setState("ok"); } else setState("error"); })
      .catch(() => { if (!cancelled) setState("error"); });
    return () => { cancelled = true; };
  }, [lat, lon]);

  const nf = useMemo(() => new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }), [locale]);
  const nf2 = useMemo(() => new Intl.NumberFormat(locale, { maximumFractionDigits: 2, minimumFractionDigits: 2 }), [locale]);
  const dateF = useMemo(() => { const f = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }); return (s) => f.format(new Date(`${s}T12:00:00`)); }, [locale]);
  const dry = data && data.dry;
  const rain = (data && data.rain) || [];
  const soil = (data && data.soil) || [];
  const peak = soil.length ? soil.reduce((b, s) => (s.root > b.root ? s : b), soil[0]) : null;

  if (state === "error") return (
    <section className="wf-sec" aria-labelledby="ds-title"><h3 id="ds-title">{t.wfDryTitle}</h3><p className="warn small">{t.skFailed}</p></section>
  );
  if (state === "loading") return (
    <section className="wf-sec" aria-labelledby="ds-title"><h3 id="ds-title">{t.wfDryTitle}</h3><p className="muted small">{t.skLoading}</p></section>
  );
  if (!dry || !dry.daysUsed) return null;

  const run = dry.ongoing ? dry.ongoing.days : 0;
  const wet = rootWetness(soil, soilKey);
  const advice = irrigationAdvice({ run, rain7, wet });
  const icon = { now: "💧", soon: "🗓️", wait: "🌧️", ok: "✅", drain: "⚠️" }[advice];
  const why = advice === "ok" && !wet ? t.wfWhy_okNoSat : fill(t[`wfWhy_${advice}`], { n: nf.format(run), mm: nf.format(rain7 || 0) });
  const soilWord = wet ? { dry: t.sMoistDry, moist: t.sMoistMoist, nearFull: t.sMoistNearFull, wet: t.sMoistWet }[wet.key] : null;
  const arrow = { down: "↓", up: "↑", flat: "→" };
  const spark = soil.length > 1 ? soil.slice(-12) : [];
  const lo = spark.length ? Math.min(...spark.map((s) => s.root)) : 0, hi = spark.length ? Math.max(...spark.map((s) => s.root)) : 1;
  const pts = spark.map((s, i) => `${(i / (spark.length - 1)) * 100},${30 - ((s.root - lo) / Math.max(hi - lo, 0.02)) * 26 - 2}`).join(" ");
  const soilName = soilKey && t.soilNames ? t.soilNames[soilKey] : "";

  return (
    <section className="wf-sec" aria-labelledby="ds-title">
      <h3 id="ds-title">{t.wfDryTitle}
        <Info t={t} source={t.wfDrySrc}>
          <span>{t.wfDryInfo}</span>
          <span>{fill(t.dryTotals, { total: nf.format(dry.totalMm), wet: nf.format(dry.wetDays), days: nf.format(dry.daysUsed), last30: nf.format(dry.last30Mm) })}</span>
          {dry.longest && <span>{fill(t.dryLongest, { n: nf.format(dry.longest.days), a: dateF(dry.longest.start), b: dateF(dry.longest.end) })}</span>}
          {wet && peak && <span>{fill(t.drySoilNow, { v: nf2.format(wet.value), date: dateF(wet.date), peak: nf2.format(peak.root), pdate: dateF(peak.date) })}</span>}
          {!wet && <span>{t.wfNoSmap}</span>}
        </Info>
      </h3>
      <div className={`wf-answer ${advice}`}>
        <span className="wf-ic" aria-hidden="true">{icon}</span>
        <div><b>{t[`wfAdv_${advice}`]}</b><span className="small">{why}</span></div>
      </div>
      <div className="wf-facts">
        <div className="wf-fact"><small>{t.wfFactRun}</small><strong>{run > 0 ? nf.format(run) : fill(t.wfFactRunNone, { date: dateF(dry.lastDate) })}</strong></div>
        <div className="wf-fact">
          <small>{t.wfFactSoil}</small>
          <strong>{soilWord ? `${soilWord}${wet.trend ? ` · ${arrow[wet.trend]} ${t[`wfTrend_${wet.trend}`]}` : ""}` : "–"}</strong>
          {spark.length > 2 && <svg className="wf-spark" viewBox="0 0 100 32" preserveAspectRatio="none" aria-hidden="true"><polyline points={pts} /></svg>}
        </div>
        <div className="wf-fact"><small>{t.wfFactRain}</small><strong>{nf.format(rain7 || 0)} mm</strong></div>
      </div>
      {soilName && wet && <p className="muted small">{fill(t.wfForSoil, { soil: soilName })}</p>}
      <div className="wf-actions">
        <button className="tab" onClick={() => onGo && onGo("soil")}>{t.wfGoSoil} →</button>
        <button className="tab" onClick={() => onGo && onGo("irrigation")}>{t.wfGoIrr} →</button>
      </div>
    </section>
  );
}
