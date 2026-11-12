import { plotLabel } from "./geo.js";
import "./farmland.css";

const fill = (s, o) => String(s).replace(/\{(\w+)\}/g, (_, k) => (o[k] == null ? "" : o[k]));

// One plot switcher for the whole app. On the pages that follow the plot it lists the plots;
// on the pages that cover the whole location it says so instead.
export default function PlotBar({ t, plots, activeId, onSelect, whole, hidden }) {
  if (hidden) return null;
  if (whole) {
    return <p className="pl-bar pl-whole small" role="note">{fill(t.plWhole, { n: plots.length })}</p>;
  }
  return (
    <div className="pl-bar" role="group" aria-label={t.plPlot}>
      <span className="pl-label">{t.plPlotLabel}</span>
      {plots.map((p, i) => (
        <button key={p.id} className={`fd-pill${p.id === activeId ? " on" : ""}`} aria-pressed={p.id === activeId} title={plotLabel(p, i, t)} onClick={() => onSelect(p.id)}>
          {p.id === activeId ? "✓ " : ""}{plotLabel(p, i, t)}
        </button>
      ))}
    </div>
  );
}
