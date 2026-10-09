import { useEffect, useRef, useState } from "react";
import { Map, NavigationControl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import "./extra.css";

const BASE = import.meta.env.BASE_URL;

// A realistic globe: NASA Blue Marble far away, Esri satellite photos up close,
// plus an atmosphere glow. No account or key is needed for either source.
function baseStyle() {
  return {
    version: 8,
    projection: { type: "globe" },
    sky: {
      "sky-color": "#2f8fe8",
      "sky-horizon-blend": 0.6,
      "horizon-color": "#9fd0ff",
      "horizon-fog-blend": 0.6,
      "fog-color": "#5aa7f0",
      "fog-ground-blend": 0.4,
      "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 1, 5, 1, 7, 0],
    },
    sources: {
      bluemarble: {
        type: "raster",
        tiles: [
          "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg",
        ],
        tileSize: 256,
        maxzoom: 8,
        attribution: "Imagery: NASA GIBS (Blue Marble)",
      },
      satellite: {
        type: "raster",
        tiles: [
          "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        ],
        tileSize: 256,
        maxzoom: 18,
        attribution: "Imagery: Esri, Maxar, Earthstar Geographics",
      },
    },
    layers: [
      { id: "ocean", type: "background", paint: { "background-color": "#06122b" } },
      { id: "bluemarble", type: "raster", source: "bluemarble" },
      {
        id: "satellite",
        type: "raster",
        source: "satellite",
        minzoom: 4,
        paint: { "raster-opacity": ["interpolate", ["linear"], ["zoom"], 4, 0, 7, 1] },
      },
    ],
  };
}

function formatDate(day, lang) {
  if (!day) return "";
  return new Date(day + "T00:00:00Z").toLocaleDateString(lang === "bn" ? "bn-BD" : "en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

// Picks the comparison that shows BOTH blue and orange the most evenly,
// so the first thing people see explains the colours.
function bestPair(meta) {
  let best = 0;
  let bestScore = -1;
  meta.changes.forEach((c, i) => {
    const score = Math.min(c.darker_percent, c.brighter_percent);
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  });
  return best;
}

// Approximate area covered by the radar window, in square kilometres.
function windowAreaKm2(meta) {
  const [w, s, e, n] = meta.bounds_west_south_east_north;
  const midLat = ((s + n) / 2) * (Math.PI / 180);
  const widthKm = (e - w) * 111.32 * Math.cos(midLat);
  const heightKm = (n - s) * 110.57;
  return widthKm * heightKm;
}

export default function MapView({ place, t, lang }) {
  const box = useRef(null);
  const mapRef = useRef(null);

  const [ready, setReady] = useState(false);      // the map has finished loading
  const [meta, setMeta] = useState(null);         // meta.json of the selected place
  const [error, setError] = useState(false);
  const [layersOn, setLayersOn] = useState(false); // radar layers exist on the map

  const [mode, setMode] = useState("change");      // "change" or "radar"
  const [beforeDate, setBeforeDate] = useState("");
  const [afterDate, setAfterDate] = useState("");
  const [mix, setMix] = useState(0);               // 0 = before, 100 = after
  const [showChange, setShowChange] = useState(true);
  const [pair, setPair] = useState(0);

  // 1. Create the map once. It starts on all of Bangladesh and India.
  useEffect(() => {
    const map = new Map({
      container: box.current,
      style: baseStyle(),
      center: [84, 23],
      zoom: 3.6,
      maxZoom: 16,
      attributionControl: { compact: true },
    });
    map.addControl(new NavigationControl({ visualizePitch: true }), "top-right");
    map.on("load", () => setReady(true));
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      setReady(false);
    };
  }, []);

  // 2. Load meta.json when a place with a radar layer is selected.
  useEffect(() => {
    setMeta(null);
    setError(false);
    if (!place.ready) return;
    let cancelled = false;
    fetch(`${BASE}data/${place.id}/meta.json`)
      .then((r) => {
        if (!r.ok) throw new Error("not found");
        return r.json();
      })
      .then((m) => {
        if (cancelled) return;
        setMeta(m);
        setMode("change");
        setBeforeDate(m.dates[0].date);
        setAfterDate(m.dates[m.dates.length - 1].date);
        setPair(bestPair(m));
        setMix(0);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [place.id, place.ready]);

  // 3. Fly to the selected place.
  useEffect(() => {
    if (!ready) return;
    const map = mapRef.current;
    if (place.ready && meta) {
      const [w, s, e, n] = meta.bounds_west_south_east_north;
      map.fitBounds([[w, s], [e, n]], { padding: 30, duration: 6000, essential: true });
    } else if (!place.ready) {
      map.flyTo({ center: [place.lon, place.lat], zoom: place.zoom, duration: 4000, essential: true });
    }
  }, [place.id, ready, meta]);

  // 4. Put the radar images, the coverage outline and the pin on the map.
  useEffect(() => {
    if (!ready || !meta) return;
    const map = mapRef.current;
    const base = `${BASE}data/${place.id}/`;
    const coordinates = meta.corners_lonlat;
    const firstFile = meta.dates[0].sar;
    const lastFile = meta.dates[meta.dates.length - 1].sar;
    const changeFile = meta.changes[bestPair(meta)].file;

    const add = (id, file, opacity) => {
      map.addSource(id, { type: "image", url: base + file, coordinates });
      map.addLayer({
        id,
        type: "raster",
        source: id,
        paint: { "raster-opacity": opacity, "raster-fade-duration": 0 },
      });
    };
    add("sar-before", firstFile, 1);
    add("sar-after", lastFile, 0);
    add("change", changeFile, 1);

    // Dashed outline: where radar data exists.
    map.addSource("coverage", {
      type: "geojson",
      data: {
        type: "Feature",
        geometry: { type: "LineString", coordinates: [...coordinates, coordinates[0]] },
      },
    });
    map.addLayer({
      id: "coverage",
      type: "line",
      source: "coverage",
      paint: { "line-color": "#ffffff", "line-width": 1.6, "line-dasharray": [2, 2] },
    });

    // Glowing pin so the radar area can be found from far away.
    const [w, s, e, n] = meta.bounds_west_south_east_north;
    map.addSource("pin", {
      type: "geojson",
      data: {
        type: "Feature",
        geometry: { type: "Point", coordinates: [(w + e) / 2, (s + n) / 2] },
      },
    });
    map.addLayer({
      id: "pin-glow",
      type: "circle",
      source: "pin",
      maxzoom: 9,
      paint: { "circle-radius": 16, "circle-color": "#f28e2b", "circle-opacity": 0.3, "circle-blur": 0.6 },
    });
    map.addLayer({
      id: "pin",
      type: "circle",
      source: "pin",
      maxzoom: 9,
      paint: {
        "circle-radius": 6,
        "circle-color": "#f28e2b",
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 2,
      },
    });
    setLayersOn(true);

    return () => {
      setLayersOn(false);
      try {
        ["pin", "pin-glow", "coverage", "change", "sar-after", "sar-before"].forEach((id) => {
          if (map.getLayer(id)) map.removeLayer(id);
        });
        ["pin", "coverage", "change", "sar-after", "sar-before"].forEach((id) => {
          if (map.getSource(id)) map.removeSource(id);
        });
      } catch {
        /* the map was already removed */
      }
    };
  }, [ready, meta, place.id]);

  // 5. Change the "before" and "after" pictures.
  useEffect(() => {
    if (!layersOn || !meta) return;
    const map = mapRef.current;
    const base = `${BASE}data/${place.id}/`;
    const coordinates = meta.corners_lonlat;
    const before = meta.dates.find((d) => d.date === beforeDate);
    const after = meta.dates.find((d) => d.date === afterDate);
    if (before) map.getSource("sar-before")?.updateImage({ url: base + before.sar, coordinates });
    if (after) map.getSource("sar-after")?.updateImage({ url: base + after.sar, coordinates });
  }, [layersOn, beforeDate, afterDate]);

  // 6. Which layers are visible depends on the mode.
  //    "What changed": satellite photo + coloured changes only.
  //    "Radar view": grey radar with the before/after slider (+ optional changes).
  useEffect(() => {
    if (!layersOn || !meta) return;
    const map = mapRef.current;
    const base = `${BASE}data/${place.id}/`;
    const radar = mode === "radar";

    map.setLayoutProperty("sar-before", "visibility", radar ? "visible" : "none");
    map.setLayoutProperty("sar-after", "visibility", radar ? "visible" : "none");
    map.setPaintProperty("sar-after", "raster-opacity", mix / 100);

    const item = meta.changes[pair];
    if (item) map.getSource("change")?.updateImage({ url: base + item.file, coordinates: meta.corners_lonlat });
    map.setLayoutProperty("change", "visibility", !radar || showChange ? "visible" : "none");
  }, [layersOn, mode, mix, pair, showChange]);

  // Plain-language summary for the chosen comparison.
  let summaryText = "";
  if (meta && meta.changes[pair]) {
    const c = meta.changes[pair];
    const total = windowAreaKm2(meta);
    const fmt = (n) =>
      n.toLocaleString(lang === "bn" ? "bn-BD" : "en-US", { maximumFractionDigits: 1 });
    summaryText = t.summary(
      c.from,
      c.to,
      fmt((c.darker_percent / 100) * total),
      fmt((c.brighter_percent / 100) * total),
      fmt(Math.round(total))
    );
  }

  return (
    <section className="stage">
      <div className="map-wrap">
        <div ref={box} className="map-box" />
        {!place.ready && (
          <div className="banner warn-banner">
            <strong>{t.places[place.id]}</strong> · {t.noLayer}
          </div>
        )}
        {place.ready && !meta && !error && <div className="banner">{t.loading}</div>}
        {error && <div className="banner warn-banner">{t.loadError}</div>}
        {meta && (
          <div className="banner">
            <strong>{t.places[place.id]}</strong> · {t.types[place.type]}
          </div>
        )}
      </div>

      {meta && (
        <div className="viewer">
          <div className="modes">
            <button
              className={"mode" + (mode === "change" ? " on" : "")}
              onClick={() => setMode("change")}
            >
              {t.modeChange}
            </button>
            <button
              className={"mode" + (mode === "radar" ? " on" : "")}
              onClick={() => setMode("radar")}
            >
              {t.modeRadar}
            </button>
          </div>

          <label className="field-label">
            {t.comparePeriods}
            <select value={pair} onChange={(e) => setPair(Number(e.target.value))}>
              {meta.changes.map((c, i) => (
                <option key={c.file} value={i}>
                  {c.from} → {c.to}
                </option>
              ))}
            </select>
          </label>

          <div className="summary">
            <p>{summaryText}</p>
            <div className="figures">
              <span className="figure"><span className="chip dark" />{t.legendDarker}</span>
              <span className="figure"><span className="chip bright" />{t.legendBrighter}</span>
            </div>
          </div>

          {mode === "radar" && (
            <>
              <div className="row">
                <label className="field-label">
                  {t.before}
                  <select value={beforeDate} onChange={(e) => setBeforeDate(e.target.value)}>
                    {meta.dates.map((d) => (
                      <option key={d.date} value={d.date}>
                        {formatDate(d.date, lang)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field-label">
                  {t.after}
                  <select value={afterDate} onChange={(e) => setAfterDate(e.target.value)}>
                    {meta.dates.map((d) => (
                      <option key={d.date} value={d.date}>
                        {formatDate(d.date, lang)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={showChange}
                    onChange={(e) => setShowChange(e.target.checked)}
                  />
                  {t.showChange}
                </label>
              </div>

              <div className="slider-row">
                <span>{formatDate(beforeDate, lang)}</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={mix}
                  onChange={(e) => setMix(Number(e.target.value))}
                  aria-label={t.slideHint}
                />
                <span>{formatDate(afterDate, lang)}</span>
              </div>
              <p className="muted small">{t.slideHint}</p>
            </>
          )}

          <p className="caption">{mode === "change" ? t.captionChange : t.captionRadar}</p>
          <p className="why">{t.why}</p>
        </div>
      )}
    </section>
  );
}