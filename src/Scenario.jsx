import { findCrop } from "./suitability.js";

const fill = (text, values) => Object.keys(values).reduce((s, k) => s.split(`{${k}}`).join(values[k]), text);
const PRESETS = [
  ["Dry", { rain: -20, temp: 0 }],
  ["Hot", { rain: 0, temp: 2 }],
  ["Both", { rain: -20, temp: 2 }],
  ["Wet", { rain: 20, temp: 0 }],
];

// What-if sliders: change the yearly rain and the temperature of the place and see which crops and rotations change.
// It simply shifts NASA POWER's monthly averages (rain by a percentage, temperature by degrees). It is not a climate forecast.
export default function Scenario({ t, lang, locale, scn, setScn, results, baseResults, rotations, baseRotations, mode, field, climate }) {
  const nf = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const num = (n) => nf.format(Math.round(n));
  const signed = (n) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${nf.format(Math.abs(Math.round(n)))}`;
  const name = (c) => (lang === "bn" ? c.bn : c.en);
  const active = scn.rain !== 0 || scn.temp !== 0;

  const months = climate.months;
  const yearRain = months.reduce((s, m) => s + (m.rainMm || 0), 0);
  const meanT = months.reduce((s, m) => s + (m.tmean || 0), 0) / 12;

  // change in each crop's best fit, in percentage points
  const changes = results.map((r, i) => ({ crop: r.crop, was: baseResults[i][mode].best, now: r[mode].best }))
    .map((c) => ({ ...c, diff: Math.round((c.now - c.was) * 100) }));
  const worst = [...changes].filter((c) => c.diff <= -3).sort((a, b) => a.diff - b.diff).slice(0, 3);
  const best = [...changes].filter((c) => c.diff >= 3).sort((a, b) => b.diff - a.diff).slice(0, 3);

  const d = (field && field.details) || {};
  const mine = (text) => (text ? changes.find((c) => findCrop([c.crop], text)) : null);
  const own = [[t.fdCurrentCrop, mine(d.currentCrop)], [t.fdPlannedCrop, mine(d.plannedCrop)]].filter(([, c]) => c);

  const ids = (list) => (list[0] ? list[0].steps.map((o) => name(o.crop)).join(" → ") : null);
  const topNow = ids(rotations), topWas = ids(baseRotations);

  return (
    <section className="sc-wrap" aria-labelledby="sc-title">
      <h3 id="sc-title">{t.scTitle}</h3>
      <p className="muted small">{t.scIntro}</p>
      <div className="sc-presets" role="group" aria-label={t.scPresets}>
        {PRESETS.map(([id, v]) => (
          <button key={id} type="button" className="chip" aria-pressed={scn.rain === v.rain && scn.temp === v.temp} onClick={() => setScn(v)}>{t[`scPreset${id}`]}</button>
        ))}
        <button type="button" className="chip" disabled={!active} onClick={() => setScn({ rain: 0, temp: 0 })}>{t.scReset}</button>
      </div>
      <div className="sc-sliders">
        <label>
          <span>{t.scRain}: <b>{signed(scn.rain)}%</b></span>
          <input type="range" min="-30" max="30" step="5" value={scn.rain} onChange={(e) => setScn({ ...scn, rain: Number(e.target.value) })} />
        </label>
        <label>
          <span>{t.scTemp}: <b>{signed(scn.temp)} °C</b></span>
          <input type="range" min="0" max="4" step="0.5" value={scn.temp} onChange={(e) => setScn({ ...scn, temp: Number(e.target.value) })} />
        </label>
      </div>
      <p className="small">{fill(t.scNumbers, { rain: num(yearRain * (1 + scn.rain / 100)), wasRain: num(yearRain), temp: nf.format(Math.round((meanT + scn.temp) * 10) / 10), wasTemp: nf.format(Math.round(meanT * 10) / 10) })}</p>

      {!active && <p className="muted small">{t.scTry}</p>}
      {active && (
        <div className="sc-result" aria-live="polite">
          {own.length > 0 && (
            <div>
              <h4>{t.scYours}</h4>
              <ul>
                {own.map(([label, c]) => (
                  <li key={label}><b>{label}</b>: {name(c.crop)} {num(c.was * 100)}% → {num(c.now * 100)}% ({signed(c.diff)} {t.scPoints})</li>
                ))}
              </ul>
            </div>
          )}
          <div className="sc-cols">
            <div>
              <h4>{t.scLose}</h4>
              {worst.length ? <ul>{worst.map((c) => <li key={c.crop.id}>{name(c.crop)}: {num(c.was * 100)}% → {num(c.now * 100)}%</li>)}</ul> : <p className="small muted">{t.scNone}</p>}
            </div>
            <div>
              <h4>{t.scGain}</h4>
              {best.length ? <ul>{best.map((c) => <li key={c.crop.id}>{name(c.crop)}: {num(c.was * 100)}% → {num(c.now * 100)}%</li>)}</ul> : <p className="small muted">{t.scNone}</p>}
            </div>
          </div>
          {mode === "irrigated" && scn.rain !== 0 && <p className="small muted">{t.scIrrNote}</p>}
          {topNow && topWas && (
            <p className="small">{topNow === topWas ? fill(t.scSameTop, { r: topNow }) : fill(t.scNewTop, { was: topWas, now: topNow })}</p>
          )}
        </div>
      )}
      <p className="muted small">{t.scCaveat}</p>
    </section>
  );
}
