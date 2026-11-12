import { useCallback, useEffect, useState } from "react";
import "./disasters.css";
import { DISASTER_OFFICES } from "./i18nDisasters.js";
import { TWO_LETTER } from "./i18nWeather.js";
import Info from "./Info.jsx";
import RiverNow, { riverState } from "./RiverNow.jsx";
import Upstream from "./Upstream.jsx";

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

const RANK = { calm: 0, watch: 1, alert: 2 };
const worstOf = (...l) => l.reduce((b, x) => (RANK[x] > RANK[b] ? x : b), "calm");
const fill = (text, values) => Object.keys(values).reduce((s, k) => s.split(`{${k}}`).join(values[k]), text);

async function getJson(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(String(r.status));
  const d = await r.json();
  if (d.ok === false) throw new Error("not ok");
  return d;
}

export default function Disasters({ t, lang, lat, lon, country: appCountry }) {
  const [data, setData] = useState(null);
  const [state, setState] = useState("loading");
  const [rw, setRw] = useState(null);
  const [rwState, setRwState] = useState("loading");
  const country = TWO_LETTER[appCountry] || null;
  const inBd = country === "BD";
  const locale = lang === "bn" ? "bn-BD" : "en-GB";

  const load = useCallback(() => {
    setState("loading");
    const ask = (n) =>
      getJson(`/api/disasters?lat=${lat}&lon=${lon}`)
        .then((d) => {
          if (d.failed && d.failed.length === 4) throw new Error("all failed");
          setData(d);
          setState("ok");
        })
        .catch(() => (n < 1 ? ask(n + 1) : setState("failed")));
    ask(0);
  }, [lat, lon]);
  useEffect(load, [load]);

  // the river and (in Bangladesh) the places upstream of it load on their own, so a slow source never blocks the page
  const loadRiver = useCallback(() => {
    setRwState("loading");
    const ask = (n) =>
      getJson(`/api/disasters?mode=${inBd ? "upstream" : "river"}&lat=${lat}&lon=${lon}`)
        .then((d) => { setRw(d); setRwState("ok"); })
        .catch(() => (n < 1 ? ask(n + 1) : setRwState("failed")));
    ask(0);
  }, [lat, lon, inBd]);
  useEffect(loadRiver, [loadRiver]);

  const num = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const whole = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const dateFmt = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" });
  const office = country && DISASTER_OFFICES[country];

  const flow = rw && rw.flow;
  const rState = flow ? riverState(flow) : null;
  const riverName = inBd && rw && rw.river ? t[`rvName_${rw.river.id}`] : null;
  const upWorst = inBd && rw ? rw.stations.reduce((b, s) => worstOf(b, s.level), "calm") : "calm";
  const riverLevel = rw ? (inBd ? rw.overall : flow ? flow.level : "calm") : "calm";

  const base = data || { alerts: [], events: [], earthquakes: [], river: null, failed: [], provenance: [] };
  const level = worstOf(levelOf({ ...base, river: null }), riverLevel);
  const nearby = [...base.alerts, ...base.events].sort((a, b) => a.km - b.km);
  const kinds = new Set([...nearby.map((e) => e.kind), base.earthquakes.length ? "earthquake" : null]);
  const floodish = rState === "high" || rState === "flood" || rState === "severe" || upWorst !== "calm";

  // plain-sentence summary by rules
  const lines = [];
  if (data) {
    if (data.earthquakes.length) {
      const q = data.earthquakes[0];
      lines.push(t.sumQuake.replace("{n}", whole.format(data.earthquakes.length)).replace("{mag}", num.format(q.magnitude)).replace("{km}", whole.format(q.km)));
    } else if (!data.failed.includes("earthquakes")) lines.push(t.sumNoQuake);
    if (data.alerts.length) lines.push(t.sumAlerts.replace("{n}", whole.format(data.alerts.length)).replace("{list}", data.alerts.slice(0, 3).map((a) => `${t[`kind_${a.kind}`]} (${t[`alertLevel_${a.alert}`] || a.alert})`).join(", ")));
    if (data.events.length) lines.push(t.sumEvents.replace("{n}", whole.format(data.events.length)).replace("{list}", [...new Set(data.events.map((e) => t[`kind_${e.kind}`]))].join(", ")));
  }
  if (flow) lines.push(`${riverName ? `${riverName}: ` : ""}${t[`rvHead_${rState}`]}.`);
  if (inBd && rw && rw.stations.length) {
    const hot = rw.stations.filter((s) => s.level !== "calm" && s.eta).sort((a, b) => (a.eta.from < b.eta.from ? -1 : 1))[0];
    const d = (s) => dateFmt.format(new Date(`${s}T00:00:00Z`));
    lines.push(hot ? fill(t.urEta, { name: riverName, a: d(hot.eta.from), b: d(hot.eta.to) }) : fill(t.urCalmP, { name: riverName }));
  }
  if (level === "calm" && data) lines.unshift(t.sumCalm);

  const tips = [
    kinds.has("earthquake") && t.tipQuake,
    (kinds.has("flood") || floodish) && t.tipFlood,
    (kinds.has("cyclone") || kinds.has("storm")) && t.tipCyclone,
    kinds.has("wildfire") && t.tipFire,
    kinds.has("drought") && t.tipDrought,
  ].filter(Boolean);

  if (state === "loading" && rwState === "loading") return <p className="muted">{t.dsLoading}</p>;

  const tile = (id, label, value, sub, lv) => (
    <a className={`ds-tile ${lv}`} href={`#${id}`} onClick={(e) => { e.preventDefault(); const el = document.getElementById(id); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); }}>
      <span className="ds-dot" aria-hidden="true" />
      <span className="ds-tl">{label}</span>
      <b>{value}</b>
      <span className="small muted">{sub}</span>
    </a>
  );
  const quakeLv = base.earthquakes.some((q) => q.magnitude >= 6 && q.km <= 300) ? "alert" : base.earthquakes.some((q) => q.magnitude >= 5 && q.km <= 300) ? "watch" : "calm";
  const alertLv = base.alerts.some((a) => a.alert === "red") ? "alert" : nearby.length ? "watch" : "calm";

  return (
    <div className="ds-page">
      <p className="muted">{t.dsIntro}</p>
      {state === "failed" && (
        <p className="warn small">{t.dsFailed} <button className="tab" onClick={load}>{t.dsRetry}</button></p>
      )}
      {data && data.failed.length > 0 && (
        <p className="warn small">{t.dsPartial.replace("{list}", data.failed.filter((f) => f !== "river").map((f) => t[`src_${f}`]).join(", "))}</p>
      )}
      <div className={`ds-level ${level}`}>
        <span className="ds-dot" aria-hidden="true" />
        <div><span className="muted small">{t.levelTitle}</span><br /><strong>{t[`level_${level}`]}</strong></div>
      </div>

      <h3>{t.dsGlance}</h3>
      <div className="ds-tiles">
        {tile("ds-quakes", t.dsGlQuake, base.earthquakes.length ? `M ${num.format(base.earthquakes[0].magnitude)}` : t.dsGlQuakeNone, t.dsGlQuakeSub, quakeLv)}
        {tile("ds-alerts", t.dsGlAlerts, nearby.length ? whole.format(nearby.length) : t.dsGlAlertsNone, t.dsGlAlertsSub, alertLv)}
        {tile("ds-river", t.dsGlRiver, flow ? t[`rvShort_${rState}`] : "…", riverName || "", flow ? (riverLevel === "alert" ? "alert" : riverLevel === "watch" ? "watch" : "calm") : "calm")}
        {inBd && tile("ds-upstream", t.dsGlUp, rw ? t[`urLevel_${upWorst}`] : "…", t.dsGlUpSub, upWorst)}
      </div>

      {lines.length > 0 && (
        <>
          <h3>{t.sumTitle}
            <Info t={t} source="USGS · GDACS · NASA EONET · GloFAS">
              <b>{t.dsSrcTitle}</b>
              <ul><li>{t.dsSrcQuake}</li><li>{t.dsSrcGdacs}</li><li>{t.dsSrcEonet}</li><li>{t.rvInfoSource}</li></ul>
              <span>{t.dsSrcNote}</span>
            </Info>
          </h3>
          <ul className="ds-sum">{lines.map((l, i) => <li key={i}>{l}</li>)}</ul>
        </>
      )}

      <h3 id="ds-alerts">{t.alertsTitle}
        <Info t={t} source="GDACS · NASA EONET"><span>{t.dsSrcGdacs}</span><span>{t.dsSrcEonet}</span><span>{t.gdacsNote}</span></Info>
      </h3>
      {nearby.length === 0 ? <p className="muted">{t.alertsNone}</p> : (
        <ul className="ds-list">
          {nearby.map((e, i) => (
            <li key={i}>
              {e.alert && <span className={`ds-chip ${e.alert}`}>{t[`alertLevel_${e.alert}`] || e.alert}</span>}
              <span className="ds-chip">{t[`kind_${e.kind}`]}</span>
              {e.url ? <a href={e.url} target="_blank" rel="noopener noreferrer">{e.title}</a> : <strong>{e.title}</strong>}
              <span className="muted small">{t.away.replace("{km}", whole.format(e.km))}{e.size ? ` · ${e.size}` : ""}</span>
            </li>
          ))}
        </ul>
      )}

      <h3 id="ds-quakes">{t.quakeTitle}
        <Info t={t} source="USGS"><span>{t.dsSrcQuake}</span><span>{t.quakeNote}</span></Info>
      </h3>
      {base.earthquakes.length === 0 ? <p className="muted">{t.quakeNone}</p> : (
        <ul className="ds-quakes">
          {base.earthquakes.map((q, i) => {
            const k = q.magnitude >= 5.5 ? "high" : q.magnitude >= 4.5 ? "mid" : "low";
            return (
              <li key={i}>
                <span className={`ds-mag ${k}`}>{num.format(q.magnitude)}</span>
                <div>
                  <a href={q.url} target="_blank" rel="noopener noreferrer">{t.away.replace("{km}", whole.format(q.km))} · {dateFmt.format(new Date(q.time))}</a>
                  <span className="small muted">{q.title.replace(/^M [\d.]+ - /, "")}</span>
                  <span className="small">{t[`qFelt_${k}`]} · {t.quakeDepth.replace("{depth}", whole.format(q.depthKm))}</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <p className="muted small">{t.qNoteShort}</p>

      {rwState === "loading" && <p className="muted small">{t.urLoading}</p>}
      {rwState === "failed" && <p className="warn small">{t.urFailed} <button className="tab" onClick={loadRiver}>{t.urRetry}</button></p>}
      {rw && <RiverNow t={t} locale={locale} flow={flow} name={riverName} km={inBd ? rw.river.km : 0} within={inBd ? rw.river.within : true} anyRiver={!inBd} />}
      {inBd && rw && rw.stations.length > 0 && <Upstream t={t} locale={locale} rw={rw} />}

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
    </div>
  );
}
