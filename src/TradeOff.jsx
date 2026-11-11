const fill = (text, values) => Object.keys(values).reduce((s, k) => s.split(`{${k}}`).join(values[k]), text);

// Strategies side by side on what the farmer may care about: water, soil, risk (and income when the numbers are entered).
// Each bar is a 0-100 score, higher is better, relative to the rotations EarthEcho considered for this place. It is a way to
// see the trade-off, not a forecast. The real figures stand next to each bar.
export default function TradeOff({ t, cols, roleLabel, num, haveIncome }) {
  const list = cols.filter((c) => c.parts);
  if (list.length < 2) return null;
  const dims = [
    { key: "water", detail: (c) => (c.m.haveClimate ? fill(t.tfWaterD, { n: num(c.m.gap) }) : t.tfNoClimate) },
    { key: "soil", detail: (c) => fill(t.tfSoilD, { leg: c.m.legumes.length ? t.stYes : t.stNo, used: num(c.m.usedCount), fam: num(c.m.families) }) },
    { key: "risk", detail: (c) => fill(t.tfRiskD, { k: num(c.m.hot.length + c.m.cold.length), w: num(c.m.bareWet.length) }) },
  ];
  if (haveIncome) dims.push({ key: "income", detail: (c) => (c.profit.complete ? fill(t.tfIncomeD, { n: num(c.profit.total) }) : t.tfNoIncome) });
  const score = (c, k) => (c.parts[k] == null ? null : Math.round(c.parts[k] * 100));
  const bestFor = (k) => {
    const ranked = list.filter((c) => score(c, k) != null).sort((a, b) => score(b, k) - score(a, k));
    if (!ranked.length) return null;
    const top = score(ranked[0], k);
    return { names: ranked.filter((c) => top - score(c, k) <= 3).map((c) => roleLabel(c.role)), top };
  };
  const winners = dims.map((d) => ({ d, w: bestFor(d.key) })).filter((x) => x.w);
  const allSame = winners.length > 1 && winners.every((x) => x.w.names.join() === winners[0].w.names.join());

  return (
    <section className="tf-wrap" aria-labelledby="tf-title">
      <h4 id="tf-title">{t.tfTitle}</h4>
      <p className="muted small">{t.tfIntro}</p>
      {dims.map((d) => (
        <div className="tf-dim" key={d.key} role="group" aria-label={t[`tfDim_${d.key}`]}>
          <h5>{t[`tfDim_${d.key}`]} <span className="muted">{t[`tfHelp_${d.key}`]}</span></h5>
          {list.map((c) => {
            const v = score(c, d.key);
            return (
              <div className="tf-row" key={c.role}>
                <span className="tf-lab">{roleLabel(c.role)}</span>
                <span className="tf-track" aria-hidden="true"><i className={`c${list.indexOf(c) % 4}`} style={{ width: `${v == null ? 0 : Math.max(v, 2)}%` }} /></span>
                <span className="tf-val"><b>{v == null ? "–" : `${num(v)}`}</b> <span className="muted">{d.detail(c)}</span></span>
              </div>
            );
          })}
        </div>
      ))}
      <ul className="small tf-wins">
        {winners.map(({ d, w }) => <li key={d.key}>{fill(t.tfBest, { dim: t[`tfDim_${d.key}`].toLowerCase(), names: w.names.join(", ") })}</li>)}
      </ul>
      <p className="small">{allSame ? t.tfSame : t.tfNoneWins}</p>
      <p className="muted small">{t.tfCaveat}</p>
    </section>
  );
}
