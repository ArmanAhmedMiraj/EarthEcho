import { useCallback, useEffect, useMemo, useState } from "react";
import "./irrigation.css";
import { fetchWeatherPlus } from "./weatherPlus.js";
import { IRRIGATION_CROPS, METHOD_EFFICIENCY, SOIL_AW, SOIL_PERC, WATER_SOURCES, kcFor, scheduleRice, scheduleUpland } from "./water.js";
import { IRR_CROP_NAMES } from "./i18nIrrigation.js";
import { moistureClass } from "./soilNames.js";

const SOILS = Object.keys(SOIL_AW);
const SQUARE_METRES = { hectare: 10000, acre: 4046.86, decimal: 40.4686, bigha: 1337.8 };
const fill = (text, values) => Object.keys(values).reduce((s, k) => s.split(`{${k}}`).join(values[k]), text);

function readStore(key) {
  try { return JSON.parse(localStorage.getItem(key) || "{}") || {}; } catch { return {}; }
}
function writeStore(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage blocked: choices are just not remembered */ }
}

function Chart({ rows, events, rice, t, locale }) {
  const W = 640, H = 170, L = 6, R = 6, T = 10, B = 24;
  const n = rows.length;
  const bw = (W - L - R) / n;
  const x = (i) => L + i * bw;
  const day = new Intl.DateTimeFormat(locale, { day: "numeric" });
  const eventDays = new Set(events.map((e) => e.date));
  return (
    <svg className="ir-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t.chartTitle}>
      {rows.map((r, i) => {
        const h = Math.max(0, Math.min(1, r.level)) * (H - T - B);
        return <rect key={r.date} x={x(i) + 2} y={H - B - h} width={bw - 4} height={h} rx="3" fill="var(--a2)" opacity="0.55" />;
      })}
      {rows.map((r, i) => (eventDays.has(r.date) ? <circle key={`e${r.date}`} cx={x(i) + bw / 2} cy={H - B + 8} r="4" fill="#2f8fd8" /> : null))}
      {rows.map((r, i) => (i % 2 === 0 ? <text key={`l${r.date}`} x={x(i) + bw / 2} y={H - 2} textAnchor="middle">{day.format(new Date(`${r.date}T00:00:00`))}</text> : null))}
    </svg>
  );
}

export default function Irrigation({ t, lang, lat, lon, country, soil: appSoil, soilMapped, satellite }) {
  const placeKey = `${lat},${lon}`;
  const store = `ef-irrigation-${placeKey}`;
  const [plus, setPlus] = useState(null);
  const [state, setState] = useState("loading");
  const [saved, setSaved] = useState(() => readStore(store));
  const locale = lang === "bn" ? "bn-BD" : "en-GB";

  const load = useCallback(() => {
    setState("loading");
    fetchWeatherPlus(lat, lon).then((p) => { setPlus(p); setState("ok"); }).catch(() => setState("failed"));
  }, [lat, lon]);
  useEffect(load, [load]);

  const set = (patch) => {
    const merged = { ...saved, ...patch };
    setSaved(merged);
    writeStore(store, merged);
  };

  const crop = saved.crop || "rice";
  const stage = saved.stage != null ? Number(saved.stage) : 1;
  const method = saved.method || "surface";
  const soil = saved.soil || appSoil || "loam";
  const unit = saved.unit || (country === "BD" ? "decimal" : "hectare");
  const area = saved.area != null ? saved.area : "";
  const rice = crop === "rice";
  const todayDate = plus ? plus.days[0].date : null;
  const dayNum = (iso) => { const [y, m, d] = iso.split("-").map(Number); return Math.round(Date.UTC(y, m - 1, d) / 86400000); };
  // "since" is stored as a date so it keeps counting while the farmer is away
  const sinceDate = saved.sinceDate || (todayDate ? new Date((dayNum(todayDate) - 2) * 86400000).toISOString().slice(0, 10) : null);
  const sinceNum = todayDate && sinceDate ? dayNum(todayDate) - dayNum(sinceDate) : 2;
  const sinceValue = sinceNum > 7 ? "more" : String(Math.max(0, sinceNum));
  const stand = saved.stand || { mm: "20", date: todayDate };
  const standAgo = todayDate && stand.date ? dayNum(todayDate) - dayNum(stand.date) : 0;

  const plan = useMemo(() => {
    if (!plus) return null;
    const past = plus.past, days = plus.days;
    if (rice) {
      const standing = stand.mm === "dry" ? null : Number(stand.mm);
      return { kind: "rice", ...scheduleRice({ stage, soil, standing, ago: standAgo > 7 ? 0 : Math.max(0, standAgo), past, days }) };
    }
    return { kind: "upland", ...scheduleUpland({ crop, stage, soil, since: sinceNum > 7 ? null : Math.max(0, sinceNum), past, days }) };
  }, [plus, rice, crop, stage, soil, sinceNum, stand.mm, standAgo]);

  if (state === "loading") return <p className="muted">{t.irLoading}</p>;
  if (state === "failed" || !plus || !plan) {
    return (
      <div>
        <p className="warn">{t.irFailed}</p>
        <button className="tab" onClick={load}>{t.irRetry}</button>
      </div>
    );
  }

  const whole = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const one = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const dateFmt = new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short" });
  const dOf = (iso) => dateFmt.format(new Date(`${iso}T00:00:00`));
  const eff = METHOD_EFFICIENCY[method];
  const m2 = area !== "" && Number(area) > 0 ? Number(area) * SQUARE_METRES[unit] : null;
  const volume = (mm) => {
    if (!m2) return "–";
    const litres = mm * m2;
    return litres >= 100000 ? fill(t.cubic, { v: one.format(litres / 1000) }) : fill(t.litres, { v: whole.format(litres) });
  };

  const first = plan.events[0];
  let headKey = "headNone";
  let head = fill(t.headNone, { n: whole.format(plus.days.length) });
  if (first) {
    headKey = first.day === 0 ? "today" : "later";
    head = first.day === 0 ? t.headToday : first.day === 1 ? t.headTomorrow : fill(t.headLater, { n: whole.format(first.day) });
  }

  const smap = satellite && satellite.soilRoot && satellite.soilRoot.volumetric != null ? moistureClass(satellite.soilRoot.volumetric, soil) : null;
  const smapWord = smap ? { dry: t.sMoistDry, moist: t.sMoistMoist, nearFull: t.sMoistNearFull, wet: t.sMoistWet }[smap] : null;
  const cropName = (id) => IRR_CROP_NAMES[id][lang] || IRR_CROP_NAMES[id].en;

  return (
    <div>
      <p className="muted">{t.irIntro}</p>
      <div className="ir-form">
        <label>{t.irCrop}
          <select value={crop} onChange={(e) => set({ crop: e.target.value })}>
            {IRRIGATION_CROPS.map((c) => <option key={c} value={c}>{cropName(c)}</option>)}
          </select>
        </label>
        <label>{t.irStage}
          <select value={stage} onChange={(e) => set({ stage: Number(e.target.value) })}>
            {[0, 1, 2, 3].map((s) => <option key={s} value={s}>{t[`irStage${s}`]}</option>)}
          </select>
        </label>
        <label>{t.irSoil}
          <select value={soil} onChange={(e) => set({ soil: e.target.value })}>
            {SOILS.map((s) => <option key={s} value={s}>{t[`irSoil_${s}`]}{s === soilMapped && !saved.soil ? ` (${t.irSoilAuto})` : ""}</option>)}
          </select>
        </label>
        <label>{t.irMethod}
          <select value={method} onChange={(e) => set({ method: e.target.value })}>
            {Object.keys(METHOD_EFFICIENCY).map((m) => <option key={m} value={m}>{t[`irMethod_${m}`]}</option>)}
          </select>
        </label>
        {rice ? (
          <label>{t.irStanding}
            <select value={stand.mm} onChange={(e) => set({ stand: { mm: e.target.value, date: todayDate } })}>
              <option value="dry">{t.irStandDry}</option>
              <option value="0">{t.irStandMud}</option>
              {[20, 50, 100].map((mm) => <option key={mm} value={String(mm)}>{fill(t.irStandCm, { n: mm / 10 })}</option>)}
            </select>
          </label>
        ) : (
          <label>{t.irSince}
            <select value={sinceValue} onChange={(e) => set({ sinceDate: e.target.value === "more" ? new Date((dayNum(todayDate) - 8) * 86400000).toISOString().slice(0, 10) : new Date((dayNum(todayDate) - Number(e.target.value)) * 86400000).toISOString().slice(0, 10) })}>
              {[0, 1, 2, 3, 4, 5, 6, 7].map((n) => <option key={n} value={n}>{n === 0 ? t.irSince0 : n === 1 ? t.irSince1 : fill(t.irSinceN, { n: whole.format(n) })}</option>)}
              <option value="more">{t.irSinceMore}</option>
            </select>
          </label>
        )}
        <label>{t.irArea}
          <span className="ir-area">
            <input type="number" min="0" step="any" value={area} onChange={(e) => set({ area: e.target.value })} />
            <select value={unit} onChange={(e) => set({ unit: e.target.value })}>
              {Object.keys(SQUARE_METRES).map((u) => <option key={u} value={u}>{t[`unit_${u}`]}</option>)}
            </select>
          </span>
        </label>
      </div>
      {!saved.soil && <p className="muted small">{t.soilGuess}</p>}

      <div className={`ir-head ${headKey}`}>
        <strong>{head}</strong>
        <span className="muted">{first ? "" : t.headNoneBody}</span>
      </div>

      <h3>{t.planTitle}</h3>
      {plan.events.length === 0 ? <p className="muted">{t.planNone}</p> : (
        <table className="ir-table">
          <thead><tr><th>{t.planDate}</th><th>{t.planNet}</th><th>{t.planGross}</th><th>{t.planVolume}</th></tr></thead>
          <tbody>
            {plan.events.map((e) => (
              <tr key={e.date}>
                <td>{dOf(e.date)}</td><td>{whole.format(e.mm)}</td><td>{whole.format(e.mm / eff)}</td><td>{volume(e.mm / eff)}</td>
              </tr>
            ))}
            <tr><th>{t.planTotal}</th><th>{whole.format(plan.totalMm)}</th><th>{whole.format(plan.totalMm / eff)}</th><th>{volume(plan.totalMm / eff)}</th></tr>
          </tbody>
        </table>
      )}

      <h3>{t.chartTitle}</h3>
      <Chart rows={plan.rows} events={plan.events} rice={rice} t={t} locale={locale} />
      <p className="muted small">{rice ? t.chartNoteRice : t.chartNote}</p>
      <p className="small">
        {rice
          ? fill(t.riceInfo, { perc: whole.format(plan.perc), use: one.format(plus.days[0].et0 * plan.kc) })
          : fill(t.soilHolds, { mm: whole.format(plan.taw), raw: whole.format(plan.raw) })}
      </p>
      {rice && <p className="muted small">{t.awdTip}</p>}

      {smapWord && (
        <>
          <h3>{t.smapTitle}</h3>
          <p className="small">{fill(t.smapBody, { state: smapWord })}</p>
        </>
      )}

      <h3>{t.assumptionsTitle}</h3>
      <p className="small muted">{t.assumptions}</p>
      <p className="small muted">{t.assumptionsNote}</p>
      <h3>{t.sourcesTitle}</h3>
      <ul className="small muted">
        <li>{t.src_et0} (<a href="https://open-meteo.com/en/docs" target="_blank" rel="noopener noreferrer">open-meteo.com</a>)</li>
        {WATER_SOURCES.filter((s) => s.id !== "W7").map((s) => (
          <li key={s.id}><a href={s.url} target="_blank" rel="noopener noreferrer">{s.by}: {s.title}</a></li>
        ))}
      </ul>
    </div>
  );
}
