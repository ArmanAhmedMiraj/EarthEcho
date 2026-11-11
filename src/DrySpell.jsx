import { useEffect, useMemo, useState } from "react";

const fill = (text, values) => Object.keys(values).reduce((s, k) => s.split(`{${k}}`).join(values[k]), text);

// "Dry spells": days in a row with almost no rain over the last 90 days (NASA POWER), next to the soil moisture SMAP measured (NASA).
// It describes what has happened. It is not a forecast.
export default function DrySpell({ t, locale, lat, lon }) {
  const [data, setData] = useState(null);
  const [state, setState] = useState("loading");

  useEffect(() => {
    let cancelled = false;
    setState("loading");
    fetch(`/api/dryspell?lat=${lat}&lon=${lon}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => { if (cancelled) return; if (d.ok) { setData(d); setState("ok"); } else setState("error"); })
      .catch(() => { if (!cancelled) setState("error"); });
    return () => { cancelled = true; };
  }, [lat, lon]);

  const nf = useMemo(() => new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }), [locale]);
  const nf2 = useMemo(() => new Intl.NumberFormat(locale, { maximumFractionDigits: 2, minimumFractionDigits: 2 }), [locale]);
  const dateF = useMemo(() => { const f = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }); return (s) => f.format(new Date(`${s}T12:00:00`)); }, [locale]);
  const dry = data && data.dry;
  const rain = (data && data.rain) || [];
  const soil = (data && data.soil) || [];
  const spellSet = useMemo(() => {
    const set = new Set();
    if (dry) dry.spells.forEach((s) => { for (let d = new Date(`${s.start}T12:00:00`); d <= new Date(`${s.end}T12:00:00`); d = new Date(d.getTime() + 86400000)) set.add(d.toISOString().slice(0, 10)); });
    return set;
  }, [dry]);

  if (state === "error") return (
    <section className="sc-season" aria-labelledby="ds-title"><h3 id="ds-title">{t.dryTitle}</h3><p className="warn small">{t.skFailed}</p></section>
  );
  if (state === "loading") return (
    <section className="sc-season" aria-labelledby="ds-title"><h3 id="ds-title">{t.dryTitle}</h3><p className="muted small">{t.skLoading}</p></section>
  );
  if (!dry || !dry.daysUsed) return null;

  const run = dry.ongoing ? dry.ongoing.days : 0;
  const lead = run >= 7 ? "long" : run >= 3 ? "some" : "none";
  const maxRain = Math.max(10, ...rain.map((d) => d.rain || 0));
  const W = 720, H = 90, bw = W / Math.max(rain.length, 1);
  const sMin = soil.length ? Math.min(...soil.map((s) => s.root)) : 0, sMax = soil.length ? Math.max(...soil.map((s) => s.root)) : 1;
  const sx = (i) => (soil.length < 2 ? 0 : (i / (soil.length - 1)) * W);
  const sy = (v) => 6 + (1 - (v - sMin) / Math.max(sMax - sMin, 0.02)) * (H - 12);
  const latest = soil.length ? soil[soil.length - 1] : null;
  const peak = soil.length ? soil.reduce((b, s) => (s.root > b.root ? s : b), soil[0]) : null;
  const ago14 = soil.length > 5 ? soil[Math.max(0, soil.length - 5)] : null; // about 12 days before the newest reading
  const rising = latest && ago14 ? latest.root - ago14.root : null;

  return (
    <section className="sc-season" aria-labelledby="ds-title">
      <h3 id="ds-title">{t.dryTitle}</h3>
      <p className="muted small">{fill(t.dryIntro, { n: nf.format(dry.daysUsed), mm: nf.format(data.wetMm) })}</p>
      <p className={`sk-hint sy-lead ds-${lead}`}>
        {run > 0 ? fill(t.dryRun, { n: nf.format(run), date: dateF(dry.lastDate) }) : fill(t.dryWet, { date: dateF(dry.lastDate) })}
        {dry.lastWetDate && run > 0 ? ` ${fill(t.dryLastWet, { date: dateF(dry.lastWetDate) })}` : ""}
        {run >= 7 ? ` ${t.dryLongNote}` : ""}
      </p>

      <h4>{t.dryRainTitle}</h4>
      <svg className="ds-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={fill(t.dryRainAria, { n: nf.format(dry.daysUsed), total: nf.format(dry.totalMm) })} preserveAspectRatio="none">
        {rain.map((d, i) => {
          const h = d.rain == null ? 0 : Math.max(d.rain >= data.wetMm ? 2 : 0, (d.rain / maxRain) * (H - 4));
          return (
            <g key={d.date}>
              {spellSet.has(d.date) && <rect x={i * bw} y="0" width={bw} height={H} className="ds-spell" />}
              <rect x={i * bw + 0.5} y={H - h} width={Math.max(bw - 1, 1)} height={h} className="ds-bar"><title>{`${dateF(d.date)}: ${d.rain == null ? "–" : nf.format(d.rain)} mm`}</title></rect>
            </g>
          );
        })}
      </svg>
      <div className="ds-axis" aria-hidden="true"><span>{rain.length ? dateF(rain[0].date) : ""}</span><span>{t.dryShaded}</span><span>{rain.length ? dateF(rain[rain.length - 1].date) : ""}</span></div>

      <ul className="sk-list small">
        <li>{fill(t.dryTotals, { total: nf.format(dry.totalMm), wet: nf.format(dry.wetDays), days: nf.format(dry.daysUsed), last30: nf.format(dry.last30Mm) })}</li>
        {dry.longest && <li>{fill(t.dryLongest, { n: nf.format(dry.longest.days), a: dateF(dry.longest.start), b: dateF(dry.longest.end) })}</li>}
        <li>{dry.spells.length ? fill(t.drySpells, { k: nf.format(dry.spells.length), min: nf.format(data.minSpell) }) : fill(t.dryNoSpells, { min: nf.format(data.minSpell) })}</li>
      </ul>

      {soil.length > 1 && (
        <>
          <h4>{t.drySoilTitle}</h4>
          <svg className="ds-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={fill(t.drySoilAria, { a: nf2.format(sMin), b: nf2.format(sMax) })} preserveAspectRatio="none">
            <polyline className="ds-line" fill="none" points={soil.map((s, i) => `${sx(i)},${sy(s.root)}`).join(" ")} />
            {soil.map((s, i) => <circle key={s.date} cx={sx(i)} cy={sy(s.root)} r="3" className="ds-dot"><title>{`${dateF(s.date)}: ${nf2.format(s.root)}`}</title></circle>)}
          </svg>
          <div className="ds-axis" aria-hidden="true"><span>{dateF(soil[0].date)}</span><span>{nf2.format(sMin)} – {nf2.format(sMax)} m³/m³</span><span>{dateF(latest.date)}</span></div>
          <ul className="sk-list small">
            <li>{fill(t.drySoilNow, { v: nf2.format(latest.root), date: dateF(latest.date), peak: nf2.format(peak.root), pdate: dateF(peak.date) })}</li>
            {rising != null && <li>{Math.abs(rising) < 0.01 ? t.drySoilFlat : rising > 0 ? t.drySoilUp : t.drySoilDown}</li>}
          </ul>
        </>
      )}
      <p className="muted small">{t.drySource}</p>
      <p className="muted small">{t.dryCaveat}</p>
    </section>
  );
}
