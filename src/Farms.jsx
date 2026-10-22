import { useCallback, useEffect, useRef, useState } from "react";
import "./farms.css";
import { AREA_UNITS, HECTARES_PER, IRRIGATION, OWNERSHIP, detailCount, exportFields, parseFields, sameSpot } from "./fields.js";
import { SOIL_TYPES } from "./soil.js";
import { loadCropTable } from "./suitability.js";
import { buildAlerts, fetchWeatherPlus } from "./weatherPlus.js";
import { levelOf } from "./Disasters.jsx";

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

export default function Farms({ t, lang, fields, active, system, onUpdate, onRemove, onOpen, onAdd, onImport }) {
  const [status, setStatus] = useState({}); // id -> { state, alerts, hazard, at }
  const [note, setNote] = useState("");
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

  const check = useCallback((list) => {
    list.forEach((farm) => {
      setStatus((s) => ({ ...s, [farm.id]: { state: "loading" } }));
      checkFarm(farm, (part) => setStatus((s) => ({ ...s, [farm.id]: { ...(s[farm.id] || {}), ...(part.alerts ? { state: "ok" } : {}), ...part } })))
        .catch(() => setStatus((s) => ({ ...s, [farm.id]: { state: "failed" } })));
    });
  }, []);
  useEffect(() => { check(fields); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const d = (active && active.details) || {};
  const setDetail = (key, value) => active && onUpdate(active.id, { details: { ...d, [key]: value } });
  const area = d.area || { value: "", unit: "bigha" };
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
  const rename = (farm) => {
    const v = window.prompt(t.fdName, farm.name);
    if (v && v.trim()) onUpdate(farm.id, { name: v.trim().slice(0, 80) });
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
    const a = f.details && f.details.area;
    return a && String(a.value || "").trim() ? fill(t.fdAreaLine, { v: a.value, u: t[`fdUnit_${a.unit}`] || a.unit }) : "";
  };

  return (
    <div className="fd">
      <p className="muted">{t.fdIntro}</p>

      {active && (
        <section className="fd-card" aria-label={t.fdCurrent}>
          <div className="fd-top">
            <span className="fd-badge">{t.fdCurrent}</span>
            <span className="muted small">✓ {t.fdSaved}</span>
          </div>

          <label className="fd-field">
            <span>{t.fdName} <Chip kind="you">{t.fdYou}</Chip></span>
            <input value={active.name} maxLength={80} onChange={(e) => onUpdate(active.id, { name: e.target.value })} onBlur={(e) => { if (!e.target.value.trim()) onUpdate(active.id, { name: active.path.split("›").pop().trim() || "Field" }); }} />
          </label>
          <p className="small muted fd-where"><strong>{t.fdWhereTitle}:</strong> {active.path ? `${active.path} · ` : ""}{active.lat.toFixed(4)}, {active.lon.toFixed(4)}</p>

          <h3>{t.fdFoundTitle} <Chip kind="system">{t.fdSystem}</Chip></h3>
          <p className="small muted">{t.fdFoundHelp}</p>
          <div className="fd-grid">
            <div className="fd-item">
              <b>{t.fdSoil}</b>
              {d.soil ? (
                <>
                  <p className="fd-value">{t.soilNames[d.soil]} <Chip kind="you">{t.fdYou}</Chip></p>
                  {sysSoil && <p className="small muted">{t.fdWasEstimate}: {t.soilNames[sysSoil.key]}{sysSoil.confidence != null ? ` (${num.format(sysSoil.confidence)}%)` : ""}</p>}
                  <button className="tab" onClick={() => setDetail("soil", "")}>{t.fdUseEstimate}</button>
                </>
              ) : sysSoil ? (
                <>
                  <p className="fd-value">{t.soilNames[sysSoil.key]} <Chip kind="system">{t.fdSystem}</Chip></p>
                  <p className="small muted">{soilSource}{confWord ? ` · ${t.fdConfidence}: ${confWord}${sysSoil.confidence != null ? ` (${num.format(sysSoil.confidence)}%)` : ""}` : ""}</p>
                </>
              ) : (
                <p className="small muted">{t.fdWaiting}</p>
              )}
              <select className="wide-select" value={d.soil || ""} onChange={(e) => setDetail("soil", e.target.value)} aria-label={t.fdKnowSoil}>
                <option value="">{d.soil ? t.fdUseEstimate : t.fdKnowSoil}</option>
                {SOIL_TYPES.map((k) => <option key={k} value={k}>{t.soilNames[k]}</option>)}
              </select>
            </div>
            <div className="fd-item">
              <b>{t.fdElevation}</b>
              <p className="fd-value">{sys && sys.elevationM != null ? `${num.format(sys.elevationM)} m` : "—"} <Chip kind="system">{t.fdSystem}</Chip></p>
            </div>
            <div className="fd-item">
              <b>{t.fdSlope}</b>
              <p className="fd-value">{sys && sys.slopePct != null ? `${num1.format(sys.slopePct)} %` : "—"} <Chip kind="system">{t.fdSystem}</Chip></p>
            </div>
          </div>

          <h3>{t.fdAboutTitle}</h3>
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
              {hectares != null && <span className="small muted">{t.fdAbout} {fill(t.fdHectares, { h: num1.format(hectares) })}</span>}
            </label>
            <label className="fd-field">
              <span>{t.fdCurrentCrop} {d.currentCrop && <Chip kind="you">{t.fdYou}</Chip>}</span>
              <input list="fd-crops" value={d.currentCrop || ""} placeholder={t.fdCropPlaceholder} maxLength={60} onChange={(e) => setDetail("currentCrop", e.target.value)} />
            </label>
            <label className="fd-field">
              <span>{t.fdPlannedCrop} {d.plannedCrop && <Chip kind="you">{t.fdYou}</Chip>}</span>
              <input list="fd-crops" value={d.plannedCrop || ""} placeholder={t.fdCropPlaceholder} maxLength={60} onChange={(e) => setDetail("plannedCrop", e.target.value)} />
            </label>
            <label className="fd-field">
              <span>{t.fdIrrigation} {d.irrigation && <Chip kind="you">{t.fdYou}</Chip>}</span>
              <select value={d.irrigation || ""} onChange={(e) => setDetail("irrigation", e.target.value)}>
                <option value="">{t.fdChoose}</option>
                {IRRIGATION.map((k) => <option key={k} value={k}>{t[`fdIrr_${k}`]}</option>)}
              </select>
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
              <label className="fd-field">
                <span>{t.fdPrevious} {d.previousCrops && <Chip kind="you">{t.fdYou}</Chip>}</span>
                <input value={d.previousCrops || ""} placeholder={t.fdPreviousPlaceholder} maxLength={160} onChange={(e) => setDetail("previousCrops", e.target.value)} />
              </label>
              <label className="fd-field wide">
                <span>{t.fdNotes} {d.notes && <Chip kind="you">{t.fdYou}</Chip>}</span>
                <textarea rows={3} value={d.notes || ""} placeholder={t.fdNotesPlaceholder} maxLength={500} onChange={(e) => setDetail("notes", e.target.value)} />
              </label>
            </div>
          </details>
          <p className="small muted">{fill(t.fdDetailsCount, { n: num.format(detailCount(d)) })}</p>
        </section>
      )}

      <h3>{t.fdFieldsTitle}</h3>
      {fields.length === 0 && <p className="muted">{t.fdNoneYet}</p>}
      {fields.map((farm) => {
        const st = status[farm.id] || {};
        const current = active && farm.id === active.id;
        const line = [areaLine(farm), farm.details && farm.details.currentCrop].filter(Boolean).join(" · ");
        return (
          <div className={`fm-card${current ? " current" : ""}`} key={farm.id}>
            <div className="fm-head">
              <strong>{farm.name}</strong>
              <span className="muted small">{current ? `${t.fdCurrent} · ` : ""}{farm.path || `${farm.lat.toFixed(2)}, ${farm.lon.toFixed(2)}`}</span>
            </div>
            {line && <p className="small">{line}</p>}
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
            <div className="fm-actions">
              {!current && <button className="tab" onClick={() => onOpen(farm)}>{t.fdUse}</button>}
              <button className="tab" onClick={() => check([farm])}>{t.fmRefresh}</button>
              <button className="tab" onClick={() => rename(farm)}>{t.fdRename}</button>
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
    </div>
  );
}
