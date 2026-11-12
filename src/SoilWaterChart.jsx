import { useEffect, useMemo, useRef, useState } from "react";

const fill = (text, values) => Object.keys(values).reduce((s, k) => s.split(`{${k}}`).join(values[k]), text);

// One column per day. Top: rain. Below: a "tank" that shows how much water the crop has that day.
// Orange drop = add water that day. Touch or slide over the columns to read a day in plain words.
const BACK = 3; // days of the past that are shown
export default function SoilWaterChart({ t, locale, rice, rows, dry, today, onPick, reading }) {
  const holder = useRef(null);
  const [W, setW] = useState(640);
  const [showDry, setShowDry] = useState(false);
  const [sel, setSel] = useState(null);
  useEffect(() => {
    const el = holder.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(() => setW(Math.max(280, Math.round(el.getBoundingClientRect().width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const from = Math.max(0, today - BACK);
  const list = (showDry && dry ? dry : rows).slice(from);
  const n = list.length;
  const small = W < 480;
  const L = 4, R = 4, cw = (W - L - R) / n, bw = Math.max(6, cw - (small ? 3 : 6));
  const RAIN_H = 64, TANK_H = small ? 150 : 170, GAP = 16;
  const tankTop = RAIN_H + GAP + 22;
  const H = tankTop + TANK_H + 74;
  const x = (i) => L + i * cw + cw / 2;
  const maxRain = Math.max(10, ...list.map((r) => r.rain || 0));
  const nf = useMemo(() => new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }), [locale]);
  const dayF = useMemo(() => new Intl.DateTimeFormat(locale, { day: "numeric" }), [locale]);
  const monF = useMemo(() => new Intl.DateTimeFormat(locale, { month: "short" }), [locale]);
  const wdF = useMemo(() => new Intl.DateTimeFormat(locale, { weekday: "short" }), [locale]);
  const fullF = useMemo(() => new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long" }), [locale]);
  const dOf = (iso) => new Date(`${iso}T00:00:00`);
  const tone = (lv) => (lv == null ? "none" : lv <= 0.12 ? "low" : lv <= 0.4 ? "mid" : "ok");
  const ti = today - from;

  const move = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    setSel(Math.max(0, Math.min(n - 1, Math.floor((px - L) / cw))));
  };
  const key = (e) => {
    if (e.key === "ArrowRight") { e.preventDefault(); setSel((s) => Math.min(n - 1, (s == null ? ti : s) + 1)); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); setSel((s) => Math.max(0, (s == null ? ti : s) - 1)); }
    else if (e.key === "Escape") setSel(null);
  };
  useEffect(() => { if (onPick) onPick(sel); }, [sel]); // eslint-disable-line react-hooks/exhaustive-deps

  const r = sel != null ? list[sel] : null;
  const levelWord = (q) => (rice ? `${((q.pre != null ? q.pre : q.state) / 10).toFixed(1)} cm` : q.level > 0.66 ? t.ir2Full : q.level > 0.25 ? t.ir2Okay : t.ir2Empty);
  const anyDiff = dry && rows.some((q, i) => i >= today && dry[i] && Math.abs((q.level || 0) - (dry[i].level || 0)) > 0.04);
  const status = (q) => { const k = tone(q.level); return k === "low" ? t.ir2StLow : k === "mid" ? t.ir2StMid : t.ir2StOk; };

  return (
    <figure className="swc" ref={holder}>
      {reading && <p className="swc-read">{reading}</p>}
      <ul className="swc-key small">
        <li><i className="k-tank" />{rice ? t.ir2KeyTankRice : t.ir2KeyTank}</li>
        <li><i className="k-rain" />{t.ir2KeyRain}</li>
        <li><i className="k-maybe" />{t.ir2KeyMaybe}</li>
        <li><i className="k-drop" />{t.ir2KeyDrop}</li>
      </ul>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" tabIndex={0} aria-label={t.ir2ChartTitle} onPointerMove={move} onPointerDown={move} onPointerLeave={(e) => { if (e.pointerType === "mouse") setSel(null); }} onKeyDown={key}>
        <text className="swc-band" x={L + 2} y={12}>{t.ir2BandRain}</text>
        <text className="swc-band" x={L + 2} y={RAIN_H + GAP + 12}>{rice ? t.ir2BandWaterRice : t.ir2BandWater}</text>
        {list.map((q, i) => {
          const hr = ((q.rain || 0) / maxRain) * (RAIN_H - 18);
          const th = q.level == null ? 0 : Math.max(3, q.level * TANK_H);
          const unlikely = q.future && !q.counted;
          const isToday = i === ti;
          return (
            <g key={q.date} className={`swc-col ${sel === i ? "sel" : ""} ${q.future ? "fut" : "was"}`}>
              {isToday && <rect className="swc-todaybg" x={x(i) - cw / 2 + 1} y={0} width={cw - 2} height={tankTop + TANK_H + 66} rx="6" />}
              {hr > 0.5 && <rect className={`swc-rain ${unlikely ? "maybe" : ""}`} x={x(i) - bw / 2} y={RAIN_H - hr} width={bw} height={hr} rx="2" />}
              {(q.rain || 0) >= 5 && <text className="swc-rl" x={x(i)} y={RAIN_H - hr - 3} textAnchor="middle">{nf.format(q.rain)}</text>}
              <rect className="swc-tankbg" x={x(i) - bw / 2} y={tankTop} width={bw} height={TANK_H} rx="3" />
              {q.level != null && <rect className={`swc-tank ${tone(q.level)}`} x={x(i) - bw / 2} y={tankTop + TANK_H - th} width={bw} height={th} rx="3" />}
              {q.given > 0 && (
                <g className="swc-irr">
                  <path d={`M${x(i)},${tankTop + TANK_H + 6} q-7,10 0,16 q7,-6 0,-16z`} />
                  <text x={x(i)} y={tankTop + TANK_H + 34} textAnchor="middle">{t.ir2LegIrr}</text>
                </g>
              )}
              {(!small || (i - ti) % 2 === 0) && <text className={`swc-day ${isToday ? "strong" : ""}`} x={x(i)} y={tankTop + TANK_H + 58} textAnchor="middle">{isToday ? t.ir2AxToday : dayF.format(dOf(q.date))}</text>}
              {(i === 0 || dayF.format(dOf(q.date)) === "1" || isToday) && <text className="swc-day sub" x={x(i)} y={tankTop + TANK_H + 71} textAnchor="middle">{isToday ? dayF.format(dOf(q.date)) + " " + monF.format(dOf(q.date)) : monF.format(dOf(q.date))}</text>}
              <rect className="swc-hit" x={x(i) - cw / 2} y={0} width={cw} height={H} />
            </g>
          );
        })}
      </svg>
      <p className="swc-axis small muted"><span>◀ {t.ir2AxPast}</span><span>{t.ir2AxNext} ▶</span></p>
      {dry && anyDiff && (
        <label className="swc-tog"><input type="checkbox" checked={showDry} onChange={(e) => setShowDry(e.target.checked)} /> {t.ir2ToggleNoRain}</label>
      )}
      <div className="swc-card" aria-live="polite">
        {r ? (
          <>
            <b>{fullF.format(dOf(r.date))}{r.today ? ` · ${t.ir2AxToday}` : ""}</b>
            <span>🌧 {(r.rain || 0) > 0 ? (r.future ? fill(t.ir2SayRainFut, { mm: nf.format(r.rain), p: nf.format(r.chance == null ? 0 : r.chance), c: r.counted ? t.ir2SayCounted : t.ir2SayNotCounted }) : fill(t.ir2SayRainPast, { mm: nf.format(r.rain) })) : t.ir2SayNoRain}</span>
            {r.level != null ? <span>💧 {fill(rice ? t.ir2SayWaterRice : t.ir2SayWater, { v: levelWord(r), s: status(r) })}</span> : <span className="muted">{t.ir2DayNoData}</span>}
            {r.given > 0 && <span className="swc-gi">🚰 {fill(t.ir2DayIrr, { mm: nf.format(r.given) })}</span>}
          </>
        ) : <span className="muted">{t.ir2ChartHint}</span>}
      </div>
    </figure>
  );
}
