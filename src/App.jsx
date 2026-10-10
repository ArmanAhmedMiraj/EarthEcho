import { useEffect, useMemo, useRef, useState } from "react";
import { LANGUAGES, TEXT } from "./i18n.js";
import { ADMIN_TEXT } from "./i18nAdmin.js";
import { LEGEND_TEXT, LEVEL_COLORS, ZOOM } from "./legend.js";
import { SOIL_NOTE, SOIL_TYPES, loadSoilMap, lookupSoil, typicalSoil } from "./soil.js";
import { fetchForecast, fetchHistory } from "./weather.js";
import {
  COUNTRY_BBOX,
  COUNTRY_CENTER,
  EMPTY_CHAIN,
  deepestOf,
  loadAdmin,
  loadUnions,
  locate,
  pathText,
  titleOf,
} from "./admin.js";
import AdminPicker from "./AdminPicker.jsx";
import MapPicker from "./MapPicker.jsx";
import Weather from "./Weather.jsx";

const PARENT = { union: "upazila", upazila: "district", district: "division", division: null };

function readSaved(key, fallback) {
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}

function saveChoice(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage blocked: the choice just won't be remembered */
  }
}

const phoneTheme = () =>
  window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";

const collection = (features) => ({ type: "FeatureCollection", features });

export default function App() {
  const [lang, setLang] = useState(() => readSaved("ef-lang", "en"));
  const [theme, setTheme] = useState(() => readSaved("ef-theme", phoneTheme()));
  const [pos, setPos] = useState({ lat: 25.75, lon: 89.25, name: null });
  const [soilChoice, setSoilChoice] = useState("auto"); // "auto" or a soil key
  const [soilMap, setSoilMap] = useState(null);

  const [admin, setAdmin] = useState(null);
  const [adminError, setAdminError] = useState(false);
  const [unionsFc, setUnionsFc] = useState(null); // unions of the chosen district
  const [place, setPlace] = useState(EMPTY_CHAIN);
  const [selected, setSelected] = useState(null); // { level, id }
  const [country, setCountry] = useState("BD");
  const [focus, setFocus] = useState(null);
  const [message, setMessage] = useState("");
  const [view, setView] = useState(null); // { zoom, bounds } of the map right now
  const [viewUnions, setViewUnions] = useState(null); // unions of the districts on screen
  const pickToken = useRef(0);

  const [forecast, setForecast] = useState(null);
  const [history, setHistory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const t = { ...TEXT[lang], ...ADMIN_TEXT[lang], ...LEGEND_TEXT[lang] };

  // Soil: the satellite-based map first, the regional guess only if the map has nothing.
  const mapSoil = lookupSoil(soilMap, pos.lat, pos.lon);
  const suggested = mapSoil || typicalSoil(pos.lat, pos.lon);
  const suggestedFrom = mapSoil ? "map" : "region";
  const soil = soilChoice === "auto" ? suggested : soilChoice;

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = LANGUAGES.find((l) => l.code === lang).dir;
    saveChoice("ef-lang", lang);
  }, [lang]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    saveChoice("ef-theme", theme);
  }, [theme]);

  useEffect(() => {
    loadSoilMap().then(setSoilMap);
  }, []);

  // boundary files
  useEffect(() => {
    loadAdmin()
      .then(setAdmin)
      .catch(() => setAdminError(true));
  }, []);

  // once the boundaries are loaded, work out where the starting point is
  useEffect(() => {
    if (admin) pickPoint(pos.lat, pos.lon);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [admin]);

  // unions of the chosen district (for the dropdown)
  const districtId = place.district ? place.district.id : null;
  useEffect(() => {
    if (!districtId) {
      setUnionsFc(null);
      return undefined;
    }
    let cancelled = false;
    loadUnions(districtId)
      .then((fc) => {
        if (!cancelled) setUnionsFc(fc);
      })
      .catch(() => {
        if (!cancelled) setUnionsFc(null);
      });
    return () => {
      cancelled = true;
    };
  }, [districtId]);

  // Which districts are on screen once you are zoomed in far enough to see union borders?
  const unionIds = useMemo(() => {
    if (!admin || !view || view.zoom < ZOOM.union - 0.6) return "";
    const [west, south, east, north] = view.bounds;
    const ids = admin.districts.features
      .filter((f) => {
        const b = f.properties.bbox;
        return b[0] <= east && b[2] >= west && b[1] <= north && b[3] >= south;
      })
      .map((f) => f.properties.id);
    return ids.length > 0 && ids.length <= 6 ? ids.join(",") : "";
  }, [admin, view]);

  // load union borders for those districts (each file is loaded once and then kept)
  useEffect(() => {
    if (!unionIds) {
      setViewUnions(null);
      return undefined;
    }
    let cancelled = false;
    Promise.all(unionIds.split(",").map((id) => loadUnions(id).catch(() => null))).then((list) => {
      if (cancelled) return;
      setViewUnions(collection(list.filter(Boolean).flatMap((fc) => fc.features)));
    });
    return () => {
      cancelled = true;
    };
  }, [unionIds]);

  // Load weather whenever the point changes.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    Promise.allSettled([fetchForecast(pos.lat, pos.lon), fetchHistory(pos.lat, pos.lon)]).then(
      ([f, h]) => {
        if (cancelled) return;
        setForecast(f.status === "fulfilled" ? f.value : null);
        setHistory(h.status === "fulfilled" ? h.value : null);
        setError(f.status !== "fulfilled");
        setLoading(false);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [pos.lat, pos.lon]);

  // ---- choosing places ----
  function buildChain(level, props) {
    const pools = { upazila: admin.upazilas, district: admin.districts, division: admin.divisions };
    const chain = { ...EMPTY_CHAIN };
    let current = props;
    let currentLevel = level;
    while (current && currentLevel) {
      chain[currentLevel] = current;
      const parentLevel = PARENT[currentLevel];
      if (!parentLevel) break;
      const parentId = current.parent;
      const parent = pools[parentLevel].features.find((f) => f.properties.id === parentId);
      current = parent ? parent.properties : null;
      currentLevel = parentLevel;
    }
    return chain;
  }

  // a dropdown choice, a search result: fly to the whole area, pin in its middle
  function selectArea(level, props) {
    const chain = buildChain(level, props);
    setPlace(chain);
    setSelected({ level, id: props.id });
    setCountry("BD");
    setMessage("");
    setPos({ lat: props.lat, lon: props.lon, name: titleOf(chain) });
    setSoilChoice("auto");
    setFocus({ key: Date.now(), bbox: props.bbox });
  }

  function resetCountry() {
    setPlace(EMPTY_CHAIN);
    setSelected(null);
    setCountry("BD");
    setMessage("");
    setPos({ lat: COUNTRY_CENTER.lat, lon: COUNTRY_CENTER.lon, name: "Bangladesh" });
    setSoilChoice("auto");
    setFocus({ key: Date.now(), bbox: COUNTRY_BBOX });
  }

  // a tap on the map (or "use my location"): the exact point, and which area it is in
  async function pickPoint(lat, lon, options = {}) {
    const latFixed = Number(lat.toFixed(4));
    const lonFixed = Number(lon.toFixed(4));
    const token = ++pickToken.current;
    setMessage("");

    let chain = EMPTY_CHAIN;
    if (admin) {
      try {
        chain = (await locate(admin, latFixed, lonFixed)) || EMPTY_CHAIN;
      } catch {
        chain = EMPTY_CHAIN;
      }
    }
    if (token !== pickToken.current) return; // a newer tap replaced this one

    const found = deepestOf(chain);
    setPlace(chain);
    setSelected(found ? { level: found.level, id: found.item.id } : null);
    setCountry(chain.district ? "BD" : "other");
    setPos({ lat: latFixed, lon: lonFixed, name: titleOf(chain) });
    setSoilChoice("auto");
    if (options.fly) setFocus({ key: Date.now(), center: [lonFixed, latFixed], zoom: found ? 11 : 9 });
    if (admin && !found) setMessage(t.outsideBD);
  }

  function onLevel(level, id) {
    if (!admin) return;
    if (!id) {
      const parentLevel = PARENT[level];
      const parentProps = parentLevel ? place[parentLevel] : null;
      if (parentProps) selectArea(parentLevel, parentProps);
      else resetCountry();
      return;
    }
    const pool = {
      division: admin.divisions,
      district: admin.districts,
      upazila: admin.upazilas,
      union: unionsFc,
    }[level];
    const found = pool ? pool.features.find((f) => f.properties.id === id) : null;
    if (found) selectArea(level, found.properties);
  }

  function onCountry(value) {
    if (value === "BD") {
      resetCountry();
    } else {
      setCountry("other");
      setPlace(EMPTY_CHAIN);
      setSelected(null);
      setMessage("");
    }
  }

  async function onPickEntry(entry) {
    if (!admin) return;
    const pools = { division: admin.divisions, district: admin.districts, upazila: admin.upazilas };
    let props = null;
    if (pools[entry.l]) {
      const f = pools[entry.l].features.find((x) => x.properties.id === entry.i);
      props = f ? f.properties : null;
    } else {
      try {
        const chain = await locate(admin, entry.y, entry.x);
        if (chain && chain.union && chain.union.id === entry.i) props = chain.union;
      } catch {
        /* fall through to the search entry itself */
      }
    }
    if (!props) props = { id: entry.i, name: entry.n, parent: null, lat: entry.y, lon: entry.x, bbox: entry.b };
    selectArea(entry.l, props);
  }

  function onPickWorld(r) {
    setPlace(EMPTY_CHAIN);
    setSelected(null);
    setCountry("other");
    setMessage("");
    setPos({ lat: Number(r.lat.toFixed(4)), lon: Number(r.lon.toFixed(4)), name: r.name });
    setSoilChoice("auto");
    setFocus({ key: Date.now(), center: [r.lon, r.lat], zoom: 9 });
  }

  function onUseLocation() {
    setMessage("");
    if (!navigator.geolocation) {
      setMessage(t.locationDenied);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => pickPoint(p.coords.latitude, p.coords.longitude, { fly: true }),
      () => setMessage(t.locationDenied),
      { timeout: 15000 }
    );
  }

  // ---- what the map shows ----
  // the chosen area, carrying its level so the map can colour it
  const selectedFeature = useMemo(() => {
    if (!selected || !admin) return null;
    const pool = {
      division: admin.divisions,
      district: admin.districts,
      upazila: admin.upazilas,
      union: unionsFc,
    }[selected.level];
    const found = pool ? pool.features.find((f) => f.properties.id === selected.id) : null;
    return found ? { type: "Feature", properties: { level: selected.level }, geometry: found.geometry } : null;
  }, [selected, admin, unionsFc]);

  const label = {
    title: pos.name || t.pickedPoint,
    path: pathText(place),
    coords: `${t.latShort} ${pos.lat} · ${t.lonShort} ${pos.lon}`,
  };

  const layers = {
    country: admin ? admin.country : null,
    districts: admin ? admin.districts : null, // always on, together with the country border
    upazilas: admin ? admin.upazilas : null, // fade in by themselves when you zoom in
    unions: viewUnions, // fade in further in, loaded for the districts on screen
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo" aria-hidden="true">◎</span>
          <div>
            <h1>{t.appName}</h1>
            <p className="tagline">{t.tagline}</p>
          </div>
        </div>
        <div className="controls">
          <label>
            <span className="sr-only">{t.language}</span>
            <select value={lang} onChange={(e) => setLang(e.target.value)}>
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>{l.label}</option>
              ))}
            </select>
          </label>
          <button className="btn" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
            {theme === "dark" ? t.themeLight : t.themeDark}
          </button>
        </div>
      </header>

      <main className="layout">
        <section className="panel">
          <h2>{t.step1}</h2>
          <AdminPicker
            t={t}
            lang={lang}
            admin={admin}
            adminError={adminError}
            unionsFc={unionsFc}
            place={place}
            country={country}
            message={message}
            onCountry={onCountry}
            onLevel={onLevel}
            onPickEntry={onPickEntry}
            onPickWorld={onPickWorld}
            onUseLocation={onUseLocation}
          />
          <p className="muted small">{t.tapMap}</p>
          <p className="small">
            <strong>{t.selected}:</strong> {label.title}
            <br />
            {label.path && (
              <>
                <span className="muted">{label.path}</span>
                <br />
              </>
            )}
            <strong>{t.coordinates}:</strong> {pos.lat}, {pos.lon}
          </p>

          <h2>{t.step2}</h2>
          <select
            className="wide-select"
            value={soil || ""}
            onChange={(e) => setSoilChoice(e.target.value)}
          >
            {!soil && <option value="" disabled>—</option>}
            {SOIL_TYPES.map((key) => (
              <option key={key} value={key}>{t.soilNames[key]}</option>
            ))}
          </select>
          {soil && <p className="small">{t.soilHelp[soil]}</p>}
          <p className="muted small">
            {soilChoice !== "auto"
              ? t.soilChanged
              : suggested
                ? SOIL_NOTE[lang][suggestedFrom]
                : t.soilUnknown}
          </p>
          {soilChoice !== "auto" && (
            <button className="btn" onClick={() => setSoilChoice("auto")}>{t.useSuggestion}</button>
          )}
          <p className="muted small">{t.soilTest}</p>
        </section>

        <section className="stage">
          <div>
            <div className="map-wrap">
              <MapPicker
                pos={pos}
                label={label}
                layers={layers}
                selected={selectedFeature}
                focus={focus}
                onPick={(lat, lon) => pickPoint(lat, lon)}
                onView={setView}
              />
            </div>
            <ul className="legend" aria-label={t.legendTitle}>
              <li><i style={{ borderTopColor: LEVEL_COLORS.country }} />{t.legendCountry}</li>
              <li><i style={{ borderTopColor: LEVEL_COLORS.district }} />{t.legendDistrict}</li>
              <li><i style={{ borderTopColor: LEVEL_COLORS.upazila }} />{t.legendUpazila}</li>
              <li><i style={{ borderTopColor: LEVEL_COLORS.union }} />{t.legendUnion}</li>
              <li><i style={{ borderTopColor: LEVEL_COLORS.division }} />{t.legendDivision}</li>
            </ul>
            <p className="muted small">{t.legendSelected}</p>
          </div>
          <div className="viewer">
            <h2>{t.step3}</h2>
            <Weather
              t={t}
              lang={lang}
              forecast={forecast}
              history={history}
              loading={loading}
              error={error}
            />
          </div>
        </section>
      </main>

      <footer className="footer">{t.footer}</footer>
    </div>
  );
}