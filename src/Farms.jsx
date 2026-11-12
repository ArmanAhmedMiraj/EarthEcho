import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import SeasonRecord from "./SeasonRecord.jsx";
import "./farms.css";
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

export default function Farms({ t, lang, fields, active, system, plotId, onPlot, onUpdate, onRemove, onOpen, onAdd, onMove, onImport }) {
  const [status, setStatus] = useState({}); // id -> { state, alerts, hazard, at }
  const [note, setNote] = useState("");
  const [section, setSection] = useState("overview");
  const [editing, setEditing] = useState(false);
  const [renaming, setRenaming] = useState(null); // null | "farm" | "plot" | "newplot"
  const [nameDraft, setNameDraft] = useState("");
  const [focusId, setFocusId] = useState("");
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
  const setArea = (patch) => setDetail("area", { ...area, ...patch });
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

  return (
    <div className="fd">
      <p className="muted small fd-intro">{t.fdIntro}</p>
      {fields.length > 0 && (
        <div className="fl-picker">
          <span id="fl-picker-l">{t.flMyFarms} ({num.format(fields.length)})</span>
          <div className="fl-picker-row">
            <select aria-labelledby="fl-picker-l" value={active ? active.id : ""} onChange={(e) => { const f = fields.find((x) => x.id === e.target.value); if (f && (!active || f.id !== active.id)) onOpen(f); }}>
              {fields.map((f) => <option key={f.id} value={f.id}>{f.name}{areaLine(f) ? ` · ${areaLine(f)}` : ""}</option>)}
            </select>
            <button className="tab" onClick={onAdd}>＋ {t.fdAdd}</button>
          </div>
        </div>
      )}
      {fields.length === 0 && (
        <div className="fd-add"><p className="muted">{t.fdNoneYet}</p><button className="btn wide" onClick={onAdd}>＋ {t.fdAdd}</button><p className="small muted">{t.fdAddHelp}</p></div>
      )}
      <div className="fd-seg" role="tablist">
        {SECTIONS.map(([id, text]) => (
          <button key={id} role="tab" aria-selected={section === id} className={section === id ? "on" : ""} onClick={() => setSection(id)}>
            {text}
            {id === "details" && active && <Chip kind="you">{num.format(detailCount(d))}/{num.format(DETAIL_KEYS.length)}</Chip>}
          </button>
        ))}
      </div>

      {active && section === "overview" && (
        <section className="fd-card" aria-label={t.fdCurrent}>
          <div className="fl-namerow">
            <strong>{active.name}</strong>
            <button className="fl-pencil" onClick={() => openRename("farm")} aria-label={t.flRenameFarm} title={t.flRenameFarm}>✎</button>
            <span className="small muted">✓ {t.fdSaved}</span>
          </div>
          <p className="small muted fd-where">{active.path ? `${active.path} · ` : ""}{active.lat.toFixed(4)}, {active.lon.toFixed(4)} · <button className="fd-link" onClick={onMove}>{t.fdMove}</button></p>

          <h3>{t.flFarmland} <span className="small muted">· {fill(plots.length === 1 ? t.plCountOne : t.plCount, { n: num.format(plots.length) })}{totalMapped > 0 ? ` · ${num1.format(inUnits(totalMapped).decimal)} ${t.flDecimal} (${num2.format(inUnits(totalMapped).hectare)} ha)` : ""}</span></h3>
          <FarmMap t={t} lang={lang} field={active} activeId={plot ? plot.id : ""} onSelect={onPlot} focusId={focusId} onEdit={() => setEditing(true)} />
          {totalMapped === 0 && <p className="small muted">{t.flNoLand}</p>}

          <h3>{t.plPlotsTitle}</h3>
          <div className="pl-grid">
            {plots.map((p, i) => {
              const pd = p.details || {};
              const sq = areaSqm(p.points);
              const typed = pd.area && String(pd.area.value || "").trim() ? fill(t.fdAreaLine, { v: pd.area.value, u: t[`fdUnit_${pd.area.unit}`] || pd.area.unit }) : "";
              const recs = Array.isArray(pd.records) ? pd.records.length : 0;
              return (
                <button key={p.id} className={`pl-card${plot && p.id === plot.id ? " on" : ""}`} aria-pressed={!!plot && p.id === plot.id} onClick={() => onPlot(p.id)}>
                  <span className="pl-row"><span><i className="fl-dot" style={{ background: p.points.length ? PLOT_COLORS[i % PLOT_COLORS.length] : "#999" }} /><b>{plotLabel(p, i, t)}</b></span>{plot && p.id === plot.id && <Chip kind="you">{t.plSelected}</Chip>}</span>
                  <span className="small">{sq > 0 ? `${num1.format(inUnits(sq).decimal)} ${t.flDecimal}` : typed || t.plNoBoundary}{sq > 0 && typed ? ` · ${typed}` : ""}</span>
                  <span className="small">{t.plCrop}: {pd.currentCrop || t.plNoCrop}{pd.plannedCrop ? ` → ${pd.plannedCrop}` : ""}</span>
                  <span className="small muted">{pd.soil ? `${t.fdSoil}: ${t.soilNames[pd.soil]} · ` : ""}{fill(t.plRecords, { n: num.format(recs) })}</span>
                </button>
              );
            })}
          </div>
          <div className="pl-tools">
            <button className="tab" onClick={() => openRename("newplot")} disabled={plots.length >= 12}>＋ {t.plAdd}</button>
            <button className="tab" onClick={() => openRename("plot")}>✎ {t.plRename}</button>
            <button className="tab" onClick={removePlot} disabled={plots.length < 2} title={plots.length < 2 ? t.plOnlyOne : undefined}>{t.plDelete}</button>
          </div>

          <h3>{t.fdFoundTitle} <Chip kind="system">{t.fdSystem}</Chip></h3>
          <div className="fd-rows">
            <div className="fd-line">
              <b>{t.fdSoil}{plots.length > 1 ? ` · ${plotName}` : ""}</b>
              <span className="fd-v">
                {d.soil ? (
                  <>{t.soilNames[d.soil]} <Chip kind="you">{t.fdYou}</Chip>
                    {sysSoil && <span className="small muted"> · {t.fdWasEstimate}: {t.soilNames[sysSoil.key]}{sysSoil.confidence != null ? ` (${num.format(sysSoil.confidence)}%)` : ""}</span>}</>
                ) : sysSoil ? (
                  <>{t.soilNames[sysSoil.key]} <Chip kind="system">{confWord ? `${confWord}${sysSoil.confidence != null ? ` ${num.format(sysSoil.confidence)}%` : ""}` : t.fdSystem}</Chip>
                    <span className="small muted"> · {soilSource}</span></>
                ) : <span className="muted">{t.fdWaiting}</span>}
              </span>
              <span className="fd-act">
                {d.soil
                  ? <button className="fd-link" onClick={() => setDetail("soil", "")}>{t.fdUseEstimate}</button>
                  : (
                    <select className="fd-mini" value="" onChange={(e) => setDetail("soil", e.target.value)} aria-label={t.fdKnowSoil}>
                      <option value="">{t.fdKnowSoil}</option>
                      {SOIL_TYPES.map((k) => <option key={k} value={k}>{t.soilNames[k]}</option>)}
                    </select>
                  )}
              </span>
            </div>
            <div className="fd-line"><b>{t.fdElevation}</b><span className="fd-v">{sys && sys.elevationM != null ? `${num.format(sys.elevationM)} m` : "—"}</span><span className="fd-act" /></div>
            <div className="fd-line"><b>{t.fdSlope}</b><span className="fd-v">{sys && sys.slopePct != null ? `${num1.format(sys.slopePct)} %` : "—"}</span><span className="fd-act" /></div>
          </div>

          <h3>{t.fdFieldAlerts}</h3>
          {alertBlock(st0)}

          <div className="fd-nudge">
            <span className="small">{plots.length > 1 ? fill(t.plPlotNote, { name: plotName }) : t.fdAboutHelp}</span>
            <button className="btn" onClick={() => setSection("details")}>{t.fdSecDetails} → ({num.format(detailCount(d))}/{num.format(DETAIL_KEYS.length)})</button>
          </div>
        </section>
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
              {mappedSqm > 0 && (
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
          <p className="small muted">✓ {t.fdSaved} · {fill(t.fdDetailsCount, { n: num.format(detailCount(d)), total: num.format(DETAIL_KEYS.length) })}</p>
        </section>
      )}

      {active && section === "record" && (
        <>
          <div className="fd-card">{plotSwitch}</div>
          <SeasonRecord key={plot ? plot.id : "x"} t={t} lang={lang} locale={locale} field={{ ...active, details: d, name: plots.length > 1 ? `${active.name} · ${plotName}` : active.name }} onUpdate={onUpdate} cropNames={crops} />
        </>
      )}

      <details className="fl-manage">
        <summary>{t.flManage}</summary>
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
