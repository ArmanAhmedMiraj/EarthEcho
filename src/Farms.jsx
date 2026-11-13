import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import SeasonRecord from "./SeasonRecord.jsx";
import "./farms.css";
import "./farm2.css";
import FarmMap from "./FarmMap.jsx";
import FarmlandEditor from "./FarmlandEditor.jsx";
import { areaSqm, inUnits, totalSqm, plotLabel, nextPlotName, newParcelId } from "./geo.js";
import { PLOT_COLORS } from "./mapstyle.js";
import { AREA_UNITS, DETAIL_KEYS, HECTARES_PER, IRRIGATION, OWNERSHIP, detailCount, exportFields, parseFields, sameSpot } from "./fields.js";
import { SOIL_TYPES } from "./soil.js";
import { loadCropTable } from "./suitability.js";
import { buildAlerts, fetchWeatherPlus } from "./weatherPlus.js";
import { levelOf } from "./Disasters.jsx";
import { MAX_SEASONS, historyOf, historyPatch } from "./history.js";

const fill = (text, values) => Object.keys(values).reduce((s, k) => s.split(`{${k}}`).join(values[k]), text);

// weather alerts (forecast limits) come first; the hazard level (quakes, UN alerts, river) is slower and is added when it arrives
function checkFarm(farm, onPart) {
  const weather = fetchWeatherPlus(farm.lat, farm.lon).then((plus) => onPart({ alerts: buildAlerts(plus), at: Date.now() }));
  const hazard = fetch(`/api/disasters?lat=${farm.lat.toFixed(2)}&lon=${farm.lon.toFixed(2)}`)
    .then((r) => r.json())
    .then((h) => onPart({ hazard: h && h.ok && !(h.failed && h.failed.length === 4) ? levelOf(h) : null, hazardDone: true }))
    .catch(() => onPart({ hazardDone: true }));
  return Promise.allSettled([weather, hazard]).then(([w]) => { if (w.status === "rejected") throw w.reason; });
}

// a small label that says where a value comes from
const Chip = ({ kind, children }) => <span className={`fd-chip ${kind}`}>{children}</span>;

export default function Farms({ t, lang, fields, active, system, plotId, onPlot, onUpdate, onRemove, onOpen, onAdd, onMove, onImport, addPlotSignal = 0, onSignalHandled }) {
  const [status, setStatus] = useState({}); // id -> { state, alerts, hazard, at }
  const [note, setNote] = useState("");
  const [section, setSection] = useState("overview");
  const [editing, setEditing] = useState(false);
  const [renaming, setRenaming] = useState(null); // null | "farm" | "plot" | "newplot"
  const [nameDraft, setNameDraft] = useState("");
  const [focusId, setFocusId] = useState("");
  const [showInstall, setShowInstall] = useState(false);
  const [crops, setCrops] = useState([]);
  const fileInput = useRef(null);
  const [installEvent, setInstallEvent] = useState(window.__efInstall || null);
  useEffect(() => {
    const on = (e) => { e.preventDefault(); window.__efInstall = e; setInstallEvent(e); };
    window.addEventListener("beforeinstallprompt", on);
    return () => window.removeEventListener("beforeinstallprompt", on);
  }, []);
  useEffect(() => {
    let alive = true;
    loadCropTable().then((table) => { if (alive && table) setCrops(table.crops.map((c) => (lang === "bn" && c.bn ? c.bn : c.en))); });
    return () => { alive = false; };
  }, [lang]);

  const locale = lang === "bn" ? "bn-BD" : "en-GB";
  const timeFmt = new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" });
  const dayFmt = new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short" });
  const num = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const num1 = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const num2 = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });

  const check = useCallback((list) => {
    list.forEach((farm) => {
      setStatus((s) => ({ ...s, [farm.id]: { state: "loading" } }));
      checkFarm(farm, (part) => setStatus((s) => ({ ...s, [farm.id]: { ...(s[farm.id] || {}), ...(part.alerts ? { state: "ok" } : {}), ...part } })))
        .catch(() => setStatus((s) => ({ ...s, [farm.id]: { state: "failed" } })));
    });
  }, []);
  useEffect(() => { check(fields); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // a location holds plots; the details, crops and records below belong to the open plot
  const plots = (active && active.parcels) || [];
  const plotIdx = Math.max(0, plots.findIndex((p) => p.id === plotId));
  const plot = plots[plotIdx] || null;
  const plotName = plot ? plotLabel(plot, plotIdx, t) : "";
  const d = (plot && plot.details) || {};
  const setDetail = (key, value) => active && onUpdate(active.id, { details: { ...d, [key]: value } });
  const area = d.area || { value: "", unit: "bigha" };
  const setDetails = (patch) => active && onUpdate(active.id, { details: { ...d, ...patch } });
  const seasons = historyOf(d);
  const setSeasons = (rows) => setDetails(historyPatch(rows));
  const setSeason = (i, patch) => setSeasons(seasons.map((r, k) => (k === i ? { ...r, ...patch } : r)));
  const setArea = (patch) => setDetails({ area: { ...area, ...patch }, areaAuto: false }); // typing your own size ends the automatic fill
  const areaNumber = Number(String(area.value).replace(",", "."));
  const hectares = HECTARES_PER[area.unit] && areaNumber > 0 ? areaNumber * HECTARES_PER[area.unit] : null;

  const download = () => {
    const blob = new Blob([exportFields(fields)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "earthecho-fields.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  const onFile = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    file.text().then((text) => {
      try {
        const incoming = parseFields(text).filter((f) => !fields.some((x) => sameSpot(x, f)));
        onImport(incoming);
        check(incoming);
        setNote(fill(t.fmImportOk, { n: num.format(incoming.length) }));
      } catch {
        setNote(t.fmImportBad);
      }
    });
    e.target.value = "";
  };
  const openRename = (mode) => {
    if (!active) return;
    setNameDraft(mode === "farm" ? active.name : mode === "plot" ? (plot && plot.name) || plotName : nextPlotName(plots, t));
    setRenaming(mode);
  };
  useEffect(() => {
    if (addPlotSignal > 0 && active) { openRename("newplot"); if (onSignalHandled) onSignalHandled(); }
  }, [addPlotSignal, active]); // eslint-disable-line react-hooks/exhaustive-deps
  const saveName = () => {
    const v = nameDraft.trim();
    if (!v || !active) return;
    if (renaming === "farm") onUpdate(active.id, { name: v.slice(0, 80) });
    else if (renaming === "plot") onUpdate(active.id, { parcels: plots.map((p) => (p.id === plot.id ? { ...p, name: v.slice(0, 60) } : p)) });
    else if (renaming === "newplot") {
      const fresh = { id: newParcelId(), name: v.slice(0, 60), points: [], details: {} };
      onUpdate(active.id, { parcels: [...plots, fresh] });
      onPlot(fresh.id);
    }
    setRenaming(null);
  };
  const removePlot = () => {
    if (!plot || plots.length < 2) return;
    if (!window.confirm(fill(t.plDeleteConfirm, { name: plotName }))) return;
    const rest = plots.filter((p) => p.id !== plot.id);
    onUpdate(active.id, { parcels: rest });
    onPlot(rest[0].id);
  };
  const totalMapped = totalSqm(plots);
  const mappedSqm = plot ? areaSqm(plot.points) : 0;
  // A plot that has a boundary on the map gets its land size from it, unless the farmer typed their own size.
  const autoSig = plots.map((p) => `${p.id}:${areaSqm(p.points)}:${(p.details && p.details.areaAuto) ? 1 : 0}:${(p.details && p.details.area && p.details.area.value) || ""}`).join("|");
  useEffect(() => {
    if (!active) return;
    let changed = false;
    const next = plots.map((p) => {
      const sq = areaSqm(p.points);
      const pd = p.details || {};
      const typed = pd.area && String(pd.area.value || "").trim() && !pd.areaAuto;
      if (sq <= 0 || typed) return p;
      const value = String(Math.round(inUnits(sq).decimal * 10) / 10);
      if (pd.area && pd.area.value === value && pd.area.unit === "decimal" && pd.areaAuto) return p;
      changed = true;
      return { ...p, details: { ...pd, area: { value, unit: "decimal" }, areaAuto: true } };
    });
    if (changed) onUpdate(active.id, { parcels: next });
  }, [autoSig, active && active.id]); // eslint-disable-line react-hooks/exhaustive-deps
  // the editor returns every plot with its boundary; each plot keeps its own details
  const saveParcels = (list) => {
    if (active) {
      const old = new Map(plots.map((p) => [p.id, p]));
      const next = list.map((p) => ({ ...p, details: (old.get(p.id) && old.get(p.id).details) || {} }));
      onUpdate(active.id, { parcels: next });
      if (!next.some((p) => p.id === plotId)) onPlot(next[0].id);
    }
    setEditing(false);
  };

  const alertText = (a) => {
    const v = a.value == null ? "" : num.format(a.value);
    const when = a.days.length ? ` (${a.days.slice(0, 3).map((day) => dayFmt.format(new Date(`${day}T00:00:00`))).join(", ")})` : "";
    return (t[`alert_${a.id}`] || a.id).replace("{v}", v) + when;
  };

  const sys = system || (active && active.system) || null;
  const sysSoil = sys && sys.soil ? sys.soil : null;
  const soilSource = sysSoil ? { satellite: t.fdSoilSat, map: t.fdSoilMap, region: t.fdSoilRegion }[sysSoil.source] : "";
  const confWord = sysSoil && sysSoil.level ? { high: t.confHigh, medium: t.confMedium, low: t.confLow }[sysSoil.level] : null;
  const areaLine = (f) => {
    const n = (f.parcels || []).length;
    const sq = totalSqm(f.parcels);
    const parts = [n > 1 ? fill(t.plCount, { n: num.format(n) }) : ""];
    if (sq > 0) parts.push(`${num1.format(inUnits(sq).decimal)} ${t.flDecimal}`);
    return parts.filter(Boolean).join(" · ");
  };

  const plotSwitch = plots.length > 0 && (
    <div className="pl-switch">
      <b className="small">{t.plPlotLabel}</b>
      <select value={plot ? plot.id : ""} onChange={(e) => onPlot(e.target.value)} aria-label={t.plPlot}>
        {plots.map((p, i) => <option key={p.id} value={p.id}>{plotLabel(p, i, t)}</option>)}
      </select>
      <button className="tab" onClick={() => openRename("newplot")} disabled={plots.length >= 12}>＋ {t.plAdd}</button>
      <button className="tab" onClick={() => openRename("plot")}>✎ {t.plRename}</button>
      {plots.length > 1 && <p className="small pl-note">{fill(t.plPlotNote, { name: plotName })}</p>}
    </div>
  );
  const st0 = (active && status[active.id]) || {};
  const alertBlock = (st) => (
    <>
      {st.state === "loading" && <p className="muted small">{t.fmChecking}</p>}
      {st.state === "failed" && <p className="warn small">{t.fmAlertFail}</p>}
      {st.state === "ok" && (
        <>
          {st.alerts.length === 0 && st.hazardDone && st.hazard !== "alert" && st.hazard !== "watch" && <p className="muted small">{t.fmNoAlerts}</p>}
          {!st.hazardDone && <p className="muted small">{t.fmChecking}</p>}
          {st.alerts.map((a) => <div key={a.id} className={`fm-alert ${a.level}`}><b>{t[`level_${a.level}`]}</b><span>{alertText(a)}</span></div>)}
          {(st.hazard === "alert" || st.hazard === "watch") && <div className={`fm-alert ${st.hazard === "alert" ? "severe" : "warning"}`}><b>{st.hazard === "alert" ? t.level_warning : t.level_watch}</b><span>{t[`fmHazard_${st.hazard}`]}</span></div>}
          <p className="muted small">{fill(t.fmUpdated, { time: timeFmt.format(new Date(st.at)) })}</p>
        </>
      )}
    </>
  );
  const hasData = (id) => { const p = plots.find((x) => x.id === id); return !!(p && p.details && Object.keys(p.details).length); };
  const SECTIONS = [["overview", t.fdSecOverview], ["details", t.fdSecDetails], ["record", t.srSection]];

  const monthsAbbr = t.rtMonthsAbbr.split(" ");
  const sowWord = (pd) => (pd.currentSowMonth !== undefined && pd.currentSowMonth !== "" && monthsAbbr[Number(pd.currentSowMonth)] ? `, ${fill(t.orbSownIn, { m: monthsAbbr[Number(pd.currentSowMonth)] })}` : "");
  const soilOf = (pd) => (pd.soil ? `${t.soilNames[pd.soil]} (${t.orbYouSet})` : sysSoil ? t.soilNames[sysSoil.key] : "—");
  const sizeOf = (p) => {
    const sq = areaSqm(p.points), pd = p.details || {};
    if (sq > 0) return `${num1.format(inUnits(sq).decimal)} ${t.flDecimal}`;
    return pd.area && String(pd.area.value || "").trim() ? fill(t.fdAreaLine, { v: pd.area.value, u: t[`fdUnit_${pd.area.unit}`] || pd.area.unit }) : t.plNoBoundary;
  };
  const CHIPS = [["currentCrop", t.orbD_currentCrop], ["currentSowMonth", t.orbD_currentSowMonth], ["irrigation", t.orbD_irrigation], ["soil", t.orbD_soil], ["area", t.orbD_area], ["irrigMethod", t.orbD_irrigMethod], ["plannedCrop", t.orbD_plannedCrop], ["ownership", t.orbD_ownership], ["previousCrops", t.orbD_previousCrops], ["notes", t.orbD_notes], ["previousSowMonth", t.orbD_previousSowMonth]];
  // The soil counts as done when the farmer set it or when EarthEcho found it from satellite and map data.
  const soilKnown = !!(d.soil || sysSoil);
  const filled = (k) => (k === "soil" ? soilKnown : k === "area" ? !!(d.area && String(d.area.value || "").trim()) : !!String(d[k] || "").trim());
  const got = detailCount(d) + (!d.soil && sysSoil ? 1 : 0), total = DETAIL_KEYS.length;
  const pickPlotThen = (p, fn) => { onPlot(p.id); fn(); };
  const openRenameOf = (p, i) => { setNameDraft(p.name || plotLabel(p, i, t)); setRenaming("plot"); };
  const removePlotOf = (p) => {
    if (plots.length < 2) return;
    if (!window.confirm(fill(t.plDeleteConfirm, { name: plotLabel(p, plots.indexOf(p), t) }))) return;
    const rest = plots.filter((x) => x.id !== p.id);
    onUpdate(active.id, { parcels: rest });
    onPlot(rest[0].id);
  };
  const pastRows = seasons.filter((r) => r.crop.trim());
  const recs = Array.isArray(d.records) ? d.records : [];
  const ringC = 2 * Math.PI * 30;

  return (
    <div className="fd fd2">
      {fields.length === 0 && (
        <div className="fd-add"><p className="muted">{t.fdNoneYet}</p><button className="btn wide" onClick={onAdd}>＋ {t.fdAdd}</button><p className="small muted">{t.fdAddHelp}</p></div>
      )}
      {active && (
        <div className="fd2-top">
          <div className="fd2-map">
            <FarmMap t={t} lang={lang} field={active} activeId={plot ? plot.id : ""} onSelect={onPlot} focusId={focusId} onEdit={() => setEditing(true)} />
            <div className="fd2-mapchips">
              <button className="fd2-chip fd2-rename" onClick={() => openRename("farm")} title={t.flRenameFarm}>✎ {active.name}</button>
              <span className="fd2-chip">{fill(plots.length === 1 ? t.plCountOne : t.plCount, { n: num.format(plots.length) })}{totalMapped > 0 ? ` · ${num1.format(inUnits(totalMapped).decimal)} ${t.flDecimal} (${num2.format(inUnits(totalMapped).hectare)} ha)` : ""}</span>
              <span className="fd2-chip">{active.path ? `${active.path} · ` : ""}{active.lat.toFixed(4)}, {active.lon.toFixed(4)} · <button className="fd-link" onClick={onMove}>{t.fdMove}</button></span>
            </div>
            {totalMapped === 0 && <p className="small muted fd2-noland">{t.flNoLand}</p>}
          </div>
          <aside className="fd2-today panel" aria-label={t.orbToday}>
            <h3>{t.orbToday}</h3>
            <div className="fd2-alerts">{alertBlock(st0)}</div>
            <div className="fd2-today-foot">
              <button className="tab" onClick={() => check([active])}>{t.fmRefresh}</button>
            </div>
          </aside>
        </div>
      )}
      <div className="fd-seg" role="tablist">
        {SECTIONS.map(([id, text]) => (
          <button key={id} role="tab" aria-selected={section === id} className={section === id ? "on" : ""} onClick={() => setSection(id)}>
            {id === "details" && active ? `${text} · ${fill(t.orbOf, { a: num.format(got), b: num.format(total) })}` : text}
          </button>
        ))}
      </div>

      {active && section === "overview" && (
        <>
          <h3 className="fd2-h">{t.plPlotsTitle}</h3>
          <div className="fd2-plots">
            {plots.map((p, i) => {
              const pd = p.details || {};
              const on = !!plot && p.id === plot.id;
              return (
                <div key={p.id} className={`fd2-plot${on ? " on" : ""}`}>
                  <button className="fd2-plot-pick" aria-pressed={on} onClick={() => onPlot(p.id)}>
                    <span className="fd2-plot-head"><b><i className="fl-dot" style={{ background: p.points.length ? PLOT_COLORS[i % PLOT_COLORS.length] : "#999" }} />{plotLabel(p, i, t)}</b><span className={`fd2-badge${on ? " on" : ""}`}>{on ? t.plSelected : t.orbTap}</span></span>
                    <dl>
                      <dt>{t.fdCurrentCrop}</dt><dd>{pd.currentCrop ? `${pd.currentCrop}${sowWord(pd)}` : t.plNoCrop}</dd>
                      <dt>{t.orbPlotWater}</dt><dd>{pd.irrigation ? t[`fdIrr_${pd.irrigation}`] : "—"}</dd>
                      <dt>{t.fdSoil}</dt><dd>{soilOf(pd)}</dd>
                      <dt>{t.orbPlotSize}</dt><dd>{sizeOf(p)}</dd>
                    </dl>
                  </button>
                  <div className="fd2-plot-act">
                    <button className="tab" onClick={() => { onPlot(p.id); openRenameOf(p, i); }}>{t.orbRename}</button>
                    <button className="tab danger" onClick={() => removePlotOf(p)} disabled={plots.length < 2} title={plots.length < 2 ? t.plOnlyOne : undefined}>{t.plDelete}</button>
                  </div>
                </div>
              );
            })}
            <button className="fd2-plot fd2-add" onClick={() => openRename("newplot")} disabled={plots.length >= 12}>＋ {t.plAdd}</button>
          </div>

          <div className="fd2-trio">
            <section className="fd2-card" aria-label={t.fdFoundTitle}>
              <h3>{t.fdFoundTitle} <span className="fd2-badge">{t.orbEstimate}</span></h3>
              <div className="fd2-found">
                <svg className="fd2-block" viewBox="0 0 160 110" aria-hidden="true">
                  <polygon points="80,8 152,44 80,80 8,44" fill="#58c26f" /><polygon points="8,44 80,80 80,100 8,64" fill="#7a5638" /><polygon points="80,80 152,44 152,64 80,100" fill="#5d3f28" />
                </svg>
                <dl>
                  <dt>{t.fdSoil}</dt><dd>{sysSoil ? <>{t.soilNames[sysSoil.key]}{sysSoil.confidence != null ? ` · ${fill(t.orbSure, { n: num.format(sysSoil.confidence) })}` : ""}</> : t.fdWaiting}</dd>
                  <dt>{t.orbHeight}</dt><dd>{sys && sys.elevationM != null ? `${num.format(sys.elevationM)} m` : "—"}</dd>
                  <dt>{t.fdSlope}</dt><dd>{sys && sys.slopePct != null ? `${num1.format(sys.slopePct)} %` : "—"}</dd>
                </dl>
              </div>
              <label className="fd2-know">
                <span>{d.soil ? `${t.fdSoil}: ${t.soilNames[d.soil]} (${t.orbYouSet})` : t.orbKnowSoil}</span>
                {d.soil
                  ? <button className="fd-link" onClick={() => setDetail("soil", "")}>{t.fdUseEstimate}</button>
                  : (
                    <select value="" onChange={(e) => setDetail("soil", e.target.value)} aria-label={t.fdKnowSoil}>
                      <option value="">{sysSoil ? `${t.orbUseEst} (${t.soilNames[sysSoil.key]})` : t.fdKnowSoil}</option>
                      {SOIL_TYPES.map((k) => <option key={k} value={k}>{t.soilNames[k]}</option>)}
                    </select>
                  )}
              </label>
            </section>

            <section className="fd2-card" aria-label={t.fdSecDetails}>
              <h3>{fill(t.orbMyDetails, { name: plotName })}</h3>
              <div className="fd2-det-top">
                <svg width="76" height="76" viewBox="0 0 76 76" role="img" aria-label={`${got}/${total}`}>
                  <circle cx="38" cy="38" r="30" fill="none" stroke="var(--border)" strokeWidth="7" />
                  <circle cx="38" cy="38" r="30" fill="none" stroke="var(--accent)" strokeWidth="7" strokeLinecap="round" strokeDasharray={`${ringC * got / total} ${ringC}`} transform="rotate(-90 38 38)" />
                  <text x="38" y="44" textAnchor="middle" className="fd2-ring-n">{num.format(got)}/{num.format(total)}</text>
                </svg>
                <p className="small">{t.orbMore}</p>
              </div>
              <div className="fd2-chips">
                {CHIPS.map(([k, label]) => <button key={k} className={`fd2-dchip${filled(k) ? " on" : ""}`} onClick={() => setSection("details")}>{filled(k) ? "✓ " : "+ "}{label}</button>)}
              </div>
              <button className="btn wide" onClick={() => setSection("details")}>{t.orbFill}</button>
            </section>

            <section className="fd2-card" aria-label={t.srSection}>
              <h3>{t.srSection}</h3>
              <ul className="fd2-seasons">
                {d.currentCrop && <li><b>{d.currentCrop}</b> · {t.orbGrowingNow}{sowWord(d).replace(/^,\s*/, " · ")}</li>}
                {pastRows.slice(0, 3).map((r, i) => <li key={`h${i}`}><b>{r.crop}</b>{r.year || (r.sowMonth !== "" && monthsAbbr[Number(r.sowMonth)]) ? ` · ${[r.sowMonth !== "" ? monthsAbbr[Number(r.sowMonth)] : "", r.year].filter(Boolean).join(" ")}` : ""}</li>)}
                {recs.slice(0, 2).map((r, i) => <li key={`r${i}`}><b>{r.crop}</b>{r.sowDate ? ` · ${r.sowDate.slice(0, 4)}` : ""}{r.yieldT ? ` · ${r.yieldT} t/ha` : ""}</li>)}
                {!d.currentCrop && pastRows.length === 0 && recs.length === 0 && <li className="muted">{t.orbNoSeasons}</li>}
              </ul>
              <p className="small muted">{t.orbAddOlder}</p>
              <button className="tab wide" onClick={() => setSection("record")}>{t.orbAddSeason}</button>
            </section>
          </div>
        </>
      )}

      {active && section === "details" && (
        <section className="fd-card">
          {plotSwitch}
          <p className="small muted">{t.fdAboutHelp}</p>
          <div className="fd-form">
            <label className="fd-field">
              <span>{t.fdArea} {String(area.value).trim() && <Chip kind="you">{t.fdYou}</Chip>}</span>
              <span className="fd-row">
                <input inputMode="decimal" value={area.value} placeholder={t.fdAreaPlaceholder} onChange={(e) => setArea({ value: e.target.value.slice(0, 12) })} />
                <select value={area.unit} onChange={(e) => setArea({ unit: e.target.value })} aria-label={t.fdArea}>
                  {AREA_UNITS.map((u) => <option key={u} value={u}>{t[`fdUnit_${u}`]}</option>)}
                </select>
              </span>
              {d.areaAuto && <span className="small muted">{t.orbAreaAuto}</span>}
              {mappedSqm > 0 && !d.areaAuto && (
                <span className="small">{fill(t.flMappedArea, { v: num1.format(inUnits(mappedSqm).decimal) })} <button type="button" className="fd-link" onClick={() => setArea({ value: String(Math.round(inUnits(mappedSqm).decimal * 10) / 10), unit: "decimal" })}>{t.flUseMapped}</button></span>
              )}
              {hectares != null && <span className="small muted">{t.fdAbout} {fill(t.fdHectares, { h: num1.format(hectares) })}</span>}
            </label>
            <label className="fd-field">
              <span>{t.fdIrrigation} {d.irrigation && <Chip kind="you">{t.fdYou}</Chip>}</span>
              <select value={d.irrigation || ""} onChange={(e) => setDetail("irrigation", e.target.value)}>
                <option value="">{t.fdChoose}</option>
                {IRRIGATION.map((k) => <option key={k} value={k}>{t[`fdIrr_${k}`]}</option>)}
              </select>
            </label>
            <label className="fd-field">
              <span>{t.ir2Method} {d.irrigMethod && <Chip kind="you">{t.fdYou}</Chip>}</span>
              <select value={d.irrigMethod || ""} onChange={(e) => setDetail("irrigMethod", e.target.value)}>
                <option value="">{t.fdChoose}</option>
                {["surface", "sprinkler", "drip"].map((k) => <option key={k} value={k}>{t[`irMethod_${k}`]}</option>)}
              </select>
            </label>
            <label className="fd-field">
              <span>{t.fdCurrentCrop} {d.currentCrop && <Chip kind="you">{t.fdYou}</Chip>}</span>
              <input list="fd-crops" value={d.currentCrop || ""} placeholder={t.fdCropPlaceholder} maxLength={60} onChange={(e) => setDetail("currentCrop", e.target.value)} />
            </label>
            {d.currentCrop && (
              <label className="fd-field">
                <span>{t.fdSowMonth} {d.currentSowMonth !== undefined && d.currentSowMonth !== "" && <Chip kind="you">{t.fdYou}</Chip>}</span>
                <select value={d.currentSowMonth ?? ""} onChange={(e) => setDetail("currentSowMonth", e.target.value)}>
                  <option value="">{t.fdChoose}</option>
                  {t.rtMonthsAbbr.split(" ").map((m, i) => <option key={m} value={String(i)}>{m}</option>)}
                </select>
              </label>
            )}
            <label className="fd-field">
              <span>{t.fdPlannedCrop} {d.plannedCrop && <Chip kind="you">{t.fdYou}</Chip>}</span>
              <input list="fd-crops" value={d.plannedCrop || ""} placeholder={t.fdCropPlaceholder} maxLength={60} onChange={(e) => setDetail("plannedCrop", e.target.value)} />
            </label>
            <datalist id="fd-crops">{crops.map((c) => <option key={c} value={c} />)}</datalist>
          </div>
          <details className="fd-more">
            <summary>{t.fdMore}</summary>
            <div className="fd-form">
              <label className="fd-field">
                <span>{t.fdOwnership} {d.ownership && <Chip kind="you">{t.fdYou}</Chip>}</span>
                <select value={d.ownership || ""} onChange={(e) => setDetail("ownership", e.target.value)}>
                  <option value="">{t.fdChoose}</option>
                  {OWNERSHIP.map((k) => <option key={k} value={k}>{t[`fdOwn_${k}`]}</option>)}
                </select>
              </label>
              <div className="fd-field wide fd-hist">
                <span>{t.fdHistory} {seasons.some((r) => r.crop.trim()) && <Chip kind="you">{t.fdYou}</Chip>}</span>
                <p className="small muted fd-hist-hint">{t.fdHistoryHint}</p>
                {seasons.map((r, i) => (
                  <div className="fd-hist-row" key={i}>
                    <b className="fd-hist-n">{fill(t.fdHistoryRow, { n: num.format(i + 1) })}</b>
                    <input list="fd-crops" value={r.crop} placeholder={t.fdCropPlaceholder} maxLength={60} aria-label={`${fill(t.fdHistoryRow, { n: num.format(i + 1) })}: ${t.fdPrevious}`} onChange={(e) => setSeason(i, { crop: e.target.value })} />
                    <select value={r.sowMonth} aria-label={`${fill(t.fdHistoryRow, { n: num.format(i + 1) })}: ${t.fdSowMonth}`} onChange={(e) => setSeason(i, { sowMonth: e.target.value })}>
                      <option value="">{t.fdChoose}</option>
                      {t.rtMonthsAbbr.split(" ").map((m, k) => <option key={m} value={String(k)}>{m}</option>)}
                    </select>
                    <input className="fd-hist-year" inputMode="numeric" value={r.year} placeholder={t.fdHistoryYear} maxLength={4} aria-label={`${fill(t.fdHistoryRow, { n: num.format(i + 1) })}: ${t.fdHistoryYear}`} onChange={(e) => setSeason(i, { year: e.target.value })} />
                    <button type="button" className="fd-link fd-hist-x" aria-label={t.fdHistoryRemove} title={t.fdHistoryRemove} onClick={() => setSeasons(seasons.filter((_, k) => k !== i))}>✕</button>
                  </div>
                ))}
                {seasons.length < MAX_SEASONS && <button type="button" className="fd-link fd-hist-add" onClick={() => setSeasons([...seasons, { crop: "", sowMonth: "", year: "" }])}>{t.fdHistoryAdd}</button>}
              </div>
              <label className="fd-field wide">
                <span>{t.fdNotes} {d.notes && <Chip kind="you">{t.fdYou}</Chip>}</span>
                <textarea rows={2} value={d.notes || ""} placeholder={t.fdNotesPlaceholder} maxLength={500} onChange={(e) => setDetail("notes", e.target.value)} />
              </label>
            </div>
          </details>
          <p className="small muted">✓ {t.fdSaved} · {fill(t.fdDetailsCount, { n: num.format(detailCount(d) + (!d.soil && sysSoil ? 1 : 0)), total: num.format(DETAIL_KEYS.length) })}</p>
        </section>
      )}

      {active && section === "record" && (
        <>
          <div className="fd-card">{plotSwitch}</div>
          <SeasonRecord key={plot ? plot.id : "x"} t={t} lang={lang} locale={locale} field={{ ...active, details: d, name: plots.length > 1 ? `${active.name} · ${plotName}` : active.name }} onUpdate={onUpdate} cropNames={crops} />
        </>
      )}

      {active && (
        <div className="fd2-manage">
          <strong>{t.flManage}</strong>
          <div className="fd2-manage-act">
            <button className="tab" onClick={download} disabled={fields.length === 0}>{t.fmExport}</button>
            <button className="tab" onClick={() => fileInput.current && fileInput.current.click()}>{t.fmImport}</button>
            <button className="tab" onClick={() => { if (installEvent) { installEvent.prompt(); window.__efInstall = null; setInstallEvent(null); } else setShowInstall((v) => !v); }}>{t.fmInstallTitle}</button>
            <button className="tab danger" onClick={() => onRemove(active)}>{t.orbDeleteFarm}</button>
          </div>
          {showInstall && <p className="small muted fd2-install">{t.fmInstallHelp}</p>}
        </div>
      )}
      <details className="fl-manage">
        <summary>{t.orbAllFarms}</summary>
      {fields.length === 0 && <p className="muted">{t.fdNoneYet}</p>}
      {fields.map((farm) => {
        const st = status[farm.id] || {};
        const current = active && farm.id === active.id;
        const line = [areaLine(farm), ...[...new Set((farm.parcels || []).map((p) => p.details && p.details.currentCrop).filter(Boolean))]].filter(Boolean).join(" · ");
        return (
          <div className={`fm-card${current ? " current" : ""}`} key={farm.id}>
            <div className="fm-head">
              <strong>{farm.name}</strong>
              <span className="muted small">{current ? `${t.fdCurrent} · ` : ""}{farm.path || `${farm.lat.toFixed(2)}, ${farm.lon.toFixed(2)}`}</span>
            </div>
            {line && <p className="small">{line}</p>}
            {alertBlock(st)}
            <div className="fm-actions">
              {!current && <button className="tab" onClick={() => onOpen(farm)}>{t.fdUse}</button>}
              <button className="tab" onClick={() => check([farm])}>{t.fmRefresh}</button>
              <button className="tab" onClick={() => onRemove(farm)}>{t.fdDelete}</button>
            </div>
          </div>
        );
      })}

      <div className="fd-add">
        <button className="btn wide" onClick={onAdd}>＋ {t.fdAdd}</button>
        <p className="small muted">{t.fdAddHelp}</p>
      </div>
      {note && <p className="small" role="status">{note}</p>}

      <h3>{t.fdBackup}</h3>
      <div className="fm-actions">
        <button className="tab" onClick={download} disabled={fields.length === 0}>{t.fmExport}</button>
        <button className="tab" onClick={() => fileInput.current && fileInput.current.click()}>{t.fmImport}</button>
        <input ref={fileInput} type="file" accept="application/json,.json" onChange={onFile} hidden />
      </div>
      <p className="muted small">{t.fdBackupNote}</p>

      <h3>{t.fmInstallTitle}</h3>
      {installEvent && (
        <p><button className="tab" onClick={() => { installEvent.prompt(); window.__efInstall = null; setInstallEvent(null); }}>{t.fmInstall}</button></p>
      )}
      <p className="small muted">{t.fmInstallHelp}</p>
      </details>

      {editing && active && <FarmlandEditor t={t} lang={lang} field={active} initialId={plot ? plot.id : ""} hasData={hasData} onSave={saveParcels} onClose={() => setEditing(false)} />}
      {renaming && createPortal(
        <div className="ac-overlay" role="dialog" aria-modal="true" aria-label={renaming === "farm" ? t.flRenameFarm : renaming === "plot" ? t.plRename : t.plAdd} onKeyDown={(e) => { if (e.key === "Escape") setRenaming(null); }}>
          <form className="ac-modal small" onSubmit={(e) => { e.preventDefault(); saveName(); }}>
            <h3>{renaming === "farm" ? t.flRenameFarm : renaming === "plot" ? t.plRename : t.plAdd}</h3>
            <label className="fd-field"><span>{renaming === "farm" ? t.fdName : t.flPlotName}</span><input autoFocus value={nameDraft} maxLength={renaming === "farm" ? 80 : 60} onChange={(e) => setNameDraft(e.target.value)} /></label>
            <div className="fm-actions"><button type="button" className="tab" onClick={() => setRenaming(null)}>{t.flCancel}</button><button type="submit" className="btn" disabled={!nameDraft.trim()}>{t.flSaveName}</button></div>
          </form>
        </div>,
        document.body,
      )}
    </div>
  );
}
