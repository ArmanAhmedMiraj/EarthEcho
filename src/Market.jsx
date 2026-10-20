import { useCallback, useEffect, useState } from "react";
import "./market.css";
import { IRR_CROP_NAMES } from "./i18nIrrigation.js";

const fill = (text, values) => Object.keys(values).reduce((s, k) => s.split(`{${k}}`).join(values[k]), text);
function readStore(key) {
  try { return JSON.parse(localStorage.getItem(key) || "{}") || {}; } catch { return {}; }
}
function writeStore(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage blocked */ }
}

function Spark({ series }) {
  if (series.length < 3) return null;
  const W = 120, H = 32;
  const lo = Math.min(...series.map((s) => s.p)), hi = Math.max(...series.map((s) => s.p), lo + 0.01);
  const x = (i) => 2 + (i * (W - 4)) / (series.length - 1);
  const y = (v) => 3 + ((hi - v) * (H - 6)) / (hi - lo);
  const d = series.map((s, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(s.p).toFixed(1)}`).join(" ");
  return <svg className="mk-spark" viewBox={`0 0 ${W} ${H}`} aria-hidden="true"><path d={d} fill="none" stroke="var(--a2)" strokeWidth="2" /></svg>;
}

// names for crops the planner knows that the irrigation page does not list
const EXTRA = { lentil: "Lentil", chickpea: "Chickpea", urd: "Black gram", cabbage: "Cabbage", cauliflower: "Cauliflower", okra: "Okra", carrot: "Carrot", garlic: "Garlic", chilli: "Chilli", pumpkin: "Pumpkin", bottlegourd: "Bottle gourd", snakegourd: "Snake gourd", bittergourd: "Bitter gourd", cucumber: "Cucumber", spinach: "Spinach", radish: "Radish", sweetpotato: "Sweet potato", banana: "Banana", papaya: "Papaya", ginger: "Ginger", turmeric: "Turmeric", coriander: "Coriander", sorghum: "Sorghum", pearlmillet: "Pearl millet", fingermillet: "Finger millet", cassava: "Cassava", pea: "Pea", sesame: "Sesame" };

export default function Market({ t, lang, lat, lon, country }) {
  const [data, setData] = useState(null);
  const [state, setState] = useState("loading");
  const [filter, setFilter] = useState("crops");
  const [savedAll, setSavedAll] = useState(false);
  const store = `ef-rotation-${country}`;
  const [used, setUsed] = useState(() => readStore(store));
  const locale = lang === "bn" ? "bn-BD" : "en-GB";
  const num = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
  const pct = new Intl.NumberFormat(locale, { maximumFractionDigits: 0, signDisplay: "exceptZero" });
  const monthFmt = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" });

  const load = useCallback(() => {
    setState("loading");
    const ask = (n) =>
      fetch(`/api/markets?country=${country}&lat=${lat}&lon=${lon}`)
        .then((r) => r.json())
        .then((d) => {
          if (!d.available && d.reason === "country") { setData(d); setState("nocountry"); }
          else if (!d.available) throw new Error("busy");
          else { setData(d); setState("ok"); }
        })
        .catch(() => (n < 1 ? ask(n + 1) : setState("failed")));
    ask(0);
  }, [country, lat, lon]);
  useEffect(load, [load]);

  if (state === "loading") return <p className="muted">{t.mkLoading}</p>;
  if (state === "nocountry") return <p className="muted">{t.mkNoCountry}</p>;
  if (state === "failed" || !data) return (<div><p className="warn">{t.mkBusy}</p><button className="tab" onClick={load}>{t.mkRetry}</button></div>);

  const cropName = (id) => (IRR_CROP_NAMES[id] ? IRR_CROP_NAMES[id][lang] || IRR_CROP_NAMES[id].en : EXTRA[id] || id);
  const useOne = (item) => {
    if (item.perKg == null) return;
    const next = { ...used, [item.crop]: { ...(used[item.crop] || {}), price: String(item.perKg) } };
    setUsed(next);
    writeStore(store, next);
  };
  const cropItems = data.items.filter((i) => i.crop);
  const shown = filter === "crops" ? cropItems : data.items;
  const useAll = () => {
    const next = { ...used };
    // one price per crop: the lowest of the items for that crop (the plain, local variety) that has a price per kg
    const byCrop = {};
    for (const i of cropItems) if (i.perKg != null && (byCrop[i.crop] == null || i.perKg < byCrop[i.crop])) byCrop[i.crop] = i.perKg;
    for (const [c, p] of Object.entries(byCrop)) next[c] = { ...(next[c] || {}), price: String(p) };
    setUsed(next);
    writeStore(store, next);
    setSavedAll(true);
  };
  const month = (m) => monthFmt.format(new Date(`${m}-01T00:00:00`));
  const arrow = (v) => (v == null ? "–" : `${v > 0 ? "▲" : v < 0 ? "▼" : "■"} ${pct.format(v)}%`);

  return (
    <div>
      <p className="muted">{t.mkIntro}</p>
      <p className="small">{fill(t.mkLatest, { m: month(data.latest.slice(0, 7)) })}</p>
      <p className="small muted">{t.mkNearest}: {data.nearest.map((n) => `${n.name} (${num.format(n.km)} km)`).join(", ")}</p>
      <div className="mk-bar">
        <label className="small">{t.mkFilter}{" "}
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="crops">{t.mkFilterCrops}</option>
            <option value="all">{t.mkFilterAll}</option>
          </select>
        </label>
        <button className="tab" onClick={useAll}>{t.mkUseAll}</button>
      </div>
      {savedAll && <p className="small">{t.mkUseAllDone}</p>}
      <p className="muted small">{t.mkUseNote}</p>
      <div className="mk-list">
        {shown.map((i) => (
          <div className="mk-row" key={`${i.commodity}|${i.unit}|${i.type}`}>
            <div className="mk-name">
              <strong>{i.commodity}</strong>
              <span className="muted small">{i.crop ? `${cropName(i.crop)} · ` : ""}{fill(t.mkMarket, { market: i.market, km: num.format(i.km) })} · {i.type}</span>
            </div>
            <div className="mk-price">
              <strong>{num.format(i.last)} {i.currency}</strong>
              <span className="muted small">{fill(t.mkPer, { unit: i.unit })}{i.perKg != null && i.unit.toLowerCase() !== "kg" ? ` (${num.format(i.perKg)} ${t.mkPerKg})` : ""}</span>
            </div>
            <div className="mk-change small">
              <span>{t.mkChange3}: {arrow(i.change3)}</span>
              <span>{t.mkChange12}: {arrow(i.change12)}</span>
            </div>
            <Spark series={i.series} />
            <div>
              {i.crop && i.perKg != null && (
                used[i.crop] && used[i.crop].price === String(i.perKg)
                  ? <span className="small muted">✓ {t.mkUsed}</span>
                  : <button className="tab" onClick={() => useOne(i)}>{t.mkUse}</button>
              )}
            </div>
          </div>
        ))}
      </div>
      <p className="muted small">{t.mkWarn}</p>
      <h3>{t.mkCreditsTitle}</h3>
      <p className="small muted"><a href={data.provenance.url} target="_blank" rel="noopener noreferrer">{t.mkCredits}</a> {data.provenance.note}</p>
    </div>
  );
}
