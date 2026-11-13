import { useCallback, useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import "./suppliers.css";
import "./suppliers2.css";
import { CATEGORIES, fetchSuppliers } from "./suppliers.js";
import { CATEGORY_COLORS } from "./i18nSuppliers.js";

const fill = (text, values) => Object.keys(values).reduce((s, k) => s.split(`{${k}}`).join(values[k]), text);
const STYLE = {
  version: 8,
  sources: { satellite: { type: "raster", tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"], tileSize: 256, maxzoom: 18, attribution: "Imagery © Esri, Maxar, Earthstar Geographics | Data © OpenStreetMap contributors" } },
  layers: [{ id: "satellite", type: "raster", source: "satellite" }],
};

const DIRS = ["n", "ne", "e", "se", "s", "sw", "w", "nw"];
const bearing = (lat1, lon1, lat2, lon2) => {
  const r = Math.PI / 180;
  const y = Math.sin((lon2 - lon1) * r) * Math.cos(lat2 * r);
  const x = Math.cos(lat1 * r) * Math.sin(lat2 * r) - Math.sin(lat1 * r) * Math.cos(lat2 * r) * Math.cos((lon2 - lon1) * r);
  return ((Math.atan2(y, x) / r) + 360) % 360;
};
const ring = (lat, lon, km) => {
  const pts = [];
  for (let a = 0; a <= 360; a += 5) {
    const th = (a * Math.PI) / 180;
    pts.push([lon + (km / (111.32 * Math.cos((lat * Math.PI) / 180))) * Math.sin(th), lat + (km / 110.57) * Math.cos(th)]);
  }
  return { type: "Feature", geometry: { type: "Polygon", coordinates: [pts] } };
};

export default function Suppliers({ t, lang, lat, lon }) {
  const [radius, setRadius] = useState(25);
  const [items, setItems] = useState(null);
  const [state, setState] = useState("loading");
  const [why, setWhy] = useState("");
  const [on, setOn] = useState(() => new Set(CATEGORIES));
  const [sel, setSel] = useState(null);
  const mapEl = useRef(null);
  const map = useRef(null);
  const markers = useRef([]);
  const radiusRef = useRef(25);
  const locale = lang === "bn" ? "bn-BD" : "en-GB";
  const num = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });

  const load = useCallback(() => {
    setState("loading");
    fetchSuppliers(lat, lon, radius).then((r) => { setItems(r); setState("ok"); }).catch((e) => { setWhy(e.message); setState("failed"); });
  }, [lat, lon, radius]);
  useEffect(load, [load]);

  // the map is made once
  useEffect(() => {
    if (!mapEl.current) return undefined;
    const m = new maplibregl.Map({ container: mapEl.current, style: STYLE, center: [lon, lat], zoom: 10, attributionControl: { compact: true } });
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    const here = document.createElement("div");
    here.className = "sp2-farm";
    here.title = t.spYou;
    here.innerHTML = `<i></i><b>${t.orbSpYourFarm}</b>`;
    new maplibregl.Marker({ element: here }).setLngLat([lon, lat]).addTo(m);
    const addRing = () => {
      if (!m.getSource("radius")) {
        m.addSource("radius", { type: "geojson", data: ring(lat, lon, radiusRef.current) });
        m.addLayer({ id: "radius-fill", type: "fill", source: "radius", paint: { "fill-color": "#3ddbc0", "fill-opacity": 0.07 } });
        m.addLayer({ id: "radius-line", type: "line", source: "radius", paint: { "line-color": "#7ff0dc", "line-width": 1.5, "line-dasharray": [3, 3] } });
      }
    };
    if (m.isStyleLoaded()) addRing(); else m.once("load", addRing);
    map.current = m;
    return () => { m.remove(); map.current = null; };
  }, [lat, lon, t.spYou, t.orbSpYourFarm]);

  useEffect(() => {
    radiusRef.current = radius;
    const m = map.current;
    if (m && m.getSource("radius")) m.getSource("radius").setData(ring(lat, lon, radius));
  }, [radius, lat, lon]);

  const shown = (items || []).filter((i) => on.has(i.category));

  // the dots follow the list
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    markers.current.forEach((x) => x.remove());
    markers.current = shown.map((i) => {
      const el = document.createElement("div");
      el.className = "sp2-dot";
      el.style.background = CATEGORY_COLORS[i.category];
      el.addEventListener("click", () => setSel(i.id));
      return new maplibregl.Marker({ element: el }).setLngLat([i.lon, i.lat]).addTo(m);
    });
    if (shown.length) {
      const b = new maplibregl.LngLatBounds([lon, lat], [lon, lat]);
      shown.slice(0, 40).forEach((i) => b.extend([i.lon, i.lat]));
      ring(lat, lon, radius).geometry.coordinates[0].forEach((p) => b.extend(p));
      m.fitBounds(b, { padding: 30, maxZoom: 13, duration: 0 });
    } else {
      const b = new maplibregl.LngLatBounds([lon, lat], [lon, lat]);
      ring(lat, lon, radius).geometry.coordinates[0].forEach((p) => b.extend(p));
      m.fitBounds(b, { padding: 30, duration: 0 });
    }
  }, [items, on, lat, lon]); // eslint-disable-line react-hooks/exhaustive-deps

  // the chosen place is drawn bigger
  useEffect(() => {
    markers.current.forEach((mk, idx) => mk.getElement().classList.toggle("on", !!shown[idx] && shown[idx].id === sel));
  }); // eslint-disable-line react-hooks/exhaustive-deps

  const focus = (i) => {
    setSel(i.id);
  };
  const labelOf = (i) => (lang === "bn" && i.nameBn) || i.name || fill(t.spUnnamed, { kind: t[`cat_${i.category}`].toLowerCase() });
  const picked = shown.find((i) => i.id === sel) || null;
  const dirOf = (i) => t.orbSpDirs[DIRS[Math.round(bearing(lat, lon, i.lat, i.lon) / 45) % 8]];
  const wayUrl = (i) => `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=${lat}%2C${lon}%3B${i.lat}%2C${i.lon}`;
  const toggle = (c) => setOn((prev) => { const n = new Set(prev); if (n.has(c)) n.delete(c); else n.add(c); return n; });
  const counts = CATEGORIES.reduce((o, c) => ({ ...o, [c]: (items || []).filter((i) => i.category === c).length }), {});

  const details = (i) => (
    <div className="sp2-det">
      {i.address && <span>{i.address}</span>}
      {i.phone && <span>{t.spPhone}: <a href={`tel:${i.phone.split(";")[0].replace(/\s+/g, "")}`} onClick={(e) => e.stopPropagation()}>{i.phone}</a></span>}
      {i.hours && <span>{t.spHours}: {i.hours}</span>}
      {i.website && /^https?:\/\//.test(i.website) && <a href={i.website} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>{t.spWebsite}</a>}
      <a href={`https://www.openstreetmap.org/${i.id}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>{t.spDirections}</a>
    </div>
  );

  return (
    <div className="sp-page sp2">
      <div className="sp2-head">
        <div>
          <h3>{t.orbSpTitle}</h3>
          <p>{t.spIntro}</p>
        </div>
        <div className="sp2-seg" role="group" aria-label={t.spRadius}>
          {[10, 25, 50].map((r) => (
            <button key={r} type="button" aria-pressed={radius === r} onClick={() => setRadius(r)}>{fill(t.spKm, { n: r })}</button>
          ))}
        </div>
      </div>
      <div className="sp-chips sp2-chips" role="group" aria-label={t.spShow}>
        {CATEGORIES.map((c) => (
          <button key={c} className="sp-chip" aria-pressed={on.has(c)} onClick={() => toggle(c)}>
            <span className="sp-dot" style={{ background: CATEGORY_COLORS[c] }} />{t[`cat_${c}`]} <b>{num.format(counts[c])}</b>
          </button>
        ))}
      </div>
      <div className="sp2-split">
        <div className="sp2-mapwrap">
          <div ref={mapEl} className="sp-map sp2-map" />
          {picked && (
            <div className="sp2-pop">
              <button type="button" className="sp2-x" aria-label="×" onClick={() => setSel(null)}>×</button>
              <small style={{ color: CATEGORY_COLORS[picked.category] }}>{t[`cat_${picked.category}`]}</small>
              <strong>{labelOf(picked)}</strong>
              <span>{fill(t.orbSpDirLine, { km: num.format(picked.km), dir: dirOf(picked) })}</span>
              <a className="btn sp2-way" href={wayUrl(picked)} target="_blank" rel="noopener noreferrer">{t.orbSpWay}</a>
            </div>
          )}
        </div>
        <aside className="sp2-list">
          <h3>{t.orbSpNearest}</h3>
          {state === "loading" && <p className="muted">{t.spLoading}</p>}
          {state === "failed" && (<div><p className="warn">{t.spFailed}</p><p className="muted small">{why}</p><button className="tab" onClick={load}>{t.spRetry}</button></div>)}
          {state === "ok" && (shown.length === 0 ? <p className="muted">{t.spNone}</p> : (
            <ul className="sp-list">
              {shown.slice(0, 60).map((i) => (
                <li key={i.id} className={i.id === sel ? "on" : ""}>
                  <button type="button" onClick={() => focus(i)}>
                    <span className="sp-dot" style={{ background: CATEGORY_COLORS[i.category] }} />
                    <span className="sp2-name"><strong>{labelOf(i)}</strong><small>{t[`cat_${i.category}`]}</small></span>
                    <b>{fill(t.spKm, { n: num.format(i.km) })}</b>
                  </button>
                  {i.id === sel && details(i)}
                </li>
              ))}
            </ul>
          ))}
          <p className="sp2-note">{t.spHonest}</p>
        </aside>
      </div>
      <p className="muted small">{t.spMapNote} {t.spCredits}</p>
    </div>
  );
}
