import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LANGUAGES, TEXT } from "./i18n.js";
import { ADMIN_TEXT } from "./i18nAdmin.js";
import { TABS_TEXT } from "./i18nTabs.js";
import { DATA_TEXT } from "./i18nData.js";
import { LEGEND_TEXT, LEVEL_COLORS, ZOOM } from "./legend.js";
import { loadSoilMap, lookupSoil, typicalSoil } from "./soil.js";
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
import Prepare from "./Prepare.jsx";
import Gallery, { usePlacePhotos } from "./Gallery.jsx";
import { START_TEXT } from "./i18nStart.js";
import { ENV_TEXT } from "./i18nEnv.js";
import { WEATHER_TEXT } from "./i18nWeather.js";
import { TRUST_TEXT } from "./i18nTrust.js";
import { SHEET_TEXT } from "./i18nSheet.js";
import { ACCOUNT_TEXT, ACCOUNT_USER_TEXT } from "./i18nAccount.js";
import { FARMLAND_TEXT } from "./i18nFarmland.js";
import { WF_TEXT } from "./i18nWeatherFarmer.js";
import PlotBar from "./PlotBar.jsx";
import { areaSqm, plotLabel } from "./geo.js";
import { Landing, AuthModal, AccountControl, GuestBar, GuestReminder, Flash } from "./Account.jsx";
import { getUser, isGuestChosen, chooseGuest, startAutoSync, checkSession } from "./account.js";
import ErrorBoundary from "./ErrorBoundary.jsx";
import { DISASTER_TEXT } from "./i18nDisasters.js";
import { RIVER_TEXT } from "./i18nRiver.js";
import Disasters from "./Disasters.jsx";
const Irrigation = lazy(() => import("./Irrigation.jsx"));
const RotationPlanner = lazy(() => import("./RotationPlanner.jsx"));
const Market = lazy(() => import("./Market.jsx"));
const Suppliers = lazy(() => import("./Suppliers.jsx"));
import Farms from "./Farms.jsx";
import { FARMS_TEXT } from "./i18nFarms.js";
import { FIELDS_TEXT } from "./i18nFields.js";
import { keepStorage, loadActiveId, loadFields, newId, saveActiveId, saveFields, sameSpot } from "./fields.js";
const Assistant = lazy(() => import("./Assistant.jsx"));
import { ASSISTANT_TEXT } from "./i18nAssistant.js";
import { SUPPLIER_TEXT } from "./i18nSuppliers.js";
import { MARKET_TEXT } from "./i18nMarket.js";
import { ROTATION_TEXT } from "./i18nRotation.js";
import { STRATEGY_TEXT } from "./i18nStrategy.js";
import { IRRIGATION_TEXT } from "./i18nIrrigation.js";
import { IRR2_TEXT } from "./i18nIrr2.js";
import { BOARD_TEXT } from "./i18nBoard.js";
import { EVID_TEXT } from "./i18nEvidence.js";
import { SOIL_TEXT } from "./i18nSoil.js";
const Soil = lazy(() => import("./Soil.jsx"));
import { SUIT_TEXT } from "./i18nSuit.js";
const Suitability = lazy(() => import("./Suitability.jsx"));
const Environment = lazy(() => import("./Environment.jsx"));
import AdminPicker from "./AdminPicker.jsx";
const MapPicker = lazy(() => import("./MapPicker.jsx"));
const Weather = lazy(() => import("./Weather.jsx"));
import Logo from "./Logo.jsx";
import Icon from "./Icons.jsx";
import { SHELL_TEXT } from "./i18nShell.js";
import { ORBIT_TEXT } from "./i18nOrbit.js";
const Sources = lazy(() => import("./Sources.jsx"));

// The pages load when first opened. So that every tab also opens with no internet, they are all fetched once
// in the background a few seconds after the app starts (the service worker keeps them). Skipped on "Data Saver".
const PAGE_LOADERS = [
  () => import("./Irrigation.jsx"), () => import("./RotationPlanner.jsx"), () => import("./Market.jsx"),
  () => import("./Suppliers.jsx"), () => import("./Assistant.jsx"), () => import("./Soil.jsx"),
  () => import("./Suitability.jsx"), () => import("./Environment.jsx"), () => import("./Weather.jsx"),
  () => import("./Sources.jsx"), () => import("./NasaMap.jsx"),
];
import "./tabs.css";
import "./sources.css";

// The pages of the app. The address bar keeps the page (#/weather), so reload and the back button work.
// the pages that follow the open plot (the others cover the whole location)
const PLOT_TABS = ["farms", "irrigation", "rotation", "assistant", "suitability", "soil"];
// the navigation: pages grouped by what the farmer is doing; the first four also sit in the phone's bottom bar
const NAV_GROUPS = [
  { label: null, items: ["farms"] },
  { label: "navToday", items: ["weather", "disasters", "irrigation"] },
  { label: "navPlan", items: ["rotation", "suitability", "market", "suppliers"] },
  { label: "navLand", items: ["soil", "environment"] },
  { label: "navHelp", items: ["assistant", "data"] },
];
const NAV_PRIMARY = ["farms", "weather", "irrigation", "rotation"];
const TABS = ["farms", "weather", "disasters", "irrigation", "rotation", "market", "suppliers", "assistant", "suitability", "soil", "environment", "data"];

function tabFromHash() {
  const id = window.location.hash.replace(/^#\/?/, "");
  return TABS.includes(id) ? id : "farms";
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
  const [country, setCountry] = useState(""); // "" until the farmer chooses; then a country code, or "other"
  const [focus, setFocus] = useState(null);
  const [message, setMessage] = useState("");
  const [tab, setTab] = useState(tabFromHash);
  const [navOpen, setNavOpen] = useState(false); // the phone's "all pages" sheet
  useEffect(() => {
    if (!navOpen) return undefined;
    const onKey = (e) => { if (e.key === "Escape") setNavOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navOpen]);
  const [explainReq, setExplainReq] = useState(null); // a strategy the farmer asked the assistant to explain
  const explainStrategy = (req) => { setExplainReq({ ...req, id: Date.now() }); window.location.hash = "/assistant"; setTab("assistant"); };
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => { window.removeEventListener("online", up); window.removeEventListener("offline", down); };
  }, []);
  const [view, setView] = useState(null); // { zoom, bounds } of the map right now
  const started = useRef(false);
  // The app always opens on the location page. The other pages open only after a place is confirmed
  // and its data is prepared:  "explore" (choose a place)  >  "prepare" (loading screen)  >  "app" (dashboard)
  // "boot": saved fields exist, so the app opens the active one straight away
  const [fields, setFields] = useState(loadFields);
  const [activeId, setActiveId] = useState(loadActiveId);
  // the plot that is open in each location (kept on this device)
  const [activePlots, setActivePlots] = useState(() => { try { return JSON.parse(localStorage.getItem("ef-active-plots") || "{}") || {}; } catch { return {}; } });
  const activePlotsRef = useRef(activePlots);
  activePlotsRef.current = activePlots;
  const bootRef = useRef(fields.length > 0);
  const nextTab = useRef("farms"); // the tab to open once a field has been prepared
  const [movingId, setMovingId] = useState(""); // a saved field whose pin is being moved
  const [newName, setNewName] = useState(""); // the name typed for a field that is about to be saved
  const [user] = useState(getUser); // the signed-in person, or null for a guest
  const [stage, setStage] = useState(() => (fields.length > 0 ? "boot" : user || isGuestChosen() ? "explore" : "welcome"));
  const [authModal, setAuthModal] = useState(null); // null | "login" | "register"
  const [reminder, setReminder] = useState(null); // null | "visit" | "farm": the guest notice on screen
  const returningGuest = useRef(!user && fields.length > 0); // saved fields from an earlier visit were already here when the app opened
  const remindedVisit = useRef(false);
  const stageRef = useRef(stage);
  stageRef.current = stage;

  // signed in: keep My Farm in step with the account, and pick up changes made on another device
  useEffect(() => {
    if (!user) return undefined;
    startAutoSync();
    checkSession();
    const pulled = () => { setFields(loadFields()); setActiveId(loadActiveId()); };
    window.addEventListener("ef-synced", pulled);
    return () => window.removeEventListener("ef-synced", pulled);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // a guest who comes back to saved fields is reminded, once per visit, that the data lives only on this device
  useEffect(() => {
    if (stage !== "app" || user || !returningGuest.current || remindedVisit.current) return;
    remindedVisit.current = true;
    let seen = false;
    try { seen = sessionStorage.getItem("ef-remind-visit") === "1"; sessionStorage.setItem("ef-remind-visit", "1"); } catch { /* storage blocked */ }
    if (!seen) setReminder("visit");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  // a guest who starts typing farm details is reminded once per visit
  const farmTyping = () => {
    if (user || reminder) return;
    try {
      if (sessionStorage.getItem("ef-remind-farm") === "1") return;
      sessionStorage.setItem("ef-remind-farm", "1");
    } catch { /* storage blocked: the notice may show again, which is harmless */ }
    setReminder("farm");
  };
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

  const t = { ...TEXT[lang], ...ADMIN_TEXT[lang], ...LEGEND_TEXT[lang], ...TABS_TEXT[lang], ...DATA_TEXT[lang], ...START_TEXT[lang], ...ENV_TEXT[lang], ...SOIL_TEXT[lang], ...SUIT_TEXT[lang], ...WEATHER_TEXT[lang], ...DISASTER_TEXT[lang], ...RIVER_TEXT[lang], ...IRRIGATION_TEXT[lang], ...IRR2_TEXT[lang], ...BOARD_TEXT[lang], ...EVID_TEXT[lang], ...SHELL_TEXT[lang], ...ORBIT_TEXT[lang], ...ROTATION_TEXT[lang], ...STRATEGY_TEXT[lang], ...TRUST_TEXT[lang], ...SHEET_TEXT[lang], ...MARKET_TEXT[lang], ...SUPPLIER_TEXT[lang], ...FARMS_TEXT[lang], ...FIELDS_TEXT[lang], ...ASSISTANT_TEXT[lang], ...ACCOUNT_TEXT[lang], ...FARMLAND_TEXT[lang], ...WF_TEXT[lang], ...(user ? ACCOUNT_USER_TEXT[lang] : {}) };

  // Soil: the satellite-based map first, the regional guess only if the map has nothing.
  const mapSoil = lookupSoil(soilMap, pos.lat, pos.lon);
  const liveSoil = soilData && soilData.available && soilData.texture ? soilData.texture.simple : null;
  const suggested = liveSoil || mapSoil || typicalSoil(pos.lat, pos.lon);
  const soil = soilChoice === "auto" ? suggested : soilChoice;

  // ---- My Farm: the saved fields, and the one that is open ----
  const activeField = fields.find((f) => f.id === activeId) || null;
  const plots = activeField ? activeField.parcels : [];
  const activePlotId = activeField ? (plots.some((p) => p.id === activePlots[activeId]) ? activePlots[activeId] : plots[0].id) : "";
  const activePlot = plots.find((p) => p.id === activePlotId) || null;
  // the open location as the plot pages see it: the plot's own details, and its name next to the location's
  const plotField = useMemo(() => {
    if (!activeField || !activePlot) return activeField;
    const i = plots.indexOf(activePlot);
    return { ...activeField, details: activePlot.details || {}, plotId: activePlot.id, name: plots.length > 1 ? `${activeField.name} · ${plotLabel(activePlot, i, t)}` : activeField.name };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeField, activePlotId, lang]);
  const patchPlot = (patch) => activeField && updateField(activeField.id, { details: { ...((activePlot && activePlot.details) || {}), ...patch } });
  useEffect(() => { saveFields(fields); }, [fields]);
  useEffect(() => {
    const saveData = navigator.connection && navigator.connection.saveData;
    if (saveData) return undefined;
    const timer = setTimeout(() => PAGE_LOADERS.forEach((load) => load().catch(() => {})), 4000);
    return () => clearTimeout(timer);
  }, []);
  useEffect(() => { saveActiveId(activeId); }, [activeId]);
  useEffect(() => { keepStorage(); }, []);
  // Details (crop, soil, records ...) belong to a plot: a "details" change is written into the open plot of that location.
  const updateField = (id, patch) =>
    setFields((list) => list.map((f) => {
      if (f.id !== id) return f;
      const next = { ...patch };
      if (next.details) {
        const want = activePlotsRef.current[f.id];
        const pid = f.parcels.some((p) => p.id === want) ? want : f.parcels[0].id;
        next.parcels = (next.parcels || f.parcels).map((p) => (p.id === pid ? { ...p, details: next.details } : p));
        delete next.details;
      }
      return { ...f, ...next, updatedAt: Date.now() };
    }));
  const selectPlot = (plotId) => {
    if (!activeId) return;
    setActivePlots((cur) => {
      const next = { ...cur, [activeId]: plotId };
      try { localStorage.setItem("ef-active-plots", JSON.stringify(next)); } catch { /* not remembered */ }
      return next;
    });
  };
  // what EarthEcho worked out for the open field (kept apart from what the farmer types)
  const systemNow = useMemo(() => {
    if (stage !== "app" || !activeId) return null;
    const tex = soilData && soilData.available ? soilData.texture : null;
    return {
      soil: suggested
        ? { key: suggested, source: liveSoil ? "satellite" : mapSoil ? "map" : "region", confidence: tex && tex.groupConfidence != null ? Math.round(tex.groupConfidence) : null, level: tex ? tex.confidenceLevel || null : null }
        : null,
      elevationM: terrain ? terrain.elevationM : null,
      slopePct: terrain ? terrain.slopePct : null,
    };
  }, [stage, activeId, suggested, liveSoil, mapSoil, soilData, terrain]);
  const systemKey = JSON.stringify(systemNow);
  useEffect(() => {
    if (!systemNow || !activeField) return;
    if (JSON.stringify(activeField.system) !== systemKey) updateField(activeField.id, { system: systemNow });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [systemKey, activeId]);
  // the farmer's own soil replaces the estimate for every tab (the estimate itself stays saved)
  const soilOverride = activePlot && activePlot.details ? activePlot.details.soil || "" : "";
  useEffect(() => { if (activeId) setSoilChoice(soilOverride || "auto"); }, [soilOverride, activeId, activePlotId]);

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

  // saved fields: once the country list is ready, open the field that was open last time
  useEffect(() => {
    if (!bootRef.current || (registry.length === 0 && !adminError)) return;
    bootRef.current = false;
    const f = fields.find((x) => x.id === activeId) || fields[0];
    if (!f) { setStage("explore"); return; }
    openField(f, { tab: "farms" }).catch(() => setStage("explore"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registry, adminError]);

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
    if (!value) return;
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

  const layersAll = {
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
  // nothing is outlined on the globe until a country is chosen
  const layers = country ? layersAll : Object.fromEntries(Object.keys(layersAll).map((k) => [k, null]));

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

  // move the open field to another place on the map (its name and details stay)
  function startMove() {
    if (!activeField) return;
    setMovingId(activeField.id);
    changeLocation();
  }

  function keepLocation() {
    setMovingId("");
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

  function startPrepare() {
    // the old place's results must never show for the new one
    setTerrain(null);
    setSatellite(null);
    setEnvData(null);
    setSoilData(null);
    snapshot.current = null;
    setStage("prepare");
  }

  // the soil the farmer chose for the plot that is open in a location
  const plotSoil = (f) => {
    const want = activePlotsRef.current[f.id];
    const p = (f.parcels || []).find((x) => x.id === want) || (f.parcels || [])[0];
    return (p && p.details && p.details.soil) || "auto";
  };

  // saving the chosen place as a field (or opening the field that is already saved there)
  function confirmLocation() {
    if (!userPicked) return;
    const here = { lat: pos.lat, lon: pos.lon };
    if (movingId) {
      const moved = fields.find((f) => f.id === movingId);
      if (moved) {
        updateField(moved.id, { lat: pos.lat, lon: pos.lon, country, path: label.path || "", system: null });
        setActiveId(moved.id);
      }
      setMovingId("");
      nextTab.current = "farms";
      startPrepare();
      return;
    }
    const existing = fields.find((f) => sameSpot(f, here));
    if (existing) {
      setActiveId(existing.id);
      setSoilChoice(plotSoil(existing));
    } else {
      const field = {
        id: newId(),
        name: (newName.trim() || label.title || "Field").slice(0, 80),
        lat: pos.lat,
        lon: pos.lon,
        country,
        path: label.path || "",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        details: {},
        parcels: [{ id: "p1", name: "", points: [], details: {} }],
        system: null,
      };
      setFields((list) => [...list, field]);
      setActiveId(field.id);
    }
    setNewName("");
    nextTab.current = "farms";
    startPrepare();
  }

  // a saved field: find its country and area, then prepare it like a place confirmed on the map
  async function openField(field, opts = {}) {
    setActiveId(field.id);
    await pickPoint(field.lat, field.lon, { name: field.name });
    setSoilChoice(plotSoil(field));
    nextTab.current = opts.tab || "farms";
    startPrepare();
  }

  function removeField(field) {
    if (!window.confirm(t.fdConfirmDelete)) return;
    const rest = fields.filter((f) => f.id !== field.id);
    setFields(rest);
    if (field.id !== activeId) return;
    if (rest.length > 0) {
      openField(rest[0], { tab: "farms" });
    } else {
      setActiveId("");
      setUserPicked(false);
      snapshot.current = null;
      window.location.hash = "";
      setStage("explore");
    }
  }

  useEffect(() => {
    document.documentElement.dataset.tab = stage === "app" ? tab : stage;
  }, [stage, tab]);

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
          const next = nextTab.current;
          nextTab.current = "farms";
          window.location.hash = `/${next}`;
          setTab(next);
          setStage("app");
        }}
      />
    );
  }

  if (stage === "boot") {
    return (
      <div className="app">
        <div className="boot" role="status">
          <Logo size={96} />
          <p>{t.fdLoadingField}</p>
        </div>
      </div>
    );
  }

  const tabLabel = (id) => ({ weather: t.tabWeather, disasters: t.tabDisasters, irrigation: t.tabIrrigation, rotation: t.tabRotation, market: t.tabMarket, suppliers: t.tabSuppliers, farms: t.tabFarms, assistant: t.tabAssistant, suitability: t.tabSuit, soil: t.tabSoil, environment: t.tabEnv, data: t.tabData }[id]);
  const goTab = (id) => { window.location.hash = `/${id}`; setNavOpen(false); };

  return (
    <div className={`app${stage === "app" ? " has-nav" : ""}`}>
      {stage !== "app" && (
      <header className="topbar">
          <div className="brand">
            <Logo size={76} />
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
            <button className="tab icon-btn" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label={theme === "dark" ? t.themeLight : t.themeDark} title={theme === "dark" ? t.themeLight : t.themeDark}>
              <Icon name={theme === "dark" ? "sun" : "moon"} size={20} />
            </button>
            {stage !== "welcome" && <AccountControl t={t} user={user} onLogin={() => setAuthModal("login")} />}
          </div>
        </header>
      )}
      <Flash t={t} />
      {!user && stage !== "welcome" && stage !== "app" && <GuestBar t={t} onLogin={() => setAuthModal("register")} />}
      {authModal && <AuthModal t={t} initialTab={authModal} onClose={() => setAuthModal(null)} />}
      {reminder && (
        <GuestReminder
          t={t}
          kind={reminder}
          onClose={() => setReminder(null)}
          onLogin={() => { setReminder(null); setAuthModal("register"); }}
        />
      )}
      {stage === "welcome" && <Landing t={t} onGuest={() => { chooseGuest(); setStage("explore"); }} />}

      <ErrorBoundary title={t.pageNeedsNet} retry={t.envRetry}>
      <Suspense fallback={<p className="muted page-loading" role="status">{t.fdLoadingField}</p>}>
      {stage === "app" && (
        <>
          {!online && <div className="fm-offline" role="status">{t.fmOffline}</div>}
          {/* desktop: a sidebar with every page, grouped. phone: the same list opens as a sheet from "More" */}
          <nav className={`nav${navOpen ? " open" : ""}`} aria-label={t.tabsLabel}>
            <div className="nav-brand"><Logo size={40} /><strong>{t.appName}</strong></div>
            <div className="nav-head"><strong>{t.navAll}</strong><button type="button" className="tab icon-btn" onClick={() => setNavOpen(false)} aria-label={t.navClose}><Icon name="close" size={20} /></button></div>
            <div className="nav-scroll">
              {NAV_GROUPS.map((g) => (
                <div className="nav-group" key={g.items[0]}>
                  {g.label && <p className="nav-label">{t[g.label]}</p>}
                  {g.items.map((id) => (
                    <button key={id} type="button" className="nav-item" aria-current={tab === id ? "page" : undefined} onClick={() => goTab(id)}>
                      <Icon name={id} /><span>{tabLabel(id)}</span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </nav>
          {navOpen && <div className="nav-shade" onClick={() => setNavOpen(false)} aria-hidden="true" />}
          <nav className="bnav" aria-label={t.tabsLabel}>
            {NAV_PRIMARY.map((id) => (
              <button key={id} type="button" className="bnav-item" aria-current={tab === id ? "page" : undefined} onClick={() => goTab(id)}>
                <Icon name={id} /><span>{id === "rotation" ? t.navRotationShort : tabLabel(id)}</span>
              </button>
            ))}
            <button type="button" className="bnav-item" aria-expanded={navOpen} aria-current={!NAV_PRIMARY.includes(tab) ? "page" : undefined} onClick={() => setNavOpen((v) => !v)}>
              <Icon name="more" /><span>{t.navMore}</span>
            </button>
          </nav>

          <header className="ctx">
            <div className="ctx-l">
              <label className="ctx-pill ctx-farm">
                <Icon name="pin" size={18} />
                <span className="sr-only">{t.navPlace}</span>
                <select value={activeId || ""} onChange={(e) => { const f = fields.find((x) => x.id === e.target.value); if (f && f.id !== activeId) openField(f, { tab }); }} aria-label={t.fdSwitch}>
                  {fields.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </label>
              {activeField && (plots.length > 1 || !PLOT_TABS.includes(tab)) && !(tab === "data") && <span className="ctx-sep" aria-hidden="true">›</span>}
              {activeField && (
                <PlotBar t={t} plots={plots} activeId={activePlotId} onSelect={selectPlot} whole={!PLOT_TABS.includes(tab)} hidden={tab === "data"} />
              )}
              <button type="button" className="ctx-pill add" onClick={changeLocation}>＋ {t.fdAdd}</button>
            </div>
            <div className="ctx-r">
              <label className="ctx-pill ctx-lang">
                <span className="sr-only">{t.language}</span>
                <select value={lang} onChange={(e) => setLang(e.target.value)}>
                  {LANGUAGES.map((l) => (<option key={l.code} value={l.code}>{l.label}</option>))}
                </select>
              </label>
              <button type="button" className="ctx-round" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label={theme === "dark" ? t.themeLight : t.themeDark} title={theme === "dark" ? t.themeLight : t.themeDark}>
                <Icon name={theme === "dark" ? "sun" : "moon"} size={20} />
              </button>
              {user ? <AccountControl t={t} user={user} onLogin={() => setAuthModal("login")} /> : (
                <button type="button" className="ctx-guest" onClick={() => setAuthModal("register")} title={t.acGuestBar}>
                  <b>{t.acGuestBadge}</b> · {t.acGuestBarBtn}
                </button>
              )}
            </div>
          </header>
          <p className="ctx-sub">
            <strong>{activeField ? activeField.name : label.title}</strong>
            <span>
              {label.path && label.path !== label.title ? `${label.path} · ` : ""}
              {pos.lat}, {pos.lon}
              {terrain ? ` · ${t.elevationShort}: ${terrain.elevationM} m` : ""}
              {soil ? ` · ${t.locbarSoil}: ${t.soilNames[soil]}` : ""}
            </span>
          </p>
        </>
      )}

      {stage === "explore" && (
        <main className="layout">
        <section className="panel">
          <div className="fd-guide">
            <h2>{movingId ? t.fdMoveTitle : fields.length === 0 ? t.fdFirstTitle : t.fdAnotherTitle}</h2>
            <p className="small">{movingId ? t.fdMoveHelp : fields.length === 0 ? t.fdFirstHelp : t.fdAnotherHelp}</p>
          </div>
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

          <div className="confirm-box">
            {!userPicked && <p className="muted small">{t.confirmFirst}</p>}
            {userPicked && !movingId && !fields.some((f) => sameSpot(f, pos)) && (
              <label className="fd-field">
                <span>{t.fdNameLabel}</span>
                <input value={newName} maxLength={80} placeholder={label.title} onChange={(e) => setNewName(e.target.value)} />
                <span className="small muted">{t.fdNameHint}</span>
              </label>
            )}
            <button className="btn wide" disabled={!userPicked} onClick={confirmLocation}>{movingId ? t.fdMoveSave : t.fdSaveOpen}</button>
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
            <h2 className="sr-only">{t.step3}</h2>
            <Weather
              key={`${pos.lat},${pos.lon}`}
              t={t}
              lang={lang}
              lat={pos.lat}
              lon={pos.lon}
              country={country}
              soil={soil}
              onGo={(id) => { window.location.hash = `/${id}`; }}
            />
          </div>
        </main>
      )}

      {stage === "app" && tab === "suitability" && (
        <main className="page">
          <Suitability
            key={`${pos.lat},${pos.lon},${activePlotId}`}
            t={t}
            lang={lang}
            lat={pos.lat}
            lon={pos.lon}
            env={envData}
            soilData={soilData}
            field={plotField}
          />
        </main>
      )}

      {stage === "app" && tab === "disasters" && (
        <main className="page">
          <div className="viewer">
            <h2 className="sr-only">{t.dsTitle}</h2>
            <Disasters key={`${pos.lat},${pos.lon}`} t={t} lang={lang} lat={pos.lat} lon={pos.lon} country={country} />
          </div>
        </main>
      )}

      {stage === "app" && tab === "irrigation" && (
        <main className="page">
          <div className="viewer">
            <h2 className="sr-only">{t.irTitle}</h2>
            <Irrigation
              key={`${pos.lat},${pos.lon},${activePlotId}`}
              t={t}
              lang={lang}
              lat={pos.lat}
              lon={pos.lon}
              country={country}
              soil={soil}
              soilMapped={suggested}
              satellite={satellite}
              field={plotField}
              onFieldChange={patchPlot}
              mappedSqm={activePlot && activePlot.points && activePlot.points.length >= 3 ? areaSqm(activePlot.points) : 0}
            />
          </div>
        </main>
      )}

      {stage === "app" && tab === "rotation" && (
        <main className="page">
          <div className="viewer">
            <h2>{t.rtTitle}</h2>
            <RotationPlanner key={`${pos.lat},${pos.lon},${activePlotId}`} t={t} lang={lang} lat={pos.lat} lon={pos.lon} country={country} env={envData} soilData={soilData} field={plotField} onExplain={explainStrategy} onFieldChange={patchPlot} />
          </div>
        </main>
      )}

      {stage === "app" && tab === "market" && (
        <main className="page">
          <div className="viewer">
            <h2 className="sr-only">{t.mkTitle}</h2>
            <Market key={`${pos.lat},${pos.lon}`} t={t} lang={lang} lat={pos.lat} lon={pos.lon} country={country} />
          </div>
        </main>
      )}

      {stage === "app" && tab === "suppliers" && (
        <main className="page">
          <div className="viewer">
            <h2 className="sr-only">{t.spTitle}</h2>
            <Suppliers key={`${pos.lat},${pos.lon}`} t={t} lang={lang} lat={pos.lat} lon={pos.lon} />
          </div>
        </main>
      )}

      {stage === "app" && tab === "farms" && (
        <main className="page" onInputCapture={farmTyping}>
          <div className="viewer">
            <h2 className="sr-only">{t.fdTitle}</h2>
            <Farms
              t={t}
              lang={lang}
              fields={fields}
              active={activeField}
              plotId={activePlotId}
              onPlot={selectPlot}
              system={systemNow}
              onUpdate={updateField}
              onRemove={removeField}
              onOpen={(f) => openField(f, { tab: "farms" })}
              onAdd={changeLocation}
              onMove={startMove}
              onImport={(list) => setFields((cur) => [...cur, ...list])}
            />
          </div>
        </main>
      )}

      {stage === "app" && tab === "assistant" && (
        <main className="page">
          <div className="viewer">
            <h2>{t.asTitle}</h2>
            <Assistant t={t} lang={lang} lat={pos.lat} lon={pos.lon} label={label.title} country={country} soilData={soilData} env={envData} field={plotField} request={explainReq} onRequestHandled={() => setExplainReq(null)} />
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
            onGo={(id) => { window.location.hash = `/${id}`; }}
            chosen={soilChoice !== "auto" ? soilChoice : null}
            suggested={soil}
            onFieldChange={patchPlot}
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

      </Suspense>
      </ErrorBoundary>

      <footer className="footer">
        {t.footer}{" "}
        <a href={`${import.meta.env.BASE_URL}admin/world/ATTRIBUTION.md`} target="_blank" rel="noreferrer">{t.boundaryCredits}</a>
      </footer>
      {stage === "app" && (
        <details className="ctx-photos">
          <summary>{t.orbPhotos}</summary>
          <Gallery t={t} title={label.title} subtitle={label.path} state={photos} />
        </details>
      )}
    </div>
  );
}