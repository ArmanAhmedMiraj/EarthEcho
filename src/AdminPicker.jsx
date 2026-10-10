import { useEffect, useMemo, useState } from "react";
import { loadSearchIndex, searchNames } from "./admin.js";
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
  admin,
  adminError,
  unionsFc,
  place,
  country,
  message,
  onCountry,
  onLevel,
  onPickEntry,
  onPickWorld,
  onUseLocation,
}) {
  const [index, setIndex] = useState(null);
  const [query, setQuery] = useState("");
  const [world, setWorld] = useState([]);
  const [worldMessage, setWorldMessage] = useState("");

  useEffect(() => {
    loadSearchIndex()
      .then(setIndex)
      .catch(() => setIndex([]));
  }, []);

  const local = useMemo(() => (index ? searchNames(index, query) : []), [index, query]);

  const divisions = useMemo(
    () => (admin ? admin.divisions.features.map((f) => f.properties).sort(byName) : []),
    [admin]
  );
  const districts = useMemo(
    () =>
      admin && place.division
        ? admin.districts.features.map((f) => f.properties).filter((p) => p.parent === place.division.id).sort(byName)
        : [],
    [admin, place.division]
  );
  const upazilas = useMemo(
    () =>
      admin && place.district
        ? admin.upazilas.features.map((f) => f.properties).filter((p) => p.parent === place.district.id).sort(byName)
        : [],
    [admin, place.district]
  );
  const unions = useMemo(
    () =>
      unionsFc && place.upazila
        ? unionsFc.features.map((f) => f.properties).filter((p) => p.parent === place.upazila.id).sort(byName)
        : [],
    [unionsFc, place.upazila]
  );

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
          <option value="BD">{t.countryBD}</option>
          <option value="other">{t.countryOther}</option>
        </select>
      </label>

      {country === "BD" &&
        (admin ? (
          <>
            <Field label={t.division} value={place.division?.id} options={divisions}
              placeholder={t.choose} onChange={(id) => onLevel("division", id)} />
            <Field label={t.district} value={place.district?.id} options={districts}
              disabled={!place.division} placeholder={place.division ? t.choose : t.chooseAbove}
              onChange={(id) => onLevel("district", id)} />
            <Field label={t.upazila} value={place.upazila?.id} options={upazilas}
              disabled={!place.district} placeholder={place.district ? t.choose : t.chooseAbove}
              onChange={(id) => onLevel("upazila", id)} />
            <Field label={t.union} value={place.union?.id} options={unions}
              disabled={!place.upazila} placeholder={place.upazila ? t.choose : t.chooseAbove}
              onChange={(id) => onLevel("union", id)} />
          </>
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
                  {t.levelNames[e.l]}
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

      <button className="btn wide" onClick={onUseLocation}>{t.useMyLocation}</button>
      {message && <p className="warn small">{message}</p>}
    </div>
  );
}