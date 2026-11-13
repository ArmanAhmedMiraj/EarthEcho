import { useCallback, useEffect, useMemo, useState } from "react";
import "./irrigation.css";
import "./irrigation2.css";
import { LivingPlot } from "./Visuals.jsx";
import Info from "./Info.jsx";
import SoilWaterChart from "./SoilWaterChart.jsx";
import { fetchWeatherPlus } from "./weatherPlus.js";
import { IRRIGATION_CROPS, METHOD_EFFICIENCY, SOIL_AW, WATER_SOURCES } from "./water.js";
import { IRR_CROP_NAMES } from "./i18nIrrigation.js";
import { assess, isoOf } from "./irrigationEngine.js";

const SOILS = Object.keys(SOIL_AW);
const SQUARE_METRES = { hectare: 10000, acre: 4046.86, decimal: 40.4686, bigha: 1337.8, katha: 66.89, sqm: 1 };
const fill = (text, values) => Object.keys(values).reduce((s, k) => s.split(`{${k}}`).join(values[k]), text);
const dayNum = (iso) => { const [y, m, d] = iso.split("-").map(Number); return Math.round(Date.UTC(y, m - 1, d) / 86400000); };
const MARK = { agree: "✓", you: "✓", near: "≈", differ: "!", missing: "–", none: "✓" };

// the irrigation crop a farmer's typed crop name belongs to (by English or Bengali name)
function cropIdFrom(text) {
  const q = String(text || "").toLowerCase().trim();
  if (!q) return null;
  return IRRIGATION_CROPS.find((id) => id === q || [IRR_CROP_NAMES[id].en, IRR_CROP_NAMES[id].bn].some((n) => String(n || "").toLowerCase() === q)) || null;
}

export default function Irrigation({ t, lang, lat, lon, country, soil: appSoil, soilMapped, satellite, field, onFieldChange, mappedSqm }) {
  const [plus, setPlus] = useState(null);
  const [nasa, setNasa] = useState(null);
  const [state, setState] = useState("loading");
  const [stamp, setStamp] = useState(null);
  const locale = lang === "bn" ? "bn-BD" : "en-GB";
  const set = (patch) => { if (onFieldChange) onFieldChange(patch); };

  const load = useCallback((quiet) => {
    if (!quiet) setState("loading");
    fetchWeatherPlus(lat, lon).then((p) => { setPlus(p); setState("ok"); setStamp(new Date()); }).catch(() => { if (!quiet) setState("failed"); });
    fetch(`/api/dryspell?lat=${lat}&lon=${lon}`).then((r) => (r.ok ? r.json() : null)).then((j) => {
      if (!j || !j.ok) { setNasa(null); return; }
      setNasa({
        rain: (j.rain || []).map((r) => ({ date: r.date, rainMm: r.rain })),
        days: (j.soil || []).map((s) => ({ date: s.date, soilRoot: s.root })),
      });
    }).catch(() => setNasa(null));
  }, [lat, lon]);
  useEffect(() => { load(false); }, [load]);
  // new rain or weather arrives: refresh every 30 minutes and when the farmer comes back to the page
  useEffect(() => {
    const timer = setInterval(() => load(true), 30 * 60 * 1000);
    const back = () => { if (document.visibilityState === "visible") load(true); };
    document.addEventListener("visibilitychange", back);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", back); };
  }, [load]);

  const fd = (field && field.details) || {};
  const cropId = cropIdFrom(fd.currentCrop);
  const typedCrop = String(fd.currentCrop || "").trim();
  const kind = cropId === "rice" ? "rice" : "upland";
  const stage = fd.irStage != null && fd.irStage !== "" ? Number(fd.irStage) : 1;
  const method = fd.irrigMethod || (fd.irrigation === "drip" ? "drip" : "surface");
  const soil = appSoil || "loam";
  const sys = field && field.system && field.system.soil ? field.system.soil : null;
  const soilUser = !!fd.soil;
  const soilInfo = soilUser ? { source: "user" } : sys ? { source: sys.source, confidence: sys.confidence } : soilMapped ? { source: "region" } : null;
  const area = fd.area && String(fd.area.value || "").trim() ? fd.area : null;
  const unit = (area && SQUARE_METRES[area.unit] ? area.unit : null) || (country === "BD" ? "decimal" : "hectare");
  const m2 = area && Number(area.value) > 0 ? Number(area.value) * SQUARE_METRES[unit] : null;
  const todayDate = plus ? plus.days[0].date : null;
  const cropName = (id) => IRR_CROP_NAMES[id][lang] || IRR_CROP_NAMES[id].en;

  // the farmer's own reading, only if it fits this crop
  const manual = useMemo(() => {
    const w = fd.irWater;
    if (!w || !w.date) return null;
    if (kind === "rice" && w.mm != null && w.mm !== "") return { mm: Number(w.mm), date: w.date };
    if (kind === "upland" && w.feel) return { feel: w.feel, date: w.date };
    return null;
  }, [fd.irWater, kind]);
  const sinceAgo = todayDate && fd.irSince ? dayNum(todayDate) - dayNum(fd.irSince) : null;

  const a = useMemo(() => {
    if (!plus || !cropId) return null;
    return assess({ kind, crop: cropId, stage, soil, plus, manual, since: kind === "upland" ? sinceAgo : null, smap: satellite && satellite.soilRoot ? satellite.soilRoot : null, nasa, soilInfo });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plus, nasa, cropId, kind, stage, soil, manual, sinceAgo, satellite, soilUser, sys && sys.source, sys && sys.confidence]);

  const whole = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const one = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const dateFmt = new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short" });
  const shortDate = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" });
  const dOf = (iso) => dateFmt.format(new Date(`${iso}T00:00:00`));
  const volume = (mm) => {
    if (!m2) return null;
    const litres = mm * m2;
    return litres >= 100000 ? fill(t.cubic, { v: one.format(litres / 1000) }) : fill(t.litres, { v: whole.format(litres) });
  };
  const soilName = t[`irSoil_${soil}`] || soil;
  const mappedName = t[`irSoil_${soilMapped}`] || soilMapped || "";

  // ---- the plot header, form ----
  const soilSrcWord = soilUser ? t.ir2SoilSrcYou : sys ? (sys.source === "satellite" ? t.ir2SoilSrcSat : sys.source === "map" ? t.ir2SoilSrcMap : t.ir2SoilSrcRegion) : t.ir2SoilSrcRegion;
  const form = (
    <section className="ir2-card ir2-plotcard" aria-labelledby="ir2-plot">
      <h3 id="ir2-plot">{t.ir2YourPlot}</h3>
      <p className="muted small">{t.ir2YourPlotHint}</p>
      <div className="ir-form">
        <label>{t.ir2Crop}
          <select value={cropId || ""} onChange={(e) => { if (e.target.value) set({ currentCrop: cropName(e.target.value) }); }}>
            <option value="">{t.ir2ChooseCrop}</option>
            {IRRIGATION_CROPS.map((c) => <option key={c} value={c}>{cropName(c)}</option>)}
          </select>
        </label>
        <label><span>{t.ir2Stage} <Info t={t}><span>{t.ir2StageInfo}</span></Info></span>
          <select value={stage} onChange={(e) => set({ irStage: Number(e.target.value) })}>
            {[0, 1, 2, 3].map((s) => <option key={s} value={s}>{t[`irStage${s}`]}</option>)}
          </select>
        </label>
        <label>{t.ir2Soil}
          <select value={fd.soil || ""} onChange={(e) => set({ soil: e.target.value })}>
            <option value="">{fill(t.ir2SoilAuto, { soil: mappedName })}</option>
            {SOILS.map((s) => <option key={s} value={s}>{t[`irSoil_${s}`]}</option>)}
          </select>
          <span className="small muted">{soilSrcWord}{!soilUser && sys && sys.confidence != null ? ` · ${fill(t.ir2SoilConf, { n: whole.format(sys.confidence) })}` : ""}</span>
        </label>
        <label>{t.ir2Method}
          <select value={method} onChange={(e) => set({ irrigMethod: e.target.value })}>
            {Object.keys(METHOD_EFFICIENCY).map((m) => <option key={m} value={m}>{t[`irMethod_${m}`]}</option>)}
          </select>
        </label>
        <label>{t.ir2Area}
          <span className="ir-area">
            <input type="number" min="0" step="any" inputMode="decimal" value={area ? area.value : ""} onChange={(e) => set({ area: { value: e.target.value, unit } })} />
            <select value={unit} onChange={(e) => set({ area: { value: area ? area.value : "", unit: e.target.value } })}>
              {Object.keys(SQUARE_METRES).map((u) => <option key={u} value={u}>{t[`unit_${u}`]}</option>)}
            </select>
          </span>
          {mappedSqm > 0 && !area && (
            <button type="button" className="ir2-link" onClick={() => { const v = Math.round((mappedSqm / SQUARE_METRES.decimal) * 10) / 10; set({ area: { value: String(v), unit: "decimal" } }); }}>
              {fill(t.ir2UseMapped, { v: one.format(mappedSqm / SQUARE_METRES.decimal) })}
            </button>
          )}
        </label>
      </div>
    </section>
  );

  if (state === "loading" && !plus) return <p className="muted">{t.ir2Loading}</p>;
  if (!plus) {
    return (
      <div>
        <p className="warn">{t.ir2Failed}</p>
        <button className="tab" onClick={() => load(false)}>{t.ir2Update}</button>
      </div>
    );
  }

  // no crop yet: ask for it, and keep it in My Farm
  if (!cropId) {
    return (
      <div className="ir2">
        {form}
        <div className="ir2-need">
          <b>{t.ir2PickCrop}</b>
          <span className="small">{typedCrop ? fill(t.ir2CropOther, { name: typedCrop }) : t.ir2PickCropBody}</span>
        </div>
      </div>
    );
  }

  const events = a.run.events;
  const first = events[0];
  const eff = METHOD_EFFICIENCY[method];
  const headKey = first ? (first.day === 0 ? "today" : first.day <= 2 ? "soon" : "later") : "none";
  const head = first ? (first.day === 0 ? t.ir2HeadToday : first.day === 1 ? t.ir2HeadTomorrow : fill(t.ir2HeadLater, { n: whole.format(first.day) })) : fill(t.ir2HeadNone, { n: whole.format(plus.days.length) });
  const p = a.p;
  const rowsNow = a.run.rows[a.today];
  const useNow = rowsNow ? rowsNow.etc + (kind === "rice" ? p.perc : 0) : 0;
  const level = (state) => (state == null ? null : kind === "rice" ? state : Math.max(0, Math.min(1, 1 - state / p.raw)) * 100);
  const showLevel = (st) => (st == null ? "–" : kind === "rice" ? `${one.format(st / 10)} cm` : `${whole.format(level(st))}%`);
  const futureCounted = a.run.rows.filter((r) => r.future && r.rainUsed > 0);
  const countedMm = Math.round(futureCounted.reduce((s, r) => s + r.rainUsed, 0));
  const bigRain = futureCounted.reduce((b, r) => (!b || r.rainUsed > b.rainUsed ? r : b), null);
  const whenWord = (d) => (d == null ? "" : d === 0 ? t.ir2WhenToday : fill(t.ir2WhenInDays, { n: whole.format(d) }));
  let rainText = t.ir2RainNothing;
  if (a.rainShift === "beyond") rainText = fill(t.ir2RainBeyond, { n: whole.format(plus.days.length), when: whenWord(a.firstDryDay) });
  else if (typeof a.rainShift === "number" && a.rainShift > 0 && bigRain) rainText = fill(t.ir2RainDelay, { date: shortDate.format(new Date(`${bigRain.date}T00:00:00`)), mm: whole.format(bigRain.rain), n: whole.format(a.rainShift), saved: whole.format(a.rainSaved) });
  else if (a.rainSaved > 0) rainText = fill(t.ir2RainSaves, { saved: whole.format(a.rainSaved) });

  const evWord = (c) => (c ? t[`ir2Feel_${c}`] : "");
  const evText = (e) => {
    const key = `ir2EvT_${e.id}_${e.status}`;
    const tpl = t[key];
    if (!tpl) return "";
    return fill(tpl, { om: whole.format(e.om || 0), nasa: whole.format(e.nasa || 0), n: whole.format(e.n || 0), mine: evWord(e.mine), other: evWord(e.other), total: whole.format(e.total || 0), counted: whole.format(e.counted || 0) });
  };

  const manualAgo = manual && todayDate ? dayNum(todayDate) - dayNum(manual.date) : null;
  const dateChoices = [0, 1, 2, 3].map((n) => ({ n, date: isoOf(dayNum(todayDate) - n) }));
  const readingDate = manual && manualAgo != null && manualAgo >= 0 && manualAgo <= 3 ? manual.date : todayDate;
  const putReading = (patch) => set({ irWater: { ...(fd.irWater && manual ? fd.irWater : {}), ...patch, date: patch.date || readingDate } });
  const quick = kind === "rice"
    ? [{ k: "dry", v: 0, label: t.ir2Dry }, { k: "mud", v: 1, label: t.ir2Mud }, { k: "2", v: 20, label: fill(t.ir2Cm, { n: 2 }) }, { k: "5", v: 50, label: fill(t.ir2Cm, { n: 5 }) }, { k: "10", v: 100, label: fill(t.ir2Cm, { n: 10 }) }]
    : [{ k: "dry", v: "dry", label: t.ir2FeelDry }, { k: "slightly", v: "slightly", label: t.ir2FeelSlightly }, { k: "moist", v: "moist", label: t.ir2FeelMoist }, { k: "wet", v: "wet", label: t.ir2FeelWet }];
  const activeQuick = manual ? (kind === "rice" ? quick.find((q) => q.v === manual.mm) : quick.find((q) => q.v === manual.feel)) : null;

  const sw = a.weight != null ? Math.round((1 - a.weight) * 100) : 0;
  const nowText = showLevel(a.nowFinal);
  const reading = first ? (first.day === 0 ? fill(t.ir2ReadToday, { now: nowText }) : fill(t.ir2ReadSoon, { now: nowText, date: shortDate.format(new Date(`${first.date}T00:00:00`)) })) : fill(t.ir2ReadOk, { now: nowText, n: whole.format(plus.days.length) });
  // ---- the choices ----
  const O = a.options;
  const lvl = (st) => (st == null ? 0 : kind === "rice" ? st / 100 : Math.max(0, Math.min(1, 1 - st / p.raw)));
  const sayLv = (st) => showLevel(st);
  const gross = (net) => net / eff;
  const amt = (net) => (volume(gross(net)) ? fill(t.ir2HowMuch, { mm: whole.format(gross(net)), litres: volume(gross(net)) }) : fill(t.ir2HowMuchMm, { mm: whole.format(gross(net)) }));
  const dShort = (iso) => shortDate.format(new Date(`${iso}T00:00:00`));
  const rainLine = (k) => {
    const rs = a.run.rows.filter((r) => r.future && r.rainUsed > 0 && r.i - a.today <= 3);
    if (rs.length) { const b = rs.reduce((m, r) => (r.rainUsed > m.rainUsed ? r : m)); return fill(t.ir2ORainSome, { date: dShort(b.date), mm: whole.format(b.rain) }); }
    const later = O.bigRain;
    return later ? `${t.ir2ORainNone} ${fill(t.ir2ORainLater, { date: dShort(later.date), mm: whole.format(later.rain) })}` : t.ir2ORainNone;
  };
  const waterLine = kind === "rice"
    ? fill(t.ir2WhyWaterRice, { cm: one.format((a.nowFinal || 0) / 10), use: one.format(useNow) })
    : fill(t.ir2WhyWaterUpland, { pct: whole.format(Math.min(100, ((a.nowFinal || 0) / p.raw) * 100)), use: one.format(useNow) });
  const afterOf = (rows, total, nextDay) => ({
    line: fill(t.ir2OAfterLine, { l1: sayLv(rows[a.today + 1] ? rows[a.today + 1].pre : null), l7: sayLv(rows[a.today + 7] ? rows[a.today + 7].pre : null) }),
    next: nextDay == null ? fill(t.ir2ONextNone, { n: whole.format(plus.days.length) }) : fill(t.ir2ONext, { when: nextDay === 0 ? t.ir2WhenToday : fill(t.ir2OWhen, { date: dShort(a.run.rows[a.today + nextDay].date) }) }),
    total: fill(t.ir2OTotal, { n: whole.format(plus.days.length), tot: whole.format(gross(total)) }),
  });
  const choices = [];
  const dueDay = first ? first.day : null;
  if (dueDay === 0) {
    const waitOk = lvl(O.opts.wait.lv(2)) > lvl(O.pre0) + 0.02 || O.rain3 >= 0.8 * O.fullNet;
    const best = O.opts.less ? "less" : O.rain3 >= 0.8 * O.fullNet && waitOk ? "wait" : "now";
    const nowO = O.opts.now, lessO = O.opts.less, waitO = O.opts.wait;
    choices.push({ id: "now", tone: best === "now" ? "best" : "ok", tag: t.ir2TagNow, title: t.ir2OptNow, net: O.fullNet, why: [waterLine, t.ir2OWhyNow], rain: rainLine(), after: afterOf(nowO.rows, nowO.total, nowO.nextDay), mmNet: O.fullNet });
    if (lessO) choices.push({ id: "less", tone: best === "less" ? "best" : "ok", tag: t.ir2TagLess, title: t.ir2OptLess, net: O.lessNet, why: [waterLine, t.ir2OWhyLess], rain: rainLine(), after: afterOf(lessO.rows, lessO.total, lessO.nextDay) });
    choices.push({ id: "wait", tone: best === "wait" ? "best" : waitOk ? "ok" : "risky", tag: t.ir2TagWait, title: waitOk ? t.ir2OptWaitRain : fill(t.ir2OptWait, { n: 2 }), net: 0, why: [waterLine, waitOk ? t.ir2OWhyWaitRain : t.ir2OWhyWaitRisk], rain: rainLine(), after: { line: fill(t.ir2OAfterLine, { l1: sayLv(waitO.rows[a.today + 1].pre), l7: sayLv(waitO.rows[a.today + 7].pre) }), next: "", total: "" } });
  } else if (dueDay != null) {
    choices.push({ id: "wait", tone: "best", tag: t.ir2TagWait, title: fill(t.ir2OptWait, { n: whole.format(dueDay) }), net: first.mm, why: [waterLine, fill(t.ir2OWhyWaitOk, { n: whole.format(dueDay) })], rain: rainLine(), after: afterOf(a.run.rows, a.run.totalMm, dueDay), later: true });
    const nowO = O.opts.now;
    choices.push({ id: "anyway", tone: "risky", tag: t.ir2TagNow, title: t.ir2OptAnyway, net: O.fullNet, why: [t.ir2OWhyAnyway], rain: rainLine(), after: { ...afterOf(nowO.rows, nowO.total, nowO.nextDay), extra: fill(t.ir2OExtra, { x: whole.format(gross(Math.max(0, nowO.total - a.run.totalMm))) }) } });
  } else {
    const nowO = O.opts.now;
    choices.push({ id: "skip", tone: "best", tag: t.ir2TagSkip, title: t.ir2OptSkip, net: 0, why: [waterLine, fill(t.ir2OWhySkip, { n: whole.format(plus.days.length) })], rain: rainLine(), after: afterOf(a.run.rows, 0, null) });
    choices.push({ id: "anyway", tone: "risky", tag: t.ir2TagNow, title: t.ir2OptAnyway, net: O.fullNet, why: [t.ir2OWhyAnyway], rain: rainLine(), after: { ...afterOf(nowO.rows, nowO.total, nowO.nextDay), extra: fill(t.ir2OExtra, { x: whole.format(gross(nowO.total)) }) } });
  }
  const bestChoice = choices.find((c) => c.tone === "best") || choices[0];
  const heroNet = bestChoice && bestChoice.id !== "wait" && bestChoice.id !== "skip" ? bestChoice.net : first ? first.mm : 0;
  const hours = stamp ? new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" }).format(stamp) : "";

  return (
    <div className="ir2 ir2-new">
      <section className={`ir2-hero ${headKey}`} aria-live="polite">
        <div className="ir2-hero-top">
          <div>
            <h3>{head}</h3>
            {first ? (
              <p className="ir2-amount">{amt(heroNet)}</p>
            ) : <p className="muted">{t.ir2PlanNone}</p>}
          </div>
          <figure className="ir2-hero-plot">
            <LivingPlot level={lvl(a.nowFinal)} rice={kind === "rice"} label={`${t.ir2Combined}: ${showLevel(a.nowFinal)}`} />
            <figcaption>{showLevel(a.nowFinal)}</figcaption>
          </figure>
          <div className={`ir2-conf ${a.confidence}`}>
            <small>{t.ir2Confidence}</small>
            <b>{t[`ir2Conf_${a.confidence}`].split(":")[0]}</b>
          </div>
        </div>
        <ul className="ir2-why">
          <li>{kind === "rice"
            ? fill(t.ir2WhyWaterRice, { cm: one.format((a.nowFinal || 0) / 10), use: one.format(useNow) })
            : fill(t.ir2WhyWaterUpland, { pct: whole.format(Math.min(100, ((a.nowFinal || 0) / p.raw) * 100)), use: one.format(useNow) })}</li>
          <li>{countedMm > 0 ? fill(t.ir2WhyRain, { mm: whole.format(countedMm) }) : t.ir2WhyNoRain}</li>
          <li>{fill(t.ir2WhySoil, { soil: soilName, aw: whole.format(SOIL_AW[soil] || 0) })} {fill(t.ir2WhyStage, { stage: t[`irStage${stage}`] })}</li>
        </ul>
        <div className="ir2-rain"><b>{t.ir2RainEffect}</b><span>{rainText}</span></div>
        <p className="small muted">{t[`ir2Conf_${a.confidence}`]}</p>
      </section>

      {form}
      {!area && <p className="muted small ir2-full">{t.ir2NoArea}</p>}

      <section className="ir2-card ir2-c-now" aria-labelledby="ir2-now">
        <h3 id="ir2-now">{t.ir2Now}</h3>
        <div className="ir2-nums">
          <div><small>{t.ir2FromRain}</small><b>{showLevel(a.nowRainOnly)}</b></div>
          <div><small>{t.ir2YourReading}</small><b>{manual ? (kind === "rice" ? `${one.format(manual.mm / 10)} cm` : t[`ir2Feel_${manual.feel === "dry" ? "dry" : manual.feel === "wet" ? "wet" : "moist"}`]) : t.ir2NoReading}</b></div>
          <div className="main"><small>{t.ir2Combined}</small><b>{showLevel(a.nowFinal)}</b><span className="small muted">{kind === "rice" ? t.ir2NowRiceUnit : t.ir2NowUplandUnit}</span></div>
        </div>
        {a.anchor === "assumed" && <p className="small muted">{t.ir2Assumed}</p>}
        <div className="ir2-read">
          <b>{t.ir2Measure}</b>
          <span className="small muted">{kind === "rice" ? t.ir2MeasureRice : t.ir2MeasureUpland}</span>
          <div className="ir2-pills">
            {quick.map((q) => (
              <button key={q.k} type="button" className={activeQuick && activeQuick.k === q.k ? "on" : ""} onClick={() => putReading(kind === "rice" ? { mm: q.v, feel: null } : { feel: q.v, mm: null })}>{q.label}</button>
            ))}
            {kind === "rice" && (
              <label className="ir2-mm"><span className="small muted">{t.ir2OrMm}</span>
                <input type="number" min="0" max="200" inputMode="decimal" value={manual && !activeQuick ? manual.mm : ""} onChange={(e) => (e.target.value === "" ? set({ irWater: null }) : putReading({ mm: Number(e.target.value), feel: null }))} />
              </label>
            )}
          </div>
          <div className="ir2-when">
            <label className="small">{t.ir2WhenMeasured}
              <select value={readingDate} onChange={(e) => (manual ? putReading({ date: e.target.value }) : null)} disabled={!manual}>
                {dateChoices.map((c) => <option key={c.date} value={c.date}>{c.n === 0 ? t.ir2Today : c.n === 1 ? t.ir2Yesterday : fill(t.ir2DaysAgo, { n: c.n })}</option>)}
              </select>
            </label>
            {kind === "upland" && (
              <label className="small">{t.ir2Since}
                <select value={sinceAgo != null && sinceAgo >= 0 && sinceAgo <= 7 ? String(sinceAgo) : fd.irSince ? "more" : ""} onChange={(e) => set({ irSince: e.target.value === "" ? "" : e.target.value === "more" ? isoOf(dayNum(todayDate) - 8) : isoOf(dayNum(todayDate) - Number(e.target.value)) })}>
                  <option value="">{t.ir2SinceNever}</option>
                  {[0, 1, 2, 3, 4, 5, 6, 7].map((n) => <option key={n} value={n}>{n === 0 ? t.ir2Today : n === 1 ? t.ir2Yesterday : fill(t.ir2DaysAgo, { n })}</option>)}
                  <option value="more">{t.ir2SinceMore}</option>
                </select>
              </label>
            )}
            {manual && <button type="button" className="ir2-link" onClick={() => set({ irWater: null })}>{t.ir2UseEstimate}</button>}
          </div>
          <span className="small muted">{t.ir2NoRainToo}</span>
        </div>
      </section>

      <section className="ir2-card ir2-c-chart" aria-labelledby="ir2-chart">
        <h3 id="ir2-chart">{t.ir2ChartTitle}</h3>
        <SoilWaterChart
          t={t}
          locale={locale}
          rice={kind === "rice"}
          rows={a.run.rows}
          dry={a.noRain.rows}
          today={a.today}
          reading={reading}
        />
      </section>

      <section className="ir2-choices-wrap" aria-labelledby="ir2-choices">
        <h3 id="ir2-choices">{t.ir2ChoicesTitle}</h3>
        <p className="muted small">{t.ir2ChoicesHint}</p>
        <div className="ir2-opts">
          {[bestChoice, ...choices.filter((c) => c !== bestChoice)].map((c) => (
            <article key={c.id} className={`ir2-opt ${c.tone}`}>
              <header>
                <span className="ir2-tag">{c.tag}</span>
                <span className={`ir2-tone ${c.tone}`}>{t[`ir2Tone${c.tone === "best" ? "Best" : c.tone === "ok" ? "Ok" : "Risky"}`]}</span>
              </header>
              <h4>{c.title}</h4>
              {c.net > 0 && c.id !== "wait" && <p className="ir2-amount">{amt(c.net)}</p>}
              <dl>
                <dt>{t.ir2OWhy}</dt>
                <dd>{c.why.map((w, i) => <span key={i}>{w}</span>)}</dd>
                <dt>{t.ir2ORain}</dt>
                <dd><span>{c.rain}</span></dd>
                <dt>{t.ir2OAfter}</dt>
                <dd>
                  <span>{c.after.line}</span>
                  {c.after.next && <span>{c.after.next}</span>}
                  {c.after.total && <span>{c.after.total}</span>}
                  {c.after.extra && <span className="warnline">{c.after.extra}</span>}
                </dd>
              </dl>
            </article>
          ))}
        </div>
      </section>

      <section className="ir2-card ir2-c3" aria-labelledby="ir2-plan">
        <h3 id="ir2-plan">{t.ir2PlanDatesTitle}</h3>
        {events.length === 0 ? <p className="muted">{t.ir2PlanNone}</p> : (
          <ul className="ir2-dates">
            {events.map((e) => (
              <li key={e.date}><b>{dOf(e.date)}</b><span>{volume(e.mm / eff) ? fill(t.ir2PlanLine, { date: "", mm: whole.format(e.mm / eff), vol: volume(e.mm / eff) }).replace(/^: /, "") : fill(t.ir2PlanLineNo, { date: "", mm: whole.format(e.mm / eff) }).replace(/^: /, "")}</span></li>
            ))}
            <li className="tot"><b>{volume(a.run.totalMm / eff) ? fill(t.ir2PlanTotalLine, { mm: whole.format(a.run.totalMm / eff), vol: volume(a.run.totalMm / eff) }) : fill(t.ir2PlanTotalNo, { mm: whole.format(a.run.totalMm / eff) })}</b></li>
          </ul>
        )}
        <p className="small muted">{t.ir2PlanNote}</p>
      </section>

      <section className="ir2-card ir2-c3" aria-labelledby="ir2-check">
        <h3 id="ir2-check">{t.ir2CheckTitle}
          <Info t={t} source="NASA POWER · SMAP · Open-Meteo">
            <span>{t.ir2InfoSrcRain}</span>
            <span>{t.ir2InfoSrcPower}</span>
            <span>{t.ir2InfoSrcSmap}</span>
            <span>{t.ir2InfoSrcSoil}</span>
            <span>{t.ir2InfoLimit1}</span>
          </Info>
        </h3>
        <ul className="ir2-ev">
          {a.ev.map((e) => (
            <li key={e.id} className={e.status}>
              <i aria-hidden="true">{MARK[e.status] || "–"}</i>
              <span><b>{t[`ir2Ev_${e.id}`]}</b><small>{evText(e)}</small></span>
            </li>
          ))}
        </ul>
      </section>

      <section className="ir2-how ir2-c3">
        <h3>{t.ir2HowTitle}
          <Info t={t} source="FAO-56 · NASA · Open-Meteo">
            <b>{t.ir2InfoMethodH}</b>
            <span>{t.ir2InfoMethod1}</span>
            <span>{t.ir2InfoMethod2}</span>
            <span>{t.ir2InfoMethod3}</span>
            <span>{fill(t.ir2InfoMethod4, { w: whole.format(sw || 40) })}</span>
            <span>{t.ir2InfoMethod5}</span>
            <span>{t.ir2InfoMethod6}</span>
            <b>{t.ir2InfoSrcH}</b>
            <span>{t.ir2InfoSrcRain}</span>
            <span>{t.ir2InfoSrcPower}</span>
            <span>{t.ir2InfoSrcSmap}</span>
            <span>{t.ir2InfoSrcSoil}</span>
            <span>{t.ir2InfoSrcRules}</span>
            {WATER_SOURCES.filter((s) => s.id !== "W7").map((s) => (
              <span key={s.id}><a href={s.url} target="_blank" rel="noopener noreferrer">{s.by}: {s.title}</a></span>
            ))}
            <span><a href="https://www.canr.msu.edu/resources/estimating-soil-moisture-by-feel-and-appearance-usda-nrcs" target="_blank" rel="noopener noreferrer">{t.ir2InfoSrcFeel}</a></span>
            <b>{t.ir2InfoLimitH}</b>
            <span>{t.ir2InfoLimit1}</span>
            <span>{t.ir2InfoLimit2}</span>
            <span>{t.ir2InfoLimit3}</span>
          </Info>
        </h3>
        <p className="small muted">{t.ir2HowLine}</p>
        <div className="ir2-foot small muted">
          {hours && <span>{fill(t.ir2Updated, { time: hours })}</span>}
          <button type="button" className="ir2-link" onClick={() => load(false)}>{t.ir2Update}</button>
        </div>
      </section>
    </div>
  );
}
