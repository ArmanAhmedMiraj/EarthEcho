import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import "./start.css";

maplibregl.setWorkerUrl(workerUrl);

const STYLE = {
  version: 8,
  sources: {
    satellite: {
      type: "raster",
      tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
      tileSize: 256,
      maxzoom: 18,
    },
  },
  layers: [{ id: "satellite", type: "raster", source: "satellite" }],
};

// the zoom at which the whole globe fills about "share" of a box that is h pixels tall (globe width is about 141 x 2^zoom)
const fitZoom = (h, share) => Math.log2((share * h) / 141);

// A small round globe (not for choosing places: the Location page has the map for that).
//   spin    turns slowly
//   pin     shows a red pin at the point
//   orbit   a satellite circles the Earth
//   scan    a soft scanning sweep over the surface
//   flyKey  changes when the globe should fly in to the point
export default function Globe({ lat, lon, spin, pin, orbit, scan, flyKey, className = "" }) {
  const box = useRef(null);
  const map = useRef(null);
  const marker = useRef(null);
  const spinning = useRef(!!spin);
  const flown = useRef(false);
  spinning.current = !!spin && !flown.current;

  useEffect(() => {
    const m = new maplibregl.Map({
      container: box.current,
      style: STYLE,
      center: [lon, lat],
      zoom: fitZoom(box.current.clientHeight || 200, 0.95),
      minZoom: -3,
      interactive: false,
      attributionControl: false,
    });
    map.current = m;
    m.on("style.load", () => {
      try {
        m.setProjection({ type: "globe" });
      } catch {
        /* a flat map still works */
      }
    });
    // keep the whole globe in view whatever size the box is
    const watch = new ResizeObserver(() => {
      m.resize();
      if (!flown.current) m.jumpTo({ zoom: fitZoom(box.current.clientHeight || 200, 0.95) });
    });
    watch.observe(box.current);
    let frame;
    let last = performance.now();
    const turn = (now) => {
      const dt = Math.min(now - last, 100);
      last = now;
      if (spinning.current && !m.isMoving()) {
        const c = m.getCenter();
        m.jumpTo({ center: [c.lng + dt * 0.008, c.lat] });
      }
      frame = requestAnimationFrame(turn);
    };
    frame = requestAnimationFrame(turn);
    return () => {
      cancelAnimationFrame(frame);
      watch.disconnect();
      m.remove();
      map.current = null;
      marker.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // a new point: turn the globe to it
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    flown.current = false;
    m.jumpTo({ center: [lon, lat], zoom: fitZoom(box.current.clientHeight || 200, 0.95) });
    if (marker.current) marker.current.setLngLat([lon, lat]);
  }, [lat, lon]);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    if (!pin) {
      if (marker.current) marker.current.remove();
      marker.current = null;
    } else if (!marker.current) {
      marker.current = new maplibregl.Marker({ color: "#e53935", scale: 0.8 }).setLngLat([lon, lat]).addTo(m);
    }
  }, [pin, lat, lon]);

  useEffect(() => {
    const m = map.current;
    if (!m || !flyKey) return;
    flown.current = true;
    m.flyTo({ center: [lon, lat], zoom: 5.5, duration: 3200, essential: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flyKey]);

  return (
    <div className={`globe ${className}`}>
      <div className="globe-clip">
        <div ref={box} className="globe-map" />
        {scan && <div className="globe-scan" />}
        <div className="globe-shade" />
      </div>
      {orbit && (
        <svg className="globe-orbit" viewBox="0 0 100 100" aria-hidden="true">
          <g transform="rotate(-24 50 50)">
            <ellipse cx="50" cy="50" rx="47" ry="15" className="orbit-line" />
            <g>
              <rect x="-4.4" y="-0.9" width="3.2" height="1.8" className="sat-panel" />
              <rect x="1.2" y="-0.9" width="3.2" height="1.8" className="sat-panel" />
              <circle r="1.5" className="sat-body" />
              <animateMotion dur="7s" repeatCount="indefinite" path="M97 50 A47 15 0 1 1 3 50 A47 15 0 1 1 97 50" />
            </g>
          </g>
        </svg>
      )}
    </div>
  );
}
