import { useEffect, useMemo, useState } from "react";

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
  const W = 12 * 26 + 8, H = 96, top = 6, bottom = 18;
  const maxV = data ? Math.max(...data.months.map((m) => m.max), 1) : 1;
  const y = (v) => top + (1 - v / maxV) * (H - top - bottom);
  const here = data ? data.months[now] : null;
  const spreadKey = here ? spread(here.cv) : null;

  const row = (label, w) => {
    if (!w) return <tr><th scope="row">{label}</th><td colSpan="3" className="muted">{t.scNoData}</td></tr>;
    return (
      <tr>
        <th scope="row">{label}</th>
        <td>{fill(t.scRainCell, { a: nf.format(w.rain), b: nf.format(w.normal) })}<br /><strong>{w.rainKey ? t[`scR_${w.rainKey}`] : "–"}</strong></td>
        <td>{fill(t.scTempCell, { a: nf1.format(w.temp), b: nf1.format(w.tempNormal) })}<br /><strong>{t[`scT_${w.tempKey}`]}</strong></td>
      </tr>
    );
  };

  const hint = () => {
    if (!data || !data.next || data.next.ratio == null) return null;
    if (data.next.dryTime && data.next.rain < 15) return t.scHintDrySeason;
    const dry = data.next.ratio < 0.5 && here && here.mean >= 40;
    const wet = data.next.ratio > 2;
    return dry ? t.scHintDry : wet ? t.scHintWet : t.scHintOk;
  };

  return (
    <section className="sc-season" aria-labelledby="sk-title">
      <h3 id="sk-title">{t.skTitle}</h3>
      <p className="muted small">{t.skIntro}</p>
      {state === "loading" && <p className="muted small">{t.skLoading}</p>}
      {state === "error" && <p className="warn small">{t.skFailed}</p>}
      {data && (
        <>
          <div className="sk-scroll" tabIndex={0} role="region" aria-label={t.skTitle}>
            <table className="sk-table">
              <thead><tr><th></th><th>{t.skRain}</th><th>{t.skTemp}</th></tr></thead>
              <tbody>
                {row(fill(t.skPast, { n: nf.format(data.past ? data.past.n : 7) }), data.past)}
                {row(fill(t.skNext, { n: nf.format(data.next ? data.next.n : 7) }), data.next)}
              </tbody>
            </table>
          </div>
          {hint() && <p className="sk-hint">{hint()}</p>}

          <h4>{t.skRangeTitle}</h4>
          <svg className="sk-range" viewBox={`0 0 ${W} ${H}`} role="img"
            aria-label={fill(t.skRangeAria, { m: monthName(now), a: nf.format(here.min), b: nf.format(here.max), c: nf.format(here.mean) })}>
            {data.months.map((m, i) => {
              const cx = 4 + i * 26 + 13;
              return (
                <g key={i} className={i === now ? "sk-now" : ""}>
                  <rect x={cx - 8} y={y(m.mean)} width="16" height={Math.max(1, H - bottom - y(m.mean))} className="sk-bar" />
                  <line x1={cx} x2={cx} y1={y(m.max)} y2={y(m.min)} className="sk-whisk" />
                  <line x1={cx - 4} x2={cx + 4} y1={y(m.max)} y2={y(m.max)} className="sk-whisk" />
                  <line x1={cx - 4} x2={cx + 4} y1={y(m.min)} y2={y(m.min)} className="sk-whisk" />
                  <text x={cx} y={H - 5} textAnchor="middle" className="sk-lab">{monthName(i)}</text>
                </g>
              );
            })}
          </svg>
          <p className="muted small">{t.skRangeNote}</p>
          <ul className="sk-list small">
            <li>{fill(t.skHere, { m: monthName(now), a: nf.format(here.min), b: nf.format(here.max), c: nf.format(here.mean) })}</li>
            {spreadKey && <li>{t[`skSpread_${spreadKey}`]}</li>}
            {data.usingRecent
              ? <li>{fill(t.skRecent, { y: yr.format(trend.recentFrom), y2: yr.format(trend.to) })}</li>
              : <li>{fill(t.skYears, { a: yr.format(trend.from), b: yr.format(trend.to) })}</li>}
          </ul>
          <p className="muted small">{t.skCaveat}</p>
        </>
      )}
    </section>
  );
}
