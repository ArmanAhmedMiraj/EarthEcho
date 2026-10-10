// Simple drawn pictures so a farmer can recognise each crop and each trait without reading.
// These are drawings, not photos of a variety. To show a real photo, put the file in public/varieties/
// and write its path in the "photo" field of that variety in crops.js.

const GROUND = "#8d6e63";
const STEM = "#4f8a2b";

// one rice stalk with a heavy head of grain
function RiceStalk({ x, lean, grain }) {
  const tipX = x + lean;
  return (
    <g>
      <path d={`M${x} 54 C${x} 40 ${x + lean / 2} 28 ${tipX} 16`} stroke={STEM} strokeWidth="2.6" fill="none" strokeLinecap="round" />
      <path d={`M${x} 46 C${x - 8} 42 ${x - 12} 34 ${x - 13} 30`} stroke={STEM} strokeWidth="2" fill="none" strokeLinecap="round" />
      {[0, 1, 2, 3, 4].map((i) => (
        <ellipse
          key={i}
          cx={tipX + (i % 2 ? 3 : -3) + lean * 0.15 * i}
          cy={14 + i * 5}
          rx="2.6"
          ry="3.8"
          fill={grain}
          transform={`rotate(${i % 2 ? 25 : -25} ${tipX} ${14 + i * 5})`}
        />
      ))}
    </g>
  );
}

function Rice({ variant }) {
  const grain = variant === "taman" ? "#b9c93a" : "#e3b23c";
  return (
    <>
      <RiceStalk x={16} lean={8} grain={grain} />
      <RiceStalk x={32} lean={3} grain={grain} />
      <RiceStalk x={48} lean={-8} grain={grain} />
      {variant === "taman" ? (
        <>
          <rect x="3" y="52" width="58" height="9" rx="3" fill="#4aa3d8" opacity="0.55" />
          <path d="M6 56 q4 -3 8 0 t8 0 t8 0 t8 0 t8 0 t8 0" stroke="#fff" strokeWidth="1.4" fill="none" opacity="0.8" />
        </>
      ) : (
        <>
          <path d="M3 55 H61" stroke={GROUND} strokeWidth="4" strokeLinecap="round" />
          {variant === "aus" && (
            <g stroke="#f5a623" strokeWidth="2" strokeLinecap="round">
              <circle cx="10" cy="12" r="4.5" fill="#f5a623" stroke="none" />
              <path d="M10 3 v2 M10 19 v2 M1 12 h2 M17 12 h2 M3.6 5.6 l1.4 1.4 M16.4 18.4 l-1.4 -1.4 M3.6 18.4 l1.4 -1.4 M16.4 5.6 l-1.4 1.4" />
            </g>
          )}
        </>
      )}
    </>
  );
}

function Flower({ cx, cy }) {
  return (
    <g>
      {[0, 90, 180, 270].map((a) => (
        <ellipse key={a} cx={cx} cy={cy - 4.5} rx="3" ry="4.5" fill="#f2c200" transform={`rotate(${a} ${cx} ${cy})`} />
      ))}
      <circle cx={cx} cy={cy} r="2.2" fill="#d98200" />
    </g>
  );
}

function Mustard() {
  return (
    <>
      <path d="M32 56 V26 M32 40 L20 28 M32 34 L45 22" stroke={STEM} strokeWidth="2.6" fill="none" strokeLinecap="round" />
      <Flower cx={32} cy={19} />
      <Flower cx={19} cy={25} />
      <Flower cx={46} cy={18} />
      <path d="M3 56 H61" stroke={GROUND} strokeWidth="4" strokeLinecap="round" />
    </>
  );
}

function Potato() {
  return (
    <>
      <path d="M32 40 V22 M32 30 L22 22 M32 26 L42 18" stroke={STEM} strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <ellipse cx="22" cy="21" rx="6" ry="3.5" fill={STEM} />
      <ellipse cx="42" cy="17" rx="6" ry="3.5" fill={STEM} />
      <ellipse cx="32" cy="12" rx="5" ry="3" fill={STEM} />
      <rect x="3" y="38" width="58" height="22" rx="4" fill={GROUND} opacity="0.35" />
      <ellipse cx="22" cy="50" rx="11" ry="8" fill="#c79a5b" />
      <ellipse cx="44" cy="48" rx="9" ry="6.5" fill="#c79a5b" />
      {[[18, 48], [25, 53], [41, 46], [46, 50]].map(([x, y]) => (
        <circle key={x} cx={x} cy={y} r="1.3" fill="#7a5a2a" />
      ))}
    </>
  );
}

function Mungbean() {
  return (
    <>
      <path d="M32 56 V20" stroke={STEM} strokeWidth="2.6" fill="none" strokeLinecap="round" />
      <ellipse cx="22" cy="24" rx="8" ry="4" fill={STEM} transform="rotate(-25 22 24)" />
      <ellipse cx="42" cy="20" rx="8" ry="4" fill={STEM} transform="rotate(25 42 20)" />
      {[[26, 34, 14], [38, 30, -14], [27, 44, 8]].map(([x, y, r], i) => (
        <path
          key={i}
          d={`M${x} ${y} q ${r > 0 ? -2 : 2} 9 ${r > 0 ? 1 : -1} 15`}
          stroke="#2f6b2a"
          strokeWidth="4.2"
          strokeLinecap="round"
          fill="none"
        />
      ))}
      <path d="M3 56 H61" stroke={GROUND} strokeWidth="4" strokeLinecap="round" />
    </>
  );
}

function Fallow() {
  return (
    <>
      <rect x="3" y="30" width="58" height="28" rx="5" fill={GROUND} opacity="0.5" />
      <path d="M10 38 l8 4 l-3 6 M30 34 l-3 7 l9 3 M48 38 l-6 6 l8 5 M18 54 l7 -3 M38 55 l6 -4" stroke="#5d4037" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M52 30 q2 -8 5 -10 M52 30 q-1 -6 -4 -8" stroke={STEM} strokeWidth="2" fill="none" strokeLinecap="round" />
      <circle cx="12" cy="14" r="6" fill="#f5a623" />
    </>
  );
}

// kind: boro, boroSalt, taman, aus (rice), mustard, potato, mungbean, fallow
export function CropPicture({ kind, size = 64, label }) {
  const rice = kind === "boro" || kind === "boroSalt" ? "boro" : kind;
  let art;
  if (rice === "boro" || rice === "taman" || rice === "aus") art = <Rice variant={rice} />;
  else if (kind === "mustard") art = <Mustard />;
  else if (kind === "potato") art = <Potato />;
  else if (kind === "mungbean") art = <Mungbean />;
  else art = <Fallow />;
  return (
    <svg className="crop-pic" viewBox="0 0 64 64" width={size} height={size} role="img" aria-label={label || kind}>
      <rect x="0" y="0" width="64" height="64" rx="12" fill="rgba(127,127,127,0.12)" />
      {art}
    </svg>
  );
}

// tag: salt, flood, drought, cold, early, yield, blast, long
export function TraitIcon({ tag, size = 22 }) {
  let art;
  switch (tag) {
    case "salt":
      art = (
        <>
          <rect x="7" y="9" width="10" height="12" rx="2" fill="#e8eef2" stroke="#6b7c88" strokeWidth="1.4" />
          <rect x="8" y="3" width="8" height="6" rx="2" fill="#6b7c88" />
          <circle cx="10.5" cy="13" r="1" fill="#6b7c88" />
          <circle cx="13.5" cy="16" r="1" fill="#6b7c88" />
          <circle cx="10.5" cy="18" r="1" fill="#6b7c88" />
        </>
      );
      break;
    case "flood":
      art = (
        <>
          <path d="M2 10 q3 -3 5 0 t5 0 t5 0 t5 0" stroke="#2f8fd8" strokeWidth="2.2" fill="none" strokeLinecap="round" />
          <path d="M2 16 q3 -3 5 0 t5 0 t5 0 t5 0" stroke="#2f8fd8" strokeWidth="2.2" fill="none" strokeLinecap="round" />
        </>
      );
      break;
    case "drought":
      art = (
        <g stroke="#f5a623" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="4.5" fill="#f5a623" stroke="none" />
          <path d="M12 2 v3 M12 19 v3 M2 12 h3 M19 12 h3 M5 5 l2 2 M17 17 l2 2 M5 19 l2 -2 M17 7 l2 -2" />
        </g>
      );
      break;
    case "cold":
      art = (
        <g stroke="#4aa3d8" strokeWidth="2" strokeLinecap="round">
          <path d="M12 2 V22 M3.3 7 L20.7 17 M3.3 17 L20.7 7" />
          <path d="M9 4 L12 7 L15 4 M9 20 L12 17 L15 20" strokeWidth="1.6" />
        </g>
      );
      break;
    case "early":
      art = (
        <>
          <circle cx="12" cy="12" r="9" fill="none" stroke="#6b8e23" strokeWidth="2" />
          <path d="M12 6 V12 L16 14" stroke="#6b8e23" strokeWidth="2" fill="none" strokeLinecap="round" />
        </>
      );
      break;
    case "yield":
      art = (
        <>
          <path d="M12 21 V8 M12 8 L6 14 M12 8 L18 14" stroke="#2e7d32" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M5 3 H19" stroke="#2e7d32" strokeWidth="2.6" strokeLinecap="round" />
        </>
      );
      break;
    case "blast":
      art = (
        <>
          <path d="M12 2 L20 5 V12 C20 17 16 20 12 22 C8 20 4 17 4 12 V5 Z" fill="#c8e6c9" stroke="#2e7d32" strokeWidth="1.6" />
          <path d="M8 12 L11 15 L16 9" stroke="#2e7d32" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </>
      );
      break;
    case "long":
    default:
      art = (
        <>
          <path d="M6 3 H18 M6 21 H18 M7 3 C7 10 12 10 12 12 C12 14 7 14 7 21 M17 3 C17 10 12 10 12 12 C12 14 17 14 17 21" stroke="#b26a00" strokeWidth="1.8" fill="none" strokeLinecap="round" />
        </>
      );
  }
  return (
    <svg className="trait-icon" viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      {art}
    </svg>
  );
}