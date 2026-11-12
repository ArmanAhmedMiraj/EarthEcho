// The irrigation engine: one daily water balance for ONE plot, anchored on several kinds of evidence.
//
//   rice:    the state is the depth of standing water (mm). Rain adds, crop use and seepage take away.
//   upland:  the state is the soil water the crop has used up (depletion, mm). Crop use adds, effective rain takes away.
//
// The balance starts from the best known point: the farmer's own reading (if there is one), else the last irrigation,
// else an assumed start (flagged). On today it is nudged towards NASA's SMAP soil wetness (upland), because the balance
// alone drifts. Evidence from other sources is compared and shown, and sets how sure we are.
// These are simple rules, not an AI. Sources for every number are in WATER_SOURCES (water.js).
import { FALLBACK_ET0, RICE_CAP, RICE_REFILL, SOIL_AW, SOIL_PERC, UPLAND, effectiveRain, kcFor, rainCounted } from "./water.js";
import { FIELD_CAPACITY, moistureClass } from "./soilNames.js";

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const dayNum = (iso) => { const [y, m, d] = iso.split("-").map(Number); return Math.round(Date.UTC(y, m - 1, d) / 86400000); };
export const isoOf = (n) => new Date(n * 86400000).toISOString().slice(0, 10);

// what the farmer feels in the soil, as the share of the allowed depletion already used (hand-feel method)
export const FEEL = { dry: 1.15, slightly: 0.7, moist: 0.35, wet: 0.05 };
export const ASSUMED_RICE_MM = 30;

export function params({ kind, crop, stage, soil }) {
  if (kind === "rice") {
    return { kc: kcFor("rice", stage), perc: SOIL_PERC[soil] != null ? SOIL_PERC[soil] : 6, soilKnown: SOIL_PERC[soil] != null };
  }
  const m = UPLAND[crop];
  const aw = SOIL_AW[soil] || SOIL_AW.loam;
  const taw = aw * m.zr;
  return { kc: kcFor(crop, stage), taw, raw: m.p * taw, aw, zr: m.zr, soilKnown: !!SOIL_AW[soil] };
}

// available-water share (0 to 1) of the soil according to a SMAP reading, for this soil
export function smapAvailable(v, soil) {
  if (v == null) return null;
  const fc = FIELD_CAPACITY[soil] || FIELD_CAPACITY.loam;
  const aw = (SOIL_AW[soil] || SOIL_AW.loam) / 1000;
  return clamp((v - (fc - aw)) / aw, 0, 1);
}

// One run of the balance. start = { i, value } (the state at the START of day i, before that day's rain and use).
// assim = { weight, target } nudges today's end state towards target (depletion mm). noRain removes forecast rain.
export function run({ kind, crop, stage, soil, past, days, start, assim, noRain, inject, auto = true }) {
  const p = params({ kind, crop, stage, soil });
  const t0 = past.length;
  const series = [...past, ...days];
  let s = start.value; // rice: depth mm; upland: depletion mm
  const rows = [];
  const events = [];
  let due = null;
  for (let i = 0; i < series.length; i++) {
    const d = series[i];
    const future = i >= t0;
    const row = { date: d.date, i, future, today: i === t0, rain: d.rain || 0, chance: d.chance, et0: d.et0 != null ? d.et0 : FALLBACK_ET0 };
    row.etc = row.et0 * p.kc;
    if (i < start.i) { rows.push({ ...row, level: null, state: null, counted: false, given: 0 }); continue; }
    const counted = noRain && future ? 0 : rainCounted(d, future);
    row.counted = counted > 0 || (!future && row.rain > 0);
    row.rainUsed = counted;
    let given = 0;
    if (kind === "rice") {
      s = Math.min(RICE_CAP, s + counted - row.etc - p.perc);
      row.pre = Math.max(0, s);
      const inj = inject && inject.find((x) => i === t0 + x.day);
      if (inj) { s = Math.min(RICE_CAP, Math.max(0, s) + inj.mm); row.injected = inj.mm; }
      if (future && s <= 0) { if (due == null) due = i - t0; if (auto) { given = RICE_REFILL - s; events.push({ date: d.date, mm: Math.round(given), day: i - t0 }); s = RICE_REFILL; } }
      s = clamp(s, 0, RICE_CAP);
      row.level = s / RICE_CAP; row.state = s;
    } else {
      s = clamp(s + row.etc - effectiveRain(counted), 0, p.taw);
      if (i === t0 && assim) s = clamp(assim.weight * s + (1 - assim.weight) * assim.target, 0, p.taw);
      const inj = inject && inject.find((x) => i === t0 + x.day);
      if (inj) { s = Math.max(0, s - inj.mm); row.injected = inj.mm; }
      row.pre = s;
      if (future && s >= p.raw) { if (due == null) due = i - t0; if (auto) { given = s; events.push({ date: d.date, mm: Math.round(s), day: i - t0 }); s = 0; } }
      row.level = clamp(1 - s / p.raw, 0, 1); row.state = s;
    }
    row.given = given;
    rows.push(row);
  }
  return { p, rows, events, due, totalMm: events.reduce((a, e) => a + e.mm, 0) };
}

const cls3 = (c) => (c === "dry" ? "dry" : c === "moist" ? "moist" : c ? "wet" : null);
const gap = (a, b) => (a == null || b == null ? null : a === b ? "agree" : (a === "dry" && b === "wet") || (a === "wet" && b === "dry") ? "differ" : "near");

// everything the plot's answer rests on
export function assess({ kind, crop, stage, soil, plus, manual, since, smap, nasa, soilInfo }) {
  const past = plus.past, days = plus.days, t0 = past.length;
  const todayDate = days[0].date;
  const p = params({ kind, crop, stage, soil });

  // 1. where the balance starts
  const ageOf = (date) => (date ? dayNum(todayDate) - dayNum(date) : null);
  const mAge = manual ? ageOf(manual.date) : null;
  const manualOk = manual && mAge != null && mAge >= 0 && mAge <= 7;
  let start, anchor;
  const initFor = (idx, value) => ({ i: idx, value });
  if (manualOk) {
    const idx = t0 - mAge;
    let v;
    if (kind === "rice") v = manual.mm != null ? clamp(Number(manual.mm), 0, RICE_CAP) : ASSUMED_RICE_MM;
    else v = clamp((FEEL[manual.feel] != null ? FEEL[manual.feel] : 0.5) * p.raw, 0, p.taw);
    // the reading is the state at the time it was taken: start the day after, so that day's own rain is already in it
    start = mAge === 0 ? initFor(t0, v) : initFor(idx, v);
    anchor = "reading";
    if (mAge === 0) start.skipToday = true;
  } else if (since != null && kind === "upland" && since >= 0 && since <= 7) {
    start = initFor(t0 - since, 0);
    anchor = "irrigated";
  } else {
    start = initFor(0, kind === "rice" ? ASSUMED_RICE_MM : p.raw * 0.5);
    anchor = "assumed";
  }

  // 2. the satellite nudge (upland only)
  const smapAvail = kind === "upland" && smap ? smapAvailable(smap.volumetric, soil) : null;
  const smapTarget = smapAvail != null ? (1 - smapAvail) * p.taw : null;
  const weight = anchor === "reading" ? (mAge === 0 ? 1 : 0.75) : anchor === "irrigated" ? 0.6 : 0.4;
  const assim = smapTarget != null && !(anchor === "reading" && mAge === 0) ? { weight, target: smapTarget } : null;

  const base = { kind, crop, stage, soil, past, days };
  // a reading taken today IS today's state: the day is not run again
  const finalRun = run({ ...base, start: start.skipToday ? { i: t0, value: start.value } : start, assim });
  if (start.skipToday) {
    // keep today's state exactly as measured, then carry on from tomorrow
    const r = finalRun.rows[t0];
    if (r) { r.state = start.value; r.pre = start.value; r.level = kind === "rice" ? start.value / RICE_CAP : clamp(1 - start.value / p.raw, 0, 1); }
  }
  const rainOnly = run({ ...base, start: initFor(Math.max(0, t0 - 3), kind === "rice" ? ASSUMED_RICE_MM : p.raw * 0.5), assim: null });
  const noRain = run({ ...base, start: start.skipToday ? { i: t0, value: start.value } : start, assim, noRain: true });
  const at = (r, i) => r.rows[i];
  const nowRainOnly = at(rainOnly, t0), nowFinal = at(finalRun, t0);

  // 3. the evidence, side by side
  const ev = [];
  // rain that fell: weather model against NASA POWER over the same days
  if (nasa && nasa.rain && nasa.rain.length) {
    const byDate = new Map(nasa.rain.filter((r) => r.rainMm != null).map((r) => [r.date, r.rainMm]));
    const common = past.filter((d) => d.rain != null && byDate.has(d.date));
    if (common.length >= 3) {
      const om = common.reduce((s, d) => s + d.rain, 0), nz = common.reduce((s, d) => s + byDate.get(d.date), 0);
      const tol = Math.max(5, 0.35 * Math.max(om, nz));
      ev.push({ id: "rain", status: Math.abs(om - nz) <= tol ? "agree" : "differ", om: Math.round(om), nasa: Math.round(nz), n: common.length });
    } else ev.push({ id: "rain", status: "missing" });
  } else ev.push({ id: "rain", status: "missing" });

  // soil water: our balance, NASA SMAP and the NASA MERRA-2 model
  let mine;
  if (kind === "rice") mine = nowFinal && nowFinal.pre != null ? (nowFinal.pre >= 10 ? "wet" : nowFinal.pre > 0 ? "moist" : "dry") : null;
  else mine = nowFinal && nowFinal.pre != null ? (nowFinal.pre >= p.raw ? "dry" : nowFinal.pre > 0.4 * p.raw ? "moist" : "wet") : null;
  const smapC = smap && smap.volumetric != null ? cls3(moistureClass(smap.volumetric, soil)) : null;
  let merra = null;
  if (nasa && nasa.days) { const last = [...nasa.days].reverse().find((r) => r.soilRoot != null); if (last) merra = cls3(moistureClass(last.soilRoot, soil)); }
  ev.push({ id: "smap", status: smapC ? gap(mine, smapC) : "missing", mine, other: smapC });
  ev.push({ id: "merra", status: merra ? gap(smapC || mine, merra) : "missing", mine: smapC || mine, other: merra });

  // the weather model's own top-soil moisture (surface only, so it is a rough check)
  const omv = plus.current && plus.current.soil_moisture_0_to_1cm != null ? Number(plus.current.soil_moisture_0_to_1cm) : null;
  const omC = omv != null && isFinite(omv) ? cls3(moistureClass(omv, soil)) : null;
  ev.push({ id: "omsoil", status: omC ? gap(smapC || mine, omC) : "missing", mine: smapC || mine, other: omC });

  // the soil map (fixed reference)
  ev.push({ id: "soilmap", status: soilInfo && soilInfo.source === "user" ? "you" : soilInfo && soilInfo.source === "region" ? "near" : soilInfo && soilInfo.source ? "agree" : "missing", source: soilInfo ? soilInfo.source : null, confidence: soilInfo ? soilInfo.confidence : null });

  // rain forecast reliability
  const fc = days.filter((d) => (d.rain || 0) >= 1);
  const counted = fc.filter((d) => rainCounted(d, true) > 0);
  ev.push({ id: "forecast", status: fc.length === 0 ? "none" : counted.length === fc.length ? "agree" : "near", total: Math.round(fc.reduce((s, d) => s + d.rain, 0)), counted: Math.round(counted.reduce((s, d) => s + d.rain, 0)) });

  // 4. how sure
  let score = 0;
  ev.forEach((e) => { if (e.status === "agree" || e.status === "you") score += 1; else if (e.status === "near") score += 0.5; else if (e.status === "differ") score -= 1.5; });
  if (anchor === "reading" && mAge <= 2) score += 1.5; else if (anchor === "assumed") score -= 1.5;
  const confidence = score >= 3.5 ? "high" : score >= 1.5 ? "medium" : "low";

  // 5. what the forecast rain does
  const first = finalRun.events[0], firstDry = noRain.events[0];
  const rainShift = first && firstDry ? first.day - firstDry.day : !first && firstDry ? "beyond" : 0;
  const rainSaved = Math.max(0, noRain.totalMm - finalRun.totalMm);

  // --- what each choice would do (simulated) ---
  const pre0 = nowFinal && nowFinal.pre != null ? nowFinal.pre : 0;
  const fullNet = kind === "rice" ? Math.max(0, RICE_REFILL - pre0) : Math.max(0, pre0);
  const cr = (k) => { const r = finalRun.rows[t0 + k]; return r ? r.rainUsed || 0 : 0; };
  const rain3 = cr(1) + cr(2) + cr(3);
  const lessNet = Math.max(0, fullNet - 0.8 * rain3);
  const simBase = { ...base, start: start.skipToday ? { i: t0, value: start.value } : start, assim };
  const sim = (o) => {
    const r = run({ ...simBase, ...o });
    const first = r.events.find((e) => e.day >= 1);
    const inj = (o.inject || []).reduce((s2, x) => s2 + x.mm, 0);
    const lv = (k) => (r.rows[t0 + k] ? r.rows[t0 + k].pre : null);
    return { rows: r.rows, nextDay: first ? first.day : null, due: r.due, total: Math.round(inj + r.totalMm), lv };
  };
  const opts = {
    now: sim({ inject: [{ day: 0, mm: fullNet }] }),
    less: lessNet > 0.25 * fullNet && lessNet < 0.85 * fullNet ? sim({ inject: [{ day: 0, mm: lessNet }] }) : null,
    wait: sim({ auto: false }),
  };
  const rainDays = finalRun.rows.filter((r) => r.future && r.rainUsed > 0);
  const bigRain = rainDays.reduce((b, r) => (!b || r.rainUsed > b.rainUsed ? r : b), null);

  return {
    options: { fullNet, lessNet, rain3, opts, bigRain, pre0, noRainTotal: noRain.totalMm }, p, run: finalRun, noRain, rainOnly, ev, confidence, anchor, mAge, start, weight: assim ? weight : null,
    smapAvail, nowRainOnly: nowRainOnly && nowRainOnly.pre, nowFinal: nowFinal && nowFinal.pre,
    rainShift, rainSaved, firstDryDay: firstDry ? firstDry.day : null, today: t0,
  };
}
