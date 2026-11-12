import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import { SAT_STYLE, FONT, PLOT_COLORS } from "./mapstyle.js";
import { boundsOf, surroundingsMask, areaSqm, inUnits } from "./geo.js";
import "./farmland.css";

maplibregl.setWorkerUrl(workerUrl);

// The Overview map: opens on the saved farmland, tints each plot, dims the surroundings; zoom and pan stay free.
export default function FarmMap({ t, lang, field, focusId, onEdit }) {
  const box = useRef(null);
  const map = useRef(null);
  const ready = useRef(false);
  const pin = useRef(null);
  const parcels = field.parcels || [];
  const n1 = new Intl.NumberFormat(lang === "bn" ? "bn-BD" : "en-GB", { maximumFractionDigits: 1 });

  const fit = (list, instant) => {
    const m = map.current;
    if (!m) return;
    const b = boundsOf(list);
    if (b) m.fitBounds(b, { padding: 50, maxZoom: 18, duration: instant ? 0 : 700 });
    else m.jumpTo({ center: [field.lon, field.lat], zoom: 15 });
  };

  useEffect(() => {
    const m = new maplibregl.Map({ container: box.current, style: SAT_STYLE, center: [field.lon, field.lat], zoom: 15, maxZoom: 20, maxPitch: 0, dragRotate: false });
    map.current = m;
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    m.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-left");
    m.on("load", () => {
      m.addSource("mask", { type: "geojson", data: surroundingsMask([]) });
      m.addSource("plots", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      m.addLayer({ id: "mask", type: "fill", source: "mask", paint: { "fill-color": "#04120c", "fill-opacity": 0.45 } });
      m.addLayer({ id: "plots-fill", type: "fill", source: "plots", paint: { "fill-color": ["get", "color"], "fill-opacity": 0.28 } });
      m.addLayer({ id: "plots-line", type: "line", source: "plots", paint: { "line-color": ["get", "color"], "line-width": 3 } });
      m.addLayer({ id: "plots-name", type: "symbol", source: "plots", layout: { "text-field": ["get", "label"], "text-font": FONT, "text-size": 13 }, paint: { "text-color": "#fff", "text-halo-color": "#000", "text-halo-width": 1.5 } });
      ready.current = true;
      paint();
      fit(parcels, true);
    });
    return () => { m.remove(); map.current = null; ready.current = false; };
  }, [field.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function paint() {
    const m = map.current;
    if (!m || !ready.current) return;
    const ok = parcels.filter((p) => p.points.length >= 3);
    m.getSource("mask").setData(surroundingsMask(ok));
    m.getSource("plots").setData({
      type: "FeatureCollection",
      features: ok.map((p, i) => ({
        type: "Feature",
        properties: { color: PLOT_COLORS[i % PLOT_COLORS.length], label: `${p.name} · ${n1.format(inUnits(areaSqm(p.points)).decimal)}` },
        geometry: { type: "Polygon", coordinates: [[...p.points, p.points[0]]] },
      })),
    });
    if (pin.current) { pin.current.remove(); pin.current = null; }
    if (!ok.length) pin.current = new maplibregl.Marker({ color: "#e53935" }).setLngLat([field.lon, field.lat]).addTo(m);
  }
  const sig = JSON.stringify(parcels);
  useEffect(() => { paint(); fit(parcels, false); }, [sig]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!focusId) return;
    const p = parcels.find((x) => x.id === String(focusId).split(":")[0]);
    if (p) fit([p], false);
  }, [focusId]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="fl-ovmap">
      <div ref={box} className="fl-map" role="img" aria-label={t.flMapLabel} />
      <div className="fl-ovbar">
        <button className="btn" onClick={onEdit}>{parcels.length ? `✎ ${t.flEditBoundary}` : `🗺 ${t.flSelectFarmland}`}</button>
        <button className="tab" onClick={() => fit(parcels, false)}>⌖ {t.flRecenter}</button>
      </div>
    </div>
  );
}
