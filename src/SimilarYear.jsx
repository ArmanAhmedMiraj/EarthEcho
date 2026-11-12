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

  // one card per coming month: what the close years did, and what that means for farm work
  const nowM = new Date().getMonth();
  const endM = data ? data.window[data.window.length - 1].m0 : 0;
  const allMonths = trend ? (trend.rainStep ? trend.monthsRecent : trend.months) : null;
  const maxMean = allMonths ? Math.max(...allMonths.map((m) => m.mean), 1) : 1;
  const plan = !data || !data.matches.length ? [] : (() => {
    let list = data.nextRange.map((g, k) => ({ g, k })).filter(({ g }) => !(g.m0 > endM && g.m0 < nowM));
    if (!list.length) list = data.nextRange.map((g, k) => ({ g, k }));
    return list.map(({ g, k }) => {
      const rows = data.matches.filter((m) => m.next[k]).map((m) => ({ year: m.endYear, rain: m.next[k].rain, tone: tone(m.next[k].rain, g.rainMean), sel: m === sel }));
      const dry = rows.filter((r) => r.tone === "dry").length, wet = rows.filter((r) => r.tone === "wet").length, n = rows.length;
      const sig = n >= 2 && dry > n / 2 ? "dry" : n >= 2 && wet > n / 2 ? "wet" : "mixed";
      const mean = allMonths ? allMonths[g.m0].mean : g.rainMean;
      const high = mean >= 20 && mean / maxMean >= 0.3;
      const key = sig === "mixed" ? "wfDo_mixed" : `wfDo_${sig}_${high ? "high" : "low"}`;
      return { m0: g.m0, sig, k: sig === "dry" ? dry : wet, n, usual: g.rainMean, rows, max: Math.max(g.rainMean, ...rows.map((r) => r.rain), 1), todo: String(t[key] || "").split("|") };
    });
  })();

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
          {plan.length > 0 && (
            <>
              <h4 className="wf-sub">{t.wfPlanTitle}</h4>
              <div className="wf-plan">
                {plan.map((c) => (
                  <article className={`wf-plancard ${c.sig}`} key={c.m0}>
                    <header>
                      <b>{monthName(c.m0)}</b>
                      <span className={`wf-tag ${c.sig === "mixed" ? "same" : c.sig}`}>{t[`wfSig_${c.sig}`]}</span>
                    </header>
                    <p className="small muted">{c.sig === "mixed" ? t.wfSigMixedHint : fill(t[`wfSigHint_${c.sig}`], { k: nf.format(c.k), n: nf.format(c.n) })}</p>
                    <div className="wf-cmp" aria-hidden="true">
                      <span>{t.wfUsual}</span>
                      <span className="wf-track"><i className="wf-fillbar usual" style={{ width: `${(c.usual / c.max) * 70}%` }} /><em>{nf.format(c.usual)} mm</em></span>
                      {c.rows.map((r) => (
                        <span key={r.year} style={{ display: "contents" }}>
                          <span className={r.sel ? "wf-selyr" : ""}>{yr.format(r.year)}</span>
                          <span className="wf-track"><i className={`wf-fillbar ${r.tone}`} style={{ width: `${(r.rain / c.max) * 70}%` }} /><em>{nf.format(r.rain)} mm</em></span>
                        </span>
                      ))}
                    </div>
                    <b className="wf-dohead">{t.wfDoTitle}</b>
                    <ul className="wf-do">{c.todo.map((x, i) => <li key={i}>{x}</li>)}</ul>
                  </article>
                ))}
              </div>
            </>
          )}
          <p className="muted small">{t.wfNotForecast}</p>
        </>
      )}
      {state === "ok" && data && data.matches.length === 0 && <p className="muted small">{t.wfNoYears}</p>}
    </section>
  );
}
