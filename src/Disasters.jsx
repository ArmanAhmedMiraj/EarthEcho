import { useCallback, useEffect, useState } from "react";
import "./disasters.css";
import { DISASTER_OFFICES } from "./i18nDisasters.js";
import { TWO_LETTER } from "./i18nWeather.js";

// the overall level from simple rules on the data
export function levelOf(d) {
  let level = 0;
  for (const a of d.alerts) {
    if (a.alert === "red") level = Math.max(level, 2);
    else if (a.alert === "orange") level = Math.max(level, 1);
  }
  for (const q of d.earthquakes) {
    if (q.magnitude >= 6 && q.km <= 300) level = Math.max(level, 2);
    else if (q.magnitude >= 5 && q.km <= 300) level = Math.max(level, 1);
  }
  for (const e of d.events) {
    if (["wildfire", "storm", "volcano"].includes(e.kind) && e.km <= 150) level = Math.max(level, 1);
  }
  if (d.river && d.river.ratio != null && d.river.ratio >= 2 && d.river.peak - d.river.now >= 2) level = Math.max(level, 1);
  return ["calm", "watch", "alert"][level];
}

function Spark({ series }) {
  const pts = series.filter((s) => s.v != null);
  if (pts.length < 3) return null;
  const W = 600, H = 100, L = 4, R = 4, T = 8, B = 16;
  const lo = Math.min(...pts.map((p) => p.v)), hi = Math.max(...pts.map((p) => p.v), lo + 0.1);
  const x = (i) => L + (i * (W - L - R)) / (pts.length - 1);
  const y = (v) => T + ((hi - v) * (H - T - B)) / (hi - lo);
  const path = pts.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
  const todayI = Math.min(7, pts.length - 1);
  return (
    <svg className="ds-spark" viewBox={`0 0 ${W} ${H}`} role="img" aria-hidden="true">
      <line x1={x(todayI)} x2={x(todayI)} y1={T} y2={H - B} stroke="var(--border)" strokeDasharray="3 3" />
      <path d={path} fill="none" stroke="var(--a2)" strokeWidth="2.2" />
      <text x={x(todayI) + 4} y={H - 3}>{pts[todayI].t.slice(5)}</text>
    </svg>
  );
}

export default function Disasters({ t, lang, lat, lon, country: appCountry }) {
  const [data, setData] = useState(null);
  const [state, setState] = useState("loading");
  const country = TWO_LETTER[appCountry] || null;
  const locale = lang === "bn" ? "bn-BD" : "en-GB";

  const load = useCallback(() => {
    setState("loading");
    const ask = (n) =>
      fetch(`/api/disasters?lat=${lat}&lon=${lon}`)
        .then((r) => r.json())
        .then((d) => {
          if (d.failed && d.failed.length === 4) throw new Error("all failed");
          setData(d);
          setState("ok");
        })
        .catch(() => (n < 1 ? ask(n + 1) : setState("failed")));
    ask(0);
  }, [lat, lon]);
  useEffect(load, [load]);

  if (state === "loading") return <p className="muted">{t.dsLoading}</p>;
  if (state === "failed" || !data) {
    return (
      <div>
        <p className="warn">{t.dsFailed}</p>
        <button className="tab" onClick={load}>{t.dsRetry}</button>
      </div>
    );
  }

  const num = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const whole = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const dateFmt = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" });
  const level = levelOf(data);
  const office = country && DISASTER_OFFICES[country];
  const nearby = [...data.alerts, ...data.events].sort((a, b) => a.km - b.km);
  const kinds = new Set([...nearby.map((e) => e.kind), data.earthquakes.length ? "earthquake" : null]);
  const rising = data.river && data.river.ratio != null && data.river.ratio >= 2 && data.river.peak - data.river.now >= 2;

  // plain-sentence summary by rules
  const lines = [];
  if (data.earthquakes.length) {
    const q = data.earthquakes[0];
    lines.push(t.sumQuake.replace("{n}", whole.format(data.earthquakes.length)).replace("{mag}", num.format(q.magnitude)).replace("{km}", whole.format(q.km)));
  } else if (!data.failed.includes("earthquakes")) lines.push(t.sumNoQuake);
  if (data.alerts.length) {
    lines.push(t.sumAlerts.replace("{n}", whole.format(data.alerts.length)).replace("{list}", data.alerts.slice(0, 3).map((a) => `${t[`kind_${a.kind}`]} (${t[`alertLevel_${a.alert}`] || a.alert})`).join(", ")));
  }
  if (data.events.length) {
    lines.push(t.sumEvents.replace("{n}", whole.format(data.events.length)).replace("{list}", [...new Set(data.events.map((e) => t[`kind_${e.kind}`]))].join(", ")));
  }
  if (data.river) {
    lines.push(rising ? t.sumRiver.replace("{ratio}", num.format(data.river.ratio)).replace("{day}", dateFmt.format(new Date(data.river.peakDay))) : t.sumRiverSteady);
  }
  if (level === "calm") lines.unshift(t.sumCalm);

  const tips = [
    kinds.has("earthquake") && t.tipQuake,
    (kinds.has("flood") || rising) && t.tipFlood,
    (kinds.has("cyclone") || kinds.has("storm")) && t.tipCyclone,
    kinds.has("wildfire") && t.tipFire,
    kinds.has("drought") && t.tipDrought,
  ].filter(Boolean);

  return (
    <div>
      <p className="muted">{t.dsIntro}</p>
      {data.failed.length > 0 && (
        <p className="warn small">{t.dsPartial.replace("{list}", data.failed.map((f) => t[`src_${f}`]).join(", "))}</p>
      )}
      <div className={`ds-level ${level}`}>
        <span className="ds-dot" aria-hidden="true" />
        <div><span className="muted small">{t.levelTitle}</span><br /><strong>{t[`level_${level}`]}</strong></div>
      </div>
      <h3>{t.sumTitle}</h3>
      <ul className="ds-sum">{lines.map((l, i) => <li key={i}>{l}</li>)}</ul>
      <p className="muted small">{t.sumNote}</p>

      <h3>{t.alertsTitle}</h3>
      {nearby.length === 0 ? <p className="muted">{t.alertsNone}</p> : (
        <ul className="ds-list">
          {nearby.map((e, i) => (
            <li key={i}>
              {e.alert && <span className={`ds-chip ${e.alert}`}>{t[`alertLevel_${e.alert}`] || e.alert}</span>}
              <span className="ds-chip">{t[`kind_${e.kind}`]}</span>
              {e.url ? <a href={e.url} target="_blank" rel="noopener noreferrer">{e.title}</a> : <strong>{e.title}</strong>}
              <span className="muted small">{t.away.replace("{km}", whole.format(e.km))} · {e.source}{e.size ? ` · ${e.size}` : ""}</span>
            </li>
          ))}
        </ul>
      )}
      {data.alerts.length > 0 && <p className="muted small">{t.gdacsNote}</p>}

      <h3>{t.quakeTitle}</h3>
      {data.earthquakes.length === 0 ? <p className="muted">{t.quakeNone}</p> : (
        <ul className="ds-list">
          {data.earthquakes.map((q, i) => (
            <li key={i}>
              <a href={q.url} target="_blank" rel="noopener noreferrer">
                {t.quakeLine.replace("{mag}", num.format(q.magnitude)).replace("{km}", whole.format(q.km)).replace("{depth}", whole.format(q.depthKm)).replace("{date}", dateFmt.format(new Date(q.time)))}
              </a>
              <span className="muted small">{q.title.replace(/^M [\d.]+ - /, "")}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="muted small">{t.quakeNote}</p>

      <h3>{t.riverTitle}</h3>
      {data.river ? (
        <>
          <div className="ds-river">
            <div><span>{t.riverNow}</span><strong>{num.format(data.river.now)}</strong></div>
            <div><span>{t.riverPeak}</span><strong>{num.format(data.river.peak)}</strong></div>
            <div><span>{t.riverTypical}</span><strong>{num.format(data.river.typical)}</strong></div>
          </div>
          <p className="muted small">{t.riverUnit}</p>
          <Spark series={data.river.series} />
          <p className={rising ? "warn small" : "muted small"}>{rising ? t.riverRising : t.riverSteady}</p>
        </>
      ) : <p className="muted">{data.failed.includes("river") ? t.src_river : t.riverNoData}</p>}
      <p className="muted small">{t.riverNote}</p>

      {tips.length > 0 && (
        <>
          <h3>{t.tipsTitle}</h3>
          <ul>{tips.map((x, i) => <li key={i}>{x}</li>)}</ul>
          <p className="muted small">{t.tipsNote}</p>
        </>
      )}

      <p className="muted small">{t.goWeather}</p>
      {office && (
        <p className="small">
          {t.officialTitle}: <a href={office.url} target="_blank" rel="noopener noreferrer">{office.name}</a>
        </p>
      )}
      <h3>{t.creditsTitle}</h3>
      <ul className="small muted">
        {data.provenance.map((p) => (
          <li key={p.name}><a href={p.url} target="_blank" rel="noopener noreferrer">{p.name}</a>: {p.note}</li>
        ))}
      </ul>
    </div>
  );
}
