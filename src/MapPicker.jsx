import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

const STYLE = {
  version: 8,
  sources: {
    satellite: {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      maxzoom: 18,
      attribution: "Imagery © Esri, Maxar, Earthstar Geographics",
    },
  },
  layers: [{ id: "satellite", type: "raster", source: "satellite" }],
};

export default function MapPicker({ pos, onPick }) {
  const box = useRef(null);
  const map = useRef(null);
  const marker = useRef(null);
  const pickRef = useRef(onPick);
  const fromMap = useRef(false);
  pickRef.current = onPick;

  useEffect(() => {
    const m = new maplibregl.Map({
      container: box.current,
      style: STYLE,
      center: [pos.lon, pos.lat],
      zoom: 7,
    });
    map.current = m;
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    m.on("style.load", () => {
      try {
        m.setProjection({ type: "globe" });
      } catch {
        /* if the globe is not supported, the flat map still works */
      }
    });
    marker.current = new maplibregl.Marker({ color: "#e53935" })
      .setLngLat([pos.lon, pos.lat])
      .addTo(m);
    m.on("click", (e) => {
      fromMap.current = true; // this change came from a tap, so don't fly the camera away
      pickRef.current(e.lngLat.lat, e.lngLat.lng);
    });
    return () => {
      m.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!map.current || !marker.current) return;
    marker.current.setLngLat([pos.lon, pos.lat]);
    if (fromMap.current) {
      fromMap.current = false;
      return;
    }
    map.current.flyTo({
      center: [pos.lon, pos.lat],
      zoom: Math.max(map.current.getZoom(), 9),
    });
  }, [pos.lat, pos.lon]);

  return <div ref={box} className="map" />;
}