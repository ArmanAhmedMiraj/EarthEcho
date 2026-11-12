// The drawn centrepieces of the pages ("From orbit to your field"). Every picture here is drawn from numbers the page already has;
// nothing is made up and nothing is decoration only. They are plain SVG, so they cost nothing to run and work offline.
import "./visuals.css";

// ---------------------------------------------------------------- the living plot: one block of land. level 0..1 is how full of water it is.
export function LivingPlot({ level = null, rice = false, label = "" }) {
  const lv = level == null ? 0 : Math.max(0, Math.min(1, level));
  const lift = 12 * lv; // the water surface rises with the level
  return (
    <svg className="vz-plot" viewBox="-130 -86 260 196" role="img" aria-label={label}>
      <polygon points="-110,0 0,55 0,95 -110,40" fill="#6b4a2f" />
      <polygon points="0,55 110,0 110,40 0,95" fill="#553a25" />
      <polygon points="0,-55 110,0 0,55 -110,0" fill="#4fae69" />
      <g stroke="#2f8f52" strokeWidth="4" strokeLinecap="round">
        <line x1="-80" y1="-5" x2="10" y2="40" /><line x1="-45" y1="-22" x2="45" y2="23" /><line x1="-10" y1="-40" x2="80" y2="5" />
      </g>
      {level != null && lv > 0.02 && (
        <g className="vz-water">
          <polygon points={`-110,${-lift} 0,${55 - lift} 0,55 -110,0`} fill="#3b82d6" opacity="0.82" />
          <polygon points={`0,${55 - lift} 110,${-lift} 110,0 0,55`} fill="#2f6fb5" opacity="0.82" />
          <polygon points={`0,${-55 - lift} 110,${-lift} 0,${55 - lift} -110,${-lift}`} fill="#5aa7ff" opacity="0.72" />
        </g>
      )}
      <polygon points="0,-55 110,0 0,55 -110,0" fill="none" stroke="rgba(246,207,106,0.9)" strokeWidth="1.5" strokeDasharray="6 6" />
      {level != null && <text x="0" y="-70" textAnchor="middle" className="vz-plot-txt">{rice ? "" : ""}</text>}
    </svg>
  );
}

// ---------------------------------------------------------------- score ring (0..1)
export function Ring({ value, label, sub, hue = "var(--a1)", size = 112 }) {
  const r = 44, c = 2 * Math.PI * r, v = Math.max(0, Math.min(1, value));
  return (
    <figure className="vz-ring" style={{ "--rh": hue }}>
      <svg width={size} height={size} viewBox="0 0 110 110" role="img" aria-label={`${label} ${Math.round(v * 100)}%`}>
        <circle cx="55" cy="55" r={r} fill="none" stroke="var(--border)" strokeWidth="10" />
        <circle cx="55" cy="55" r={r} fill="none" stroke="var(--rh)" strokeWidth="10" strokeLinecap="round" strokeDasharray={`${c * v} ${c}`} transform="rotate(-90 55 55)" className="vz-ring-arc" />
        <text x="55" y="62" textAnchor="middle" className="vz-ring-num">{Math.round(v * 100)}</text>
      </svg>
      <figcaption><b>{label}</b>{sub ? <small>{sub}</small> : null}</figcaption>
    </figure>
  );
}

// ---------------------------------------------------------------- the year wheel: each crop is an arc over the months it is in the ground
const WHEEL = ["#f6cf6a", "#3ddbc0", "#7fb2ff", "#ff9478", "#b69cff", "#5fcf7c"];
export function YearWheel({ steps, months, centre, label }) {
  const cx = 110, cy = 110, R = 84;
  const pt = (m, r) => { const a = (m / 12) * 2 * Math.PI - Math.PI / 2; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; };
  const arc = (from, len, r) => {
    const n = Math.min(12, Math.max(1, len));
    const [x1, y1] = pt(from, r), [x2, y2] = pt(from + n - 0.06, r);
    return `M${x1.toFixed(1)} ${y1.toFixed(1)} A${r} ${r} 0 ${n > 6 ? 1 : 0} 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`;
  };
  return (
    <svg className="vz-wheel" viewBox="0 0 220 220" role="img" aria-label={label}>
      <circle cx={cx} cy={cy} r={R} fill="none" stroke="var(--border)" strokeWidth="18" />
      {months.map((m, i) => { const [x, y] = pt(i + 0.5, R + 20); return <text key={i} x={x} y={y + 4} textAnchor="middle" className="vz-wheel-m">{m}</text>; })}
      {steps.map((s, i) => (
        <path key={i} d={arc((s.start || 0) % 12, s.len, R)} fill="none" stroke={WHEEL[i % WHEEL.length]} strokeWidth="18" strokeLinecap="butt" className="vz-wheel-arc" style={{ animationDelay: `${i * 0.25}s` }} />
      ))}
      <text x={cx} y={cy - 2} textAnchor="middle" className="vz-wheel-c">{centre}</text>
    </svg>
  );
}
export const WHEEL_COLORS = WHEEL;

// ---------------------------------------------------------------- the radar: your farm in the middle, hazards placed by their real distance
export function Radar({ items, maxKm = 500, label, tone = "calm" }) {
  const cx = 130, cy = 130, R = 112;
  const hue = { calm: "#3ddbc0", watch: "#f6cf6a", alert: "#ff9478" };
  return (
    <svg className={`vz-radar ${tone}`} viewBox="0 0 260 260" role="img" aria-label={label}>
      <defs>
        <radialGradient id="vzRad" cx="50%" cy="50%" r="50%"><stop offset="0" stopColor={hue[tone]} stopOpacity="0.18" /><stop offset="1" stopColor={hue[tone]} stopOpacity="0" /></radialGradient>
      </defs>
      <circle cx={cx} cy={cy} r={R} fill="url(#vzRad)" />
      {[0.25, 0.5, 0.75, 1].map((f) => <circle key={f} cx={cx} cy={cy} r={R * f} fill="none" stroke="var(--border-strong)" strokeWidth="1" strokeDasharray={f < 1 ? "3 5" : "0"} />)}
      <line x1={cx - R} y1={cy} x2={cx + R} y2={cy} stroke="var(--border)" /><line x1={cx} y1={cy - R} x2={cx} y2={cy + R} stroke="var(--border)" />
      <g className="vz-sweep" style={{ transformOrigin: `${cx}px ${cy}px` }}>
        <path d={`M${cx} ${cy} L${cx + R} ${cy} A${R} ${R} 0 0 0 ${cx + R * Math.cos(-0.7)} ${cy + R * Math.sin(-0.7)} Z`} fill={hue[tone]} opacity="0.22" />
        <line x1={cx} y1={cy} x2={cx + R} y2={cy} stroke={hue[tone]} strokeWidth="2" />
      </g>
      {items.map((it, i) => {
        const d = Math.min(maxKm, Math.max(8, it.km)) / maxKm;
        const a = ((i * 137.5) % 360) * (Math.PI / 180);
        const x = cx + R * d * Math.cos(a), y = cy + R * d * Math.sin(a);
        return <circle key={i} cx={x} cy={y} r={it.big ? 7 : 5} fill={hue[it.tone || "watch"]} stroke="var(--panel-solid)" strokeWidth="1.5"><title>{it.title}</title></circle>;
      })}
      <circle cx={cx} cy={cy} r="7" fill="#3ddbc0" stroke="var(--panel-solid)" strokeWidth="2" />
      <text x={cx + R * 0.25 + 3} y={cy - 4} className="vz-radar-k">{Math.round(maxKm / 4)}</text>
      <text x={cx + R * 0.5 + 3} y={cy - 4} className="vz-radar-k">{Math.round(maxKm / 2)}</text>
      <text x={cx + R - 22} y={cy - 4} className="vz-radar-k">{maxKm} km</text>
    </svg>
  );
}

// ---------------------------------------------------------------- the sky chart: temperature line and rain bars for the next hours
export function SkyChart({ hours, label, rainLabel, tempLabel, hourFmt, compact = false }) {
  const w = compact ? 340 : 640, h = compact ? 190 : 170, pad = 8;
  const n = hours.length;
  if (n < 2) return null;
  const ts = hours.map((x) => x.temp), lo = Math.min(...ts) - 1, hi = Math.max(...ts) + 1;
  const maxR = Math.max(2, ...hours.map((x) => x.rain || 0));
  const X = (i) => pad + (i / (n - 1)) * (w - 2 * pad);
  const Y = (v) => pad + (1 - (v - lo) / (hi - lo)) * (h - 40);
  const line = hours.map((x, i) => `${i ? "L" : "M"}${X(i).toFixed(1)} ${Y(x.temp).toFixed(1)}`).join(" ");
  const ticks = hours.map((x, i) => ({ x, i })).filter(({ i }) => i % 6 === 0);
  return (
    <svg className="vz-sky" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label}>
      {hours.map((x, i) => {
        const bh = ((x.rain || 0) / maxR) * 46;
        return bh > 0.5 ? <rect key={i} x={X(i) - 3.5} y={h - 24 - bh} width="7" height={bh} rx="2" fill="#7fb2ff" opacity="0.75"><title>{`${rainLabel}: ${x.rain.toFixed(1)} mm`}</title></rect> : null;
      })}
      <path d={`${line} L${X(n - 1)} ${h - 24} L${X(0)} ${h - 24} Z`} fill="url(#vzTemp)" opacity="0.5" />
      <defs><linearGradient id="vzTemp" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f6cf6a" stopOpacity="0.55" /><stop offset="1" stopColor="#f6cf6a" stopOpacity="0" /></linearGradient></defs>
      <path d={line} fill="none" stroke="#f6cf6a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      {ticks.map(({ x, i }) => <text key={i} x={X(i)} y={h - 6} textAnchor="middle" className={`vz-sky-t${compact ? " lg" : ""}`}>{hourFmt(x.time)}</text>)}
      <text x={pad} y="14" className={`vz-sky-k${compact ? " lg" : ""}`}>{tempLabel}</text>
    </svg>
  );
}
