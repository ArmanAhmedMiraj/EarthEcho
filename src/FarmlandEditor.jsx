import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import { SAT_STYLE, FONT, PLOT_COLORS } from "./mapstyle.js";
import { areaSqm, inUnits, boundsOf, toGeoJSON, selfCrosses, newParcelId, plotLabel, MAX_PARCELS, MAX_POINTS } from "./geo.js";
import "./farmland.css";

maplibregl.setWorkerUrl(workerUrl);

const fill = (s, o) => String(s).replace(/\{(\w+)\}/g, (_, k) => (o[k] == null ? "" : o[k]));
const copy = (list) => list.map((p) => ({ id: p.id, name: p.name, points: p.points.map((q) => [...q]) }));

// Draw and edit the boundary of a farm's land on a satellite map. Several plots can be drawn; each has its own name and area.
export default function FarmlandEditor({ t, lang, field, initialId, hasData, onSave, onClose }) {
  const box = useRef(null);
  const map = useRef(null);
  const ready = useRef(false);
  const markers = useRef([]);
  const gpsMarker = useRef(null);
  const [parcels, setParcels] = useState(() => copy(field.parcels));
  const [activeId, setActiveId] = useState(() => (field.parcels.some((p) => p.id === initialId) ? initialId : field.parcels[0].id));
  const [selected, setSelected] = useState(-1); // the chosen point of the active plot
  const [history, setHistory] = useState([]);
  const [gps, setGps] = useState({ state: "idle" });
  const [dirty, setDirty] = useState(false);
  const live = useRef({});
  const locale = lang === "bn" ? "bn-BD" : "en-GB";
  const n0 = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const n1 = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const n2 = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });

  const aid = activeId || parcels[0].id;
  const active = parcels.find((p) => p.id === aid) || parcels[0];
  live.current = { parcels, aid, selected };

  const change = useCallback((fn) => {
    setHistory((h) => [...h.slice(-30), copy(live.current.parcels)]);
    setParcels((cur) => fn(copy(cur)));
    setDirty(true);
  }, []);
  const undo = () => {
    setHistory((h) => {
      if (!h.length) return h;
      const prev = h[h.length - 1];
      setParcels(prev);
      setSelected(-1);
      return h.slice(0, -1);
    });
  };
  const editActive = (fn) => change((cur) => { const p = cur.find((x) => x.id === live.current.aid); if (p) fn(p); return cur; });

  const addPoint = (lngLat) => editActive((p) => {
    if (p.points.length >= MAX_POINTS) return;
    p.points.push([lngLat.lng, lngLat.lat]);
    setSelected(p.points.length - 1);
  });

  // ---- map
  useEffect(() => {
    const first = field.parcels.some((p) => p.points.length >= 3) ? field.parcels : null;
    const m = new maplibregl.Map({ container: box.current, style: SAT_STYLE, center: [field.lon, field.lat], zoom: 16, maxZoom: 20, maxPitch: 0, dragRotate: false });
    map.current = m;
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    m.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-left");
    m.on("load", () => {
      m.addSource("plots", { type: "geojson", data: toGeoJSON([], null) });
      m.addLayer({ id: "plots-fill", type: "fill", source: "plots", filter: ["==", ["geometry-type"], "Polygon"], paint: { "fill-color": "#ffd54f", "fill-opacity": ["case", ["==", ["get", "active"], 1], 0.38, 0.2] } });
      m.addLayer({ id: "plots-line", type: "line", source: "plots", paint: { "line-color": ["case", ["==", ["get", "active"], 1], "#ffeb3b", "#ffffff"], "line-width": ["case", ["==", ["get", "active"], 1], 3, 2] } });
      m.addLayer({ id: "plots-name", type: "symbol", source: "plots", filter: ["==", ["geometry-type"], "Polygon"], layout: { "text-field": ["get", "name"], "text-font": FONT, "text-size": 13 }, paint: { "text-color": "#fff", "text-halo-color": "#000", "text-halo-width": 1.5 } });
      ready.current = true;
      if (first) { const b = boundsOf(first); if (b) m.fitBounds(b, { padding: 70, maxZoom: 19, duration: 0 }); }
      draw();
    });
    m.on("click", (e) => addPoint(e.lngLat));
    return () => { markers.current.forEach((k) => k.remove()); if (gpsMarker.current) gpsMarker.current.remove(); m.remove(); map.current = null; ready.current = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // redraw the shapes and the point handles whenever the plots change
  function draw() {
    const m = map.current;
    if (!m || !ready.current) return;
    const { parcels: ps, aid: a, selected: sel } = live.current;
    const named = ps.map((p, i) => ({ ...p, name: `${plotLabel(p, i, t)} · ${n1.format(inUnits(areaSqm(p.points)).decimal)}` }));
    const src = m.getSource("plots");
    if (src) src.setData(toGeoJSON(named, a));
    markers.current.forEach((k) => k.remove());
    markers.current = [];
    const p = ps.find((x) => x.id === a);
    if (!p) return;
    const pts = p.points;
    // the "add a point between" handles
    if (pts.length >= 2) {
      const count = pts.length >= 3 ? pts.length : 1;
      for (let i = 0; i < count; i++) {
        const A = pts[i], B = pts[(i + 1) % pts.length];
        const el = document.createElement("button");
        el.type = "button"; el.className = "fl-mid"; el.title = t.flAddBetween; el.setAttribute("aria-label", t.flAddBetween);
        el.addEventListener("click", (ev) => {
          ev.stopPropagation();
          const at = i + 1;
          editActive((q) => { if (q.points.length < MAX_POINTS) q.points.splice(at, 0, [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2]); });
          setSelected(at);
        });
        markers.current.push(new maplibregl.Marker({ element: el }).setLngLat([(A[0] + B[0]) / 2, (A[1] + B[1]) / 2]).addTo(m));
      }
    }
    pts.forEach((pt, i) => {
      const el = document.createElement("button");
      el.type = "button"; el.className = `fl-pt${i === sel ? " on" : ""}`; el.textContent = String(i + 1);
      el.setAttribute("aria-label", fill(t.flPointN, { n: n0.format(i + 1) }));
      el.addEventListener("click", (ev) => { ev.stopPropagation(); setSelected(i); });
      const mk = new maplibregl.Marker({ element: el, draggable: true }).setLngLat(pt).addTo(m);
      mk.on("dragend", () => { const ll = mk.getLngLat(); setSelected(i); editActive((q) => { if (q.points[i]) q.points[i] = [ll.lng, ll.lat]; }); });
      markers.current.push(mk);
    });
  }
  useEffect(draw, [parcels, activeId, selected]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- phone location
  const locate = (thenAdd) => {
    if (!navigator.geolocation) { setGps({ state: "unsupported" }); return; }
    setGps({ state: "busy" });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        setGps({ state: "ok", accuracy, lat: latitude, lon: longitude });
        const m = map.current;
        if (m) {
          if (!gpsMarker.current) { const el = document.createElement("div"); el.className = "fl-me"; gpsMarker.current = new maplibregl.Marker({ element: el }).setLngLat([longitude, latitude]).addTo(m); }
          else gpsMarker.current.setLngLat([longitude, latitude]);
          if (!thenAdd) m.flyTo({ center: [longitude, latitude], zoom: 18, duration: 900 });
        }
        if (thenAdd) addPoint({ lng: longitude, lat: latitude });
      },
      (err) => setGps({ state: err && err.code === 1 ? "denied" : "failed" }),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  };

  // ---- plots
  const newPlot = () => {
    if (parcels.length >= MAX_PARCELS) return;
    const id = newParcelId();
    change((cur) => { cur.push({ id, name: "", points: [] }); return cur; });
    setActiveId(id); setSelected(-1);
  };
  const removePlot = () => {
    if (parcels.length === 1) { change((cur) => { cur[0].points = []; return cur; }); setSelected(-1); return; }
    if (hasData && hasData(aid) && !window.confirm(fill(t.plDeleteConfirm, { name: plotLabel(active, idx, t) }))) return;
    const rest = parcels.filter((p) => p.id !== aid);
    change(() => rest);
    setActiveId(rest[0].id); setSelected(-1);
  };
  const removePoint = () => { if (selected < 0) return; editActive((p) => { p.points.splice(live.current.selected, 1); }); setSelected(-1); };
  const clearPlot = () => { editActive((p) => { p.points = []; }); setSelected(-1); };
  const zoomPlot = () => { const b = boundsOf([active]); if (b && map.current) map.current.fitBounds(b, { padding: 70, maxZoom: 19 }); };

  const save = () => {
    if (parcels.some((p) => p.points.length > 0 && p.points.length < 3) && !window.confirm(t.flFewPoints)) return;
    onSave(parcels.map((p) => ({ id: p.id, name: p.name.trim(), points: p.points.length >= 3 ? p.points.map(([x, y]) => [Math.round(x * 1e6) / 1e6, Math.round(y * 1e6) / 1e6]) : [] })));
  };
  const close = () => { if (dirty && !window.confirm(t.flDiscard)) return; onClose(); };
  useEffect(() => {
    const k = (e) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  });

  const sq = areaSqm(active.points);
  const u = inUnits(sq);
  const total = parcels.reduce((s, p) => s + areaSqm(p.points), 0);
  const crossed = selfCrosses(active.points);
  const anyCross = parcels.some((p) => selfCrosses(p.points));
  const idx = parcels.findIndex((p) => p.id === aid);
  const helpKey = active.points.length === 0 ? "flHelp0" : active.points.length < 3 ? "flHelp1" : "flHelp3";
  const gpsText = {
    busy: t.flGpsBusy, denied: t.flGpsDenied, failed: t.flGpsFailed, unsupported: t.flGpsNo,
    ok: gps.accuracy != null ? fill(t.flGpsOk, { m: n0.format(gps.accuracy) }) : "",
  }[gps.state];

  return createPortal(
    <div className="fl-overlay" role="dialog" aria-modal="true" aria-label={t.flTitle}>
      <div className="fl-shell">
        <header className="fl-head">
          <div><h2>{t.flTitle}</h2><span className="small muted">{field.name}</span></div>
          <button className="fl-x" onClick={close} aria-label={t.flCancel}>✕</button>
        </header>
        <div className="fl-body">
          <div className="fl-side">
            <div className="fl-box">
              <b>{t.flA}</b>
              <p className="small">{t.flGpsAdvice}</p>
              <div className="fl-row">
                <button className="btn" onClick={() => locate(false)} disabled={gps.state === "busy"}>📍 {t.flUseLocation}</button>
                {gps.state === "ok" && <button className="tab" onClick={() => locate(true)}>＋ {t.flAddHere}</button>}
              </div>
              {gpsText && <p className={`small ${gps.state === "ok" ? "" : "warn"}`} role="status">{gpsText}</p>}
            </div>
            <div className="fl-box">
              <b>{t.flB}</b>
              <p className="small">{t[helpKey]}</p>
            </div>

            <div className="fl-plots" role="tablist" aria-label={t.flPlots}>
              {parcels.map((p, i) => (
                <button key={p.id} role="tab" aria-selected={p.id === aid} className={`fl-chip${p.id === aid ? " on" : ""}`} style={{ borderColor: PLOT_COLORS[i % PLOT_COLORS.length] }} onClick={() => { setActiveId(p.id); setSelected(-1); }}>
                  {plotLabel(p, i, t)}
                </button>
              ))}
              {parcels.length < MAX_PARCELS && <button className="fl-chip add" onClick={newPlot}>＋ {t.flAddPlot}</button>}
            </div>
            <label className="fd-field">
              <span>{t.flPlotName}</span>
              <input value={active.name} maxLength={60} placeholder={fill(t.flPlotN, { n: n0.format(idx + 1) })} onChange={(e) => editActive((p) => { p.name = e.target.value; })} />
            </label>

            <div className="fl-area" aria-live="polite">
              {active.points.length >= 3 && !crossed ? (
                <>
                  <b>{n1.format(u.decimal)} {t.flDecimal}</b>
                  <span className="small muted">{n2.format(u.acre)} {t.flAcre} · {n2.format(u.hectare)} ha · {n0.format(u.sqm)} m² · ≈ {n1.format(u.bigha)} {t.flBigha}</span>
                </>
              ) : <span className="small muted">{crossed ? "" : t.flAreaNeed}</span>}
              {crossed && <span className="small warn">{t.flCrossed}</span>}
              {parcels.length > 1 && total > 0 && <span className="small">{t.flTotal}: <b>{n1.format(inUnits(total).decimal)} {t.flDecimal}</b></span>}
              <span className="small muted">{fill(t.flPointsCount, { n: n0.format(active.points.length) })}</span>
            </div>

            <div className="fl-tools">
              <button className="tab" onClick={undo} disabled={!history.length}>↶ {t.flUndo}</button>
              <button className="tab" onClick={removePoint} disabled={selected < 0}>− {t.flRemovePoint}</button>
              <button className="tab" onClick={clearPlot} disabled={!active.points.length}>{t.flClear}</button>
              <button className="tab" onClick={zoomPlot} disabled={active.points.length < 1}>⌖ {t.flZoomPlot}</button>
              <button className="tab danger" onClick={removePlot}>{t.flDeletePlot}</button>
            </div>
            <p className="small muted">{t.flEditHint}</p>
          </div>
          <div className="fl-mapwrap">
            <div ref={box} className="fl-map" />
            {/* always says what to do next, on the map itself */}
            <p className={`fl-guide${crossed ? " bad" : active.points.length >= 3 ? " ok" : ""}`} role="status">
              {crossed ? t.flGuideCross : active.points.length === 0 ? t.flGuide0 : active.points.length < 3 ? fill(t.flGuideFew, { n: n0.format(active.points.length) }) : fill(t.flGuideDone, { n: n0.format(active.points.length) })}
            </p>
          </div>
        </div>
        <footer className="fl-foot">
          <button className="tab" onClick={close}>{t.flCancel}</button>
          <button className="btn" onClick={save} disabled={anyCross}>{t.flSave}</button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
