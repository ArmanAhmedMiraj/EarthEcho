import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LANGUAGES, TEXT } from "./i18n.js";
import { ADMIN_TEXT } from "./i18nAdmin.js";
import { CROP_TEXT } from "./i18nCrops.js";
import { TABS_TEXT } from "./i18nTabs.js";
import { DATA_TEXT } from "./i18nData.js";
import { WATER_TEXT } from "./i18nWater.js";
import { LEGEND_TEXT, LEVEL_COLORS, ZOOM } from "./legend.js";
import { SOIL_NOTE, SOIL_TYPES, loadSoilMap, lookupSoil, typicalSoil } from "./soil.js";
import { fetchForecast, fetchHistory } from "./weather.js";
import {
  EMPTY_CHAIN,
  SLOTS,
  buildChain,
  deepestOf,
  detectCountry,
  loadCountry,
  loadPart,
  loadRegistry,
  locate,
  partKey,
  pathText,
  titleOf,
} from "./admin.js";
import { nearestPlace } from "./nearby.js";
import Globe from "./Globe.jsx";
import Prepare from "./Prepare.jsx";
import Gallery, { usePlacePhotos } from "./Gallery.jsx";
import { START_TEXT } from "./i18nStart.js";
import { ENV_TEXT } from "./i18nEnv.js";
import { WEATHER_TEXT } from "./i18nWeather.js";
import { DISASTER_TEXT } from "./i18nDisasters.js";
import Disasters from "./Disasters.jsx";
import Irrigation from "./Irrigation.jsx";
import RotationPlanner from "./RotationPlanner.jsx";
import Market from "./Market.jsx";
import Suppliers from "./Suppliers.jsx";
import { SUPPLIER_TEXT } from "./i18nSuppliers.js";
import { MARKET_TEXT } from "./i18nMarket.js";
import { ROTATION_TEXT } from "./i18nRotation.js";
import { IRRIGATION_TEXT } from "./i18nIrrigation.js";
import { SOIL_TEXT } from "./i18nSoil.js";
import Soil from "./Soil.jsx";
import { SUIT_TEXT } from "./i18nSuit.js";
import Suitability from "./Suitability.jsx";
import Environment from "./Environment.jsx";
import AdminPicker from "./AdminPicker.jsx";
import MapPicker from "./MapPicker.jsx";
import Weather from "./Weather.jsx";
import Crops from "./Crops.jsx";
import Sources from "./Sources.jsx";
import "./crops.css";
import "./tabs.css";
import "./sources.css";

// The pages of the app. The address bar keeps the page (#/weather), so reload and the back button work.
const TABS = ["weather", "disasters", "irrigation", "rotation", "market", "suppliers", "crops", "suitability", "soil", "environment", "data"];

function tabFromHash() {
  const id = window.location.hash.replace(/^#\/?/, "");
  return TABS.includes(id) ? id : "crops";
}

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

// One point with a name for every area, placed at the area's middle.
// "rank" makes bigger areas get their name placed first, so small areas never hide big ones.
function namePoints(fc) {
  if (!fc) return null;
  const points = [];
  for (const f of fc.features) {
    const p = f.properties;
    if (!p || !p.name || p.lat == null || p.lon == null) continue;
    const b = p.bbox || [0, 0, 0, 0];
    const area = Math.abs((b[2] - b[0]) * (b[3] - b[1]));
    points.push({
      type: "Feature",
      properties: { name: p.name, rank: -area },
      geometry: { type: "Point", coordinates: [p.lon, p.lat] },
    });
  }
  return collection(points);
}

export default function App() {
  const [lang, setLang] = useState(() => readSaved("ef-lang", "en"));
  const [theme, setTheme] = useState(() => readSaved("ef-theme", phoneTheme()));
  const [pos, setPos] = useState({ lat: 25.75, lon: 89.25, name: null });
  const [soilChoice, setSoilChoice] = useState("auto"); // "auto" or a soil key
  const [soilMap, setSoilMap] = useState(null);

  const [registry, setRegistry] = useState([]); // the countries we have boundaries for
  const registryRef = useRef([]);
  const [admin, setAdmin] = useState(null); // the boundaries of the chosen country
  const [adminError, setAdminError] = useState(false);
  const [chainParts, setChainParts] = useState({}); // lazy levels of the chosen place: { level index: FeatureCollection }
  const [viewParts, setViewParts] = useState({}); // lazy levels of what is on screen
  const [place, setPlace] = useState(EMPTY_CHAIN);
  const [selected, setSelected] = useState(null); // { level, id }
  const [country, setCountry] = useState("BD"); // a country code, or "other"
  const [focus, setFocus] = useState(null);
  const [message, setMessage] = useState("");
  const [tab, setTab] = useState(tabFromHash);
  const [view, setView] = useState(null); // { zoom, bounds } of the map right now
  const started = useRef(false);
  // The app always opens on the location page. The other pages open only after a place is confirmed
  // and its data is prepared:  "explore" (choose a place)  >  "prepare" (loading screen)  >  "app" (dashboard)
  const [stage, setStage] = useState("explore");
  const stageRef = useRef("explore");
  stageRef.current = stage;
  const [userPicked, setUserPicked] = useState(false); // true once the farmer has chosen a place
  const [terrain, setTerrain] = useState(null); // { elevationM, slopePct } of the confirmed place
  const [soilData, setSoilData] = useState(null); // SoilGrids reading of the confirmed place
  const [envData, setEnvData] = useState(null); // NASA vegetation, land temperature and climate of the confirmed place
  const [satellite, setSatellite] = useState(null); // NASA SMAP / GPM readings of the confirmed place
  const snapshot = useRef(null); // the confirmed place, kept while the farmer looks for another one
  const [nearest, setNearest] = useState(null); // nearest named village / neighbourhood, from OpenStreetMap
  const pickToken = useRef(0);

  const [forecast, setForecast] = useState(null);
  const [history, setHistory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(null); // when the forecast was last fetched
  const [refreshing, setRefreshing] = useState(false);
  const weatherKey = useRef(""); // the place the forecast on screen belongs to
  const lastFetch = useRef(0);

  const t = { ...TEXT[lang], ...ADMIN_TEXT[lang], ...LEGEND_TEXT[lang], ...CROP_TEXT[lang], ...WATER_TEXT[lang], ...TABS_TEXT[lang], ...DATA_TEXT[lang], ...START_TEXT[lang], ...ENV_TEXT[lang], ...SOIL_TEXT[lang], ...SUIT_TEXT[lang], ...WEATHER_TEXT[lang], ...DISASTER_TEXT[lang], ...IRRIGATION_TEXT[lang], ...ROTATION_TEXT[lang], ...MARKET_TEXT[lang], ...SUPPLIER_TEXT[lang] };

  // Soil: the satellite-based map first, the regional guess only if the map has nothing.
  const mapSoil = lookupSoil(soilMap, pos.lat, pos.lon);
  const liveSoil = soilData && soilData.available && soilData.texture ? soilData.texture.simple : null;
  const suggested = liveSoil || mapSoil || typicalSoil(pos.lat, pos.lon);
  const suggestedFrom = liveSoil ? "live" : mapSoil ? "map" : "region";
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
    // a link to a dashboard page does not skip the location step
    if (window.location.hash) window.history.replaceState(null, "", window.location.pathname + window.location.search);
    const onHash = () => {
      if (stageRef.current === "app") setTab(tabFromHash());
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  // The map is built fresh each time the Location page opens, so start it on the current choice
  // (before any choice it is a turning globe).
  useEffect(() => {
    if (stage !== "explore") return;
    const found = deepestOf(place);
    if (!userPicked) setFocus(null);
    else if (found && found.item.bbox) setFocus({ key: Date.now(), bbox: found.item.bbox });
    else setFocus({ key: Date.now(), center: [pos.lon, pos.lat], zoom: 9 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  useEffect(() => {
    loadSoilMap().then(setSoilMap);
  }, []);

  // the list of countries, then the boundaries of Bangladesh (the starting country)
  useEffect(() => {
    loadRegistry()
      .then((list) => {
        registryRef.current = list;
        setRegistry(list);
        return loadCountry(list[0]);
      })
      .then(setAdmin)
      .catch(() => setAdminError(true));
  }, []);

  // once the first boundaries are loaded, work out where the starting point is
  useEffect(() => {
    if (admin && !started.current) {
      started.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [admin]);

  // the big levels are stored one file per top-level area: load the ones of the chosen place (for the dropdowns)
  useEffect(() => {
    if (!admin) {
      setChainParts({});
      return undefined;
    }
    let cancelled = false;
    const jobs = admin.levels
      .map((lv, i) => {
        const key = partKey(admin, i, place);
        return key ? loadPart(admin, i, key).then((fc) => [i, fc]).catch(() => null) : null;
      })
      .filter(Boolean);
    Promise.all(jobs).then((list) => {
      if (!cancelled) setChainParts(Object.fromEntries(list.filter(Boolean)));
    });
    return () => {
      cancelled = true;
    };
  }, [admin, place]);

  // Which top-level areas are on screen once you are zoomed in far enough to see the borders of a big level?
  const viewKeys = useMemo(() => {
    if (!admin || !view) return "";
    const [west, south, east, north] = view.bounds;
    const wanted = [];
    admin.levels.forEach((lv, i) => {
      if (!lv.lazy || view.zoom < ZOOM[SLOTS[i]] - 0.6) return;
      const keyLevel = admin.levels[SLOTS.indexOf(lv.lazy.keySlot)];
      const ids = keyLevel.fc.features
        .filter((f) => {
          const b = f.properties.bbox;
          return b[0] <= east && b[2] >= west && b[1] <= north && b[3] >= south;
        })
        .map((f) => f.properties.id);
      if (ids.length > 0 && ids.length <= 9) wanted.push(`${i}:${ids.join(",")}`);
    });
    return wanted.join("|");
  }, [admin, view]);

  // load those files (each file is loaded once and then kept)
  useEffect(() => {
    if (!viewKeys) {
      setViewParts({});
      return undefined;
    }
    let cancelled = false;
    Promise.all(
      viewKeys.split("|").map(async (part) => {
        const [index, ids] = part.split(":");
        const list = await Promise.all(ids.split(",").map((id) => loadPart(admin, Number(index), id).catch(() => null)));
        return [Number(index), collection(list.filter(Boolean).flatMap((fc) => fc.features))];
      })
    ).then((entries) => {
      if (!cancelled) setViewParts(Object.fromEntries(entries));
    });
    return () => {
      cancelled = true;
    };
  }, [viewKeys, admin]);

  // The nearest named village or neighbourhood of the chosen point (after a short pause, so a fast series of taps asks once)
  useEffect(() => {
    setNearest(null);
    if (!userPicked) return undefined;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      nearestPlace(pos.lat, pos.lon, lang, controller.signal)
        .then(setNearest)
        .catch(() => {});
    }, 700);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [pos.lat, pos.lon, lang, userPicked]);

  // Load weather whenever the point changes.
  useEffect(() => {
    let cancelled = false;
    const key = `${pos.lat},${pos.lon}`;
    weatherKey.current = key;
    setLoading(true);
    setError(false);
    Promise.allSettled([fetchForecast(pos.lat, pos.lon), fetchHistory(pos.lat, pos.lon)]).then(
      ([f, h]) => {
        if (cancelled) return;
        setForecast(f.status === "fulfilled" ? f.value : null);
        setHistory(h.status === "fulfilled" ? h.value : null);
        setUpdatedAt(f.status === "fulfilled" ? new Date() : null);
        if (f.status === "fulfilled") lastFetch.current = Date.now();
        setError(f.status !== "fulfilled");
        setLoading(false);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [pos.lat, pos.lon]);

  // Keep the forecast live: fetch it again in the background. If that fails, the last good forecast stays on screen.
  const refreshForecast = useCallback(() => {
    const key = `${pos.lat},${pos.lon}`;
    setRefreshing(true);
    fetchForecast(pos.lat, pos.lon)
      .then((f) => {
        if (weatherKey.current !== key) return; // the farmer moved the pin while this was loading
        setForecast(f);
        setUpdatedAt(new Date());
        setError(false);
        lastFetch.current = Date.now();
      })
      .catch(() => {})
      .finally(() => setRefreshing(false));
  }, [pos.lat, pos.lon]);

  useEffect(() => {
    const EVERY = 20 * 60 * 1000;
    const timer = setInterval(refreshForecast, EVERY);
    // coming back to the tab (or the phone waking up) after a while: refresh at once
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - lastFetch.current > 5 * 60 * 1000) refreshForecast();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refreshForecast]);

  // ---- choosing places ----
  const infoOf = (iso) => registryRef.current.find((c) => c.iso === iso);

  async function openCountry(iso) {
    const info = infoOf(iso);
    if (!info) throw new Error(`no boundaries for ${iso}`);
    const loaded = await loadCountry(info);
    setAdmin(loaded);
    setAdminError(false);
    return loaded;
  }

  // show a whole country on the map (some outlines, like the USA, cross the date line: use a centre and zoom then)
  function countryFocus(info) {
    if (info.bbox[2] - info.bbox[0] > 100) return { key: Date.now(), center: [info.centre.lon, info.centre.lat], zoom: 3.4 };
    return { key: Date.now(), bbox: info.bbox };
  }

  // a dropdown choice, a search result: fly to the whole area, pin in its middle
  async function selectArea(index, props, adm = admin) {
    const token = ++pickToken.current;
    const chain = await buildChain(adm, index, props);
    if (token !== pickToken.current) return;
    setUserPicked(true);
    setPlace(chain);
    setSelected({ level: SLOTS[index], id: props.id });
    setCountry(adm.iso);
    setMessage("");
    setPos({ lat: props.lat, lon: props.lon, name: titleOf(chain) });
    setSoilChoice("auto");
    setFocus({ key: Date.now(), bbox: props.bbox });
  }

  // choosing a country: show it whole, pin in its middle
  async function resetCountry(iso) {
    const token = ++pickToken.current;
    setMessage("");
    let loaded = admin;
    if (!admin || admin.iso !== iso) {
      try {
        loaded = await openCountry(iso);
      } catch {
        setAdminError(true);
        return;
      }
    }
    if (token !== pickToken.current) return;
    setUserPicked(true);
    const info = loaded.info;
    setPlace(EMPTY_CHAIN);
    setSelected(null);
    setCountry(iso);
    setPos({ lat: info.centre.lat, lon: info.centre.lon, name: info.name[lang] });
    setSoilChoice("auto");
    setFocus(countryFocus(info));
  }

  // a tap on the map (or "use my location"): the exact point, which country it is in, and which area
  async function pickPoint(lat, lon, options = {}) {
    const latFixed = Number(lat.toFixed(4));
    const lonFixed = Number(lon.toFixed(4));
    const token = ++pickToken.current;
    setMessage("");

    let loaded = admin;
    let chain = EMPTY_CHAIN;
    let iso = null;
    try {
      const list = registryRef.current;
      iso = list.length > 0 ? await detectCountry(list, latFixed, lonFixed) : admin ? admin.iso : null;
      if (iso) {
        if (!loaded || loaded.iso !== iso) loaded = await openCountry(iso);
        chain = (await locate(loaded, latFixed, lonFixed)) || EMPTY_CHAIN;
      }
    } catch {
      chain = EMPTY_CHAIN;
    }
    if (token !== pickToken.current) return; // a newer tap replaced this one

    const found = deepestOf(chain);
    if (!options.initial) setUserPicked(true);
    setPlace(chain);
    setSelected(found ? { level: found.level, id: found.item.id } : null);
    setCountry(iso && loaded && loaded.iso === iso ? iso : "other");
    setPos({ lat: latFixed, lon: lonFixed, name: titleOf(chain) || options.name || null });
    setSoilChoice("auto");
    if (options.fly) setFocus({ key: Date.now(), center: [lonFixed, latFixed], zoom: found ? 11 : 9 });
    if (!iso) setMessage(t.outsideCountry);
  }

  function onLevel(index, id) {
    if (!admin) return;
    if (!id) {
      const above = index > 0 ? place[SLOTS[index - 1]] : null;
      if (above) selectArea(index - 1, above);
      else resetCountry(admin.iso);
      return;
    }
    const lv = admin.levels[index];
    const pool = lv.fc || chainParts[index];
    const found = pool ? pool.features.find((f) => f.properties.id === id) : null;
    if (found) selectArea(index, found.properties);
  }

  function onCountry(value) {
    if (value === "other") {
      setCountry("other");
      setPlace(EMPTY_CHAIN);
      setSelected(null);
      setMessage("");
    } else {
      resetCountry(value);
    }
  }

  async function onPickEntry(entry) {
    if (!admin) return;
    const index = SLOTS.indexOf(entry.l);
    const lv = admin.levels[index];
    let props = null;
    if (lv.fc) {
      const f = lv.fc.features.find((x) => x.properties.id === entry.i);
      props = f ? f.properties : null;
    } else {
      try {
        // the file of a big level is only known by position: find the area at the search result's middle point
        const chain = await locate(admin, entry.y, entry.x);
        if (chain && chain[entry.l] && chain[entry.l].id === entry.i) props = chain[entry.l];
      } catch {
        /* fall through to the search entry itself */
      }
    }
    if (!props) props = { id: entry.i, name: entry.n, parent: null, lat: entry.y, lon: entry.x, bbox: entry.b };
    selectArea(index, props);
  }

  // a place found by name anywhere in the world: pick its point (inside the 7 countries it also finds the area)
  function onPickWorld(r) {
    pickPoint(r.lat, r.lon, { fly: true, name: r.name });
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
    const index = SLOTS.indexOf(selected.level);
    const lv = admin.levels[index];
    if (!lv) return null;
    const pool = lv.fc || chainParts[index];
    const found = pool ? pool.features.find((f) => f.properties.id === selected.id) : null;
    return found ? { type: "Feature", properties: { level: selected.level }, geometry: found.geometry } : null;
  }, [selected, admin, chainParts]);

  // the borders of each level: a big level is only there for the top-level areas on screen
  const levelFc = (i) => {
    const lv = admin && admin.levels[i];
    return lv ? lv.fc || viewParts[i] || null : null;
  };
  const fc0 = levelFc(0);
  const fc1 = levelFc(1);
  const fc2 = levelFc(2);
  const fc3 = levelFc(3);

  // place names for the map (built once per file, not on every move)
  const divisionNames = useMemo(() => namePoints(fc0), [fc0]);
  const districtNames = useMemo(() => namePoints(fc1), [fc1]);
  const upazilaNames = useMemo(() => namePoints(fc2), [fc2]);
  const unionNames = useMemo(() => namePoints(fc3), [fc3]);

  const label = {
    title: pos.name || t.pickedPoint,
    path: pathText(place),
    coords: `${t.latShort} ${pos.lat} · ${t.lonShort} ${pos.lon}`,
  };

  const layers = {
    country: admin ? admin.country : null,
    divisions: fc0, // always on, together with the country border
    districts: fc1, // fade in when you zoom in
    upazilas: fc2,
    unions: fc3,
    divisionNames,
    districtNames,
    upazilaNames,
    unionNames,
  };

  // what the photo gallery looks for: the country, or the deepest area chosen
  const photoTarget = useMemo(() => {
    if (!admin || !userPicked || country === "other") return null;
    const info = admin.info;
    const d = deepestOf(place);
    if (!d) return { id: info.iso, kind: "country", name: info.name.en, country: info.name.en, bbox: info.bbox, countryBbox: info.bbox };
    const parents = [];
    for (let i = d.index - 1; i >= 0; i -= 1) if (place[SLOTS[i]]) parents.push(place[SLOTS[i]].name);
    return {
      id: d.item.id, kind: "place", name: d.item.name, parents, country: info.name.en,
      lat: d.item.lat, lon: d.item.lon, level: d.index, bbox: d.item.bbox, countryBbox: info.bbox,
    };
  }, [admin, userPicked, country, place]);
  const photos = usePlacePhotos(photoTarget);

  const picker = (
    <AdminPicker
      t={t}
      lang={lang}
      registry={registry}
      info={admin ? admin.info : null}
      admin={admin}
      adminError={adminError}
      chainParts={chainParts}
      place={place}
      country={country}
      message={message}
      onCountry={onCountry}
      onLevel={onLevel}
      onPickEntry={onPickEntry}
      onPickWorld={onPickWorld}
      onUseLocation={onUseLocation}
    />
  );

  // the dashboard's "change location": remember the confirmed place so the farmer can go back to it
  function changeLocation() {
    snapshot.current = { pos, place, selected, country, soilChoice, userPicked };
    window.location.hash = "";
    setStage("explore");
  }

  function keepLocation() {
    const saved = snapshot.current;
    if (saved) {
      pickToken.current += 1; // a lookup still running must not undo this
      setPos(saved.pos);
      setPlace(saved.place);
      setSelected(saved.selected);
      setCountry(saved.country);
      setSoilChoice(saved.soilChoice);
      setUserPicked(saved.userPicked);
    }
    setMessage("");
    window.location.hash = `/${tab}`;
    setStage("app");
  }

  function confirmLocation() {
    if (!userPicked) return;
    // the old place's results must never show for the new one
    setTerrain(null);
    setSatellite(null);
    setEnvData(null);
    setSoilData(null);
    snapshot.current = null;
    setStage("prepare");
  }

  if (stage === "prepare") {
    return (
      <Prepare
        t={t}
        lang={lang}
        lat={pos.lat}
        lon={pos.lon}
        title={label.title}
        path={label.path}
        ready={{
          soilReady: soilMap !== null,
          soilText: soil ? t.soilNames[soil] : "",
          weatherDone: !loading,
          weatherOk: !error && !!forecast,
          historyOk: !!history,
        }}
        onDone={(found) => {
          if (stageRef.current !== "prepare") return;
          setTerrain(found.terrain);
          setSatellite(found.satellite);
          setEnvData(found.env);
          setSoilData(found.soil);
          window.location.hash = "/crops";
          setTab("crops");
          setStage("app");
        }}
      />
    );
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          {stage === "app" ? (
            <Globe className="mini" lat={pos.lat} lon={pos.lon} spin orbit scan />
          ) : (
            <span className="logo" aria-hidden="true">◎</span>
          )}
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

      {stage === "app" && (
        <>
          <nav className="tabs" aria-label={t.tabsLabel}>
            {TABS.filter((id) => id !== "crops" || country === "BD").map((id) => (
              <button
                key={id}
                className="tab"
                aria-current={(tab === "crops" && country !== "BD" ? "rotation" : tab) === id ? "page" : undefined}
                onClick={() => {
                  window.location.hash = `/${id}`;
                }}
              >
                {{ weather: t.tabWeather, disasters: t.tabDisasters, irrigation: t.tabIrrigation, rotation: t.tabRotation, market: t.tabMarket, suppliers: t.tabSuppliers, crops: t.tabCrops, suitability: t.tabSuit, soil: t.tabSoil, environment: t.tabEnv, data: t.tabData }[id]}
              </button>
            ))}
          </nav>

          <Gallery t={t} state={photos} banner>
            <button className="placebar-place" onClick={changeLocation} title={t.changeLocationHint}>
              <strong>{label.title} <span className="locbar-edit">✎ {t.changeLocationHint}</span></strong>
              <span className="small">
                {label.path && label.path !== label.title ? `${label.path} · ` : ""}
                {pos.lat}, {pos.lon}
                {terrain ? ` · ${t.elevationShort}: ${terrain.elevationM} m` : ""}
                {soil ? ` · ${t.locbarSoil}: ${t.soilNames[soil]}` : ""}
              </span>
            </button>
            <button className="btn" onClick={changeLocation}>{t.locbarChange}</button>
          </Gallery>
        </>
      )}

      {stage === "explore" && (
        <main className="layout">
        <section className="panel">
          <h2>{t.step1}</h2>
          {picker}
          <p className="muted small">{t.tapMap}</p>
          {userPicked && (
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
              {nearest && (
                <>
                  <br />
                  <strong>{t.nearestPlace}:</strong> {nearest.name}
                  {nearest.postcode ? ` (${nearest.postcode})` : ""}{" "}
                  <span className="muted">· OpenStreetMap</span>
                </>
              )}
            </p>
          )}

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
                ? (suggestedFrom === "live" ? t.soilNoteLive : SOIL_NOTE[lang][suggestedFrom])
                : t.soilUnknown}
          </p>
          {soilChoice !== "auto" && (
            <button className="btn" onClick={() => setSoilChoice("auto")}>{t.useSuggestion}</button>
          )}
          <p className="muted small">{t.soilTest}</p>

          <div className="confirm-box">
            {!userPicked && <p className="muted small">{t.confirmFirst}</p>}
            <button className="btn wide" disabled={!userPicked} onClick={confirmLocation}>{t.confirmLocation}</button>
            {snapshot.current && <button className="btn" onClick={keepLocation}>{t.keepLocation}</button>}
          </div>
        </section>

        <section className="stage">
          <div>
            <div className="map-wrap tall">
              <MapPicker
                pos={pos}
                label={label}
                layers={layers}
                selected={selectedFeature}
                focus={focus}
                chosen={userPicked}
                onPick={(lat, lon) => pickPoint(lat, lon, { fly: !view || view.zoom < 5 })}
                onView={setView}
              />
            </div>
            {userPicked && <Gallery t={t} title={label.title} subtitle={label.path} state={photos} />}
            <ul className="legend" aria-label={t.legendTitle}>
              <li><i style={{ borderTopColor: LEVEL_COLORS.country }} />{t.legendCountry}</li>
              {admin &&
                admin.info.levels.map((lv, i) => (
                  <li key={i}>
                    <i style={{ borderTopColor: LEVEL_COLORS[SLOTS[i]] }} />
                    {lv[lang]}
                    {i > 0 ? ` ${t.legendZoomIn}` : ""}
                  </li>
                ))}
            </ul>
            <p className="muted small">{t.legendSelected}</p>
            <p className="muted small">{t.legendNames}</p>
          </div>
        </section>
        </main>
      )}

      {stage === "app" && tab === "weather" && (
        <main className="page">
          <div className="viewer">
            <h2>{t.step3}</h2>
            <Weather
              key={`${pos.lat},${pos.lon}`}
              t={t}
              lang={lang}
              lat={pos.lat}
              lon={pos.lon}
              country={country}
              history={history}
            />
          </div>
        </main>
      )}

      {stage === "app" && tab === "crops" && country === "BD" && (
        <main className="page">
          <div className="viewer">
            <Crops
              t={t}
              lang={lang}
              districtName={country === "BD" && place.district ? place.district.name : ""}
              soil={soil}
              soilLabel={soil ? t.soilNames[soil] : ""}
              forecast={forecast}
              updatedAt={updatedAt}
              refreshing={refreshing}
              onRefresh={refreshForecast}
              place={{ title: label.title, path: label.path, lat: pos.lat, lon: pos.lon }}
            />
          </div>
        </main>
      )}

      {stage === "app" && tab === "suitability" && (
        <main className="page">
          <Suitability
            key={`${pos.lat},${pos.lon}`}
            t={t}
            lang={lang}
            lat={pos.lat}
            lon={pos.lon}
            env={envData}
            soilData={soilData}
          />
        </main>
      )}

      {stage === "app" && tab === "disasters" && (
        <main className="page">
          <div className="viewer">
            <h2>{t.dsTitle}</h2>
            <Disasters key={`${pos.lat},${pos.lon}`} t={t} lang={lang} lat={pos.lat} lon={pos.lon} country={country} />
          </div>
        </main>
      )}

      {stage === "app" && tab === "irrigation" && (
        <main className="page">
          <div className="viewer">
            <h2>{t.irTitle}</h2>
            <Irrigation
              key={`${pos.lat},${pos.lon}`}
              t={t}
              lang={lang}
              lat={pos.lat}
              lon={pos.lon}
              country={country}
              soil={soil}
              soilMapped={suggested}
              satellite={satellite}
            />
          </div>
        </main>
      )}

      {stage === "app" && (tab === "rotation" || (tab === "crops" && country !== "BD")) && (
        <main className="page">
          <div className="viewer">
            <h2>{t.rtTitle}</h2>
            <RotationPlanner key={`${pos.lat},${pos.lon}`} t={t} lang={lang} lat={pos.lat} lon={pos.lon} country={country} env={envData} soilData={soilData} />
          </div>
        </main>
      )}

      {stage === "app" && tab === "market" && (
        <main className="page">
          <div className="viewer">
            <h2>{t.mkTitle}</h2>
            <Market key={`${pos.lat},${pos.lon}`} t={t} lang={lang} lat={pos.lat} lon={pos.lon} country={country} />
          </div>
        </main>
      )}

      {stage === "app" && tab === "suppliers" && (
        <main className="page">
          <div className="viewer">
            <h2>{t.spTitle}</h2>
            <Suppliers key={`${pos.lat},${pos.lon}`} t={t} lang={lang} lat={pos.lat} lon={pos.lon} />
          </div>
        </main>
      )}

      {stage === "app" && tab === "soil" && (
        <main className="page">
          <Soil
            key={`${pos.lat},${pos.lon}`}
            t={t}
            lang={lang}
            lat={pos.lat}
            lon={pos.lon}
            country={country}
            initial={soilData}
            satellite={satellite}
            chosen={soilChoice !== "auto" ? soilChoice : null}
            suggested={soil}
          />
        </main>
      )}

      {stage === "app" && tab === "environment" && (
        <main className="page">
          <Environment
            key={`${pos.lat},${pos.lon}`}
            t={t}
            lang={lang}
            lat={pos.lat}
            lon={pos.lon}
            initial={envData}
            satellite={satellite}
            terrain={terrain}
          />
        </main>
      )}

      {stage === "app" && tab === "data" && (
        <main className="page">
          <Sources t={t} lang={lang} lat={pos.lat} lon={pos.lon} />
        </main>
      )}

      <footer className="footer">
        {t.footer}{" "}
        <a href={`${import.meta.env.BASE_URL}admin/world/ATTRIBUTION.md`} target="_blank" rel="noreferrer">{t.boundaryCredits}</a>
      </footer>
    </div>
  );
}