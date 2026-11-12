import { useEffect, useMemo, useState } from "react";
import "./rotation.css";
import "./strategy.css";
import "./trust.css";
import "./rotation2.css";
import { evaluateCrops, loadCropTable, soilInput } from "./suitability.js";
import { ANNUAL, planRotations } from "./rotation.js";
import MultiYear from "./MultiYear.jsx";
import Scenario from "./Scenario.jsx";
import Evidence from "./Evidence.jsx";
import RotationBoard, { PlotCard } from "./RotationBoard.jsx";
import { STRATEGIES, buildBoard } from "./rotationBoard.js";
import { FARM_SHARE } from "./econ.js";

const fill = (text, values) => Object.keys(values).reduce((s, k) => s.split(`{${k}}`).join(values[k]), text);
function readStore(key) {
  try { return JSON.parse(localStorage.getItem(key) || "{}") || {}; } catch { return {}; }
}
function writeStore(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage blocked */ }
}

// The Crop rotation tab. The plot's crop, history, water, soil and slope come from My Farm and the Soil Map,
// the climate from NASA, the prices from the UN food price database. The farmer only corrects what is wrong.
export default function RotationPlanner({ t, lang, lat, lon, country, env, soilData, field, onExplain, onFieldChange }) {
  const [table, setTable] = useState(null);
  const [climate, setClimate] = useState(env && env.climate ? env.climate : null);
  const [state, setState] = useState(env && env.climate ? "ok" : "loading");
  const [attempt, setAttempt] = useState(0);
  const [scn, setScn] = useState({ rain: 0, temp: 0 }); // what-if: rain change in percent, warming in degrees
  const [kind, setKind] = useState("all");
  const [markets, setMarkets] = useState(null);
  const store = `ef-rotation-${country}`;
  const [inputs, setInputs] = useState(() => readStore(store));
  const monthNames = t.rtMonthsAbbr.split(" ");
  const locale = lang === "bn" ? "bn-BD" : "en-GB";

  const d = (field && field.details) || {};
  // the water source of the plot decides rain-only or irrigated; not set = irrigated (as before) and the page says so
  const mode = d.irrigation === "none" ? "rainfed" : "irrigated";
  const assumedWater = !d.irrigation;
  const sysSoil = field && field.system && field.system.soil;
  const soilKey = d.soil || (!(soilData && soilData.available) && sysSoil ? sysSoil.key : null) || undefined;
  const effectiveSoil = d.soil || (sysSoil && sysSoil.key) || (soilData && soilData.available && soilData.texture ? soilData.texture.simple : null);

  useEffect(() => { loadCropTable().then(setTable); }, []);
  useEffect(() => {
    if (env && env.climate && attempt === 0) return undefined;
    let cancelled = false;
    setState("loading");
    fetch(`/api/environment?lat=${lat}&lon=${lon}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((x) => { if (cancelled) return; if (x.ok && x.climate) { setClimate(x.climate); setState("ok"); } else setState("error"); })
      .catch(() => { if (!cancelled) setState("error"); });
    return () => { cancelled = true; };
  }, [lat, lon, env, attempt]);
  // market prices from the UN food price database (nearest market that reports)
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/markets?country=${country}&lat=${lat}&lon=${lon}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((x) => { if (!cancelled) setMarkets(x && x.ok && x.available ? x : { items: [] }); })
      .catch(() => { if (!cancelled) setMarkets({ items: [] }); });
    return () => { cancelled = true; };
  }, [lat, lon, country]);

  const marketMap = useMemo(() => {
    const out = {};
    if (!markets || !markets.items) return out;
    for (const it of markets.items) {
      if (!it.crop || !(it.perKg > 0)) continue;
      const cur = out[it.crop];
      if (!cur || it.km < cur.km || (it.km === cur.km && it.lastMonth > cur.lastMonth)) out[it.crop] = { perKg: it.perKg, market: it.market, km: it.km, lastMonth: it.lastMonth, currency: it.currency };
    }
    return out;
  }, [markets]);
  const rate = markets && markets.rate ? markets.rate : null;
  const currency = (markets && markets.currency) || (rate ? "" : "USD");
  const share = inputs.__share != null ? Number(inputs.__share) : FARM_SHARE;
  const econCtx = useMemo(() => ({ inputs, market: marketMap, rate, share }), [inputs, marketMap, rate, share]);

  // normal climate and the what-if climate (monthly averages shifted by the sliders)
  const baseMonths = useMemo(() => (climate ? climate.months.map((m) => ({ tmean: m.tmean, rainMm: m.rainMm })) : null), [climate]);
  const usable = baseMonths && !baseMonths.some((m) => m.tmean == null || m.rainMm == null);
  const soilIn = useMemo(() => soilInput(soilData, soilKey), [soilData, soilKey]);
  const baseResults = useMemo(() => (table && usable ? evaluateCrops(table.crops, baseMonths, soilIn) : null), [table, usable, baseMonths, soilIn]);
  const results = useMemo(() => {
    if (!table || !usable) return null;
    if (scn.rain === 0 && scn.temp === 0) return baseResults;
    const shifted = baseMonths.map((m) => ({ tmean: m.tmean + scn.temp, rainMm: Math.max(0, m.rainMm * (1 + scn.rain / 100)) }));
    return evaluateCrops(table.crops, shifted, soilIn);
  }, [table, usable, baseMonths, baseResults, scn, soilIn]);
  const scenarioClimate = useMemo(() => {
    if (!climate) return null;
    return { ...climate, months: climate.months.map((m) => ({ ...m, tmean: m.tmean == null ? m.tmean : m.tmean + scn.temp, rainMm: m.rainMm == null ? m.rainMm : Math.max(0, Math.round(m.rainMm * (1 + scn.rain / 100))) })) };
  }, [climate, scn]);

  // a crop the farmer wants to keep: every rotation is then built around it
  const keepRaw = d.keepCrop ? String(d.keepCrop) : "";
  const keepEntry = results && keepRaw ? results.find((r) => r.crop.id === keepRaw && ANNUAL.includes(r.crop.group) && r.cycle <= 8) || null : null;
  const keepId = keepEntry ? keepRaw : null;

  const waitMarkets = markets == null;
  const ready = !!(results && scenarioClimate && !waitMarkets);
  const withKeep = useMemo(() => (ready ? buildBoard({ results, climate: scenarioClimate, field, mode, kind, keepId, econCtx }) : null), [ready, results, scenarioClimate, field, mode, kind, keepId, econCtx]);
  const keepFailed = !!(keepId && ready && !withKeep);
  const withoutKeep = useMemo(() => (keepFailed ? buildBoard({ results, climate: scenarioClimate, field, mode, kind, keepId: null, econCtx }) : null), [keepFailed, results, scenarioClimate, field, mode, kind, econCtx]);
  const shown = withKeep || withoutKeep;
  const baseBoard = useMemo(() => (baseResults && climate && ready && (scn.rain !== 0 || scn.temp !== 0) ? buildBoard({ results: baseResults, climate, field, mode, kind, keepId: keepFailed ? null : keepId, econCtx }) : null), [baseResults, climate, ready, field, mode, kind, keepId, keepFailed, econCtx, scn]);

  // the rotation lists that What-if reads: the best goal's picks come first
  const topList = (b) => {
    if (!b) return [];
    const order = [b.best.id, ...STRATEGIES.filter((s) => s !== b.best.id)];
    return [...new Map(order.flatMap((s) => b.strategies[s]).map((x) => [x.steps.map((o) => o.crop.id).join(">"), x.r])).values()];
  };
  const rotations = useMemo(() => topList(shown), [shown]);
  const baseRotations = useMemo(() => (baseBoard ? topList(baseBoard) : rotations), [baseBoard, rotations]);
  const pool = useMemo(() => (results ? planRotations(results, mode, kind, 30, keepFailed ? null : keepId) : []), [results, mode, kind, keepId, keepFailed]);

  const patchInput = (id, key, value) => {
    const next = { ...inputs, [id]: { ...(inputs[id] || {}), [key]: value } };
    setInputs(next);
    writeStore(store, next);
  };
  const resetCrop = (id) => {
    const next = { ...inputs };
    delete next[id];
    setInputs(next);
    writeStore(store, next);
  };
  const setShare = (v) => { const next = { ...inputs, __share: v }; setInputs(next); writeStore(store, next); };
  const cur = currency || (rate ? "" : "USD");
  const moneyProps = { inputs, setInput: patchInput, resetCrop, cur, share, setShare };

  if (state === "loading" || !table) return <p className="muted">{t.rtLoading}</p>;
  if (state === "error" || !results) {
    return (
      <div>
        <p className="warn">{t.rtFailed}</p>
        <button className="tab" onClick={() => setAttempt((n) => n + 1)}>{t.rtRetry}</button>
      </div>
    );
  }

  const name = (c) => (lang === "bn" ? c.bn : c.en);
  const soilName = (key) => (t.soilNames && t.soilNames[key]) || key;
  // the soil line used in the explanations
  const soilLine = (() => {
    if (d.soil) return { text: fill(t.stEvSoil, { name: soilName(d.soil) }), level: "entered" };
    if (sysSoil && sysSoil.key) {
      const word = sysSoil.level ? { high: t.confHigh, medium: t.confMedium, low: t.confLow }[sysSoil.level] : null;
      return { text: word ? fill(t.stEvSoilEst, { name: soilName(sysSoil.key), level: word }) : fill(t.stEvSoilPlain, { name: soilName(sysSoil.key) }), level: sysSoil.level || null };
    }
    return { text: null, level: null };
  })();
  const ctx = { scenarioOn: scn.rain !== 0 || scn.temp !== 0, scenario: scn };

  const plotCard = <PlotCard t={t} lang={lang} locale={locale} field={field} results={results} mode={mode} climate={climate} soilKey={effectiveSoil} onFieldChange={onFieldChange} monthNames={monthNames} assumedWater={assumedWater} />;
  const controls = (
    <div className="rt-controls">
      <label>{t.rtKind}
        <select value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="all">{t.rtKindAll}</option>
          <option value="field">{t.rtKindField}</option>
          <option value="vegetable">{t.rtKindVeg}</option>
        </select>
      </label>
      {onFieldChange && (
        <label>{t.rtKeep}
          <select value={keepId || ""} onChange={(e) => onFieldChange({ keepCrop: e.target.value })}>
            <option value="">{t.rtKeepNone}</option>
            {results.filter((r) => ANNUAL.includes(r.crop.group) && r.cycle <= 8).sort((a, b) => name(a.crop).localeCompare(name(b.crop), locale)).map((r) => <option key={r.crop.id} value={r.crop.id}>{name(r.crop)}</option>)}
          </select>
        </label>
      )}
    </div>
  );
  const notes = (
    <>
      <p className="muted small">{t.rbIntro}</p>
      <p className="muted small">{t.rtKeepHelp}</p>
      {keepRaw && keepEntry && keepFailed && <p className="warn small">{fill(t.rtKeepFail, { crop: name(keepEntry.crop) })}</p>}
      {waitMarkets && <p className="muted">{t.rbLoading}</p>}
      {ready && !shown && <p className="warn">{t.rbNoRotations}</p>}
    </>
  );

  return (
    <div className="rb-root">
      {shown ? (
        <RotationBoard t={t} lang={lang} locale={locale} board={shown} results={results} field={field} mode={mode} monthNames={monthNames} ctx={ctx} onExplain={onExplain} country={country} moneyProps={moneyProps} soilLine={soilLine} plotSlot={plotCard} controlsSlot={controls} notes={notes}
          tools={(
            <>
              <Scenario t={t} lang={lang} locale={locale} scn={scn} setScn={setScn} results={results} baseResults={baseResults} rotations={rotations} baseRotations={baseRotations} mode={mode} field={field} climate={climate} />
              <MultiYear t={t} lang={lang} locale={locale} results={results} pool={pool} field={field} mode={mode} monthNames={monthNames} keep={keepEntry && !keepFailed ? keepEntry.crop : null} />
            </>
          )} />
      ) : (<>{plotCard}{controls}{notes}</>)}
      {shown && <Evidence t={t} lang={lang} locale={locale} lat={lat} lon={lon} climate={scenarioClimate} rotations={rotations} field={field} soilData={soilData} mode={mode} monthNames={monthNames} results={results} country={country} />}
    </div>
  );
}
