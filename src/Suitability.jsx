import { useEffect, useMemo, useState } from "react";
import { bestMonths, evaluateCrops, findCrop, limiting, loadCropTable, rating, soilInput } from "./suitability.js";
import "./suitability.css";
import "./suitability2.css";
import FieldNote from "./FieldNote.jsx";

const fill = (text, values) => Object.keys(values).reduce((s, k) => s.split(`{${k}}`).join(values[k]), text);

function ScoreRing({ value, hue, size = 80 }) {
  const r = 40;
  const c = 2 * Math.PI * r;
  return (
    <svg className="su2-ring" viewBox="0 0 100 100" width={size} height={size} aria-hidden="true">
      <circle cx="50" cy="50" r={r} fill="none" stroke="color-mix(in srgb, var(--muted) 25%, transparent)" strokeWidth="9" />
      <circle cx="50" cy="50" r={r} fill="none" stroke={hue} strokeWidth="9" strokeLinecap="round" strokeDasharray={`${c * value} ${c}`} transform="rotate(-90 50 50)" />
    </svg>
  );
}

const GROUPS = ["cereal", "pulse", "oilseed", "vegetable", "root", "fruit", "fibre", "cash"];

export default function Suitability({ t, lang, lat, lon, env, soilData, field }) {
  const [table, setTable] = useState(null);
  const [climate, setClimate] = useState(env && env.climate ? env.climate : null);
  const [state, setState] = useState(env && env.climate ? "ok" : "loading");
  const [attempt, setAttempt] = useState(0);
  const [mode, setMode] = useState(() => (field && field.details && field.details.irrigation === "none" ? "rainfed" : "irrigated"));
  const [group, setGroup] = useState("all");
  const [shown, setShown] = useState(6);
  const [query, setQuery] = useState("");
  const [sel, setSel] = useState(null);

  useEffect(() => {
    let cancelled = false;
    loadCropTable().then((d) => {
      if (!cancelled) setTable(d);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (env && env.climate && attempt === 0) return undefined;
    let cancelled = false;
    setState("loading");
    fetch(`/api/environment?lat=${lat}&lon=${lon}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => {
        if (cancelled) return;
        if (d.ok && d.climate) {
          setClimate(d.climate);
          setState("ok");
        } else setState("error");
      })
      .catch(() => {
        if (!cancelled) setState("error");
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lon, attempt]);

  const soil = useMemo(() => soilInput(soilData), [soilData]);
  const results = useMemo(() => {
    if (!table || !climate) return null;
    const months = climate.months.map((m) => ({ tmean: m.tmean, rainMm: m.rainMm }));
    if (months.some((m) => m.tmean == null || m.rainMm == null)) return null;
    return evaluateCrops(table.crops, months, soil);
  }, [table, climate, soil]);

  const locale = lang === "bn" ? "bn-BD" : "en-GB";
  const num = (v, d = 0) => new Intl.NumberFormat(locale, { maximumFractionDigits: d, minimumFractionDigits: d }).format(v);
  const monthShort = (m) => new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" }).format(new Date(Date.UTC(2021, m, 1)));
  const pct = (v) => `${num(Math.round(v * 100))}%`;
  const name = (c) => (lang === "bn" ? c.bn : c.en);
  const thisMonth = new Date().getMonth();

  if (state === "loading" || !table) {
    return (
      <div className="viewer suit">
        <h2>{t.suitTitle}</h2>
        <p className="muted">{t.suitLoading}</p>
      </div>
    );
  }
  if (state === "error" || !results) {
    return (
      <div className="viewer suit">
        <h2>{t.suitTitle}</h2>
        <p className="warn-soft">{t.suitNoClimate}</p>
        <button className="btn" onClick={() => setAttempt((n) => n + 1)}>{t.suitRetry}</button>
      </div>
    );
  }

  const key = mode === "irrigated" ? "irrigated" : "rainfed";
  const sorted = results.slice().sort((a, b) => b[key].best - a[key].best);
  const filtered = sorted.filter((r) => group === "all" || r.crop.group === group);
  const nowList = results
    .slice()
    .sort((a, b) => b[key].now - a[key].now)
    .filter((r) => r[key].now >= 0.5)
    .slice(0, 6);

  const tex = soilData && soilData.available ? soilData.texture : null;
  const basisSoil = soil
    ? `${t.suitBasisSoil}: ${soil.ph != null ? `pH ${num(soil.ph, 1)}` : ""}${tex ? ` · ${t.soilNames[tex.simple]}` : ""} (ISRIC SoilGrids)`
    : t.suitBasisSoilNone;

  const monthLong = (m) => new Intl.DateTimeFormat(locale, { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2021, m, 1)));
  const d = (field && field.details) || {};
  const growing = d.currentCrop ? results.find((r) => findCrop([r.crop], d.currentCrop)) : null;
  const planned = d.plannedCrop ? results.find((r) => findCrop([r.crop], d.plannedCrop)) : null;
  const focus = growing || planned;
  const hueOf = (v) => (v >= 0.75 ? "var(--a1)" : v >= 0.5 ? "var(--gold)" : "var(--clay, #ff9478)");
  const q = query.trim().toLowerCase();
  const list = filtered.filter((r) => !q || r.crop.en.toLowerCase().includes(q) || r.crop.bn.toLowerCase().includes(q) || (r.crop.sci || "").toLowerCase().includes(q));
  const picked = (sel && results.find((r) => r.crop.id === sel)) || (focus || nowList[0] || sorted[0]);

  const status = (r) => {
    if (growing && growing.crop.id === r.crop.id) return fill(t.orbSuGrowing, { f: field.name });
    if (r[key].now >= 0.6) return t.orbSuSowNow;
    if (r.crop.group === "pulse") return t.orbSuSoil;
    return "";
  };

  const reason = (r) => {
    const win = r.months.detail[r[key].month];
    const held = limiting(win, key === "irrigated");
    return r[key].best >= 0.85 ? fill(t.orbSuNoHold, { m: monthLong(r[key].month) }) : `${t.suitHeldBy}: ${t.factorNames[held[0]]}`;
  };

  const detailTable = (r, win) => {
    const need = win.rainTotal < r.crop.r[1] ? Math.round((r.crop.r[1] - win.rainTotal) / 10) * 10 : 0;
    return (
      <details className="su2-more">
        <summary>{t.suitDetails}</summary>
        <table className="suit-table">
          <tbody>
            <tr>
              <th>{t.suitDetailTemp}</th>
              <td>
                {t.suitYourPlace}: {num(win.tMin, 0)}–{num(win.tMax, 0)} °C · {t.suitCropRange}: {r.crop.t[0]}–{r.crop.t[3]} °C ({t.suitOptimum} {r.crop.t[1]}–{r.crop.t[2]})
              </td>
            </tr>
            <tr>
              <th>{t.suitDetailRain}</th>
              <td>
                {t.suitYourPlace}: {num(win.rainTotal)} mm · {t.suitCropRange}: {r.crop.r[0]}–{r.crop.r[3]} mm ({t.suitOptimum} {r.crop.r[1]}–{r.crop.r[2]})
                <br />
                {t.suitIrrigNeed}: {need ? `${num(need)} mm` : t.suitIrrigNone}
              </td>
            </tr>
            {soil && soil.ph != null && (
              <tr>
                <th>{t.suitDetailPh}</th>
                <td>
                  {t.suitYourPlace}: {num(soil.ph, 1)}
                  {soil.phLow != null ? ` (${num(soil.phLow, 1)}–${num(soil.phHigh, 1)})` : ""} · {t.suitCropRange}: {r.crop.ph[0]}–{r.crop.ph[3]} ({t.suitOptimum} {r.crop.ph[1]}–{r.crop.ph[2]})
                </td>
              </tr>
            )}
            {tex && (
              <tr>
                <th>{t.suitDetailTex}</th>
                <td>
                  {t.suitTexSoilIs}: {t.soilNames[tex.simple]} · {t.suitTexCropLikes}: {r.crop.text.map((c) => t.texCodes[c] || c).join(", ")}
                </td>
              </tr>
            )}
            <tr>
              <th>{t.suitDetailDrain}</th>
              <td>
                {t.suitDrainNote}: {r.crop.dra.map((c) => t.drainCodes[c] || c).join(" / ")}. {t.suitDrainEst}
              </td>
            </tr>
            <tr>
              <th>{t.suitCycle}</th>
              <td>{r.cycle} {t.suitMonthsWord} · FAO: {r.crop.gmin}–{r.crop.gmax}</td>
            </tr>
          </tbody>
        </table>
      </details>
    );
  };

  const verdict = (r) => {
    const v = { c: name(r.crop), m: monthLong(r[key].month) };
    if (r[key].best >= 0.75 && r[key].now >= 0.6) return fill(t.orbSuVerdictGood, v);
    if (r[key].best >= 0.5) return fill(t.orbSuVerdictWait, v);
    return fill(t.orbSuVerdictHard, v);
  };

  const pWin = picked ? picked.months.detail[picked[key].month] : null;
  const pHeld = picked && pWin ? limiting(pWin, key === "irrigated") : null;
  const bars = pWin
    ? [
        [t.orbSuHeat, pWin.tempFactor],
        key === "irrigated" ? null : [t.orbSuWater, pWin.rainFactor],
        pWin.phFactor != null ? [t.orbSuAcid, pWin.phFactor] : null,
        pWin.texFactor != null ? [t.orbSuTex, pWin.texFactor] : null,
      ].filter(Boolean)
    : [];
  if (key === "irrigated" && pWin) bars.splice(1, 0, [t.orbSuWater, 1]);

  return (
    <div className="viewer suit su2">
      <h2 className="sr-only">{t.suitTitle}</h2>

      <section className="su2-hero">
        <div className="su2-hero-top">
          <div>
            <h3>{t.suitTitle}</h3>
            <p>{t.suitIntro}</p>
          </div>
          <div className="su2-toggle" role="group">
            {["irrigated", "rainfed"].map((m) => (
              <button key={m} aria-pressed={mode === m} onClick={() => setMode(m)}>
                {m === "irrigated" ? t.suitModeIrr : t.suitModeRain}
              </button>
            ))}
          </div>
        </div>
        <div className="su2-rings">
          {sorted.slice(0, 4).map((r) => (
            <button key={r.crop.id} className="su2-ringcard" onClick={() => setSel(r.crop.id)} aria-label={name(r.crop)}>
              <ScoreRing value={r[key].best} hue={hueOf(r[key].best)} />
              <span className="su2-ringnum">{num(Math.round(r[key].best * 100))}</span>
              <span className="su2-ringtxt">
                <strong>{name(r.crop)}</strong>
                <span>{fill(t.orbSuBestIn, { m: monthLong(r[key].month) })}</span>
                {status(r) && <b style={{ color: hueOf(r[key].best) }}>{status(r)}</b>}
              </span>
            </button>
          ))}
        </div>
      </section>

      <div className="su2-two">
        <section className="su2-card su2-field">
          {focus ? (
            <>
              <h3>{fill(t.orbSuFieldNow, { c: name(focus.crop) })}</h3>
              <div className="su2-tiles">
                <div className="su2-tile good"><strong>{num(Math.round(focus[key].best * 100))}</strong><span>{fill(t.orbSuBestMonth, { m: monthLong(focus[key].month) })}</span></div>
                <div className={`su2-tile ${focus[key].now >= 0.5 ? "good" : "bad"}`}><strong>{num(Math.round(focus[key].now * 100))}</strong><span>{fill(t.orbSuIfNow, { m: monthLong(thisMonth) })}</span></div>
              </div>
              <p>{verdict(focus)}</p>
              <FieldNote t={t} lang={lang} field={field} results={results} mode={key} locale={locale} />
            </>
          ) : (
            <>
              <h3>{t.orbSuFieldTitle}</h3>
              <p className="muted">{t.orbSuNoCrop}</p>
              <FieldNote t={t} lang={lang} field={field} results={results} mode={key} locale={locale} />
            </>
          )}
        </section>
        <section className="su2-card suit-basis su2-basis">
          <h3>{t.suitBasis}</h3>
          <ul>
            <li>{t.suitBasisClimate}</li>
            <li>{basisSoil}</li>
            <li>{t.suitBasisCrops}</li>
          </ul>
          <p className="small muted">{t.orbSuBasisNote}</p>
        </section>
      </div>

      <section className="suit-now su2-now">
        <h3>{t.suitNowTitle}</h3>
        {nowList.length ? (
          <ul className="now-list su2-nowlist">
            {nowList.map((r) => (
              <li key={r.crop.id}>
                <button onClick={() => setSel(r.crop.id)}>
                  <span><strong>{name(r.crop)}</strong><b>{num(Math.round(r[key].now * 100))}</b></span>
                  <small>{t.groups[r.crop.group]} · {r[key].now >= 0.6 && r.months[key][thisMonth] >= r.months[key][(thisMonth + 1) % 12] ? t.orbSuNow : t.orbSuNext}</small>
                  <i style={{ "--w": `${Math.round(r[key].now * 100)}%` }} />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">{t.suitNowNone}</p>
        )}
      </section>

      <section className="su2-card su2-all">
        <header>
          <h3>{t.orbSuAllTitle}</h3>
          <div className="su2-filters">
            <input type="search" value={query} placeholder={t.orbSuSearch} aria-label={t.orbSuSearch} onChange={(e) => { setQuery(e.target.value); setShown(6); }} />
            <select value={group} aria-label={t.orbSuKinds} onChange={(e) => { setGroup(e.target.value); setShown(6); }}>
              <option value="all">{t.orbSuKinds}</option>
              {GROUPS.map((g) => <option key={g} value={g}>{t.groups[g]}</option>)}
            </select>
          </div>
        </header>
        <ul className="su2-rows">
          {list.slice(0, shown).map((r) => {
            const scores = r.months[key];
            const best = bestMonths(scores);
            return (
              <li key={r.crop.id}>
                <button className={picked && picked.crop.id === r.crop.id ? "on" : ""} onClick={() => setSel(r.crop.id)}>
                  <span className="su2-rname"><strong>{name(r.crop)}</strong><small>{lang === "bn" ? r.crop.en : r.crop.sci}</small></span>
                  <span className="month-strip su2-strip" role="img" aria-label={`${t.suitSow}: ${best.length ? best.map(monthShort).join(", ") : t.suitSowNone}`}>
                    {scores.map((v, m) => (
                      <span key={m} className={`mcell${best.includes(m) ? " best" : ""}${m === thisMonth ? " now" : ""}`} style={{ "--v": v }} title={`${monthShort(m)}: ${pct(v)}`} />
                    ))}
                  </span>
                  <b className="su2-rscore" style={{ color: hueOf(r[key].best) }}>{num(Math.round(r[key].best * 100))}</b>
                  <span className="su2-rwhy">{reason(r)}</span>
                </button>
              </li>
            );
          })}
        </ul>
        {list.length === 0 && <p className="muted">{t.suitSowNone}</p>}
        <footer>
          <p className="small muted">{t.orbSuStrip}</p>
          {list.length > shown && <button className="btn" onClick={() => setShown((n) => n + 12)}>{fill(t.orbSuMore, { n: num(list.length - shown) })}</button>}
        </footer>
      </section>

      <div className="su2-two">
        {picked && (
          <section className="su2-card su2-nums">
            <h3>{fill(t.orbSuNumbers, { c: name(picked.crop), m: monthLong(picked[key].month) })}</h3>
            <p className="small muted">{t.suitRange}: {pct(picked[key].low)} – {pct(picked[key].high)}</p>
            <ul className="su2-bars">
              {bars.map(([label, v]) => (
                <li key={label}>
                  <span>{label}</span>
                  <i><b style={{ width: `${Math.round(v * 100)}%`, background: hueOf(v) }} /></i>
                  <em>{num(Math.round(v * 100))}</em>
                </li>
              ))}
            </ul>
            {pHeld && picked[key].best < 0.9 && <p>{t.suitHeldBy} <strong>{t.factorNames[pHeld[0]]}</strong>.</p>}
            {detailTable(picked, pWin)}
          </section>
        )}
        <section className="su2-card suit-method">
          <h3>{t.suitMethodTitle}</h3>
          <p className="muted">{t.suitMethod}</p>
          <p className="small muted">{t.suitCredits}</p>
          <p className="small"><strong>{t.suitCheck}</strong></p>
        </section>
      </div>
    </div>
  );
}
