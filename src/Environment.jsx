import { useEffect, useState } from "react";
import "./environment.css";

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
        <h2>{t.envTitle}</h2>
        <p className="muted">{t.envLoading}</p>
      </div>
    );
  }
  if (state === "error" || !data) {
    return (
      <div className="viewer env">
        <h2>{t.envTitle}</h2>
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

  return (
    <div className="viewer env">
      <h2>{t.envTitle}</h2>
      <p className="muted">{t.envIntro}</p>

      <div className="env-grid">
        <section className="env-card">
          <h3>{t.vegTitle}</h3>
          {veg ? (
            <>
              <p className="env-big">
                {num(veg.latest.value, 2)} <small>{t.vegValue}</small>
              </p>
              <p className="env-sentence"><strong>{vegClass(veg.latest.value)}</strong> · {t.vegAsOf}: {monthYear(veg.latest)}</p>
              {compare && (
                <p className="env-sentence">
                  {compare} ({t.vegUsualBase}: {num(veg.usual, 2)})
                </p>
              )}
              <svg className="env-spark" viewBox={`0 0 ${sw} ${sh}`} role="img" aria-label={t.vegTrend}>
                <path d={sparkPath} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
                {series.map((r, i) => (
                  <circle key={`${r.year}-${r.month}`} cx={sx(i)} cy={sy(r.value)} r="3" fill="var(--accent)" />
                ))}
              </svg>
              <p className="small muted env-months">
                {t.vegTrend}: {series.map((r) => `${monthName(r.month)} ${num(r.value, 2)}`).join(" · ")}
              </p>
              <p className="small muted">{t.vegExplain}</p>
              {sourceLine(prov.vegetation)}
            </>
          ) : (
            <p className="muted">{t.envNoData}</p>
          )}
        </section>

        <section className="env-card">
          <h3>{t.tempTitle}</h3>
          {data.landTemp ? (
            <>
              <p className="env-big">
                {num(data.landTemp.celsius, 1)} °C <small>{t.tempDay}</small>
              </p>
              <p className="env-sentence">{day.format(new Date(data.landTemp.date))}</p>
              <p className="small muted">{t.tempExplain}</p>
              {sourceLine(prov.landTemp)}
            </>
          ) : (
            <p className="muted">{t.envNoData}</p>
          )}
        </section>

        <section className="env-card">
          <h3>{t.soilTitle}</h3>
          {satellite && (satellite.soilRoot || satellite.soilSurface || satellite.rainNow) ? (
            <ul className="env-list">
              {satellite.soilSurface && <li>{t.soilSurface}: <strong>{num(satellite.soilSurface.volumetric * 100)}%</strong></li>}
              {satellite.soilRoot && <li>{t.soilRoot}: <strong>{num(satellite.soilRoot.volumetric * 100)}%</strong></li>}
              {satellite.rainNow && satellite.rainNow.rateMmHr != null && (
                <li>{t.soilRain}: <strong>{num(satellite.rainNow.rateMmHr, 1)} mm/h</strong></li>
              )}
            </ul>
          ) : (
            <p className="muted">{t.soilNoSat}</p>
          )}
          <p className="small muted">{t.soilExplain}</p>
          {satellite && satellite.provenance && sourceLine(satellite.provenance.soil)}
        </section>

        <section className="env-card">
          <h3>{t.terrainTitle}</h3>
          {terrain ? (
            <ul className="env-list">
              <li>{t.terrainElev}: <strong>{num(terrain.elevationM)} m</strong></li>
              <li>{t.terrainSlope}: <strong>{num(terrain.slopePct, 1)}%</strong></li>
            </ul>
          ) : (
            <p className="muted">{t.terrainNone}</p>
          )}
          <p className="env-source small">{t.sourceLabel}: Open-Meteo elevation (Copernicus DEM)</p>
        </section>
      </div>

      <section className="env-card env-wide">
        <h3>{t.waterTitle}</h3>
        {climate ? (
          <>
            <svg className="env-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t.waterTitle}>
              {months.map((m, i) => (
                <g key={m.month}>
                  {i === thisMonth && <rect x={i * step} y="0" width={step} height={H - 18} fill="var(--accent)" opacity="0.12" />}
                  <rect
                    x={i * step + step * 0.2}
                    y={y(m.rainMm || 0)}
                    width={step * 0.6}
                    height={Math.max(0, H - 18 - y(m.rainMm || 0))}
                    rx="2"
                    fill="#3a8fd9"
                    opacity="0.85"
                  />
                  <text x={i * step + step / 2} y={H - 4} textAnchor="middle" fontSize="8" fill="var(--muted)">
                    {monthName(m.month).slice(0, 3)}
                  </text>
                </g>
              ))}
              <path d={etPath} fill="none" stroke="var(--clay)" strokeWidth="2.4" strokeLinejoin="round" />
            </svg>
            <p className="env-legend small">
              <span><i className="dot rain" /> {t.waterRain}</span>
              <span><i className="dot et" /> {t.waterEvap}</span>
              <span className="muted">{t.waterUnit} · {t.waterNow}: {monthName(thisMonth, "long")}</span>
            </p>
            <p className="env-sentence">{t.waterSurplus}: <strong>{wet.length ? wet.join(", ") : t.waterNone}</strong></p>
            <p className="env-sentence">{t.waterDeficit}: <strong>{dry.length ? dry.join(", ") : t.waterNone}</strong></p>
            <p className="small muted">{t.waterExplain}</p>
            {sourceLine(prov.climate)}
          </>
        ) : (
          <p className="muted">{t.envNoData}</p>
        )}
      </section>
    </div>
  );
}
