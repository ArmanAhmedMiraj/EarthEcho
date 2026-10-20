import { useEffect, useRef, useState } from "react";
import Globe from "./Globe.jsx";
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

  return (
    <main className="prepare">
      <div className="prepare-card panel">
        <Globe className="big" lat={lat} lon={lon} pin orbit scan flyKey={1} />
        <h1 className="prepare-title">{t.prepTitle}</h1>
        <p className="muted">
          {t.prepRunning} <strong>{title}</strong>
        </p>
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
        {finished && (
          <>
            <p className="prepare-end">{finished.partial ? t.prepPartial : t.prepDone}</p>
            <button className="btn" onClick={() => onDone(results.current)}>{t.prepOpen}</button>
          </>
        )}
      </div>
    </main>
  );
}
