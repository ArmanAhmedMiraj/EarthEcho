import { useCallback, useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import "./suppliers.css";
import { CATEGORIES, fetchSuppliers } from "./suppliers.js";
import { CATEGORY_COLORS } from "./i18nSuppliers.js";

const fill = (text, values) => Object.keys(values).reduce((s, k) => s.split(`{${k}}`).join(values[k]), text);
const STYLE = {
  version: 8,
  sources: { satellite: { type: "raster", tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"], tileSize: 256, maxzoom: 18, attribution: "Imagery © Esri, Maxar, Earthstar Geographics | Data © OpenStreetMap contributors" } },
  layers: [{ id: "satellite", type: "raster", source: "satellite" }],
};

export default function Suppliers({ t, lang, lat, lon }) {
  const [radius, setRadius] = useState(25);
  const [items, setItems] = useState(null);
  const [state, setState] = useState("loading");
  const [why, setWhy] = useState("");
  const [on, setOn] = useState(() => new Set(CATEGORIES));
  const mapEl = useRef(null);
  const map = useRef(null);
  const markers = useRef([]);
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
    here.style.cssText = "width:16px;height:16px;border-radius:50%;background:#ffeb3b;border:3px solid #000;box-shadow:0 0 0 2px #fff";
    here.title = t.spYou;
    new maplibregl.Marker({ element: here }).setLngLat([lon, lat]).addTo(m);
    map.current = m;
    return () => { m.remove(); map.current = null; };
  }, [lat, lon, t.spYou]);

  const shown = (items || []).filter((i) => on.has(i.category));

  // the dots follow the list
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    markers.current.forEach((x) => x.remove());
    markers.current = shown.map((i) => {
      const el = document.createElement("div");
      el.style.cssText = `width:14px;height:14px;border-radius:50%;background:${CATEGORY_COLORS[i.category]};border:2px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.5);cursor:pointer`;
      const label = i.name || fill(t.spUnnamed, { kind: t[`cat_${i.category}`].toLowerCase() });
      const popup = new maplibregl.Popup({ offset: 10, closeButton: false }).setText(`${label} · ${fill(t.spAway, { km: num.format(i.km) })}`);
      return new maplibregl.Marker({ element: el }).setLngLat([i.lon, i.lat]).setPopup(popup).addTo(m);
    });
    if (shown.length) {
      const b = new maplibregl.LngLatBounds([lon, lat], [lon, lat]);
      shown.slice(0, 40).forEach((i) => b.extend([i.lon, i.lat]));
      m.fitBounds(b, { padding: 40, maxZoom: 13, duration: 0 });
    }
  }, [items, on, lat, lon]); // eslint-disable-line react-hooks/exhaustive-deps

  const focus = (i, index) => {
    if (map.current) map.current.flyTo({ center: [i.lon, i.lat], zoom: 14 });
    const mk = markers.current[index];
    if (mk) { mk.togglePopup(); }
  };
  const toggle = (c) => setOn((prev) => { const n = new Set(prev); if (n.has(c)) n.delete(c); else n.add(c); return n; });
  const counts = CATEGORIES.reduce((o, c) => ({ ...o, [c]: (items || []).filter((i) => i.category === c).length }), {});

  return (
    <div>
      <p className="muted">{t.spIntro}</p>
      <div className="sp-controls">
        <label>{t.spRadius}
          <select value={radius} onChange={(e) => setRadius(Number(e.target.value))}>
            {[10, 25, 50].map((r) => <option key={r} value={r}>{fill(t.spKm, { n: r })}</option>)}
          </select>
        </label>
      </div>
      <div className="sp-chips" role="group" aria-label={t.spShow}>
        {CATEGORIES.map((c) => (
          <button key={c} className="sp-chip" aria-pressed={on.has(c)} onClick={() => toggle(c)}>
            <span className="sp-dot" style={{ background: CATEGORY_COLORS[c] }} />{t[`cat_${c}`]} ({counts[c]})
          </button>
        ))}
      </div>
      <div ref={mapEl} className="sp-map" />
      <p className="muted small">{t.spMapNote}</p>

      {state === "loading" && <p className="muted">{t.spLoading}</p>}
      {state === "failed" && (<div><p className="warn">{t.spFailed}</p><p className="muted small">{why}</p><button className="tab" onClick={load}>{t.spRetry}</button></div>)}
      {state === "ok" && (shown.length === 0 ? <p className="muted">{t.spNone}</p> : (
        <>
          <p className="small">{fill(t.spCount, { n: shown.length })}</p>
          <ul className="sp-list">
            {shown.slice(0, 60).map((i, idx) => (
              <li className="sp-item" key={i.id} onClick={() => focus(i, idx)}>
                <span className="sp-dot" style={{ background: CATEGORY_COLORS[i.category] }} />
                <div>
                  <strong>{(lang === "bn" && i.nameBn) || i.name || fill(t.spUnnamed, { kind: t[`cat_${i.category}`].toLowerCase() })}</strong>
                  <div className="sp-meta">
                    <span>{t[`cat_${i.category}`]}</span>
                    <span>{fill(t.spAway, { km: num.format(i.km) })}</span>
                    {i.address && <span>{i.address}</span>}
                    {i.phone && <span>{t.spPhone}: <a href={`tel:${i.phone.split(";")[0].replace(/\s+/g, "")}`}>{i.phone}</a></span>}
                    {i.hours && <span>{t.spHours}: {i.hours}</span>}
                    {i.website && /^https?:\/\//.test(i.website) && <a href={i.website} target="_blank" rel="noopener noreferrer">{t.spWebsite}</a>}
                    <a href={`https://www.openstreetmap.org/${i.id}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>{t.spDirections}</a>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </>
      ))}
      <p className="muted small">{t.spHonest}</p>
      <p className="muted small">{t.spCredits}</p>
    </div>
  );
}
