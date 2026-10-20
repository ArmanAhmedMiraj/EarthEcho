import { useId } from "react";
import "./logo.css";

// The EarthEcho logo: a shaded globe that turns slowly, a sprout that grows from it, a water drop that falls on it
// and a satellite that circles it. (The globe is the Earth, the satellite is the NASA data, the sprout is the farmer's crop.)
// The animation is plain CSS and SMIL inside this one SVG, so it costs nothing to run and works offline.
export default function Logo({ size = 52, className = "" }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const id = (name) => `lg${uid}${name}`;
  const ring = "M26 106 a74 24 0 1 1 148 0 a74 24 0 1 1 -148 0";
  return (
    <svg className={`efl ${className}`} width={size} height={size} viewBox="0 0 200 200" role="img" aria-label="EarthEcho">
      <defs>
        <radialGradient id={id("sea")} cx="36%" cy="30%" r="85%"><stop offset="0" stopColor="#46e0cc" /><stop offset="0.5" stopColor="#128a8c" /><stop offset="1" stopColor="#052f3a" /></radialGradient>
        <linearGradient id={id("grass")} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#b6ee6b" /><stop offset="1" stopColor="#5cbf4a" /></linearGradient>
        <radialGradient id={id("shade")} cx="68%" cy="72%" r="75%"><stop offset="0.45" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity="0.62" /></radialGradient>
        <radialGradient id={id("shine")} cx="30%" cy="24%" r="30%"><stop offset="0" stopColor="#fff" stopOpacity="0.55" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></radialGradient>
        <radialGradient id={id("halo")} cx="50%" cy="50%" r="50%"><stop offset="0.72" stopColor="#35e0b0" stopOpacity="0.35" /><stop offset="1" stopColor="#35e0b0" stopOpacity="0" /></radialGradient>
        <clipPath id={id("ball")}><circle cx="100" cy="106" r="62" /></clipPath>
      </defs>
      <circle cx="100" cy="106" r="86" fill={`url(#${id("halo")})`} />
      <g className="efl-ring">
        <path d="M26 106 a74 24 0 0 1 148 0" fill="none" stroke="#35e0b0" strokeOpacity="0.55" strokeWidth="2.4" strokeLinecap="round" strokeDasharray="1 7" />
      </g>
      <circle cx="100" cy="106" r="62" fill={`url(#${id("sea")})`} />
      <g clipPath={`url(#${id("ball")})`}>
        <g className="efl-land" transform="translate(0 6)">
          <g id={id("tile")} fill={`url(#${id("grass")})`}>
            <path d="M52 78 C58 64 78 60 88 70 C96 80 90 92 80 98 C70 104 58 100 52 90 Z" />
            <path d="M104 96 C116 88 134 92 140 106 C144 120 132 136 118 134 C106 130 98 108 104 96 Z" />
            <path d="M70 118 C80 112 90 120 88 132 C84 142 70 142 66 132 Z" />
            <path d="M120 62 C128 56 140 60 142 70 C138 78 126 78 120 70 Z" />
          </g>
          <use href={`#${id("tile")}`} x="124" />
        </g>
      </g>
      <circle cx="100" cy="106" r="62" fill={`url(#${id("shade")})`} />
      <circle cx="100" cy="106" r="62" fill={`url(#${id("shine")})`} />
      <circle cx="100" cy="106" r="62" fill="none" stroke="#9ff5e0" strokeOpacity="0.45" strokeWidth="1.4" />
      <g className="efl-ring">
        <path d="M174 106 a74 24 0 0 1 -148 0" fill="none" stroke="#35e0b0" strokeWidth="2.6" strokeLinecap="round" />
        <circle r="5.2" fill="#fff"><animateMotion dur="9s" repeatCount="indefinite" path={ring} /></circle>
        <circle r="9" fill="#35e0b0" fillOpacity="0.35"><animateMotion dur="9s" repeatCount="indefinite" path={ring} /></circle>
      </g>
      <g className="efl-sprout">
        <path d="M100 44 C100 34 100 26 100 16" stroke="#7be05a" strokeWidth="4.4" strokeLinecap="round" fill="none" />
        <path d="M100 30 C86 31 76 23 74 10 C89 10 98 17 100 30 Z" fill="#9ef07a" />
        <path d="M100 24 C113 25 124 17 126 5 C111 5 102 11 100 24 Z" fill="#6fd24f" />
      </g>
      <path className="efl-drop" d="M150 62 C153 67 155 70 155 73 A5 5 0 0 1 145 73 C145 70 147 67 150 62 Z" fill="#59c8ff" />
    </svg>
  );
}
