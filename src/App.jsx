import { useEffect, useState } from "react";
import { LANGUAGES, TEXT } from "./i18n.js";
import { SOIL_NOTE, SOIL_TYPES, loadSoilMap, lookupSoil, typicalSoil } from "./soil.js";
import { fetchForecast, fetchHistory, searchPlace } from "./weather.js";
import MapPicker from "./MapPicker.jsx";
import Weather from "./Weather.jsx";

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

export default function App() {
  const [lang, setLang] = useState(() => readSaved("ef-lang", "en"));
  const [theme, setTheme] = useState(() => readSaved("ef-theme", phoneTheme()));
  const [pos, setPos] = useState({ lat: 25.75, lon: 89.25, name: "Rangpur" });
  const [soilChoice, setSoilChoice] = useState("auto"); // "auto" or a soil key
  const [soilMap, setSoilMap] = useState(null);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);
  const [message, setMessage] = useState("");

  const [forecast, setForecast] = useState(null);
  const [history, setHistory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const t = TEXT[lang];

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

  // Load weather whenever the place changes.
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

  function choosePlace(lat, lon, name) {
    setPos({ lat: Number(lat.toFixed(4)), lon: Number(lon.toFixed(4)), name });
    setSoilChoice("auto");
    setResults(null);
    setMessage("");
  }

  async function onSearch(event) {
    event.preventDefault();
    if (!query.trim()) return;
    setMessage("");
    try {
      const found = await searchPlace(query.trim(), lang);
      setResults(found);
      if (found.length === 0) setMessage(t.noResults);
    } catch {
      setMessage(t.noResults);
    }
  }

  function onUseLocation() {
    setMessage("");
    if (!navigator.geolocation) {
      setMessage(t.locationDenied);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => choosePlace(p.coords.latitude, p.coords.longitude, null),
      () => setMessage(t.locationDenied),
      { timeout: 15000 }
    );
  }

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
          <form className="search-row" onSubmit={onSearch}>
            <input
              className="search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t.searchPlaceholder}
            />
            <button className="btn" type="submit">{t.search}</button>
          </form>
          <button className="btn wide" onClick={onUseLocation}>{t.useMyLocation}</button>
          {message && <p className="warn small">{message}</p>}
          {results && results.length > 0 && (
            <ul className="results">
              {results.map((r, i) => (
                <li key={i}>
                  <button onClick={() => choosePlace(r.lat, r.lon, r.name)}>{r.name}</button>
                </li>
              ))}
            </ul>
          )}
          <p className="muted small">{t.tapMap}</p>
          <p className="small">
            <strong>{t.selected}:</strong> {pos.name || "—"}
            <br />
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
          <div className="map-wrap">
            <MapPicker pos={pos} onPick={(lat, lon) => choosePlace(lat, lon, null)} />
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