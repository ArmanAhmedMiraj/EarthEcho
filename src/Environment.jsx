import { Suspense, lazy, useEffect, useState } from "react";
import ErrorBoundary from "./ErrorBoundary.jsx";

const fill = (text, values) => Object.keys(values).reduce((s, k) => s.split(`{${k}}`).join(values[k]), text);
const NasaMap = lazy(() => import("./NasaMap.jsx")); // loads the map code only when this tab opens
import "./environment.css";
import "./env2.css";

// NASA environment page: vegetation, land temperature, soil wetness, yearly water balance and land shape.
// `initial` is what the preparation screen already fetched; if it is missing the page asks again itself.
export default function Environment({ t, lang, lat, lon, initial, satellite, terrain }) {
  const [state, setState] = useState(initial ? "ok" : "loading");
  const [data, setData] = useState(initial || null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (initial && attempt === 0) return undefined;
    let cancelled = false;
    setState("loading");
    fetch(`/api/environment?lat=${lat}&lon=${lon}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setState(d.ok ? "ok" : "error");
      })
      .catch(() => {
        if (!cancelled) setState("error");
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lon, attempt]);

  const locale = lang === "bn" ? "bn-BD" : "en-GB";
  const num = (v, d = 0) => new Intl.NumberFormat(locale, { maximumFractionDigits: d, minimumFractionDigits: d }).format(v);
  const monthName = (m, style = "short") => new Intl.DateTimeFormat(locale, { month: style, timeZone: "UTC" }).format(new Date(Date.UTC(2021, m, 1)));
  const monthYear = (r) => `${monthName(r.month, "long")} ${r.year}`;
  const day = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

  if (state === "loading") {
    return (
      <div className="viewer env">
        <h2 className="sr-only">{t.envTitle}</h2>
        <p className="muted">{t.envLoading}</p>
      </div>
    );
  }
  if (state === "error" || !data) {
    return (
      <div className="viewer env">
        <h2 className="sr-only">{t.envTitle}</h2>
        <p className="warn-soft">{t.envFailed}</p>
        <button className="btn" onClick={() => setAttempt((n) => n + 1)}>{t.envRetry}</button>
      </div>
    );
  }

  const prov = data.provenance || {};
  const veg = data.vegetation;
  const climate = data.climate;
  const sourceLine = (p) =>
    p ? (
      <p className="env-source small">
        {t.sourceLabel}: {p.url ? <a href={p.url} target="_blank" rel="noreferrer">{p.name}</a> : p.name}
        {p.publisher ? ` · ${p.publisher}` : ""}
        {p.resolution ? ` · ${t.resolutionLabel}: ${p.resolution}` : ""}
      </p>
    ) : null;

  // vegetation wording
  const vegClass = (v) => (v < 0.2 ? t.vegBare : v < 0.4 ? t.vegSparse : v < 0.6 ? t.vegModerate : t.vegDense);
  let compare = null;
  if (veg && veg.usual != null) {
    const diff = veg.latest.value - veg.usual;
    compare = Math.abs(diff) < 0.05 ? t.vegUsualSame : diff > 0 ? t.vegUsualMore : t.vegUsualLess;
  }

  // water balance chart
  const months = climate ? climate.months : [];
  const thisMonth = new Date().getUTCMonth();
  const top = Math.max(1, ...months.map((m) => Math.max(m.rainMm || 0, m.etMm || 0)));
  const W = 360;
  const H = 150;
  const step = W / 12;
  const y = (v) => H - 18 - (v / top) * (H - 34);
  const etPath = months
    .map((m, i) => (m.etMm == null ? null : `${i === 0 ? "M" : "L"}${(i * step + step / 2).toFixed(1)},${y(m.etMm).toFixed(1)}`))
    .filter(Boolean)
    .join(" ");
  const wet = months.filter((m) => m.balanceMm != null && m.balanceMm >= 0).map((m) => monthName(m.month));
  const dry = months.filter((m) => m.balanceMm != null && m.balanceMm < 0).map((m) => monthName(m.month));

  // vegetation sparkline
  const series = veg ? veg.series : [];
  const sw = 220;
  const sh = 56;
  const sx = (i) => (series.length < 2 ? sw / 2 : 8 + (i * (sw - 16)) / (series.length - 1));
  const sy = (v) => sh - 8 - Math.min(1, Math.max(0, v)) * (sh - 16);
  const sparkPath = series.map((r, i) => `${i === 0 ? "M" : "L"}${sx(i).toFixed(1)},${sy(r.value).toFixed(1)}`).join(" ");

  // water balance by month: blue above the line = more rain than the sun dries up, gold below = short of water
  const maxBal = Math.max(40, ...months.map((m) => Math.abs(m.balanceMm || 0)));
  const BH = 150;
  const mid = BH * 0.62;
  const barH = (v) => (Math.abs(v) / maxBal) * (v >= 0 ? mid - 6 : BH - mid - 6);

  // vegetation line with month labels
  const vw = 340;
  const vh = 90;
  const vx = (i) => (series.length < 2 ? vw / 2 : 10 + (i * (vw - 20)) / (series.length - 1));
  const vy = (v) => vh - 14 - Math.min(1, Math.max(0, v)) * (vh - 28);
  const vPath = series.map((r, i) => `${i === 0 ? "M" : "L"}${vx(i).toFixed(1)},${vy(r.value).toFixed(1)}`).join(" ");

  const slope = terrain ? terrain.slopePct : null;
  const shapeNote = slope == null ? null : slope < 2 ? t.orbEnFlat : slope < 6 ? t.orbEnGentle : t.orbEnSloping;
  const airNow = climate && months[thisMonth] && months[thisMonth].tmean != null ? months[thisMonth].tmean : null;
  const wetTiles = satellite ? [
    satellite.soilRoot && [`${num(satellite.soilRoot.volumetric * 100)}%`, t.soilRoot],
    satellite.soilSurface && [`${num(satellite.soilSurface.volumetric * 100)}%`, t.soilSurface],
    satellite.rainNow && satellite.rainNow.rateMmHr != null && [num(satellite.rainNow.rateMmHr, 1), t.orbEnRainUnit],
  ].filter(Boolean) : [];

  return (
    <div className="viewer env env2">
      <h2 className="sr-only">{t.envTitle}</h2>
      <div className="env2-head">
        <h3>{t.orbEnTitle}</h3>
        <p>{t.envIntro}</p>
      </div>

      <ErrorBoundary title={t.pageNeedsNet} retry={t.envRetry}>
        <Suspense fallback={<p className="muted small">{t.nmLoading}</p>}>
          <NasaMap t={t} lang={lang} lat={lat} lon={lon} />
        </Suspense>
      </ErrorBoundary>

      <div className="env2-trio">
        <section className="env2-card">
          <h3>{t.orbEnGreen}</h3>
          {veg ? (
            <>
              <p className="env2-big green">{num(veg.latest.value, 2)} <small>{vegClass(veg.latest.value)}</small></p>
              <svg className="env2-spark" viewBox={`0 0 ${vw} ${vh}`} role="img" aria-label={t.vegTrend}>
                {veg.usual != null && <line x1="6" x2={vw - 6} y1={vy(veg.usual)} y2={vy(veg.usual)} stroke="currentColor" strokeOpacity="0.4" strokeDasharray="4 4" />}
                <path d={vPath} fill="none" stroke="#7bd98a" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
                {series.map((r, i) => <circle key={`${r.year}-${r.month}`} cx={vx(i)} cy={vy(r.value)} r="3.5" fill="#7bd98a" />)}
                {series.length > 1 && [0, series.length - 1].map((i) => <text key={i} x={vx(i)} y={vh - 1} fontSize="10" fill="currentColor" opacity="0.7" textAnchor={i === 0 ? "start" : "end"}>{monthName(series[i].month)}</text>)}
              </svg>
              <p>{t.vegAsOf}: {monthYear(veg.latest)}. {compare && <>{compare} ({t.vegUsualBase}: {num(veg.usual, 2)}).</>}</p>
              <p className="small muted">{t.vegExplain}</p>
              {sourceLine(prov.vegetation)}
            </>
          ) : <p className="muted">{t.envNoData}</p>}
        </section>

        <section className="env2-card">
          <h3>{t.orbEnWarm}</h3>
          {data.landTemp ? (
            <>
              <div className="env2-tiles two">
                <div className="env2-tile warm"><strong>{num(data.landTemp.celsius, 0)}°</strong><span>{t.tempDay}</span></div>
                {airNow != null && <div className="env2-tile cool"><strong>{num(airNow, 0)}°</strong><span>{fill(t.orbEnAir, { m: monthName(thisMonth, "long") })}</span></div>}
              </div>
              <p>{day.format(new Date(data.landTemp.date))}</p>
              <p className="small muted">{t.tempExplain}</p>
              {sourceLine(prov.landTemp)}
            </>
          ) : <p className="muted">{t.envNoData}</p>}
        </section>

        <section className="env2-card">
          <h3>{t.soilTitle}</h3>
          {wetTiles.length ? (
            <div className={`env2-tiles n${wetTiles.length}`}>
              {wetTiles.map(([big, label], i) => <div key={label} className={`env2-tile ${i === 2 ? "cool" : "wet"}`}><strong>{big}</strong><span>{label}</span></div>)}
            </div>
          ) : <p className="muted">{t.soilNoSat}</p>}
          <p className="small muted">{t.soilExplain}</p>
          {satellite && satellite.provenance && sourceLine(satellite.provenance.soil)}
        </section>
      </div>

      <div className="env2-two">
        <section className="env2-card">
          <h3>{t.terrainTitle}</h3>
          {terrain ? (
            <>
              <div className="env2-shape" role="img" aria-label={`${num(terrain.elevationM)} m`}>
                <span style={{ top: `${Math.max(20, 50 - Math.min(30, terrain.slopePct * 4))}%` }}><b>{t.orbSpYourFarm}, {num(terrain.elevationM)} m</b></span>
              </div>
              <p><strong>{fill(t.orbEnAbove, { e: num(terrain.elevationM), s: num(terrain.slopePct, 1) })}</strong> {shapeNote}</p>
            </>
          ) : <p className="muted">{t.terrainNone}</p>}
          <p className="env-source small">{t.sourceLabel}: Open-Meteo elevation (Copernicus DEM)</p>
        </section>

        <section className="env2-card">
          <h3>{t.orbEnRainSun}</h3>
          {climate ? (
            <>
              <svg className="env2-bal" viewBox={`0 0 360 ${BH + 18}`} role="img" aria-label={t.waterTitle}>
                {months.map((m, i) => {
                  const v = m.balanceMm || 0;
                  const x = i * 30 + 4;
                  return (
                    <g key={m.month}>
                      {i === thisMonth && <rect x={i * 30} y="0" width="30" height={BH} fill="currentColor" opacity="0.07" />}
                      <rect x={x} y={v >= 0 ? mid - barH(v) : mid} width="22" height={Math.max(1, barH(v))} rx="3" fill={v >= 0 ? "#4d9bff" : "#f2c94c"}>
                        <title>{`${monthName(m.month)}: ${t.waterRain} ${num(m.rainMm || 0)} mm, ${t.waterEvap} ${num(m.etMm || 0)} mm`}</title>
                      </rect>
                      <text x={x + 11} y={BH + 12} textAnchor="middle" fontSize="9" fill="currentColor" opacity="0.7">{monthName(m.month).slice(0, 3)}</text>
                    </g>
                  );
                })}
              </svg>
              <p><b className="blue">{t.orbEnBlue}</b> {t.orbEnBlueMean} <b className="gold">{t.orbEnGold}</b> {t.orbEnGoldMean} {fill(t.orbEnShort, { n: num(dry.length) })}</p>
              <p className="small">{t.waterSurplus}: <strong>{wet.length ? wet.join(", ") : t.waterNone}</strong> · {t.waterDeficit}: <strong>{dry.length ? dry.join(", ") : t.waterNone}</strong></p>
              <p className="small muted">{t.waterExplain}</p>
              {sourceLine(prov.climate)}
            </>
          ) : <p className="muted">{t.envNoData}</p>}
        </section>
      </div>
    </div>
  );
}
