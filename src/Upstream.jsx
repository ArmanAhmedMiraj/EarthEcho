import { useMemo } from "react";
import Info from "./Info.jsx";
import UpstreamMap from "./UpstreamMap.jsx";

const fill = (text, values) => Object.keys(values).reduce((s, k) => s.split(`{${k}}`).join(values[k]), text);
const RANK = { calm: 0, watch: 1, alert: 2 };
const ext = (url, label) => <a href={url} target="_blank" rel="noopener noreferrer">{label}</a>;

export default function Upstream({ t, locale, rw, part }) {
  const show = (p) => !part || part === p;
  const nf = useMemo(() => new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }), [locale]);
  const nf1 = useMemo(() => new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }), [locale]);
  const dateF = useMemo(() => { const f = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }); return (s) => f.format(new Date(`${s}T00:00:00Z`)); }, [locale]);
  const river = t[`rvName_${rw.river.id}`];
  const stations = rw.stations;
  const worst = stations.reduce((b, s) => (RANK[s.level] > RANK[b] ? s.level : b), "calm");
  const hot = stations.filter((s) => s.level !== "calm").sort((a, b) => RANK[b.level] - RANK[a.level] || (a.eta && b.eta ? (a.eta.from < b.eta.from ? -1 : 1) : 0)).slice(0, 3);
  const vsUsual = (s) => (s.flow && s.flow.usual > 0 ? Math.round((s.flow.now / s.flow.usual) * 100) : null);
  const arrow = (s) => (s.flow ? (s.flow.trend === "rising" ? "↗" : s.flow.trend === "falling" ? "↘" : "→") : "");
  const lead = (s) => (s.lead[1] <= 1 ? fill(t.urLeadNear, { b: nf.format(Math.max(1, s.lead[1])) }) : fill(t.urLeadFar, { a: nf.format(s.lead[0]), b: nf.format(s.lead[1]) }));
  const what = (s) => {
    if (s.reason === "flow") {
      const f = s.flow;
      if (f.q2 >= 100) return fill(t.urWhat_flow, { peak: nf.format(f.peak), date: dateF(f.peakDay), p: nf.format(Math.round((f.peak / f.q2) * 100)) });
      return fill(t.urWhat_flowSmall, { peak: nf.format(f.peak), date: dateF(f.peakDay), r: nf1.format(f.peak / Math.max(f.now, 1)) });
    }
    return fill(t.urWhat_rain, { mm: nf.format(s.rain.peak), date: dateF(s.rain.peakDay) });
  };
  const nasaDays = stations.map((s) => (s.rain ? s.rain.nasaDays : 0)).reduce((a, b) => Math.max(a, b), 0);

  return (
    <section className={`up-wrap2${part ? " up-part" : ""}`} id={show("journey") ? "ds-upstream" : undefined} aria-labelledby={show("journey") ? "ur-title" : undefined}>
      {show("journey") && <>
      <h3 id="ur-title">{t.urTitle}
        <Info t={t} source="GloFAS · NASA POWER · NASA GIBS">
          <span>{t.urInfoHow}</span>
          <span>{t.urInfoTime}</span>
          <span>{t.urInfoLimits}</span>
          <span>{t.urInfoRainSrc}</span>
          <b>{t.urSrcTitle}</b>
          <ul>
            <li>{t.urSrcRiver}</li>
            <li>{t.urSrcNasa}</li>
            <li>{t.urSrcEvents}</li>
          </ul>
          <b>{t.urOfficial}</b>
          <ul>
            <li>{ext("http://www.ffwc.gov.bd", t.urOffBd)}</li>
            <li>{ext("https://cwc.gov.in", t.urOffIn)}</li>
            <li>{ext("https://www.globalfloods.eu", t.urOffGlofas)}</li>
          </ul>
        </Info>
      </h3>
      <p className="muted small">{fill(t.urIntro, { name: river })}</p>

      <div className={`up-banner ${worst}`}>
        <span className="up-ic" aria-hidden="true">{worst === "calm" ? "✓" : worst === "watch" ? "!" : "⚠"}</span>
        <div>
          <b>{worst === "calm" ? t.urCalmH : worst === "watch" ? t.urWatchH : t.urAlertH}</b>
          <span className="small">{worst === "calm" ? fill(t.urCalmP, { name: river }) : hot.length ? fill(t.urEta, { name: river, a: dateF(hot[0].eta.from), b: dateF(hot[0].eta.to) }) : ""}</span>
        </div>
      </div>

      {hot.map((s) => (
        <article className={`up-hot ${s.level}`} key={s.id}>
          <header><b>{t[`stName_${s.id}`]}</b><span className={`up-chip ${s.level}`}>{t[`urLevel_${s.level}`]}</span></header>
          <dl>
            <dt>{t.urWhat}</dt><dd>{what(s)}</dd>
            <dt>{t.urWhere}</dt><dd>{t[`stWhere_${s.id}`]}</dd>
            <dt>{t.urWhy}</dt><dd>{t[`stWhy_${s.id}`]}</dd>
            <dt>{t.urEffect}</dt><dd>{fill(t.urEffectTxt, { name: river, a: dateF(s.eta.from), b: dateF(s.eta.to) })}</dd>
          </dl>
        </article>
      ))}

      <h4 className="wf-sub">{t.urJourney}</h4>
      <ol className="up-journey">
        {stations.map((s, i) => (
          <li key={s.id} className={s.level}>
            <span className="up-step" aria-hidden="true">{i === 0 ? t.urFar : ""}</span>
            <header>
              <span className={`up-dot ${s.level}`} aria-hidden="true" />
              <b>{t[`stName_${s.id}`]}</b>
              <span className={`up-chip ${s.level}`}>{t[`urLevel_${s.level}`]}</span>
            </header>
            <span className="small muted">{t[`stWhere_${s.id}`]} · {lead(s)}</span>
            <div className="up-facts">
              <div><span>{t.urFlow}</span><b>{s.flow ? `${arrow(s)} ${vsUsual(s) != null ? fill(t.urFlowVs, { p: nf.format(vsUsual(s)) }) : nf.format(s.flow.now) + " m³/s"}` : t.urNoData}</b>{s.flow && s.flow.peak > s.flow.now * 1.1 && <span className="up-rise">{fill(t.urFlowPeak, { peak: nf.format(s.flow.peak), date: dateF(s.flow.peakDay) })}</span>}</div>
              <div><span>{fill(t.urRain7, { n: nf.format(s.rain ? s.rain.nasaDays : 0) })}</span><b>{s.rain && s.rain.nasaMm != null ? fill(t.urMm, { n: nf.format(s.rain.nasaMm) }) : t.urNoData}</b></div>
              <div><span>{t.urRainNext}</span><b>{s.rain && s.rain.next3 != null ? fill(t.urMm, { n: nf.format(s.rain.next3) }) : t.urNoData}</b></div>
            </div>
            {s.level === "calm" && (
              <details className="up-why"><summary>{t.urWhy}</summary><p className="small">{t[`stWhy_${s.id}`]}</p></details>
            )}
          </li>
        ))}
        <li className="up-you">
          <header><span className="up-dot you" aria-hidden="true" /><b>{t.urYou}</b></header>
          <span className="small muted">{river}</span>
          {rw.here && rw.here.nasaMm != null && <span className="small muted">{fill(t.urHereRain, { n: nf.format(rw.here.nasaDays), mm: nf.format(rw.here.nasaMm) })}</span>}
        </li>
      </ol>
      {rw.failed.includes("stations") && <p className="warn small">{t.urPartial}</p>}
      {nasaDays === 0 && null}
      </>}

      {show("map") && <UpstreamMap t={t} lat={rw.location.lat} lon={rw.location.lon} river={rw.river} lines={rw.lines} stations={stations} order={stations.map((s) => s.id)} />}

      {show("events") && <>
      <h4 className="wf-sub">{t.urEvTitle}
        <Info t={t} source="GDACS · NASA EONET">
          <span>{t.dsSrcGdacs}</span>
          <span>{t.dsSrcEonet}</span>
        </Info>
      </h4>
      {rw.events.length === 0 ? <p className="muted small">{t.urEvNone}</p> : (
        <ul className="ds-list">
          {rw.events.map((e, i) => (
            <li key={i}>
              {e.alert && <span className={`ds-chip ${e.alert}`}>{t[`alertLevel_${e.alert}`] || e.alert}</span>}
              <span className="ds-chip">{t[`kind_${e.kind}`]}</span>
              {e.url ? <a href={e.url} target="_blank" rel="noopener noreferrer">{e.title}</a> : <strong>{e.title}</strong>}
              <span className="muted small">{fill(t.urEvNear, { place: t[`stName_${e.near.id}`] })}</span>
            </li>
          ))}
        </ul>
      )}
      </>}
    </section>
  );
}
