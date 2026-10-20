import { useEffect, useMemo, useState } from "react";
import "./rotation.css";
import { evaluateCrops, loadCropTable, rating, soilInput } from "./suitability.js";
import { TYPICAL_YIELD, planRotations, profitOf } from "./rotation.js";

const fill = (text, values) => Object.keys(values).reduce((s, k) => s.split(`{${k}}`).join(values[k]), text);
function readStore(key) {
  try { return JSON.parse(localStorage.getItem(key) || "{}") || {}; } catch { return {}; }
}
function writeStore(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage blocked */ }
}

export default function RotationPlanner({ t, lang, lat, lon, country, env, soilData }) {
  const [table, setTable] = useState(null);
  const [climate, setClimate] = useState(env && env.climate ? env.climate : null);
  const [state, setState] = useState(env && env.climate ? "ok" : "loading");
  const [attempt, setAttempt] = useState(0);
  const [mode, setMode] = useState("irrigated");
  const [rank, setRank] = useState("fit");
  const [kind, setKind] = useState("all");
  const store = `ef-rotation-${country}`;
  const [inputs, setInputs] = useState(() => readStore(store));
  const monthNames = t.rtMonthsAbbr.split(" ");
  const locale = lang === "bn" ? "bn-BD" : "en-GB";
  const whole = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });

  useEffect(() => { loadCropTable().then(setTable); }, []);
  useEffect(() => {
    if (env && env.climate && attempt === 0) return undefined;
    let cancelled = false;
    setState("loading");
    fetch(`/api/environment?lat=${lat}&lon=${lon}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => { if (cancelled) return; if (d.ok && d.climate) { setClimate(d.climate); setState("ok"); } else setState("error"); })
      .catch(() => { if (!cancelled) setState("error"); });
    return () => { cancelled = true; };
  }, [lat, lon, env, attempt]);

  const results = useMemo(() => {
    if (!table || !climate) return null;
    const months = climate.months.map((m) => ({ tmean: m.tmean, rainMm: m.rainMm }));
    if (months.some((m) => m.tmean == null || m.rainMm == null)) return null;
    return evaluateCrops(table.crops, months, soilInput(soilData));
  }, [table, climate, soilData]);

  const rotations = useMemo(() => (results ? planRotations(results, mode, kind) : []), [results, mode, kind]);

  const setField = (id, field, value) => {
    const next = { ...inputs, [id]: { ...(inputs[id] || {}), [field]: value } };
    setInputs(next);
    writeStore(store, next);
  };
  const valueOf = (id, field) => {
    const v = inputs[id] && inputs[id][field];
    if (v != null) return v;
    return field === "yield" && TYPICAL_YIELD[id] != null ? String(TYPICAL_YIELD[id]) : "";
  };
  const effective = useMemo(() => {
    const out = {};
    for (const r of rotations) for (const o of r.steps) out[o.crop.id] = { yield: valueOf(o.crop.id, "yield"), price: valueOf(o.crop.id, "price"), cost: valueOf(o.crop.id, "cost") };
    return out;
  }, [rotations, inputs]);

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
  const month = (m) => monthNames[((m % 12) + 12) % 12];
  const nowMonth = new Date().getMonth();
  const ranked = rotations.map((r) => ({ r, p: profitOf(r, effective) }));
  if (rank === "profit") ranked.sort((a, b) => (b.p.complete ? b.p.total : -Infinity) - (a.p.complete ? a.p.total : -Infinity));

  return (
    <div>
      <p className="muted">{t.rtIntro}</p>
      <div className="rt-controls">
        <label>{t.rtMode}
          <select value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="irrigated">{t.rtIrrigated}</option>
            <option value="rainfed">{t.rtRainfed}</option>
          </select>
        </label>
        <label>{t.rtKind}
          <select value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="all">{t.rtKindAll}</option>
            <option value="field">{t.rtKindField}</option>
            <option value="vegetable">{t.rtKindVeg}</option>
          </select>
        </label>
        <label>{t.rtRank}
          <select value={rank} onChange={(e) => setRank(e.target.value)}>
            <option value="fit">{t.rtRankSuit}</option>
            <option value="profit">{t.rtRankProfit}</option>
          </select>
        </label>
      </div>

      {ranked.length === 0 && <p className="warn">{t.rtNone}</p>}
      {ranked.map(({ r, p }, idx) => {
        // the next sowing from this month on
        const next = [...r.steps].sort((a, b) => ((a.at % 12) - nowMonth + 12) % 12 - ((b.at % 12) - nowMonth + 12) % 12)[0];
        const cells = Array.from({ length: 12 }, () => null);
        r.steps.forEach((o, i) => { for (let k = 0; k < o.months; k += 1) cells[(o.at + k) % 12] = i; });
        return (
          <div className="rt-card" key={r.steps.map((o) => o.crop.id).join("+")}>
            <div className="rt-head">
              <strong>{fill(t.rtRotation, { n: idx + 1 })}: {r.steps.map((o) => name(o.crop)).join(" → ")}</strong>
              <span className="rt-tag">{fill(t.rtFit, { p: whole.format(Math.round(r.score * 100)) })}</span>
            </div>
            <div className="rt-tl" aria-hidden="true">
              {monthNames.map((m) => <span className="m" key={m}>{m}</span>)}
              {cells.map((c, i) => (c == null ? <span className="rt-empty" key={i} /> : <span className={`rt-seg c${c}`} key={i}>{cells[i - 1] === c && i > 0 ? "" : name(r.steps[c].crop)}</span>))}
            </div>
            <ul className="rt-steps">
              {r.steps.map((o) => (
                <li key={o.crop.id}>{fill(t.rtStep, { crop: name(o.crop), sow: month(o.at), harvest: month(o.at + o.months), n: o.months })} · {Math.round(o.score * 100)}%</li>
              ))}
            </ul>
            <p className="small">{fill(t.rtNext, { crop: name(next.crop), month: month(next.at) })}</p>
            <p className="small muted">
              {r.legume ? t.rtLegume : t.rtNoLegume}. {fill(t.rtUse, { n: whole.format(Math.min(12, r.used)) })}.
              {r.repeat > 0 ? ` ${t.rtRepeat}.` : ""}
            </p>

            <h4>{t.rtProfitTitle}</h4>
            <table className="rt-profit">
              <thead><tr><th></th><th>{t.rtYield}</th><th>{t.rtPrice}</th><th>{t.rtCost}</th><th>{t.rtProfit}</th></tr></thead>
              <tbody>
                {r.steps.map((o, i) => (
                  <tr key={o.crop.id}>
                    <td>{name(o.crop)}</td>
                    {["yield", "price", "cost"].map((f) => (
                      <td key={f}><input type="number" min="0" step="any" value={valueOf(o.crop.id, f)} onChange={(e) => setField(o.crop.id, f, e.target.value)} /></td>
                    ))}
                    <td>{p.parts[i].profit == null ? "–" : whole.format(p.parts[i].profit)}</td>
                  </tr>
                ))}
                <tr><th colSpan="4">{t.rtTotal}</th><th>{p.complete ? whole.format(p.total) : "–"}</th></tr>
              </tbody>
            </table>
            {!p.complete && <p className="muted small">{t.rtNeedMore}</p>}
          </div>
        );
      })}
      <p className="muted small">{t.rtProfitHelp} ({t.rtTypical}.)</p>
      <h3>{t.rtNotes}</h3>
      <p className="small muted">{t.rtNotesBody}</p>
      {country === "BD" && <p className="small muted">{t.rtBdNote}</p>}
    </div>
  );
}
