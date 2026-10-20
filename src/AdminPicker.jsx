import { useEffect, useMemo, useState } from "react";
import { SLOTS, loadSearchIndex, searchNames } from "./admin.js";
import { searchPlace } from "./weather.js";

const byName = (a, b) => a.name.localeCompare(b.name);

function Field({ label, value, options, onChange, disabled, placeholder }) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value || ""} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function AdminPicker({
  t,
  lang,
  registry,
  info,
  admin,
  adminError,
  chainParts,
  place,
  country,
  message,
  onCountry,
  onLevel,
  onPickEntry,
  onPickWorld,
  onUseLocation,
  hideUse,
}) {
  const [index, setIndex] = useState(null);
  const [query, setQuery] = useState("");
  const [world, setWorld] = useState([]);
  const [worldMessage, setWorldMessage] = useState("");

  // the names of the chosen country, for the search box
  useEffect(() => {
    setIndex(null);
    if (!info) return undefined;
    let cancelled = false;
    loadSearchIndex(info)
      .then((list) => !cancelled && setIndex(list))
      .catch(() => !cancelled && setIndex([]));
    return () => {
      cancelled = true;
    };
  }, [info]);

  const local = useMemo(() => (index ? searchNames(index, query) : []), [index, query]);

  // the choices of every level: the areas inside the one chosen above
  const fields = useMemo(() => {
    if (!admin) return [];
    return admin.levels.map((lv, i) => {
      const above = i > 0 ? place[SLOTS[i - 1]] : null;
      const pool = lv.fc || (chainParts && chainParts[i]) || null;
      let options = [];
      if (pool && (i === 0 || above)) {
        options = pool.features
          .map((f) => f.properties)
          .filter((p) => i === 0 || p.parent === above.id)
          .sort(byName);
      }
      const chosen = place[SLOTS[i]];
      if (chosen && !options.some((o) => o.id === chosen.id)) options = [chosen, ...options];
      return { index: i, label: info.levels[i][lang], value: chosen ? chosen.id : "", options, enabled: i === 0 || !!above };
    });
  }, [admin, info, chainParts, place, lang]);

  async function onSubmit(event) {
    event.preventDefault();
    if (query.trim().length < 2) return;
    setWorldMessage("");
    try {
      const found = await searchPlace(query.trim(), lang);
      setWorld(found);
      if (found.length === 0 && local.length === 0) setWorldMessage(t.noResults);
    } catch {
      setWorld([]);
      if (local.length === 0) setWorldMessage(t.noResults);
    }
  }

  function clearSearch() {
    setQuery("");
    setWorld([]);
    setWorldMessage("");
  }

  return (
    <div>
      <label className="field">
        <span>{t.country}</span>
        <select value={country} onChange={(e) => onCountry(e.target.value)}>
          {registry.map((c) => (
            <option key={c.iso} value={c.iso}>{c.name[lang]}</option>
          ))}
          <option value="other">{t.countryOther}</option>
        </select>
      </label>

      {country !== "other" &&
        (admin ? (
          fields.map((f) => (
            <Field key={f.index} label={f.label} value={f.value} options={f.options}
              disabled={!f.enabled}
              placeholder={f.enabled ? t.choose : t.chooseAbove}
              onChange={(id) => onLevel(f.index, id)} />
          ))
        ) : (
          <p className="muted small">{adminError ? t.adminError : t.adminLoading}</p>
        ))}

      {country === "other" && <p className="muted small">{t.otherCountryHint}</p>}

      <form className="search-row" onSubmit={onSubmit}>
        <input
          className="search"
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setWorld([]);
            setWorldMessage("");
          }}
          placeholder={t.nameSearchPlaceholder}
        />
        <button className="btn" type="submit">{t.search}</button>
      </form>

      {(local.length > 0 || world.length > 0) && (
        <ul className="results">
          {local.map((e) => (
            <li key={e.i}>
              <button
                onClick={() => {
                  onPickEntry(e);
                  clearSearch();
                }}
              >
                <strong>{e.n}</strong>
                <span className="muted small">
                  {" "}
                  {info ? info.levels[SLOTS.indexOf(e.l)][lang] : ""}
                  {e.p ? ` · ${e.p}` : ""}
                </span>
              </button>
            </li>
          ))}
          {world.length > 0 && <li className="results-head muted small">{t.searchWorld}</li>}
          {world.map((r, i) => (
            <li key={`w${i}`}>
              <button
                onClick={() => {
                  onPickWorld(r);
                  clearSearch();
                }}
              >
                {r.name}
              </button>
            </li>
          ))}
        </ul>
      )}
      {worldMessage && <p className="warn small">{worldMessage}</p>}

      {!hideUse && <button className="btn wide" onClick={onUseLocation}>{t.useMyLocation}</button>}
      {message && <p className="warn small">{message}</p>}
    </div>
  );
}