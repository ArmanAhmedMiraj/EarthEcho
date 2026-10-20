import { useCallback, useEffect, useRef, useState } from "react";
import "./farms.css";
import { exportFarms, loadFarms, newId, parseFarms, saveFarms } from "./farms.js";
import { buildAlerts, fetchWeatherPlus } from "./weatherPlus.js";
import { levelOf } from "./Disasters.jsx";

const fill = (text, values) => Object.keys(values).reduce((s, k) => s.split(`{${k}}`).join(values[k]), text);
const same = (a, b) => Math.abs(a.lat - b.lat) < 0.005 && Math.abs(a.lon - b.lon) < 0.005;

// weather alerts (forecast limits) come first; the hazard level (quakes, UN alerts, river) is slower and is added when it arrives
function checkFarm(farm, onPart) {
  const weather = fetchWeatherPlus(farm.lat, farm.lon).then((plus) => onPart({ alerts: buildAlerts(plus), at: Date.now() }));
  const hazard = fetch(`/api/disasters?lat=${farm.lat.toFixed(2)}&lon=${farm.lon.toFixed(2)}`)
    .then((r) => r.json())
    .then((h) => onPart({ hazard: h && h.ok && !(h.failed && h.failed.length === 4) ? levelOf(h) : null, hazardDone: true }))
    .catch(() => onPart({ hazardDone: true }));
  return Promise.allSettled([weather, hazard]).then(([w]) => { if (w.status === "rejected") throw w.reason; });
}

export default function Farms({ t, lang, here, onOpen }) {
  const [farms, setFarms] = useState(loadFarms);
  const [name, setName] = useState(here.title || "");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState({}); // id -> { state, alerts, hazard, at }
  const fileInput = useRef(null);
  const [installEvent, setInstallEvent] = useState(window.__efInstall || null);
  useEffect(() => {
    const on = (e) => { e.preventDefault(); window.__efInstall = e; setInstallEvent(e); };
    window.addEventListener("beforeinstallprompt", on);
    return () => window.removeEventListener("beforeinstallprompt", on);
  }, []);
  const locale = lang === "bn" ? "bn-BD" : "en-GB";
  const timeFmt = new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" });
  const dayFmt = new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short" });
  const num = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });

  const update = (next) => { setFarms(next); saveFarms(next); };

  const check = useCallback((list) => {
    list.forEach((farm) => {
      setStatus((s) => ({ ...s, [farm.id]: { state: "loading" } }));
      checkFarm(farm, (part) => setStatus((s) => ({ ...s, [farm.id]: { ...(s[farm.id] || {}), ...(part.alerts ? { state: "ok" } : {}), ...part } })))
        .catch(() => setStatus((s) => ({ ...s, [farm.id]: { state: "failed" } })));
    });
  }, []);
  useEffect(() => { check(farms); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const alreadySaved = farms.some((f) => same(f, here));
  const save = () => {
    if (alreadySaved) { setNote(t.fmAlready); return; }
    const farm = { id: newId(), name: (name || here.title || "Farm").slice(0, 80), lat: here.lat, lon: here.lon, country: here.country, path: here.path || "" };
    const next = [...farms, farm];
    update(next);
    check([farm]);
    setNote(t.fmSaved);
  };
  const rename = (farm) => {
    const v = window.prompt(t.fmName, farm.name);
    if (v && v.trim()) update(farms.map((f) => (f.id === farm.id ? { ...f, name: v.trim().slice(0, 80) } : f)));
  };
  const remove = (farm) => {
    if (window.confirm(t.fmConfirmDelete)) update(farms.filter((f) => f.id !== farm.id));
  };
  const download = () => {
    const blob = new Blob([exportFarms(farms)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "earthecho-farms.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  const onFile = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    file.text().then((text) => {
      try {
        const incoming = parseFarms(text).filter((f) => !farms.some((x) => same(x, f)));
        const next = [...farms, ...incoming];
        update(next);
        check(incoming);
        setNote(fill(t.fmImportOk, { n: num.format(incoming.length) }));
      } catch {
        setNote(t.fmImportBad);
      }
    });
    e.target.value = "";
  };

  const alertText = (a) => {
    const v = a.value == null ? "" : num.format(a.value);
    const when = a.days.length ? ` (${a.days.slice(0, 3).map((d) => dayFmt.format(new Date(`${d}T00:00:00`))).join(", ")})` : "";
    return (t[`alert_${a.id}`] || a.id).replace("{v}", v) + when;
  };

  return (
    <div>
      <p className="muted">{t.fmIntro}</p>
      <div className="fm-save">
        <label>{t.fmName}<input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} /></label>
        <button className="tab" onClick={save} disabled={alreadySaved}>{t.fmSaveHere}</button>
      </div>
      {note && <p className="small" role="status">{note}</p>}

      {farms.length === 0 && <p className="muted">{t.fmEmpty}</p>}
      {farms.map((farm) => {
        const st = status[farm.id] || {};
        const current = same(farm, here);
        return (
          <div className={`fm-card${current ? " current" : ""}`} key={farm.id}>
            <div className="fm-head">
              <strong>{farm.name}</strong>
              <span className="muted small">{current ? `${t.fmCurrent} · ` : ""}{farm.path || `${farm.lat.toFixed(2)}, ${farm.lon.toFixed(2)}`}</span>
            </div>
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
              {!current && <button className="tab" onClick={() => onOpen(farm)}>{t.fmOpen}</button>}
              <button className="tab" onClick={() => check([farm])}>{t.fmRefresh}</button>
              <button className="tab" onClick={() => rename(farm)}>{t.fmRename}</button>
              <button className="tab" onClick={() => remove(farm)}>{t.fmDelete}</button>
            </div>
          </div>
        );
      })}

      <div className="fm-actions">
        <button className="tab" onClick={download} disabled={farms.length === 0}>{t.fmExport}</button>
        <button className="tab" onClick={() => fileInput.current && fileInput.current.click()}>{t.fmImport}</button>
        <input ref={fileInput} type="file" accept="application/json,.json" onChange={onFile} hidden />
      </div>
      <p className="muted small">{t.fmBackupNote}</p>

      <h3>{t.fmInstallTitle}</h3>
      {installEvent && (
        <p><button className="tab" onClick={() => { installEvent.prompt(); window.__efInstall = null; setInstallEvent(null); }}>{t.fmInstall}</button></p>
      )}
      <p className="small muted">{t.fmInstallHelp}</p>
    </div>
  );
}
