import { useMemo, useState } from "react";

// Learn section: how to read the app. A glossary with search, and an explainer on satellite versus ground.
export default function Learn({ t }) {
  const [q, setQ] = useState("");
  const words = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return t.glossary.filter((g) => !needle || g.term.toLowerCase().includes(needle) || g.def.toLowerCase().includes(needle));
  }, [q, t.glossary]);

  const list = (items) => <ul className="ln-list">{items.map((x) => <li key={x}>{x}</li>)}</ul>;

  return (
    <section className="ln-wrap" aria-labelledby="ln-title">
      <h3 id="ln-title">{t.lnTitle}</h3>
      <p className="muted small">{t.lnIntro}</p>

      <details className="ln-box" open>
        <summary>{t.lnSatTitle}</summary>
        <div className="ln-three">
          <div><h4>{t.lnSatSee}</h4>{list(t.lnSatSeeList)}</div>
          <div><h4>{t.lnSatMiss}</h4>{list(t.lnSatMissList)}</div>
          <div><h4>{t.lnSatGround}</h4>{list(t.lnSatGroundList)}</div>
        </div>
        <p className="ln-rule">{t.lnSatRule}</p>
        <h4>{t.lnScaleTitle}</h4>
        <svg className="ln-scale" viewBox="0 0 120 120" role="img" aria-label={t.lnScaleAria}>
          <rect x="10" y="10" width="100" height="100" className="ln-pixel" />
          <rect x="55" y="55" width="10" height="10" className="ln-field" />
          <text x="60" y="8" textAnchor="middle" className="ln-lab">1 km</text>
        </svg>
        <p className="muted small">{t.lnScaleNote}</p>
      </details>

      <details className="ln-box">
        <summary>{t.lnGlossTitle} ({words.length})</summary>
        <label className="ln-search">{t.lnSearch}
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        {words.length === 0 && <p className="muted small">{t.lnNone}</p>}
        <dl className="ln-gloss">
          {words.map((g) => (
            <div key={g.term}><dt>{g.term}</dt><dd>{g.def}</dd></div>
          ))}
        </dl>
      </details>
    </section>
  );
}
