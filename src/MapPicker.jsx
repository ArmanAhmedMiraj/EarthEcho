import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
// MapLibre 6 needs to be told where its background worker file is when used with Vite.
// "?worker&url" (not plain "?url") makes Vite bundle the worker together with the file it imports.
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import { LEVEL_COLORS, ZOOM } from "./legend.js";

maplibregl.setWorkerUrl(workerUrl);

// Turn this on to show a small black box on the map that says whether the border layers exist.
const SHOW_STATUS = false;

const EMPTY = { type: "FeatureCollection", features: [] };
const SOURCES = ["country", "districts", "upazilas", "unions", "selected"];

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

// the chosen area is coloured by its level (the feature carries a "level" property)
const BY_LEVEL = [
  "match", ["get", "level"],
  "division", LEVEL_COLORS.division,
  "district", LEVEL_COLORS.district,
  "upazila", LEVEL_COLORS.upazila,
  "union", LEVEL_COLORS.union,
  "#ffeb3b",
];

// ---- line style: all the numbers you may want to change are in this block ----
// zoomWidth([zoom, width], [zoom, width], ...) = a line width that grows as you zoom in
const zoomWidth = (...stops) => ["interpolate", ["linear"], ["zoom"], ...stops.flat()];

const WIDTH = {
  country: zoomWidth([4, 1.1], [8, 1.6], [12, 2.4]),
  district: zoomWidth([4, 0.7], [8, 1.1], [12, 1.8]),
  upazila: zoomWidth([9, 0.8], [13, 1.6]),
  union: zoomWidth([10, 0.6], [14, 1.2]),
  selected: zoomWidth([4, 2], [12, 3]),
};
const HALO = {
  country: zoomWidth([4, 2.4], [8, 3.4], [12, 4.6]),
  selected: zoomWidth([4, 4], [12, 5.5]),
};
const HALO_OPACITY = 0.35; // how dark the soft shadow under the country and chosen lines is
const FILL_OPACITY = 0.22; // how strongly the chosen area is coloured in

// fades in over the last 0.6 zoom steps before "zoom", so lines don't pop in suddenly
const fadeIn = (zoom) => ["interpolate", ["linear"], ["zoom"], zoom - 0.6, 0, zoom, 0.9];

function line(id, source, color, width, opacity, minzoom) {
  const def = {
    id,
    type: "line",
    source,
    layout: { "line-join": "round", "line-cap": "round" },
    paint: { "line-color": color, "line-width": width, "line-opacity": opacity },
  };
  if (minzoom != null) def.minzoom = minzoom;
  return def;
}

// a soft dark shadow under a line, so a thin line stays easy to see on the satellite picture
function halo(id, source, width) {
  return {
    id,
    type: "line",
    source,
    layout: { "line-join": "round", "line-cap": "round" },
    paint: { "line-color": "#000000", "line-width": width, "line-opacity": HALO_OPACITY, "line-blur": 1.5 },
  };
}

// bottom to top
const LAYER_DEFS = [
  { id: "selected-fill", type: "fill", source: "selected",
    paint: { "fill-color": BY_LEVEL, "fill-opacity": FILL_OPACITY } },
  // appear by themselves when you zoom in to that level
  line("upazilas-line", "upazilas", LEVEL_COLORS.upazila, WIDTH.upazila, fadeIn(ZOOM.upazila), ZOOM.upazila - 0.6),
  line("unions-line", "unions", LEVEL_COLORS.union, WIDTH.union, fadeIn(ZOOM.union), ZOOM.union - 0.6),
  // always on
  line("districts-line", "districts", LEVEL_COLORS.district, WIDTH.district, 0.85),
  halo("country-halo", "country", HALO.country),
  line("country-line", "country", LEVEL_COLORS.country, WIDTH.country, 1),
  // the area you chose, outlined in the colour of its level
  halo("selected-halo", "selected", HALO.selected),
  line("selected-line", "selected", BY_LEVEL, WIDTH.selected, 1),
];

const count = (d) => (!d ? 0 : d.features ? d.features.length : 1);

export default function MapPicker({ pos, label, layers, selected, focus, onPick, onView }) {
  const box = useRef(null);
  const map = useRef(null);
  const marker = useRef(null);
  const popup = useRef(null);
  const pickRef = useRef(onPick);
  const viewRef = useRef(onView);
  const ready = useRef(false);
  const events = useRef([]);
  const notes = useRef([]);
  const dataRef = useRef({});
  const [status, setStatus] = useState("starting…");
  pickRef.current = onPick;
  viewRef.current = onView;
  dataRef.current = {
    country: layers.country,
    districts: layers.districts,
    upazilas: layers.upazilas,
    unions: layers.unions,
    selected,
  };

  function note(text) {
    if (!notes.current.includes(text)) notes.current.push(text);
  }

  function reportView() {
    const m = map.current;
    if (!m || !viewRef.current) return;
    try {
      const b = m.getBounds();
      viewRef.current({ zoom: m.getZoom(), bounds: [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()] });
    } catch (error) {
      note(`view: ${error.message}`);
    }
  }

  function refreshStatus() {
    const m = map.current;
    if (!m || !SHOW_STATUS) return;
    let present = 0;
    let rendered = "?";
    try {
      present = LAYER_DEFS.filter((d) => m.getLayer(d.id)).length;
      const existing = ["districts-line", "country-line"].filter((id) => m.getLayer(id));
      rendered = existing.length ? m.queryRenderedFeatures({ layers: existing }).length : 0;
    } catch (error) {
      note(`status: ${error.message}`);
    }
    const d = dataRef.current;
    setStatus(
      `layers ${present}/${LAYER_DEFS.length} | in view: ${rendered}\n` +
        `data: country ${count(d.country)}, districts ${count(d.districts)}, upazilas ${count(d.upazilas)}, ` +
        `unions ${count(d.unions)}, selected ${count(d.selected)}\n` +
        `zoom ${m.getZoom().toFixed(1)} | events: ${events.current.join(", ") || "none"}\n` +
        `errors: ${notes.current.length ? notes.current.join(" ; ") : "none"}`
    );
  }

  // adds the sources and layers once, then fills them with data
  function build(m, only) {
    for (const name of SOURCES) {
      try {
        if (!m.getSource(name)) m.addSource(name, { type: "geojson", data: EMPTY });
      } catch (error) {
        note(`source ${name}: ${error.message}`);
      }
    }
    for (const def of LAYER_DEFS) {
      try {
        if (!m.getLayer(def.id)) m.addLayer(def);
      } catch (error) {
        note(`layer ${def.id}: ${error.message}`);
      }
    }
    for (const name of only ? [only] : SOURCES) {
      try {
        const source = m.getSource(name);
        if (source) source.setData(dataRef.current[name] || EMPTY);
      } catch (error) {
        note(`data ${name}: ${error.message}`);
      }
    }
    refreshStatus();
  }

  // create the map once
  useEffect(() => {
    const m = new maplibregl.Map({
      container: box.current,
      style: STYLE,
      center: [pos.lon, pos.lat],
      zoom: 7,
    });
    map.current = m;
    ready.current = false;
    events.current = [];
    notes.current = [];
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

    const start = (eventName) => {
      if (!events.current.includes(eventName)) events.current.push(eventName);
      if (eventName === "style.load") {
        try {
          m.setProjection({ type: "globe" });
        } catch (error) {
          note(`globe: ${error.message}`);
        }
      }
      build(m, null);
      ready.current = true;
      reportView();
    };
    m.on("style.load", () => start("style.load"));
    m.on("load", () => start("load"));
    m.on("error", (e) => {
      note(`map error: ${(e && e.error && e.error.message) || "unknown"}`.slice(0, 120));
      refreshStatus();
    });
    m.on("moveend", () => {
      reportView();
      refreshStatus();
    });
    m.on("idle", refreshStatus);

    marker.current = new maplibregl.Marker({ color: "#e53935" }).setLngLat([pos.lon, pos.lat]).addTo(m);
    popup.current = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 30, maxWidth: "280px" });

    m.on("click", (e) => pickRef.current(e.lngLat.lat, e.lngLat.lng));

    return () => {
      m.remove();
      map.current = null;
      ready.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // each border layer is updated on its own when its data arrives or changes
  const update = (name) => {
    if (map.current && ready.current) build(map.current, name);
  };
  useEffect(() => {
    update("country");
  }, [layers.country]);
  useEffect(() => {
    update("districts");
  }, [layers.districts]);
  useEffect(() => {
    update("upazilas");
  }, [layers.upazilas]);
  useEffect(() => {
    update("unions");
  }, [layers.unions]);
  useEffect(() => {
    update("selected");
  }, [selected]);

  // pin and name label
  useEffect(() => {
    if (!map.current || !marker.current || !popup.current) return;
    marker.current.setLngLat([pos.lon, pos.lat]);

    const el = document.createElement("div");
    el.className = "pop";
    const title = document.createElement("strong");
    title.textContent = label.title;
    el.appendChild(title);
    if (label.path) {
      const path = document.createElement("div");
      path.className = "pop-path";
      path.textContent = label.path;
      el.appendChild(path);
    }
    const coords = document.createElement("div");
    coords.className = "pop-coords";
    coords.textContent = label.coords;
    el.appendChild(coords);

    popup.current.setLngLat([pos.lon, pos.lat]).setDOMContent(el);
    if (!popup.current.isOpen()) popup.current.addTo(map.current);
  }, [pos.lat, pos.lon, label.title, label.path, label.coords]);

  // fly to a chosen area or place
  useEffect(() => {
    if (!focus || !map.current) return;
    const m = map.current;
    if (focus.bbox) {
      const [west, south, east, north] = focus.bbox;
      m.fitBounds([[west, south], [east, north]], { padding: 50, maxZoom: 13, duration: 1600 });
    } else if (focus.center) {
      m.flyTo({ center: focus.center, zoom: focus.zoom || 10, duration: 1600 });
    }
  }, [focus]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div ref={box} className="map" />
      {SHOW_STATUS && (
        <div
          style={{
            position: "absolute", left: 8, top: 8, zIndex: 5, maxWidth: "78%",
            background: "rgba(0,0,0,0.75)", color: "#fff", padding: "5px 8px", borderRadius: 4,
            font: "11px/1.4 ui-monospace, Consolas, monospace", whiteSpace: "pre-wrap",
            pointerEvents: "none",
          }}
        >
          {status}
        </div>
      )}
    </div>
  );
}