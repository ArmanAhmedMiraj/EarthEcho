import { useEffect, useRef, useState } from "react";
import "./start.css";
import { fetchTerrain } from "./terrain.js";
import { evaluateCrops, loadCropTable, soilInput } from "./suitability.js";

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// poll until check() is true, or give up after timeout ms
async function waitFor(check, timeout) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (check()) return true;
    await wait(150);
  }
  return check();
}

async function fetchSatellite(lat, lon) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const r = await fetch(`/api/satellite?lat=${lat}&lon=${lon}`, { signal: controller.signal });
    if (!r.ok) return null;
    const data = await r.json();
    return data && data.ok ? data : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchEnvironment(lat, lon) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const r = await fetch(`/api/environment?lat=${lat}&lon=${lon}`, { signal: controller.signal });
    if (!r.ok) return null;
    const data = await r.json();
    return data && data.ok ? data : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchSoil(lat, lon) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 40000);
  try {
    const r = await fetch(`/api/soil?lat=${lat}&lon=${lon}`, { signal: controller.signal });
    if (!r.ok) return null;
    const data = await r.json();
    return data && data.ok ? data : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// The screen between choosing a place and the dashboard. Every step waits for a real result:
// a step is ticked only when its data arrived, and says plainly when it did not.
export default function Prepare({ t, lang, lat, lon, title, path, ready, onDone }) {
  const [steps, setSteps] = useState([
    { id: "area", label: t.stepArea, state: "run" },
    { id: "soil", label: t.stepSoil, state: "wait" },
    { id: "weather", label: t.stepWeather, state: "wait" },
    { id: "climate", label: t.stepClimate, state: "wait" },
    { id: "terrain", label: t.stepTerrain, state: "wait" },
    { id: "veg", label: t.stepVeg, state: "wait" },
    { id: "water", label: t.stepWater, state: "wait" },
    { id: "suit", label: t.stepSuit, state: "wait" },
  ]);
  const [finished, setFinished] = useState(null); // null while running, then { partial }
  const live = useRef(ready);
  live.current = ready;
  const results = useRef({ terrain: null, satellite: null, env: null, soil: null });
  const ran = useRef(false);
  // on a slow connection the farmer must never be stuck here: after a few seconds they can go in, and each page loads its own data
  const [canSkip, setCanSkip] = useState(false);
  useEffect(() => { const id = setTimeout(() => setCanSkip(true), 8000); return () => clearTimeout(id); }, []);

  const set = (id, patch) => setSteps((list) => list.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  useEffect(() => {
    if (ran.current) return undefined; // React strict mode runs effects twice in development
    ran.current = true;
    let cancelled = false;
    const alive = () => !cancelled;

    (async () => {
      // the slow downloads start at once, the steps then wait for them one by one
      const satellite = fetchSatellite(lat, lon);
      const terrain = fetchTerrain(lat, lon).catch(() => null);
      const environment = fetchEnvironment(lat, lon);
      const soilMap = fetchSoil(lat, lon);
      let failures = 0;

      await wait(700);
      if (!alive()) return;
      set("area", { state: "ok", note: `${t.stepFound}: ${path || title}` });

      set("soil", { state: "run" });
      await waitFor(() => live.current.soilReady, 8000);
      const sat = await satellite;
      results.current.satellite = sat;
      const grids = await soilMap;
      results.current.soil = grids;
      if (!alive()) return;
      const parts = [];
      if (grids && grids.available && grids.texture) {
        const conf = grids.texture.groupConfidence != null ? ` (${grids.texture.groupConfidence}%)` : "";
        parts.push(`${t.stepSoilGrids}: ${t.soilNames[grids.texture.simple]}${conf}`);
      } else if (grids && grids.available === false) parts.push(t.stepSoilNone);
      else if (live.current.soilText) parts.push(`${t.stepSoilOk}: ${live.current.soilText}`);
      if (!grids) parts.push(t.stepSoilGridsFail);
      if (sat && sat.soilRoot) parts.push(`${t.stepSmapOk}: ${sat.soilRoot.volumetric.toFixed(2)} m³/m³`);
      if (sat && sat.rainNow && sat.rainNow.rateMmHr != null) parts.push(`${t.stepRain}: ${sat.rainNow.rateMmHr} mm/h`);
      if (sat && !sat.soilRoot) parts.push(t.stepNoSmap);
      if (!sat) failures += 1;
      set("soil", { state: sat || live.current.soilText ? "ok" : "slow", note: parts.join(" · ") || t.stepNoSmap });
      await wait(300);

      set("weather", { state: "run" });
      await waitFor(() => live.current.weatherDone, 15000);
      if (!alive()) return;
      const weatherOk = live.current.weatherOk;
      if (!weatherOk) failures += 1;
      set("weather", { state: weatherOk ? "ok" : "slow", note: weatherOk ? t.stepForecastOk : t.stepForecastFail });
      await wait(300);

      set("climate", { state: "run" });
      await waitFor(() => live.current.weatherDone, 15000);
      if (!alive()) return;
      const climateOk = live.current.historyOk;
      if (!climateOk) failures += 1;
      set("climate", { state: climateOk ? "ok" : "slow", note: climateOk ? t.stepClimateOk : t.stepClimateFail });
      await wait(300);

      set("terrain", { state: "run" });
      const ground = await terrain;
      results.current.terrain = ground;
      if (!alive()) return;
      if (!ground) failures += 1;
      set("terrain", {
        state: ground ? "ok" : "slow",
        note: ground ? `${t.stepElevation}: ${ground.elevationM} m · ${t.stepSlope}: ${ground.slopePct}%` : t.stepTerrainFail,
      });
      await wait(300);

      set("veg", { state: "run" });
      const env = await environment;
      results.current.env = env;
      if (!alive()) return;
      const veg = env && env.vegetation;
      if (!veg) failures += 1;
      const temp = env && env.landTemp ? ` · ${env.landTemp.celsius} °C` : "";
      set("veg", { state: veg ? "ok" : "slow", note: veg ? `${t.stepVegOk}: ${veg.latest.value}${temp}` : t.stepVegFail });
      await wait(300);

      set("water", { state: "run" });
      await wait(400);
      const months = env && env.climate ? env.climate.months : null;
      if (!months) failures += 1;
      const dryCount = months ? months.filter((m) => m.balanceMm != null && m.balanceMm < 0).length : 0;
      set("water", { state: months ? "ok" : "slow", note: months ? `${t.stepWaterOk}: ${dryCount} / 12` : t.stepWaterFail });
      await wait(300);

      set("suit", { state: "run" });
      const table = await loadCropTable();
      await wait(500);
      if (!alive()) return;
      let top = [];
      if (table && env && env.climate) {
        const months = env.climate.months.map((m) => ({ tmean: m.tmean, rainMm: m.rainMm }));
        if (!months.some((m) => m.tmean == null || m.rainMm == null)) {
          top = evaluateCrops(table.crops, months, soilInput(results.current.soil))
            .sort((a, b) => b.irrigated.best - a.irrigated.best)
            .slice(0, 3)
            .map((r) => (lang === "bn" ? r.crop.bn : r.crop.en));
        }
      }
      if (top.length === 0) failures += 1;
      const partial = failures > 0;
      set("suit", {
        state: top.length === 0 ? "slow" : partial ? "slow" : "ok",
        note: top.length === 0 ? t.stepSuitNoClimate : `${t.stepSuitReal}: ${top.join(", ")}${partial ? ` · ${t.stepSuitPartial}` : ""}`,
      });
      setFinished({ partial });
      await wait(partial ? 4500 : 2200); // let the farmer read the result
      if (alive()) onDone(results.current);
    })();

    return () => {
      cancelled = true;
      ran.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const doneCount = steps.filter((s) => s.state === "ok" || s.state === "slow").length;
  const pct = Math.round((doneCount / Math.max(1, steps.length)) * 100);
  return (
    <main className="orb-prep">
      <div className="orb-prep-card panel">
        <svg className="orb-scene" viewBox="0 0 260 560" role="img" aria-label={t.orbSceneAlt}>
          <defs>
            <linearGradient id="orbSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0b1235" /><stop offset="1" stopColor="#1d3e7a" /></linearGradient>
            <linearGradient id="orbGw" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2f6fb5" /><stop offset="1" stopColor="#0f2d5c" /></linearGradient>
          </defs>
          <rect x="70" y="0" width="190" height="300" rx="18" fill="url(#orbSky)" opacity="0.9" />
          <g fill="#fff" opacity="0.8"><circle cx="100" cy="30" r="1.5" /><circle cx="210" cy="22" r="1.3" /><circle cx="236" cy="70" r="1.4" /><circle cx="92" cy="110" r="1.2" /></g>
          <g>
            <rect x="150" y="38" width="30" height="14" rx="3" fill="#f6cf6a" /><rect x="118" y="41" width="26" height="8" fill="#7fb2ff" /><rect x="186" y="41" width="26" height="8" fill="#7fb2ff" />
          </g>
          <line className="orb-beam" x1="165" y1="56" x2="165" y2="318" stroke="#3ddbc0" strokeWidth="2.5" strokeLinecap="round" />
          <circle r="5" fill="#f6cf6a"><animateMotion dur="3s" repeatCount="indefinite" path="M165 56 L165 318" /></circle>
          <g fill="#d9e4ff" opacity="0.92"><ellipse cx="130" cy="150" rx="40" ry="16" /><ellipse cx="200" cy="140" rx="36" ry="15" /><ellipse cx="165" cy="164" rx="46" ry="15" /></g>
          <g stroke="#7fb2ff" strokeWidth="3" strokeLinecap="round"><line className="orb-drop" x1="140" y1="182" x2="136" y2="196" /><line className="orb-drop" style={{ animationDelay: "0.5s" }} x1="170" y1="184" x2="166" y2="198" /><line className="orb-drop" style={{ animationDelay: "1s" }} x1="198" y1="180" x2="194" y2="194" /></g>
          <polygon points="165,300 235,330 165,360 95,330" fill="#5fcf7c" /><polygon points="95,330 165,360 165,380 95,350" fill="#6b4a2f" /><polygon points="165,360 235,330 235,350 165,380" fill="#553a25" />
          <polygon points="95,350 165,380 165,420 95,390" fill="#8a6038" /><polygon points="165,380 235,350 235,390 165,420" fill="#6f4c2c" />
          <polygon points="95,390 165,420 165,456 95,426" fill="#4d5f7a" /><polygon points="165,420 235,390 235,426 165,456" fill="#3c4c66" />
          <polygon points="95,426 165,456 165,520 95,490" fill="url(#orbGw)" /><polygon points="165,456 235,426 235,490 165,520" fill="url(#orbGw)" opacity="0.85" />
          <g fill="currentColor" fontSize="13" fontWeight="700" className="orb-scene-labels">
            <text x="0" y="48">{t.orbScene1}</text><text x="0" y="160">{t.orbScene2}</text><text x="0" y="334">{t.orbScene3}</text><text x="0" y="410">{t.orbScene4}</text><text x="0" y="486">{t.orbScene5}</text>
          </g>
        </svg>
        <div>
          <h1 className="prepare-title">{t.prepTitle}</h1>
          <p className="muted">
            {t.prepRunning} <strong>{title}</strong>
          </p>
          <div className="orb-prep-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}><i style={{ width: `${pct}%` }} /></div>
          <p className="small muted">{doneCount} / {steps.length}</p>
          <div className="steps" aria-live="polite">
            <ol>
              {steps.map((s) => (
                <li key={s.id} className={`step ${s.state}`}>
                  <span className="step-mark" aria-hidden="true">
                    {s.state === "ok" ? "✓" : s.state === "slow" ? "!" : s.state === "run" ? "" : "·"}
                  </span>
                  <span className="step-text">
                    {s.label}
                    {s.note ? <small>{s.note}</small> : null}
                  </span>
                </li>
              ))}
            </ol>
          </div>
          {!finished && canSkip && (
            <p className="prepare-skip">
              <button className="tab" onClick={() => onDone(results.current)}>{t.prepSkip}</button>
              <span className="small muted">{t.prepSkipNote}</span>
            </p>
          )}
          {finished && (
            <>
              <p className="prepare-end">{finished.partial ? t.prepPartial : t.prepDone}</p>
              <button className="btn" onClick={() => onDone(results.current)}>{t.prepOpen}</button>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
