import { useEffect, useMemo, useRef, useState } from "react";

const fill = (text, values) => Object.keys(values).reduce((s, k) => s.split(`{${k}}`).join(values[k]), text);

// Water in the soil, day by day: rain bars, the estimate so far, the prediction, and the same prediction without the forecast rain.
// Slide a finger or the mouse over it (or use the arrow keys) to read any day.
export default function SoilWaterChart({ t, locale, rice, rows, dry, today, limit, taw, smap, onPick }) {
  const holder = useRef(null);
  const [W, setW] = useState(640);
  const [showDry, setShowDry] = useState(false);
  const [sel, setSel] = useState(null);
  useEffect(() => {
    const el = holder.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(() => setW(Math.max(290, Math.round(el.getBoundingClientRect().width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const small = W < 480;
  const H = small ? 300 : 290, L = small ? 40 : 46, R = 10, T = 14, B = 34, RAIN_H = 48;
  const n = rows.length;
  const plotH = H - T - B - RAIN_H - 10;
  const x = (i) => L + (i + 0.5) * ((W - L - R) / n);
  const bw = Math.max(4, (W - L - R) / n - 3);
  const y = (lv) => T + (1 - lv) * plotH;
  const maxRain = Math.max(10, ...rows.map((r) => r.rain || 0));
  const rainY = (mm) => (mm / maxRain) * RAIN_H;
  const base = H - B;
  const dayF = useMemo(() => new Intl.DateTimeFormat(locale, { day: "numeric" }), [locale]);
  const fullF = useMemo(() => new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short" }), [locale]);
  const monF = useMemo(() => new Intl.DateTimeFormat(locale, { month: "short" }), [locale]);
  const nf = useMemo(() => new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }), [locale]);
  const dOf = (iso) => new Date(`${iso}T00:00:00`);

  const path = (list, from, to) => {
    let s = "";
    for (let i = from; i <= to && i < n; i++) {
      const lv = list[i] && list[i].level;
      if (lv == null) { s += ""; continue; }
      s += `${s && list[i - 1] && list[i - 1].level != null && i > from ? "L" : "M"}${x(i).toFixed(1)},${y(lv).toFixed(1)} `;
    }
    return s.trim();
  };
  const pastD = path(rows, 0, today);
  const predD = path(rows, today, n - 1);
  const dryD = dry ? path(dry, today, n - 1) : "";
  const area = (d, from) => {
    const pts = rows.slice(from).map((r, k) => (r.level == null ? null : [x(from + k), y(r.level)])).filter(Boolean);
    if (pts.length < 2) return "";
    return `M${pts[0][0]},${base - RAIN_H - 10} ${pts.map((p) => `L${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ")} L${pts[pts.length - 1][0]},${base - RAIN_H - 10} Z`;
  };

  const move = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    const i = Math.max(0, Math.min(n - 1, Math.floor(((px - L) / (W - L - R)) * n)));
    setSel(i);
  };
  const key = (e) => {
    if (e.key === "ArrowRight") { e.preventDefault(); setSel((s) => Math.min(n - 1, (s == null ? today : s) + 1)); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); setSel((s) => Math.max(0, (s == null ? today : s) - 1)); }
    else if (e.key === "Escape") setSel(null);
  };
  useEffect(() => { if (onPick) onPick(sel); }, [sel]); // eslint-disable-line react-hooks/exhaustive-deps

  const r = sel != null ? rows[sel] : null;
  const rd = sel != null && dry ? dry[sel] : null;
  const levelWord = (lv) => (rice ? `${nf.format((lv || 0) * 100 / 10)} cm` : `${nf.format((lv || 0) * 100)}%`);
  const anyDiff = dry && rows.some((q, i) => i >= today && dry[i] && q.level != null && dry[i].level != null && Math.abs(q.level - dry[i].level) > 0.04);
  const ev = rows.filter((q) => q.given > 0);
  const mark = (i) => (i === 0 || dayF.format(dOf(rows[i].date)) === "1" ? monF.format(dOf(rows[i].date)) : null);

  return (
    <figure className="swc" ref={holder}>
      <figcaption><b>{rice ? t.ir2ChartRice : t.ir2ChartUpland}</b><span className="small muted">{t.ir2ChartHint}</span></figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" tabIndex={0} aria-label={t.ir2ChartTitle} onPointerMove={move} onPointerDown={move} onPointerLeave={(e) => { if (e.pointerType === "mouse") setSel(null); }} onKeyDown={key}>
        <rect className="swc-fc" x={x(today) - (W - L - R) / n / 2} y={T} width={W - R - (x(today) - (W - L - R) / n / 2)} height={H - T - B} />
        {[0, 0.5, 1].map((lv) => (
          <g key={lv}>
            <line className="swc-grid" x1={L} x2={W - R} y1={y(lv)} y2={y(lv)} />
            <text className="swc-ax" x={L - 5} y={y(lv) + 4} textAnchor="end">{lv === 1 ? t.ir2Full : lv === 0 ? t.ir2Empty : ""}</text>
          </g>
        ))}
        {limit != null && (
          <g>
            <line className="swc-limit" x1={L} x2={W - R} y1={y(limit)} y2={y(limit)} />
            <text className="swc-limt" x={W - R - 2} y={y(limit) - 4} textAnchor="end">{t.ir2LegLimit}</text>
          </g>
        )}
        <path className="swc-area" d={area(null, 0)} />
        {showDry && dryD && <path className="swc-dry" d={dryD} />}
        {pastD && <path className="swc-past" d={pastD} />}
        {predD && <path className="swc-pred" d={predD} />}
        {rows.map((q, i) => {
          const h = rainY(q.rain || 0);
          if (h <= 0.4) return null;
          const unlikely = q.future && !q.counted;
          return <rect key={q.date} className={`swc-rain ${unlikely ? "unlikely" : ""} ${q.future ? "fc" : "was"}`} x={x(i) - bw / 2} y={base - h} width={bw} height={h} rx="2" />;
        })}
        {ev.map((q) => (
          <g key={`e${q.date}`} className="swc-irr">
            <line x1={x(q.i)} x2={x(q.i)} y1={T + 6} y2={base - RAIN_H - 10} />
            <path d={`M${x(q.i)},${T} q-6,9 0,14 q6,-5 0,-14z`} />
          </g>
        ))}
        {smap && smap.i != null && smap.level != null && (
          <g><rect className="swc-sat" x={x(smap.i) - 5} y={y(smap.level) - 5} width="10" height="10" transform={`rotate(45 ${x(smap.i)} ${y(smap.level)})`} /></g>
        )}
        <line className="swc-today" x1={x(today)} x2={x(today)} y1={T} y2={base} />
        {rows.map((q, i) => (i % (small ? 3 : 2) === 0 ? <text key={`d${q.date}`} className={`swc-ax ${i === today ? "strong" : ""}`} x={x(i)} y={H - 18} textAnchor="middle">{i === today ? t.ir2AxToday : dayF.format(dOf(q.date))}</text> : null))}
        {rows.map((q, i) => (mark(i) && i % (small ? 3 : 2) === 0 ? <text key={`m${q.date}`} className="swc-ax" x={x(i)} y={H - 4} textAnchor="middle">{mark(i)}</text> : null))}
        {sel != null && (
          <g>
            <line className="swc-cross" x1={x(sel)} x2={x(sel)} y1={T} y2={base} />
            {r.level != null && <circle className="swc-pt" cx={x(sel)} cy={y(r.level)} r="5" />}
          </g>
        )}
      </svg>
      <div className="swc-legend small">
        <span><i className="lg past" />{t.ir2LegPast}</span>
        <span><i className="lg pred" />{t.ir2LegPred}</span>
        <span><i className="lg rain" />{t.ir2LegRain}</span>
        <span><i className="lg rain unl" />{t.ir2LegRainUnlikely}</span>
        <span><i className="lg irr" />{t.ir2LegIrr}</span>
        {smap && smap.level != null && <span><i className="lg sat" />{t.ir2DaySat}</span>}
      </div>
      {dry && anyDiff && (
        <label className="swc-tog small"><input type="checkbox" checked={showDry} onChange={(e) => setShowDry(e.target.checked)} /> {t.ir2ToggleNoRain}</label>
      )}
      <div className="swc-card" aria-live="polite">
        {r ? (
          <>
            <b>{fullF.format(dOf(r.date))}</b>
            <span>{t.ir2DayRain}: {nf.format(r.rain || 0)} mm {r.future ? (r.rain > 0 ? `· ${fill(t.ir2DayChance, { p: nf.format(r.chance == null ? 0 : r.chance) })} · ${r.counted ? t.ir2DayCounted : t.ir2DayNotCounted}` : "") : r.rain > 0 ? `· ${t.ir2DayFell}` : ""}</span>
            {r.level != null ? <span>{rice ? t.ir2DayWaterRice : t.ir2DayWater}: <b>{rice ? `${nf.format(r.state)} mm` : levelWord(r.level)}</b></span> : <span className="muted">{t.ir2DayNoData}</span>}
            {rd && rd.level != null && r.future && Math.abs(rd.level - (r.level || 0)) > 0.02 && <span>{t.ir2DayNoRainWater}: {rice ? `${nf.format(rd.state)} mm` : levelWord(rd.level)}</span>}
            {r.given > 0 && <span className="swc-gi">{fill(t.ir2DayIrr, { mm: nf.format(r.given) })}</span>}
          </>
        ) : <span className="muted">{t.ir2ChartHint}</span>}
      </div>
    </figure>
  );
}
