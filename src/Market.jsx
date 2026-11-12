import { useCallback, useEffect, useMemo, useState } from "react";
import "./market.css";
import Info from "./Info.jsx";
import { loadCropTable, cycleMonths } from "./suitability.js";
import { ANNUAL } from "./rotation.js";
import { FARM_SHARE, estimateUsdPrice } from "./econ.js";

// Bengali names for the foods the price data lists (the data itself is in English). Anything not listed stays as it is.
const COMMODITY_BN = {
  "Bananas (ripe)": "কলা (পাকা)",
  "Chili (green)": "কাঁচা মরিচ",
  "Eggs (brown)": "ডিম (বাদামি)",
  "Fish (live, pangasius)": "মাছ (জীবিত পাঙাশ)",
  "Garlic (imported, China)": "রসুন (আমদানি, চীন)",
  "Gourd (bottle)": "লাউ",
  "Lentils (masur)": "মসুর ডাল",
  "Meat (chicken, broiler)": "মাংস (ব্রয়লার মুরগি)",
  "Milk (cow, pasteurized)": "দুধ (গরু, পাস্তুরিত)",
  "Oil (palm)": "পাম তেল",
  "Oil (soybean, fortified)": "সয়াবিন তেল (ফর্টিফাইড)",
  "Onions (imported, China)": "পেঁয়াজ (আমদানি, চীন)",
  "Papaya (green)": "কাঁচা পেঁপে",
  "Potatoes (Holland, white)": "আলু (হল্যান্ড, সাদা)",
  "Rice (coarse)": "চাল (মোটা)",
  "Snake gourd": "চিচিঙ্গা",
  "Spinach (malabar)": "পুঁইশাক",
  "Spinach (red)": "লাল শাক",
  "Sugar": "চিনি",
  "Wheat flour": "আটা",
};
const GROUPS = ["cereal", "pulse", "oilseed", "vegetable", "root", "fibre", "cash"];

const fill = (text, values) => Object.keys(values).reduce((s, k) => s.split(`{${k}}`).join(values[k]), text);
function readStore(key) {
  try { return JSON.parse(localStorage.getItem(key) || "{}") || {}; } catch { return {}; }
}

// A small area chart of the monthly prices, with the newest month marked
function Spark({ series, label }) {
  if (!series || series.length < 3) return null;
  const W = 160, H = 44, px = 4, py = 6;
  const lo = Math.min(...series.map((s) => s.p)), hi = Math.max(...series.map((s) => s.p), lo + 0.01);
  const x = (i) => px + (i * (W - 2 * px)) / (series.length - 1);
  const y = (v) => py + ((hi - v) * (H - 2 * py)) / (hi - lo);
  const d = series.map((s, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(s.p).toFixed(1)}`).join(" ");
  const last = series[series.length - 1];
  return (
    <svg className="mk2-spark" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
      <path d={`${d} L${x(series.length - 1).toFixed(1)},${H - py} L${x(0).toFixed(1)},${H - py} Z`} className="area" />
      <path d={d} className="line" fill="none" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(series.length - 1)} cy={y(last.p)} r="3" className="dot" />
    </svg>
  );
}

function Change({ t, label, v, pct }) {
  if (v == null) return <span className="mk2-ch flat"><em>{label}</em> –</span>;
  const cls = v > 0 ? "up" : v < 0 ? "down" : "flat";
  return <span className={`mk2-ch ${cls}`} title={v > 0 ? t.mk2Up : v < 0 ? t.mk2Down : ""}><em>{label}</em> {v > 0 ? "▲" : v < 0 ? "▼" : "■"} {pct.format(Math.abs(v))}%</span>;
}

export default function Market({ t, lang, lat, lon, country }) {
  const [data, setData] = useState(null);
  const [state, setState] = useState("loading");
  const [table, setTable] = useState(null);
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [others, setOthers] = useState(false);
  const locale = lang === "bn" ? "bn-BD" : "en-GB";
  const num = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
  const whole = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const pct = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const monthFmt = new Intl.DateTimeFormat(locale, { month: "short", year: "numeric" });
  const share = (() => { const v = readStore(`ef-rotation-${country}`).__share; return v != null && Number(v) > 0 ? Number(v) : FARM_SHARE; })();

  useEffect(() => { loadCropTable().then(setTable); }, []);
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

  // one row per crop of the planner: the nearest market that reports it, else a rough estimate
  const rows = useMemo(() => {
    if (!table || !data || !data.items) return [];
    const best = {};
    for (const i of data.items) {
      if (!i.crop || !(i.perKg > 0)) continue;
      const b = best[i.crop];
      if (!b || i.km < b.km || (i.km === b.km && i.perKg < b.perKg)) best[i.crop] = i;
    }
    const rate = data.rate || null;
    return table.crops.filter((c) => ANNUAL.includes(c.group) && cycleMonths(c) <= 8).map((c) => {
      const m = best[c.id] || null;
      const est = estimateUsdPrice(c) * (rate || 1);
      return { crop: c, market: m, est };
    });
  }, [table, data]);

  if (state === "loading" || !table) return <p className="muted">{t.mkLoading}</p>;
  if (state === "nocountry") return <p className="muted">{t.mkNoCountry}</p>;
  if (state === "failed" || !data) return (<div><p className="warn">{t.mkBusy}</p><button className="tab" onClick={load}>{t.mkRetry}</button></div>);

  const name = (c) => (lang === "bn" ? c.bn : c.en);
  const month = (m) => monthFmt.format(new Date(`${m}-01T00:00:00`));
  const currency = data.currency || (data.rate ? "" : "USD");
  const withMarket = rows.filter((r) => r.market).length;
  const q = query.trim().toLowerCase();
  const visible = rows.filter((r) => (filter === "all" || (filter === "market" ? r.market : !r.market)) && (!q || r.crop.en.toLowerCase().includes(q) || r.crop.bn.includes(query.trim())));
  const otherItems = data.items.filter((i) => !i.crop);

  return (
    <div className="mk2">
      <p className="muted">{t.mk2Intro} <Info t={t} source="WFP · UN OCHA">
        <p>{t.mk2InfoWfp}</p>
        <p>{t.mk2InfoEst}</p>
        <p>{t.mk2InfoPlanner}</p>
        <p>{t.mk2InfoWarn}</p>
        <p><a href={data.provenance.url} target="_blank" rel="noopener noreferrer">{t.mk2InfoLink}</a></p>
      </Info></p>
      <div className="mk2-meta">
        <span className="mk2-pill"><b>{t.mkLatest.split(":")[0]}:</b> {month(data.latest.slice(0, 7))}</span>
        {data.nearest.length > 0 && <span className="mk2-pill"><b>{t.mkNearest}:</b> {data.nearest.map((n) => `${n.name} (${num.format(n.km)} km)`).join(", ")}</span>}
        <span className="mk2-pill">{fill(t.mk2Count, { a: whole.format(withMarket), b: whole.format(rows.length) })}</span>
      </div>

      {withMarket < rows.length && <p className="small muted">{t.mk2EstNote}</p>}
      <div className="mk2-bar">
        <input className="mk2-search" type="search" value={query} placeholder={t.mk2Search} aria-label={t.mk2Search} onChange={(e) => setQuery(e.target.value)} />
        <div className="mk2-seg" role="group">
          {[["all", t.mk2ShowAll], ["market", t.mk2ShowMarket], ["est", t.mk2ShowEst]].map(([k, label]) => (
            <button key={k} type="button" className={filter === k ? "on" : ""} aria-pressed={filter === k} onClick={() => setFilter(k)}>{label}</button>
          ))}
        </div>
      </div>

      {visible.length === 0 && <p className="muted">{t.mk2None}</p>}
      {GROUPS.map((g) => {
        const list = visible.filter((r) => r.crop.group === g).sort((a, b) => Number(!!b.market) - Number(!!a.market) || name(a.crop).localeCompare(name(b.crop), locale));
        if (!list.length) return null;
        return (
          <section key={g} className="mk2-group">
            <h3>{t[`mk2Group_${g}`]} <span className="mk2-n">{whole.format(list.length)}</span></h3>
            <div className="mk2-grid">
              {list.map(({ crop, market: m, est }) => (
                <article className={`mk2-card ${m ? "real" : "est"}`} key={crop.id}>
                  <header>
                    <h4>{name(crop)}</h4>
                    <span className={`mk2-chip ${m ? "real" : "est"}`}>{m ? t.mk2Market : t.mk2Est}</span>
                  </header>
                  {m ? (
                    <>
                      <p className="mk2-price"><b>{num.format(m.perKg)}</b> <span>{m.currency} / kg</span></p>
                      <p className="mk2-sub">{t.mk2Shop}</p>
                      <p className="mk2-farm">{fill(t.mk2Farm, { v: `${num.format(m.perKg * share)} ${m.currency}`, p: whole.format(Math.round(share * 100)) })}</p>
                      <div className="mk2-chg"><Change t={t} label={t.mk2Months3} v={m.change3} pct={pct} /><Change t={t} label={t.mk2Months12} v={m.change12} pct={pct} /></div>
                      {m.series && m.series.length >= 3 ? <Spark series={m.series} label={`${name(crop)}: ${m.series[0].m} – ${m.series[m.series.length - 1].m}`} /> : <p className="mk2-sub">{t.mk2NoChart}</p>}
                      <p className="mk2-src">{fill(t.mk2From, { market: m.market, km: whole.format(m.km), month: month(m.lastMonth) })}</p>
                      <p className="mk2-src">{lang === "bn" && COMMODITY_BN[m.commodity] ? COMMODITY_BN[m.commodity] : m.commodity} · {m.type}</p>
                    </>
                  ) : (
                    <>
                      <p className="mk2-price"><b>{num.format(est)}</b> <span>{currency || ""} / kg</span></p>
                      <p className="mk2-sub">{t.mk2EstLine}</p>
                    </>
                  )}
                </article>
              ))}
            </div>
          </section>
        );
      })}

      {otherItems.length > 0 && (
        <section className="mk2-group">
          <h3>
            <button type="button" className="mk2-toggle" aria-expanded={others} onClick={() => setOthers((v) => !v)}>{others ? "▾" : "▸"} {t.mk2Others} <span className="mk2-n">{whole.format(otherItems.length)}</span></button>
          </h3>
          {others && (
            <div className="mk2-grid slim">
              {otherItems.map((i) => (
                <article className="mk2-card real slim" key={`${i.commodity}|${i.unit}|${i.type}`}>
                  <header><h4>{lang === "bn" && COMMODITY_BN[i.commodity] ? COMMODITY_BN[i.commodity] : i.commodity}</h4></header>
                  <p className="mk2-price"><b>{num.format(i.last)}</b> <span>{i.currency} {fill(t.mkPer, { unit: i.unit })}</span></p>
                  <p className="mk2-src">{fill(t.mk2From, { market: i.market, km: whole.format(i.km), month: month(i.lastMonth) })}</p>
                </article>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
