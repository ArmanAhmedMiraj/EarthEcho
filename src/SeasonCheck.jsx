import { useEffect, useMemo, useState } from "react";
import Info from "./Info.jsx";

const fill = (text, values) => Object.keys(values).reduce((s, k) => s.split(`{${k}}`).join(values[k]), text);
const DAYS = [31, 28.25, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;

// rain ratio -> word key. Rain over a few days is very uneven, so the bands are wide.
const rainClass = (ratio) => (ratio < 0.5 ? "muchDrier" : ratio < 0.8 ? "drier" : ratio <= 1.25 ? "normal" : ratio <= 2 ? "wetter" : "muchWetter");
// two different sources are compared, so a small gap is not called a difference
const tempClass = (diff) => (diff <= -3 ? "cooler" : diff < 3 ? "normal" : diff < 5 ? "warmer" : "muchWarmer");

function spread(cv) { return cv == null ? null : cv < 0.35 ? "steady" : cv < 0.7 ? "uneven" : "veryUneven"; }

export default function SeasonCheck({ t, lang, locale, lat, lon, plus }) {
  const [trend, setTrend] = useState(null);
  const [state, setState] = useState("loading");

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
  const nf1 = useMemo(() => new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }), [locale]);
  const yr = useMemo(() => new Intl.NumberFormat(locale, { useGrouping: false }), [locale]);
  const monthName = useMemo(() => { const f = new Intl.DateTimeFormat(locale, { month: "short" }); return (i) => f.format(new Date(2000, i, 1)); }, [locale]);

  const data = useMemo(() => {
    if (!trend || !plus) return null;
    // a sudden jump in NASA's series means the old years do not describe today: use the last ten years instead
    const usingRecent = !!trend.rainStep;
    const months = usingRecent ? trend.monthsRecent : trend.months;
    const window = (days) => {
      const used = days.filter((d) => d.rain != null && d.tmax != null && d.tmin != null);
      if (used.length < 4) return null;
      let rain = 0, normal = 0, tSum = 0, tNorm = 0;
      used.forEach((d) => {
        const m = Number(d.date.slice(5, 7)) - 1;
        rain += d.rain; normal += months[m].mean / DAYS[m];
        tSum += (d.tmax + d.tmin) / 2; tNorm += months[m].tmean;
      });
      const n = used.length;
      const ratio = normal > 1 ? rain / normal : null;
      return { n, rain, normal, ratio, dryTime: normal < 15, rainKey: ratio == null ? null : (normal < 15 && rain < 15 ? "dryTime" : rainClass(ratio)), temp: tSum / n, tempNormal: tNorm / n, tempKey: tempClass(tSum / n - tNorm / n) };
    };
    return { usingRecent, months, past: window(plus.past), next: window(plus.days.slice(0, 7)) };
  }, [trend, plus]);

  const now = new Date().getMonth();
  const here = data ? data.months[now] : null;
  const spreadKey = here ? spread(here.cv) : null;
  const maxMean = data ? Math.max(...data.months.map((m) => m.mean), 1) : 1;
  const monthClass = (m) => (m.mean < 20 ? "dry" : m.mean / maxMean < 0.3 ? "light" : m.mean / maxMean < 0.65 ? "rainy" : "peak");

  const hint = () => {
    if (!data || !data.next || data.next.ratio == null) return null;
    if (data.next.dryTime && data.next.rain < 15) return t.scHintDrySeason;
    const dry = data.next.ratio < 0.5 && here && here.mean >= 40;
    const wet = data.next.ratio > 2;
    return dry ? t.scHintDry : wet ? t.scHintWet : t.scHintOk;
  };

  const period = (label, w) => {
    if (!w) return <div className="wf-period"><h4>{label}</h4><p className="muted small">{t.scNoData}</p></div>;
    const rainTone = { muchDrier: "dry", drier: "dry", dryTime: "same", normal: "same", wetter: "wet", muchWetter: "wet" }[w.rainKey] || "same";
    const tempTone = { cooler: "cool", normal: "same", warmer: "warm", muchWarmer: "warm" }[w.tempKey] || "same";
    const maxR = Math.max(w.rain, w.normal, 1);
    const maxT = Math.max(w.temp, w.tempNormal, 1);
    return (
      <div className="wf-period">
        <h4>{label}</h4>
        <div className="wf-line-row">
          <span>{t.wfRainLbl}</span><br />
          <span className={`wf-verdict ${rainTone}`}>{w.rainKey ? t[`wfR_${w.rainKey}`] : "–"}</span>
          <div className="wf-cmp">
            <span>{t.wfThis}</span><div className="wf-track"><span className="wf-fillbar" style={{ width: `${(w.rain / maxR) * 100}%` }} /><em>{nf.format(w.rain)} mm</em></div>
            <span>{t.wfUsual}</span><div className="wf-track"><span className="wf-fillbar usual" style={{ width: `${(w.normal / maxR) * 100}%` }} /><em>{nf.format(w.normal)} mm</em></div>
          </div>
        </div>
        <div className="wf-line-row">
          <span>{t.wfTempLbl}</span><br />
          <span className={`wf-verdict ${tempTone}`}>{t[`wfT_${w.tempKey}`]}</span>
          <div className="wf-cmp">
            <span>{t.wfThis}</span><div className="wf-track"><span className="wf-fillbar" style={{ width: `${(w.temp / maxT) * 100}%` }} /><em>{nf1.format(w.temp)}°C</em></div>
            <span>{t.wfUsual}</span><div className="wf-track"><span className="wf-fillbar usual" style={{ width: `${(w.tempNormal / maxT) * 100}%` }} /><em>{nf1.format(w.tempNormal)}°C</em></div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <section className="wf-sec" aria-labelledby="sk-title">
      <h3 id="sk-title">{t.wfSeasonTitle}
        <Info t={t} source={t.wfSeasonSrc}>
          <span>{t.wfSeasonInfo}</span>
          <span>{t.skCaveat}</span>
        </Info>
      </h3>
      {state === "loading" && <p className="muted small">{t.skLoading}</p>}
      {state === "error" && <p className="warn small">{t.skFailed}</p>}
      {data && (
        <>
          <div className="wf-two">
            {period(t.wfPast, data.past)}
            {period(t.wfNext, data.next)}
          </div>
          {hint() && <p className="wf-hint"><b>{t.wfMeans}</b>{hint()}</p>}

          <h4 className="wf-sub">{t.wfMonthsTitle}
            <Info t={t} source={t.wfMonthsSrc}>
              <span>{t.wfMonthsInfo}</span>
              <span>{fill(t.skHere, { m: monthName(now), a: nf.format(here.min), b: nf.format(here.max), c: nf.format(here.mean) })}</span>
              <span>{data.usingRecent ? fill(t.skRecent, { y: yr.format(trend.recentFrom), y2: yr.format(trend.to) }) : fill(t.skYears, { a: yr.format(trend.from), b: yr.format(trend.to) })}</span>
            </Info>
          </h4>
          <div className="wf-months">
            {data.months.map((m, i) => {
              const k = monthClass(m);
              return (
                <div key={i} className={`wf-month ${k}${i === now ? " now" : ""}`} aria-label={`${monthName(i)}: ${t[`wfMonth${k[0].toUpperCase()}${k.slice(1)}`]}`}>
                  <b>{monthName(i)}</b>{t[`wfMonth${k[0].toUpperCase()}${k.slice(1)}`]}
                  {i === now && <span className="nowtag">{t.wfNowTag}</span>}
                </div>
              );
            })}
          </div>
          {spreadKey === "veryUneven" && <p className="small">{fill(t.wfUneven, { m: monthName(now) })}</p>}
        </>
      )}
    </section>
  );
}
