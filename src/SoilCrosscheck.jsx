import { useEffect, useState } from "react";
import { loadSecondMap, lookupSecond, compareSoil, GROUP } from "./soilcheck.js";

// Shown on the Soil tab for places in Bangladesh: the SoilGrids estimate next to a second, different soil map.
export default function SoilCrosscheck({ t, lang, lat, lon, country, tex, compact }) {
  const [map, setMap] = useState(undefined); // undefined = loading, null = failed
  useEffect(() => {
    let cancelled = false;
    if (country !== "BD") return undefined;
    loadSecondMap().then((m) => { if (!cancelled) setMap(m || null); });
    return () => { cancelled = true; };
  }, [country]);

  if (country !== "BD" || !tex || map === null) return null;
  if (map === undefined) return null;
  const digits = (n) => new Intl.NumberFormat(lang === "bn" ? "bn-BD" : "en").format(n);
  const nameOf = (c) => (t.sTexClassNames && t.sTexClassNames[c]) || c;
  const groupOf = (g) => ({ fine: t.sTexGroupFine, medium: t.sTexGroupMedium, coarse: t.sTexGroupCoarse }[g] || "");
  const first = { name: tex.class, group: GROUP[tex.class] || tex.group };
  const second = lookupSecond(map, lat, lon);
  const verdict = compareSoil(first, second);
  const fill = (s) =>
    s
      .replace("{a}", nameOf(first.name)).replace("{b}", second ? nameOf(second.name) : "")
      .replace("{ga}", groupOf(first.group)).replace("{gb}", second ? groupOf(second.group) : "")
      .replace("{group}", second ? groupOf(second.group) : "");

  return (
    <section className={compact ? "so2-card sx-card" : "soil-card soil-wide sx-card"} aria-label={t.sxTitle}>
      <h3>{t.sxTitle}</h3>
      <p className="muted small">{t.sxIntro}</p>
      {!second && <p className="sx-verdict none">{t.sxMissing}</p>}
      {second && (
        <>
          <div className="sx-two">
            <div>
              <p className="small muted">{t.sxFirst}</p>
              <p className="sx-name">{nameOf(first.name)}</p>
              <p className="small muted">{groupOf(first.group)}</p>
            </div>
            <div>
              <p className="small muted">{t.sxSecond}</p>
              <p className="sx-name">{nameOf(second.name)}</p>
              <p className="small muted">{groupOf(second.group)}</p>
            </div>
          </div>
          <p className={`sx-verdict ${verdict}`}>{{ agree: t.sxAgree, close: t.sxClose, differ: t.sxDiffer }[verdict]}</p>
          <p>{fill({ agree: t.sxAgreeBody, close: t.sxCloseBody, differ: t.sxDifferBody }[verdict])}</p>
          {second.share > 0 && second.share < 100 && (
            <p className="small muted">{t.sxShare.replace("{n}", digits(second.share)).replace("{c}", nameOf(second.name))}</p>
          )}
          {second.movedCells > 0 && <p className="small muted">{t.sxMoved}</p>}
        </>
      )}
      <p className="small muted">{t.sxHonest}</p>
      <p className="small muted">{t.sxSources}</p>
    </section>
  );
}
