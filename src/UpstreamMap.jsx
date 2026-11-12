import { useEffect, useMemo, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import Info from "./Info.jsx";

maplibregl.setWorkerUrl(workerUrl);

const fill = (text, values) => Object.keys(values).reduce((s, k) => s.split(`{${k}}`).join(values[k]), text);
const GIBS = "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best";
const dayBack = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
const COLOR = { calm: "#2e9d6b", watch: "#e0a020", alert: "#d0392b" };

// The river, the places we watch and, on request, NASA's satellite rain or flood-water layers.
export default function UpstreamMap({ t, lat, lon, river, lines, stations, order }) {
  const box = useRef(null), map = useRef(null), marks = useRef([]);
  const [layer, setLayer] = useState("none");
  const rainDate = useMemo(() => dayBack(2), []);

  const bounds = useMemo(() => {
    const pts = [[lon, lat], ...stations.map((s) => [s.lon, s.lat]), ...river.line.map(([a, b]) => [b, a])];
    const b = new maplibregl.LngLatBounds(pts[0], pts[0]);
    pts.forEach((p) => b.extend(p));
    return b;
  }, [lat, lon, stations, river]);

  const chain = useMemo(() => {
    const byId = Object.fromEntries(stations.map((s) => [s.id, s]));
    const pts = order.map((id) => byId[id]).filter(Boolean).map((s) => [s.lon, s.lat]);
    return [...pts, [river.reach.lon, river.reach.lat]];
  }, [stations, order, river]);

  useEffect(() => {
    if (!box.current) return undefined;
    const m = new maplibregl.Map({
      container: box.current,
      style: {
        version: 8,
        sources: {
          base: { type: "raster", tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"], tileSize: 256, maxzoom: 17, attribution: "Imagery © Esri, Maxar, Earthstar Geographics | NASA GIBS" },
        },
        layers: [{ id: "base", type: "raster", source: "base" }],
      },
      bounds, fitBoundsOptions: { padding: 36, maxZoom: 8 }, attributionControl: { compact: true }, cooperativeGestures: true,
    });
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.current = m;
    m.on("load", () => {
      const feat = (coords, props = {}) => ({ type: "Feature", properties: props, geometry: { type: "LineString", coordinates: coords } });
      m.addSource("rivers", { type: "geojson", data: { type: "FeatureCollection", features: Object.entries(lines).map(([id, pts]) => feat(pts.map(([a, b]) => [b, a]), { me: id === river.id ? 1 : 0 })) } });
      m.addLayer({ id: "rivers", type: "line", source: "rivers", paint: { "line-color": ["case", ["==", ["get", "me"], 1], "#4fc3f7", "#7fa8c9"], "line-width": ["case", ["==", ["get", "me"], 1], 5, 2.5], "line-opacity": 0.95 } });
      m.addSource("path", { type: "geojson", data: { type: "FeatureCollection", features: [feat(chain)] } });
      m.addLayer({ id: "path", type: "line", source: "path", paint: { "line-color": "#ffffff", "line-width": 2.5, "line-dasharray": [2, 2], "line-opacity": 0.9 } });
    });
    return () => { marks.current.forEach((k) => k.remove()); marks.current = []; m.remove(); map.current = null; };
  }, [bounds, lines, river, chain]);

  // dots: the places we watch, and you
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    marks.current.forEach((k) => k.remove());
    marks.current = [];
    const add = (lng, la, el) => marks.current.push(new maplibregl.Marker({ element: el }).setLngLat([lng, la]).addTo(m));
    stations.forEach((s) => {
      const el = document.createElement("div");
      el.className = "um-dot";
      el.style.background = COLOR[s.level] || COLOR.calm;
      el.title = t[`stName_${s.id}`];
      el.innerHTML = `<span>${t[`stName_${s.id}`]}</span>`;
      add(s.lon, s.lat, el);
    });
    const you = document.createElement("div");
    you.className = "um-you";
    you.innerHTML = `<span>${t.urMapYou}</span>`;
    add(lon, lat, you);
  }, [stations, lat, lon, t]);

  // NASA layers
  useEffect(() => {
    const m = map.current;
    if (!m) return undefined;
    const apply = () => {
      ["nasa"].forEach((id) => { if (m.getLayer(id)) m.removeLayer(id); if (m.getSource(id)) m.removeSource(id); });
      if (layer === "none") return;
      const url = layer === "rain"
        ? `${GIBS}/IMERG_Precipitation_Rate/default/${rainDate}/GoogleMapsCompatible_Level6/{z}/{y}/{x}.png`
        : `${GIBS}/MODIS_Combined_Flood_2-Day/default/${dayBack(0)}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.png`;
      m.addSource("nasa", { type: "raster", tiles: [url], tileSize: 256, maxzoom: layer === "rain" ? 6 : 9 });
      m.addLayer({ id: "nasa", type: "raster", source: "nasa", paint: { "raster-opacity": layer === "rain" ? 0.7 : 0.9 } }, m.getLayer("rivers") ? "rivers" : undefined);
    };
    if (m.isStyleLoaded()) apply(); else m.once("load", apply);
    return undefined;
  }, [layer, rainDate, bounds]);

  return (
    <div className="um-wrap">
      <h4 className="wf-sub">{t.urMapTitle}
        <Info t={t} source="NASA GIBS">
          <b>{t.urNasaInfoTitle}</b>
          <span>{t.urNasaRain}</span>
          <span>{t.urNasaFlood}</span>
          <span>{t.urNasaBase}</span>
        </Info>
      </h4>
      <div className="um-layers" role="group" aria-label={t.urMapTitle}>
        {["none", "rain", "flood"].map((k) => (
          <button key={k} type="button" className={`tab ${layer === k ? "on" : ""}`} aria-pressed={layer === k} onClick={() => setLayer(k)}>
            {t[k === "none" ? "urLayerNone" : k === "rain" ? "urLayerRain" : "urLayerFlood"]}
          </button>
        ))}
      </div>
      <div className="um-map" ref={box} />
      <p className="small muted">{layer === "rain" ? fill(t.urRainLegend, { date: rainDate }) : layer === "flood" ? t.urFloodLegend : t.urMapCap}</p>
    </div>
  );
}
