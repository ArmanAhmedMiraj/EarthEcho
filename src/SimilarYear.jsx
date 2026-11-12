import { useEffect, useMemo, useState } from "react";
import { closeness, findAnalogues } from "./analogue.js";
import Info from "./Info.jsx";

const fill = (text, values) => Object.keys(values).reduce((s, k) => s.split(`{${k}}`).join(values[k]), text);

// "A past year most like this one": the last finished months of this year next to the closest earlier years (NASA POWER).
// It is a comparison with the past, not a forecast.
export default function SimilarYear({ t, locale, lat, lon }) {
  const [trend, setTrend] = useState(null);
  const [state, setState] = useState("loading");
  const [pick, setPick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState("loading"); setPick(0);
    fetch(`/api/trend?lat=${lat}&lon=${lon}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => { if (cancelled) return; if (d.ok) { setTrend(d); setState("ok"); } else setState("error"); })
      .catch(() => { if (!cancelled) setState("error"); });
    return () => { cancelled = true; };
  }, [lat, lon]);

  const nf = useMemo(() => new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }), [locale]);
  const nf1 = useMemo(() => new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }), [locale]);
  const nf2 = useMemo(() => new Intl.NumberFormat(locale, { maximumFractionDigits: 2, minimumFractionDigits: 2 }), [locale]);
  const yr = useMemo(() => new Intl.NumberFormat(locale, { useGrouping: false }), [locale]);
  const monthName = useMemo(() => { const f = new Intl.DateTimeFormat(locale, { month: "short" }); return (i) => f.format(new Date(2000, i, 1)); }, [locale]);
  const data = useMemo(() => (trend ? findAnalogues(trend) : null), [trend]);

  if (state === "ok" && !data) return null; // too early in the year, or an older answer without the month-by-month data
  const label = (r) => `${monthName(r.m0)} ${yr.format(r.year)}`;
  const span = (rows) => `${label(rows[0])} – ${label(rows[rows.length - 1])}`;
  const sel = data && data.matches[Math.min(pick, data.matches.length - 1)];
  const medal = ["🥇", "🥈", "🥉"];
  const tone = (rain, mean) => (mean == null || mean < 1 ? "same" : rain < mean * 0.7 ? "dry" : rain > mean * 1.3 ? "wet" : "same");
  const toneWord = { dry: t.wfDrier, wet: t.wfWetter, same: t.wfAbout };

  // across all the close years: was each coming month drier or wetter than usual?
  const pattern = !data ? [] : data.nextRange.map((g, k) => {
    const marks = data.matches.map((m) => (m.next[k] ? tone(m.next[k].rain, g.rainMean) : null)).filter(Boolean);
    const dry = marks.filter((x) => x === "dry").length, wet = marks.filter((x) => x === "wet").length;
    const n = marks.length;
    if (n >= 2 && dry > n / 2) return fill(t.wfPatDry, { m: monthName(g.m0), k: nf.format(dry), n: nf.format(n) });
    if (n >= 2 && wet > n / 2) return fill(t.wfPatWet, { m: monthName(g.m0), k: nf.format(wet), n: nf.format(n) });
    return fill(t.wfPatMixed, { m: monthName(g.m0) });
  });

  return (
    <section className="wf-sec" aria-labelledby="sy-title">
      <h3 id="sy-title">{t.wfYearsTitle}
        <Info t={t} source={t.wfYearsSrc}>
          <span>{t.wfYearsInfo}</span>
          {data && <span>{data.usedJump ? fill(t.syJump, { y: yr.format(data.jumpYear) }) : fill(t.syYears, { a: yr.format(data.from), b: yr.format(trend.to) })}</span>}
          {sel && (
            <>
              <b>{t.wfCompare}: {span(sel.rows)}</b>
              <table>
                <thead><tr><th>{t.syMonth}</th><th>{t.syRainNow}</th><th>{yr.format(sel.endYear)}</th><th>{t.syTempNow}</th><th>{yr.format(sel.endYear)}</th></tr></thead>
                <tbody>
                  {data.window.map((now, i) => (
                    <tr key={i}><th scope="row">{monthName(now.m0)}</th><td>{nf.format(now.rain)}</td><td>{nf.format(sel.rows[i].rain)}</td><td>{nf1.format(now.temp)}</td><td>{nf1.format(sel.rows[i].temp)}</td></tr>
                  ))}
                </tbody>
              </table>
              <span>{fill(t.syGap, { d: nf2.format(sel.d) })}</span>
            </>
          )}
        </Info>
      </h3>
      {state === "loading" && <p className="muted small">{t.skLoading}</p>}
      {state === "error" && <p className="warn small">{t.skFailed}</p>}
      {data && data.matches.length > 0 && (
        <>
          <p className="small">{fill(t.wfYearsLead, { span: span(data.window) })}</p>
          <div className="wf-rank" role="group" aria-label={t.syPickLabel}>
            {data.matches.map((m, i) => (
              <button key={m.shift} type="button" className={i === pick ? "on" : ""} aria-pressed={i === pick} onClick={() => setPick(i)}>
                <span className="medal" aria-hidden="true">{medal[i] || ""}</span>
                <small>{t[`wfRank_${i + 1}`] || ""}</small>
                <strong>{yr.format(m.endYear)}</strong>
                <small>{t[`wfMatch_${closeness(m.d)}`]}</small>
              </button>
            ))}
          </div>
          {sel.next.length > 0 && (
            <>
              <h4 className="wf-sub">{fill(t.wfAfter, { y: yr.format(sel.endYear) })}</h4>
              <div className="wf-after">
                {sel.next.map((r, i) => {
                  const g = data.nextRange[i];
                  const k = tone(r.rain, g.rainMean);
                  return (
                    <div className="wf-after-row" key={i}>
                      <b>{monthName(r.m0)}</b>
                      <span className="small">{fill(t.wfThen, { a: nf.format(r.rain), b: nf.format(g.rainMean) })}</span>
                      <span className={`wf-tag ${k}`}>{toneWord[k]}</span>
                    </div>
                  );
                })}
              </div>
              <h4 className="wf-sub">{t.wfPattern}</h4>
              <ul className="wf-pattern small">{pattern.map((p, i) => <li key={i}>{p}</li>)}</ul>
            </>
          )}
          <p className="muted small">{t.wfNotForecast}</p>
        </>
      )}
      {state === "ok" && data && data.matches.length === 0 && <p className="muted small">{t.wfNoYears}</p>}
    </section>
  );
}
