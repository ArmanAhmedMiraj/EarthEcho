import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";

maplibregl.setWorkerUrl(workerUrl);

const fill = (text, values) => Object.keys(values).reduce((s, k) => s.split(`{${k}}`).join(values[k]), text);
const GIBS = "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best";
const STYLE = {
  version: 8,
  sources: { base: { type: "raster", tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"], tileSize: 256, maxzoom: 18, attribution: "Imagery © Esri, Maxar, Earthstar Geographics | NASA GIBS" } },
  layers: [{ id: "base", type: "raster", source: "base" }],
};

const tileUrl = (l, date) => `${GIBS}/${l.layer}/default/${date}/${l.set}/{z}/{y}/{x}.png`;

// the tile that holds a point, and the pixel inside it (web-map tiles, 256 pixels wide)
function tileOf(lat, lon, z) {
  const n = 2 ** z;
  const x = ((lon + 180) / 360) * n;
  const rad = (lat * Math.PI) / 180;
  const y = ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n;
  return { x: Math.floor(x), y: Math.floor(y), px: Math.min(255, Math.floor((x % 1) * 256)), py: Math.min(255, Math.floor((y % 1) * 256)) };
}

const tileCache = new Map(); // url -> Promise<ImageBitmap|null>, so the slider never asks twice
function loadTile(url) {
  if (!tileCache.has(url)) {
    tileCache.set(url, fetch(url, { mode: "cors" }).then((r) => (r.ok ? r.blob() : null)).then((b) => (b ? createImageBitmap(b) : null)).catch(() => null));
  }
  return tileCache.get(url);
}

// Value at the field: read the colour of one pixel and look it up in NASA's colour table.
async function readValue(layer, lut, date, lat, lon) {
  const z = layer.maxZ;
  const { x, y, px, py } = tileOf(lat, lon, z);
  const url = `${GIBS}/${layer.layer}/default/${date}/${layer.set}/${z}/${y}/${x}.png`;
  const bmp = await loadTile(url);
  if (!bmp) return null;
  const cv = document.createElement("canvas");
  cv.width = 1; cv.height = 1;
  const ctx = cv.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(bmp, px, py, 1, 1, 0, 0, 1, 1);
  const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
  if (a < 200) return null;
  const v = lut.get(`${r},${g},${b}`);
  return v == null ? null : v;
}

function Line({ dates, values, now, unit, nf }) {
  const w = 300, h = 70, pad = 6;
  const ok = values.map((v, i) => (v == null ? null : { v, i })).filter(Boolean);
  if (ok.length < 2) return null;
  const min = Math.min(...ok.map((p) => p.v)), max = Math.max(...ok.map((p) => p.v)), span = max - min || 1;
  const x = (i) => pad + (i / (dates.length - 1)) * (w - 2 * pad);
  const y = (v) => h - pad - ((v - min) / span) * (h - 2 * pad);
  const d = ok.map((p, k) => `${k ? "L" : "M"}${x(p.i).toFixed(1)} ${y(p.v).toFixed(1)}`).join(" ");
  const cur = values[now];
  return (
    <svg className="nm-line" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`${nf.format(min)}–${nf.format(max)} ${unit}`}>
      <path d={d} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      {cur != null && <circle cx={x(now)} cy={y(cur)} r="4.5" fill="var(--accent)" stroke="#fff" strokeWidth="1.5" />}
    </svg>
  );
}

export default function NasaMap({ t, lang, lat, lon }) {
  const [info, setInfo] = useState(null);
  const [state, setState] = useState("loading");
  const [attempt, setAttempt] = useState(0);
  const [layerId, setLayerId] = useState("ndvi");
  const [idx, setIdx] = useState(null);
  const [opacity, setOpacity] = useState(0.8);
  const [playing, setPlaying] = useState(false);
  const [value, setValue] = useState({ state: "idle" });
  const [series, setSeries] = useState(null); // { id, values } for the chosen layer
  const [seriesBusy, setSeriesBusy] = useState(false);
  const box = useRef(null);
  const map = useRef(null);
  const ready = useRef(false);

  const locale = lang === "bn" ? "bn-BD" : "en-GB";
  const nf = useMemo(() => new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }), [locale]);
  const dateFmt = useMemo(() => new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }), [locale]);
  const showDate = (iso) => dateFmt.format(new Date(`${iso}T00:00:00Z`));

  useEffect(() => {
    let cancelled = false;
    setState("loading");
    fetch("/api/layers")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => { if (cancelled) return; if (d.ok) { setInfo(d); setState("ok"); } else setState("error"); })
      .catch(() => { if (!cancelled) setState("error"); });
    return () => { cancelled = true; };
  }, [attempt]);

  const layer = info ? info.layers.find((l) => l.id === layerId) || info.layers[0] : null;
  const lutMap = useMemo(() => (layer ? new Map(layer.lut.map((r) => [`${r[0]},${r[1]},${r[2]}`, r[3]])) : null), [layer]);
  const date = layer && idx != null ? layer.dates[Math.min(idx, layer.dates.length - 1)] : null;

  // start each layer at its newest date
  useEffect(() => { if (layer) setIdx(layer.dates.length - 1); setSeries(null); setPlaying(false); }, [layer && layer.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // the map, made once
  useEffect(() => {
    if (state !== "ok" || !box.current) return undefined;
    const m = new maplibregl.Map({ container: box.current, style: STYLE, center: [lon, lat], zoom: 6, maxPitch: 0, attributionControl: { compact: true } });
    map.current = m;
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    new maplibregl.Marker({ color: "#e53935", scale: 0.8 }).setLngLat([lon, lat]).addTo(m);
    m.on("load", () => { ready.current = true; m.fire("nm-ready"); });
    return () => { ready.current = false; m.remove(); map.current = null; };
  }, [state, lat, lon]);

  // show the chosen layer and date
  const apply = useCallback(() => {
    const m = map.current;
    if (!m || !layer || !date) return;
    if (m.getLayer("nasa")) m.removeLayer("nasa");
    if (m.getSource("nasa")) m.removeSource("nasa");
    m.addSource("nasa", { type: "raster", tiles: [tileUrl(layer, date)], tileSize: 256, maxzoom: layer.maxZ, attribution: "NASA GIBS" });
    m.addLayer({ id: "nasa", type: "raster", source: "nasa", paint: { "raster-opacity": opacity, "raster-fade-duration": 0 } });
  }, [layer, date, opacity]);
  useEffect(() => {
    const m = map.current;
    if (!m) return undefined;
    if (ready.current) { apply(); return undefined; }
    m.once("nm-ready", apply);
    return () => m.off("nm-ready", apply);
  }, [apply, state]);

  // value at the field for the chosen date
  useEffect(() => {
    if (!layer || !date || !lutMap) return undefined;
    let cancelled = false;
    setValue({ state: "loading" });
    readValue(layer, lutMap, date, lat, lon).then((v) => { if (!cancelled) setValue(v == null ? { state: "none" } : { state: "ok", v }); }).catch(() => { if (!cancelled) setValue({ state: "none" }); });
    return () => { cancelled = true; };
  }, [layer, date, lutMap, lat, lon]);

  // play button: step through the dates
  useEffect(() => {
    if (!playing || !layer) return undefined;
    const timer = setInterval(() => setIdx((i) => (i == null || i >= layer.dates.length - 1 ? 0 : i + 1)), 1400);
    return () => clearInterval(timer);
  }, [playing, layer]);

  const loadSeries = async () => {
    if (!layer || !lutMap) return;
    setSeriesBusy(true);
    const values = new Array(layer.dates.length).fill(null);
    let next = 0;
    const worker = async () => {
      while (next < layer.dates.length) {
        const i = next; next += 1;
        try { values[i] = await readValue(layer, lutMap, layer.dates[i], lat, lon); } catch { values[i] = null; }
      }
    };
    await Promise.all(Array.from({ length: 6 }, worker));
    setSeries({ id: layer.id, values });
    setSeriesBusy(false);
  };

  if (state === "loading") return <section className="nm-wrap"><h3>{t.nmTitle}</h3><p className="muted small">{t.nmLoading}</p></section>;
  if (state === "error" || !layer) {
    return (
      <section className="nm-wrap">
        <h3>{t.nmTitle}</h3>
        <p className="warn small">{t.nmFailed}</p>
        <button className="tab" onClick={() => setAttempt((n) => n + 1)}>{t.envRetry}</button>
      </section>
    );
  }

  // legend: the colour steps inside the range worth showing
  const [lo, hi] = layer.show;
  const steps = layer.lut.filter((r) => r[3] >= lo && r[3] <= hi).sort((a, b) => a[3] - b[3]);
  const pick = steps.length > 12 ? Array.from({ length: 12 }, (_, k) => steps[Math.round((k * (steps.length - 1)) / 11)]) : steps;
  const gradient = `linear-gradient(to right, ${pick.map((r) => `rgb(${r[0]},${r[1]},${r[2]})`).join(", ")})`;
  const unitLabel = t[`nmUnit_${layer.id}`];
  const here = value.state === "ok" ? `${nf.format(value.v)} ${unitLabel}` : null;
  const seriesNow = series && series.id === layer.id ? series.values : null;

  return (
    <section className="nm-wrap" aria-labelledby="nm-title">
      <h3 id="nm-title">{t.nmTitle}</h3>
      <p className="muted small">{t.nmIntro}</p>

      <div className="nm-layers" role="radiogroup" aria-label={t.nmChoose}>
        {info.layers.map((l) => (
          <button key={l.id} type="button" role="radio" aria-checked={l.id === layer.id} className={`nm-chip${l.id === layer.id ? " on" : ""}`} onClick={() => setLayerId(l.id)}>{t[`nmLayer_${l.id}`]}</button>
        ))}
      </div>
      <p className="small">{t[`nmAbout_${layer.id}`]}</p>

      <div className="nm-map" ref={box} role="application" aria-label={t.nmMapLabel} />

      <div className="nm-legend" aria-label={t.nmLegend}>
        <span>{nf.format(lo)}</span>
        <i style={{ background: gradient }} />
        <span>{nf.format(hi)} {unitLabel}</span>
      </div>

      <div className="nm-slider">
        <button type="button" className="tab" onClick={() => setPlaying((p) => !p)} aria-pressed={playing}>{playing ? t.nmPause : t.nmPlay}</button>
        <input type="range" min="0" max={layer.dates.length - 1} value={idx == null ? 0 : idx} onChange={(e) => { setPlaying(false); setIdx(Number(e.target.value)); }}
          aria-label={t.nmDate} aria-valuetext={date ? showDate(date) : ""} />
        <strong className="nm-date">{date ? showDate(date) : ""}</strong>
      </div>
      <label className="nm-opacity">{t.nmOpacity}
        <input type="range" min="0.2" max="1" step="0.1" value={opacity} onChange={(e) => setOpacity(Number(e.target.value))} />
      </label>

      <div className="nm-read" aria-live="polite">
        <strong>{t.nmAtField}:</strong>{" "}
        {value.state === "loading" && <span className="muted">…</span>}
        {value.state === "ok" && <span>{here} <span className="muted small">({showDate(date)})</span></span>}
        {value.state === "none" && <span className="muted">{t.nmNone}</span>}
        <div>
          {!seriesNow && <button type="button" className="tab" onClick={loadSeries} disabled={seriesBusy}>{seriesBusy ? t.nmSeriesBusy : fill(t.nmSeries, { n: nf.format(layer.dates.length) })}</button>}
          {seriesNow && <Line dates={layer.dates} values={seriesNow} now={idx == null ? 0 : idx} unit={unitLabel} nf={nf} />}
          {seriesNow && <p className="muted small">{fill(t.nmSeriesNote, { a: showDate(layer.dates[0]), b: showDate(layer.dates[layer.dates.length - 1]) })}</p>}
        </div>
      </div>

      <p className="muted small">{t[`nmLimit_${layer.id}`]}</p>
      <p className="muted small">{t.nmCredit} <a href={info.source.url} target="_blank" rel="noreferrer">{info.source.name}</a>.</p>
    </section>
  );
}
