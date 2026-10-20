import { useEffect, useMemo, useState } from "react";
import { bestMonths, evaluateCrops, limiting, loadCropTable, rating, soilInput } from "./suitability.js";
import "./suitability.css";

const GROUPS = ["cereal", "pulse", "oilseed", "vegetable", "root", "fruit", "fibre", "cash"];

export default function Suitability({ t, lang, lat, lon, env, soilData }) {
  const [table, setTable] = useState(null);
  const [climate, setClimate] = useState(env && env.climate ? env.climate : null);
  const [state, setState] = useState(env && env.climate ? "ok" : "loading");
  const [attempt, setAttempt] = useState(0);
  const [mode, setMode] = useState("irrigated");
  const [group, setGroup] = useState("all");
  const [shown, setShown] = useState(15);

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

  const card = (r) => {
    const s = r[key];
    const grade = rating(s.best);
    const scores = r.months[key === "irrigated" ? "irrigated" : "rainfed"];
    const best = bestMonths(scores);
    const win = r.months.detail[s.month];
    const held = limiting(win, key === "irrigated");
    const need = win.rainTotal < r.crop.r[1] ? Math.round((r.crop.r[1] - win.rainTotal) / 10) * 10 : 0;
    return (
      <li key={r.crop.id} className={`suit-card ${grade}`}>
        <div className="suit-head">
          <div>
            <h3>{name(r.crop)}</h3>
            <p className="small muted">{lang === "bn" ? r.crop.en : r.crop.sci}</p>
          </div>
          <div className="suit-score">
            <strong>{pct(s.best)}</strong>
            <span className={`pill ${grade}`}>{t.ratings[grade]}</span>
          </div>
        </div>
        <p className="small muted">
          {t.suitRange}: {pct(s.low)} – {pct(s.high)}
        </p>
        <div className="month-strip" role="img" aria-label={t.suitSow}>
          {scores.map((v, m) => (
            <span
              key={m}
              className={`mcell${best.includes(m) ? " best" : ""}${m === thisMonth ? " now" : ""}`}
              style={{ "--v": v }}
              title={`${monthShort(m)}: ${pct(v)}`}
            >
              {monthShort(m).slice(0, 1)}
            </span>
          ))}
        </div>
        <p className="small">
          <strong>{t.suitSow}:</strong> {best.length ? best.map(monthShort).join(", ") : t.suitSowNone}
        </p>
        {grade !== "veryGood" && (
          <p className="small muted">
            {t.suitHeldBy}: {t.factorNames[held[0]]}
          </p>
        )}
        <details>
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
      </li>
    );
  };

  return (
    <div className="viewer suit">
      <h2>{t.suitTitle}</h2>
      <p className="muted">{t.suitIntro}</p>

      <div className="suit-basis small">
        <strong>{t.suitBasis}</strong>
        <span>{t.suitBasisClimate}</span>
        <span>{basisSoil}</span>
        <span>{t.suitBasisCrops}</span>
      </div>

      <div className="filters" role="group">
        {["irrigated", "rainfed"].map((m) => (
          <button key={m} className="chip" aria-pressed={mode === m} onClick={() => setMode(m)}>
            {m === "irrigated" ? t.suitModeIrr : t.suitModeRain}
          </button>
        ))}
      </div>

      <section className="suit-now">
        <h3>{t.suitNowTitle}</h3>
        {nowList.length ? (
          <ul className="now-list">
            {nowList.map((r) => (
              <li key={r.crop.id}>
                <strong>{name(r.crop)}</strong> <span className="muted">{pct(r[key].now)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">{t.suitNowNone}</p>
        )}
      </section>

      <div className="filters" role="group">
        <button className="chip" aria-pressed={group === "all"} onClick={() => { setGroup("all"); setShown(15); }}>{t.suitAll}</button>
        {GROUPS.map((g) => (
          <button key={g} className="chip" aria-pressed={group === g} onClick={() => { setGroup(g); setShown(15); }}>{t.groups[g]}</button>
        ))}
      </div>

      <ul className="suit-list">{filtered.slice(0, shown).map(card)}</ul>
      {filtered.length > shown && (
        <button className="btn" onClick={() => setShown((n) => n + 15)}>
          + {filtered.length - shown}
        </button>
      )}

      <section className="suit-method">
        <h3>{t.suitMethodTitle}</h3>
        <p className="small muted">{t.suitMethod}</p>
        <p className="small muted">{t.suitCredits}</p>
        <p className="small"><strong>{t.suitCheck}</strong></p>
      </section>
    </div>
  );
}
