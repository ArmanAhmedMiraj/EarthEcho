import { useEffect, useRef, useState } from "react";
import { Map, NavigationControl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

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

export default function MapView({ place, t, lang }) {
  const box = useRef(null);
  const mapRef = useRef(null);

  const [ready, setReady] = useState(false);      // the map has finished loading
  const [meta, setMeta] = useState(null);         // meta.json of the selected place
  const [error, setError] = useState(false);
  const [layersOn, setLayersOn] = useState(false); // radar layers exist on the map

  const [beforeDate, setBeforeDate] = useState("");
  const [afterDate, setAfterDate] = useState("");
  const [mix, setMix] = useState(0);               // 0 = before, 100 = after
  const [showChange, setShowChange] = useState(true);
  const [pair, setPair] = useState(0);

  // 1. Create the map once.
  useEffect(() => {
    const map = new Map({
      container: box.current,
      style: baseStyle(),
      center: [90, 22],
      zoom: 1.6,
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
        setBeforeDate(m.dates[0].date);
        setAfterDate(m.dates[m.dates.length - 1].date);
        setPair(Math.min(3, m.changes.length - 1));
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
      map.fitBounds([[w, s], [e, n]], { padding: 30, duration: 5000, essential: true });
    } else if (!place.ready) {
      map.flyTo({ center: [place.lon, place.lat], zoom: place.zoom, duration: 4000, essential: true });
    }
  }, [place.id, ready, meta]);

  // 4. Put the radar images and the coverage outline on the map.
  useEffect(() => {
    if (!ready || !meta) return;
    const map = mapRef.current;
    const base = `${BASE}data/${place.id}/`;
    const coordinates = meta.corners_lonlat;
    const firstFile = meta.dates[0].sar;
    const lastFile = meta.dates[meta.dates.length - 1].sar;
    const changeFile = meta.changes[Math.min(3, meta.changes.length - 1)].file;

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
    setLayersOn(true);

    return () => {
      setLayersOn(false);
      try {
        ["coverage", "change", "sar-after", "sar-before"].forEach((id) => {
          if (map.getLayer(id)) map.removeLayer(id);
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

  // 6. The slider fades from before to after.
  useEffect(() => {
    if (!layersOn) return;
    mapRef.current.setPaintProperty("sar-after", "raster-opacity", mix / 100);
  }, [layersOn, mix]);

  // 7. Change overlay: which comparison, and on or off.
  useEffect(() => {
    if (!layersOn || !meta) return;
    const map = mapRef.current;
    const base = `${BASE}data/${place.id}/`;
    const item = meta.changes[pair];
    if (item) map.getSource("change")?.updateImage({ url: base + item.file, coordinates: meta.corners_lonlat });
    map.setLayoutProperty("change", "visibility", showChange ? "visible" : "none");
  }, [layersOn, pair, showChange]);

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

          <div className="row">
            <label className="check">
              <input
                type="checkbox"
                checked={showChange}
                onChange={(e) => setShowChange(e.target.checked)}
              />
              {t.showChange}
            </label>
            <label className="field-label grow">
              {t.comparePeriods}
              <select value={pair} onChange={(e) => setPair(Number(e.target.value))}>
                {meta.changes.map((c, i) => (
                  <option key={c.file} value={i}>
                    {c.from} → {c.to}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <ul className="legend">
            <li><span className="chip dark" />{t.legendDarker}</li>
            <li><span className="chip bright" />{t.legendBrighter}</li>
          </ul>
          <p className="caption">{t.caption}</p>
        </div>
      )}
    </section>
  );
}