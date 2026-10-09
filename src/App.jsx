import { useEffect, useState } from "react";
import { LANGUAGES, TEXT } from "./i18n.js";
import { DEMO_PLACES } from "./demoPlaces.js";
import MapView from "./MapView.jsx";

// Reads a saved choice, and never crashes if browser storage is blocked.
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

function phoneTheme() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export default function App() {
  const [lang, setLang] = useState(() => readSaved("ee-lang", "en"));
  const [theme, setTheme] = useState(() => readSaved("ee-theme", phoneTheme()));
  const [selectedId, setSelectedId] = useState("jamuna");

  const t = TEXT[lang];
  const selected = DEMO_PLACES.find((p) => p.id === selectedId);

  // Apply language and theme to the whole page.
  useEffect(() => {
    const info = LANGUAGES.find((l) => l.code === lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = info.dir;
    saveChoice("ee-lang", lang);
  }, [lang]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    saveChoice("ee-theme", theme);
  }, [theme]);

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
          <label className="field">
            <span className="sr-only">{t.language}</span>
            <select value={lang} onChange={(e) => setLang(e.target.value)}>
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>
          <button
            className="btn"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? t.themeLight : t.themeDark}
          </button>
        </div>
      </header>

      <main className="layout">
        <aside className="panel">
          <input className="search" type="search" placeholder={t.searchPlaceholder} disabled />
          <button className="btn wide" disabled>
            {t.useMyLocation}
          </button>

          <h2>{t.demoPlaces}</h2>
          <ul className="places">
            {DEMO_PLACES.map((p) => (
              <li key={p.id}>
                <button
                  className={"place" + (p.id === selectedId ? " active" : "")}
                  onClick={() => setSelectedId(p.id)}
                >
                  <span className="place-name">{t.places[p.id]}</span>
                  <span className="place-type">{t.types[p.type]}</span>
                  <span className={"badge" + (p.ready ? " ok" : "")}>
                    {p.ready ? t.ready : t.comingSoon}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <MapView place={selected} t={t} lang={lang} theme={theme} />
      </main>

      <footer className="footer">{t.footer}</footer>
    </div>
  );
}