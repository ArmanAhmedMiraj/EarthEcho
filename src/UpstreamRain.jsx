import { useEffect, useMemo, useState } from "react";
import "./weather.css";

const fill = (text, values) => Object.keys(values).reduce((s, k) => s.split(`{${k}}`).join(values[k]), text);

// Rain in the hills and plains that feed the rivers reaching Bangladesh. One point per area, so this is a hint about where heavy rain
// has fallen or is coming, not a flood forecast. Heavy-rain limits follow the India Met Department's daily classes (64.5 and 115.6 mm).
export const AREAS = [
  { id: "assam", lat: 26.18, lon: 91.75 },
  { id: "upperassam", lat: 27.48, lon: 94.91 },
  { id: "meghalaya", lat: 25.28, lon: 91.72 },
  { id: "barak", lat: 24.83, lon: 92.78 },
  { id: "sikkim", lat: 27.33, lon: 88.61 },
  { id: "ganges", lat: 25.61, lon: 85.14 },
];
export const HEAVY = 64.5, VERY_HEAVY = 115.6;
const PAST = 7, AHEAD = 4; // days asked for: the last 7 and today plus the next 3

export function summarize(daily) {
  // daily: { time: [...], precipitation_sum: [...] } with PAST days before today, then today and the days after
  const v = (daily.precipitation_sum || []).map((x) => (typeof x === "number" ? x : null));
  const sum = (a, b) => v.slice(a, b).reduce((s, x) => s + (x || 0), 0);
  const win = v.slice(PAST - 3).filter((x) => x != null); // last 3 days, today and the next 3
  const peak = win.length ? Math.max(...win) : null;
  return {
    past3: sum(PAST - 3, PAST), next3: sum(PAST, PAST + AHEAD), peak,
    level: peak == null ? null : peak >= VERY_HEAVY ? "alert" : peak >= HEAVY ? "watch" : "calm",
    heavyPast: v.slice(PAST - 3, PAST).some((x) => x != null && x >= HEAVY),
    heavyAhead: v.slice(PAST, PAST + AHEAD).some((x) => x != null && x >= HEAVY),
  };
}

export default function UpstreamRain({ t, lang, locale, lat, lon }) {
  const [rows, setRows] = useState(null);
  const [state, setState] = useState("loading");

  useEffect(() => {
    let cancelled = false;
    setState("loading");
    const key = `ef-upstream-${AREAS.length}`;
    try {
      const saved = JSON.parse(sessionStorage.getItem(key) || "null");
      if (saved && Date.now() - saved.at < 30 * 60e3) { setRows(saved.rows); setState("ok"); return () => {}; }
    } catch { /* storage may be off */ }
    const url = "https://api.open-meteo.com/v1/forecast?" +
      `latitude=${AREAS.map((a) => a.lat).join(",")}&longitude=${AREAS.map((a) => a.lon).join(",")}` +
      `&daily=precipitation_sum&past_days=${PAST}&forecast_days=${AHEAD}&timezone=Asia%2FDhaka`;
    fetch(url)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => {
        if (cancelled) return;
        const list = Array.isArray(d) ? d : [d];
        const out = AREAS.map((a, i) => ({ id: a.id, ...summarize((list[i] && list[i].daily) || {}) }));
        setRows(out); setState("ok");
        try { sessionStorage.setItem(key, JSON.stringify({ at: Date.now(), rows: out })); } catch { /* storage may be off */ }
      })
      .catch(() => { if (!cancelled) setState("error"); });
    return () => { cancelled = true; };
  }, []);

  const nf = useMemo(() => new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }), [locale]);
  const km = (a) => { // distance from the field to the area, in kilometres
    const R = 6371, rad = Math.PI / 180;
    const dLat = (a.lat - lat) * rad, dLon = (a.lon - lon) * rad;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat * rad) * Math.cos(a.lat * rad) * Math.sin(dLon / 2) ** 2;
    return Math.round(2 * R * Math.asin(Math.sqrt(h)));
  };

  const worst = rows ? (rows.some((r) => r.level === "alert") ? "alert" : rows.some((r) => r.level === "watch") ? "watch" : "calm") : null;
  const named = (lv) => (rows ? rows.filter((r) => r.level === lv).map((r) => t[`upArea_${r.id}`]) : []);
  const nf1 = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });

  return (
    <section className="up-wrap" aria-labelledby="up-title">
      <h3 id="up-title">{t.upTitle}</h3>
      <p className="muted small">{t.upIntro}</p>
      {state === "loading" && <p className="muted small">{t.skLoading}</p>}
      {state === "error" && <p className="warn small">{t.upFailed}</p>}
      {rows && (
        <>
          <p className={`sk-hint sy-lead up-${worst}`}>
            {worst === "calm" ? t.upCalm : [named("alert").length ? fill(t.upAlert, { list: named("alert").join(", ") }) : "", named("watch").length ? fill(t.upWatch, { list: named("watch").join(", ") }) : ""].filter(Boolean).join(" ")}
          </p>
          {worst !== "calm" && <p className="small">{t.upMeaning}</p>}
          <div className="sk-scroll" tabIndex={0} role="region" aria-label={t.upTitle}>
            <table className="sk-table">
              <thead>
                <tr><th>{t.upArea}</th><th>{t.upPast}</th><th>{t.upNext}</th><th>{t.upPeak}</th><th>{t.upStatus}</th></tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const a = AREAS.find((x) => x.id === r.id);
                  return (
                    <tr key={r.id}>
                      <th scope="row">{t[`upArea_${r.id}`]}<br /><span className="muted small">{t[`upRivers_${r.id}`]} · {fill(t.upAway, { km: nf.format(km(a)) })}</span></th>
                      <td>{nf.format(r.past3)}</td>
                      <td>{nf.format(r.next3)}</td>
                      <td>{r.peak == null ? "–" : nf.format(r.peak)}</td>
                      <td><span className={`up-chip ${r.level || "calm"}`}>{r.level ? t[`upLevel_${r.level}`] : "–"}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="muted small">{fill(t.upLimits, { a: nf1.format(HEAVY), b: nf1.format(VERY_HEAVY) })}</p>
          <p className="muted small">{t.upCaveat}</p>
        </>
      )}
    </section>
  );
}
