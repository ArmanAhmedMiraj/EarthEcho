import { useEffect, useMemo, useRef, useState } from "react";
import Info from "./Info.jsx";

const fill = (text, values) => Object.keys(values).reduce((s, k) => s.split(`{${k}}`).join(values[k]), text);

// One headline word for the river: what the next 16 days look like.
export function riverState(flow) {
  if (!flow) return null;
  const z = flow.zonePeak;
  if (z === "severe") return "severe";
  if (z === "flood") return "flood";
  if (z === "high" && (flow.rising || flow.zoneNow === "high")) return flow.rising ? "high" : "high";
  if (flow.trend === "rising") return "rising";
  if (flow.trend === "falling") return "falling";
  return "normal";
}
const actionKey = (st) => (st === "severe" ? "severe" : st === "flood" ? "flood" : st === "high" ? "high" : "normal");
export const stateLevel = (st) => (st === "severe" ? "alert" : st === "flood" || st === "high" ? "watch" : "calm");

function Gauge({ t, flow, nf }) {
  const { q2, q5, now, peak } = flow;
  const max = Math.max(q5 * 1.15, peak * 1.05, now * 1.05);
  const pos = (v) => `${Math.min(100, Math.max(0, (v / max) * 100))}%`;
  const same = peak <= now * 1.03;
  const edge = (v) => (v / max > 0.72 ? "end" : v / max < 0.16 ? "start" : "");
  const apart = Math.abs(now - peak) / max;
  const zones = [
    { k: "normal", from: 0, to: q2 * 0.5 },
    { k: "high", from: q2 * 0.5, to: q2 },
    { k: "flood", from: q2, to: q5 },
    { k: "severe", from: q5, to: max },
  ];
  return (
    <div className="rv-gauge">
      <div className={`rv-marks ${!same && apart < 0.2 ? "stack" : ""}`}>
        <span className={`rv-mark ${edge(now)}`} style={{ left: pos(now) }}><b>{t.rvGaugeNow}</b> {nf.format(now)}</span>
        {!same && <span className={`rv-mark peak ${edge(peak)}`} style={{ left: pos(peak) }}><b>{t.rvGaugePeak}</b> {nf.format(peak)}</span>}
      </div>
      <div className="rv-bar" role="img" aria-label={`${t.rvGaugeNow}: ${t[`rvZone_${flow.zoneNow}`]}`}>
        {zones.map((z) => <i key={z.k} className={`z-${z.k}`} style={{ left: pos(z.from), width: `${((z.to - z.from) / max) * 100}%` }} />)}
        <em className="rv-pin" style={{ left: pos(now) }} />
        {!same && <em className="rv-pin peak" style={{ left: pos(peak) }} />}
      </div>
      <div className="rv-zones">
        {zones.map((z) => <span key={z.k} className={`z-${z.k}`} style={{ left: pos(z.from) }}>{t[`rvZone_${z.k}`]}</span>)}
      </div>
    </div>
  );
}

function FlowChart({ t, flow, nf, dateF }) {
  const [W, setW] = useState(640);
  const holder = useRef(null);
  useEffect(() => {
    const el = holder.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(() => setW(Math.max(280, Math.round(el.getBoundingClientRect().width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const pts = flow.series.filter((p) => p.v != null);
  if (pts.length < 3) return null;
  const H = W < 480 ? 250 : 230, L = W < 480 ? 50 : 58, R = 12, T = 22, B = 44;
  const todayI = Math.min(7, pts.length - 1);
  const top = Math.max(...pts.map((p) => p.v), ...pts.map((p) => p.u || 0), 1) * 1.18;
  const x = (i) => L + (i * (W - L - R)) / (pts.length - 1);
  const y = (v) => T + (1 - v / top) * (H - T - B);
  const line = (key) => pts.map((p, i) => (p[key] == null ? "" : `${i && pts[i - 1][key] != null ? "L" : "M"}${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`)).join(" ");
  const flowPath = line("v");
  const area = `${flowPath} L${x(pts.length - 1).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z`;
  const peakI = flow.peakDay ? pts.findIndex((p) => p.t === flow.peakDay) : -1;
  const showPeak = peakI > todayI && flow.peak > flow.now * 1.05;
  const ticks = [0, top / 2, top].map((v) => ({ v, y: y(v) }));
  const off = flow.q2 && flow.q2 > top;
  return (
    <figure className="rv-chart" ref={holder}>
      <figcaption><b>{t.rvChartTitle}</b><span className="small muted">{t.rvChartCap}</span></figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t.rvChartTitle}>
        <rect className="rv-fc" x={x(todayI)} y={T} width={x(pts.length - 1) - x(todayI)} height={H - T - B} />
        <text className="rv-fct" x={x(todayI) + 8} y={T + 13} textAnchor="start">{t.rvLegFc}</text>
        {ticks.map((k, i) => (
          <g key={i}>
            <line className="rv-grid" x1={L} x2={W - R} y1={k.y} y2={k.y} />
            <text className="rv-ax" x={L - 6} y={k.y + 4} textAnchor="end">{nf.format(k.v)}</text>
          </g>
        ))}
        <text className="rv-ax" x={4} y={T - 8} textAnchor="start">{t.rvUnit}</text>
        <path className="rv-area" d={area} />
        <path className="rv-usual" d={line("u")} />
        <path className="rv-line" d={flowPath} />
        <line className="rv-today" x1={x(todayI)} x2={x(todayI)} y1={T} y2={H - B} />
        <circle className="rv-dot" cx={x(todayI)} cy={y(pts[todayI].v)} r="5" />
        {showPeak && (
          <g>
            <circle className="rv-dot peak" cx={x(peakI)} cy={y(flow.peak)} r="5" />
            <text className="rv-ax strong" x={Math.min(Math.max(x(peakI), L + 40), W - 50)} y={y(flow.peak) - 9} textAnchor="middle">{t.rvPeakLbl} {nf.format(flow.peak)}</text>
          </g>
        )}
        <text className="rv-ax" x={x(0)} y={H - 22} textAnchor="start">{t.rvAgo}</text>
        <text className="rv-ax" x={x(0)} y={H - 8} textAnchor="start">{dateF(pts[0].t)}</text>
        <text className="rv-ax strong" x={x(todayI)} y={H - 22} textAnchor="middle">{t.rvToday}</text>
        <text className="rv-ax" x={x(todayI)} y={H - 8} textAnchor="middle">{dateF(pts[todayI].t)}</text>
        <text className="rv-ax" x={x(pts.length - 1)} y={H - 22} textAnchor="end">{t.rvAhead}</text>
        <text className="rv-ax" x={x(pts.length - 1)} y={H - 8} textAnchor="end">{dateF(pts[pts.length - 1].t)}</text>
      </svg>
      <div className="rv-legend small">
        <span><i className="lg line" />{t.rvLegFlow}</span>
        <span><i className="lg usual" />{t.rvLegUsual}</span>
        <span><i className="lg fc" />{t.rvLegFc}</span>
      </div>
      {off && <p className="small muted">{fill(t.rvOffChart, { n: nf.format(flow.q2) })}</p>}
    </figure>
  );
}

export default function RiverNow({ t, locale, flow, name, km, within, anyRiver }) {
  const nf = useMemo(() => new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }), [locale]);
  const nf1 = useMemo(() => new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }), [locale]);
  const dateF = useMemo(() => { const f = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }); return (s) => f.format(new Date(`${s}T00:00:00Z`)); }, [locale]);
  const fmt = (v) => (v < 10 ? nf1.format(v) : nf.format(v));
  const state = riverState(flow);

  return (
    <section className="rv-card" id="ds-river" aria-labelledby="rv-title">
      <h3 id="rv-title">{t.rvTitle}
        <Info t={t} source="GloFAS · Open-Meteo · NASA POWER">
          <span>{t.rvInfoWhat}</span>
          <span>{t.rvInfoCompare}</span>
          <span>{t.rvInfoSource}</span>
        </Info>
      </h3>
      {!flow ? <p className="muted">{t.rvNoData}</p> : (
        <>
          {name && <p className="muted small rv-where">{within ? fill(t.rvNear, { name, km: nf.format(km) }) : fill(t.rvFar, { name, km: nf.format(km) })}</p>}
          {!name && anyRiver && <p className="muted small rv-where">{t.rvNearAny}</p>}
          <div className={`rv-head ${stateLevel(state)}`}>
            <span className="rv-arrow" aria-hidden="true">{state === "rising" || state === "high" || state === "flood" || state === "severe" ? "↗" : state === "falling" ? "↘" : "→"}</span>
            <div><b>{t[`rvHead_${state}`]}</b><span className="small">{t[`rvAct_${actionKey(state)}`]}</span></div>
          </div>
          <div className="rv-tiles">
            <div>
              <span className="rv-l">{t.rvNowT}</span>
              <b>{fmt(flow.now)} <small>m³/s</small></b>
              <span className="small muted">{flow.now >= 1250 ? fill(t.rvNowPools, { n: nf.format(Math.round(flow.now / 2500) || 1) }) : fill(t.rvNowLitres, { n: nf.format(Math.round(flow.now * 1000)) })}</span>
            </div>
            {flow.usual > 0 && (
              <div>
                <span className="rv-l">{t.rvUsualT}</span>
                {(() => { const p = Math.round((flow.now / flow.usual) * 100); const k = p < 75 ? "low" : p > 130 ? "high" : "same"; return (<><b className={`rv-u ${k}`}>{t[`rvUsual_${k}`]}</b><span className="small muted">{fill(t.rvUsualSub, { p: nf.format(p) })}</span></>); })()}
              </div>
            )}
            <div>
              <span className="rv-l">{t.rvPeakT}</span>
              <b>{fmt(flow.peak)} <small>m³/s</small></b>
              <span className="small muted">{flow.peak <= flow.now * 1.03 ? (flow.q2 ? fill(t.rvPeakNoRise, { p: nf.format(Math.round((flow.peak / flow.q2) * 100)) }) : t.rvPeakNoRiseS) : flow.q2 ? fill(t.rvPeakSub, { date: dateF(flow.peakDay), p: nf.format(Math.round((flow.peak / flow.q2) * 100)) }) : fill(t.rvPeakSubNo, { date: dateF(flow.peakDay) })}</span>
            </div>
          </div>
          {flow.q2 >= 100 && (
            <>
              <Gauge t={t} flow={flow} nf={nf} />
              <p className="small muted">{t.rvGaugeCap}</p>
            </>
          )}
          <FlowChart t={t} flow={flow} nf={nf} dateF={dateF} />
        </>
      )}
    </section>
  );
}
