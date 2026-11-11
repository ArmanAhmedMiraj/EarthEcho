import { useEffect, useMemo, useState } from "react";
import { closeness, findAnalogues } from "./analogue.js";

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
  const best = data && data.matches[0];
  const sel = data && data.matches[Math.min(pick, data.matches.length - 1)];
  const word = (m) => t[`syClose_${closeness(m.d)}`];

  return (
    <section className="sc-season" aria-labelledby="sy-title">
      <h3 id="sy-title">{t.syTitle}</h3>
      <p className="muted small">{data ? fill(t.syIntro, { span: span(data.window) }) : t.syIntroShort}</p>
      {state === "loading" && <p className="muted small">{t.skLoading}</p>}
      {state === "error" && <p className="warn small">{t.skFailed}</p>}
      {data && best && (
        <>
          <p className={`sk-hint sy-lead ${closeness(best.d)}`}>
            {closeness(best.d) === "weak" ? t.syNoneClose : fill(t.syBest, { span: span(best.rows), word: word(best) })}
          </p>
          <div className="sy-chips" role="group" aria-label={t.syPickLabel}>
            {data.matches.map((m, i) => (
              <button key={m.shift} type="button" className={`sy-chip ${i === pick ? "on" : ""}`} aria-pressed={i === pick} onClick={() => setPick(i)}>
                {fill(t.syChip, { y: yr.format(m.endYear), word: word(m) })}
              </button>
            ))}
          </div>
          <div className="sk-scroll" tabIndex={0} role="region" aria-label={t.syTitle}>
            <table className="sk-table">
              <thead>
                <tr>
                  <th>{t.syMonth}</th>
                  <th>{t.syRainNow}</th>
                  <th>{fill(t.syRainThen, { y: span(sel.rows) })}</th>
                  <th>{t.syTempNow}</th>
                  <th>{fill(t.syTempThen, { y: span(sel.rows) })}</th>
                </tr>
              </thead>
              <tbody>
                {data.window.map((now, i) => (
                  <tr key={i}>
                    <th scope="row">{monthName(now.m0)}</th>
                    <td>{nf.format(now.rain)}</td>
                    <td>{nf.format(sel.rows[i].rain)}</td>
                    <td>{nf1.format(now.temp)}</td>
                    <td>{nf1.format(sel.rows[i].temp)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted small">{fill(t.syGap, { d: nf2.format(sel.d) })}</p>

          {sel.next.length > 0 && (
            <>
              <h4>{fill(t.syNextTitle, { y: yr.format(sel.endYear) })}</h4>
              <div className="sk-scroll" tabIndex={0} role="region" aria-label={fill(t.syNextTitle, { y: yr.format(sel.endYear) })}>
                <table className="sk-table">
                  <thead><tr><th>{t.syMonth}</th><th>{fill(t.syRainIn, { y: yr.format(sel.endYear) })}</th><th>{t.syRainRange}</th></tr></thead>
                  <tbody>
                    {sel.next.map((r, i) => {
                      const g = data.nextRange[i];
                      return (
                        <tr key={i}>
                          <th scope="row">{monthName(r.m0)}</th>
                          <td>{nf.format(r.rain)}</td>
                          <td>{fill(t.syRangeCell, { a: nf.format(g.rainMin), b: nf.format(g.rainMax), c: nf.format(g.rainMean) })}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
          <ul className="sk-list small">
            <li>{data.usedJump ? fill(t.syJump, { y: yr.format(data.jumpYear) }) : fill(t.syYears, { a: yr.format(data.from), b: yr.format(trend.to) })}</li>
            <li>{t.syOne}</li>
          </ul>
          <p className="muted small">{t.syCaveat}</p>
        </>
      )}
    </section>
  );
}
