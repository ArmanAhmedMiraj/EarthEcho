import { useEffect, useMemo, useState } from "react";
import { CROPS } from "./crops.js";
import { WATER_SOURCES, isRice, isUpland, riceCountdown, uplandCountdown } from "./water.js";
import "./water.css";

const say = (obj, lang) => (obj ? obj[lang] || obj.en : "");
const fill = (text, values) => Object.keys(values).reduce((s, k) => s.split(`{${k}}`).join(values[k]), text);

const CROP_CHOICES = ["boro", "taman", "aus", "mustard", "potato", "mungbean"];
const SINCE_CHOICES = ["0", "1", "2", "3", "4", "5", "6", "7", "more"];

// a tank that shows how full the soil (or the field) is; the line is the point where you irrigate
function Tank({ level, line, low }) {
  const h = Math.max(0, Math.min(1, level)) * 60;
  return (
    <svg className="wd-tank" viewBox="0 0 60 80" width="60" height="80" aria-hidden="true">
      <rect x="6" y="10" width="48" height="60" rx="6" fill="rgba(127,127,127,0.15)" stroke="rgba(127,127,127,0.6)" strokeWidth="2" />
      <rect x="8" y={70 - h} width="44" height={h} rx="4" fill={low ? "#e53935" : "#2f8fd8"} opacity="0.85" />
      {line != null && <path d={`M4 ${70 - line * 60} H56`} stroke="#e53935" strokeWidth="2" strokeDasharray="4 3" />}
    </svg>
  );
}

function Drop() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
      <path d="M12 2 C12 2 5 10 5 15 a7 7 0 0 0 14 0 C19 10 12 2 12 2 Z" fill="#2f8fd8" />
    </svg>
  );
}

export default function Water({ t, lang, forecast, soil, soilLabel, guess, onSummary }) {
  const [crop, setCrop] = useState(guess.crop ? (guess.crop === "boroSalt" ? "boro" : guess.crop) : "none");
  const [stage, setStage] = useState(guess.stage);
  const [since, setSince] = useState("2");
  const [standing, setStanding] = useState("20");

  const locale = lang === "bn" ? "bn-BD" : "en-GB";
  const whole = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const one = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const two = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
  const dayLabel = new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric" });

  const past = forecast ? forecast.past || [] : [];
  const days = forecast ? forecast.days || [] : [];
  const rice = isRice(crop);
  const upland = isUpland(crop);

  const result = useMemo(() => {
    if (!forecast) return null;
    if (rice) {
      const st = standing === "dry" ? null : Number(standing);
      return riceCountdown({ crop, stage, soil, standing: st, days });
    }
    if (upland) {
      return uplandCountdown({ crop, stage, soil, since: since === "more" ? null : Number(since), past, days });
    }
    return null;
  }, [forecast, rice, upland, crop, stage, soil, since, standing, past, days]);

  // the headline for the answer
  let title = "";
  const lines = [];
  if (result) {
    const n = result.inDays;
    const horizon = days.length;
    if (result.kind === "upland") {
      if (result.status === "check") title = t.waterCheckTitle;
      else if (result.status === "now") title = t.waterNowTitle;
      else if (result.status === "today") title = t.waterTodayTitle;
      else if (result.status === "later") title = n === 1 ? t.waterTomorrowTitle : fill(t.waterLaterTitle, { n: whole.format(n) });
      else title = fill(t.waterNoneTitle, { n: whole.format(horizon) });
      if (result.status === "check") lines.push(t.waterCheckBody);
      else {
        lines.push(fill(t.waterLeft, { p: whole.format(Math.round(result.leftNow * 100)) }));
        lines.push(fill(t.waterGive, { cm: one.format(Math.max(0.5, Math.round(result.giveMm) / 10)) }));
      }
    } else {
      if (result.status === "now") title = t.waterRiceNowTitle;
      else if (result.status === "today") title = t.waterRiceTodayTitle;
      else if (result.status === "later") title = n === 1 ? t.waterRiceTomorrowTitle : fill(t.waterRiceLaterTitle, { n: whole.format(n) });
      else title = fill(t.waterRiceNoneTitle, { n: whole.format(horizon) });
      lines.push(t.waterRiceTip);
    }
    if (!result.soilKnown) lines.push(t.waterSoilUnknown);
  }

  // hand the answer to the printable plan
  const summaryKey = JSON.stringify([crop, title, lines]);
  useEffect(() => {
    if (onSummary) onSummary(crop === "none" || !result ? null : { crop, title, lines });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summaryKey]);

  const cropName = (k) => say(CROPS[k].short, lang);

  return (
    <section className="water">
      <h2>{t.waterTitle}</h2>
      <p className="muted small">{t.waterIntro}</p>

      <div className="crops-form">
        <label>
          {t.waterCrop}
          <select className="wide-select" value={crop} onChange={(e) => setCrop(e.target.value)}>
            {CROP_CHOICES.map((k) => (
              <option key={k} value={k}>
                {cropName(k)}
              </option>
            ))}
            <option value="none">{t.waterCropNone}</option>
          </select>
        </label>
        {crop !== "none" && (
          <label>
            {t.waterStage}
            <select className="wide-select" value={stage} onChange={(e) => setStage(Number(e.target.value))}>
              {[0, 1, 2, 3].map((s) => (
                <option key={s} value={s}>
                  {t[`waterStage${s}`]}
                </option>
              ))}
            </select>
          </label>
        )}
        {upland && (
          <label>
            {t.waterSince}
            <select className="wide-select" value={since} onChange={(e) => setSince(e.target.value)}>
              {SINCE_CHOICES.map((k) => (
                <option key={k} value={k}>
                  {k === "more" ? t.waterSinceMore : k === "0" ? t.waterSince0 : k === "1" ? t.waterSince1 : fill(t.waterSinceN, { n: whole.format(Number(k)) })}
                </option>
              ))}
            </select>
          </label>
        )}
        {rice && (
          <label>
            {t.waterStanding}
            <select className="wide-select" value={standing} onChange={(e) => setStanding(e.target.value)}>
              <option value="50">{t.waterStanding50}</option>
              <option value="20">{t.waterStanding20}</option>
              <option value="0">{t.waterStanding0}</option>
              <option value="dry">{t.waterStandingDry}</option>
            </select>
          </label>
        )}
      </div>
      {guess.crop && <p className="muted small">{t.waterGuessNote}</p>}

      {crop === "none" && <p className="water-empty">{t.waterNothing}</p>}
      {crop !== "none" && !forecast && <p className="warn">{t.waterNoWeather}</p>}

      {result && (
        <div className={`water-card ${result.status}`}>
          <div className="water-head">
            {result.kind === "upland" && result.status !== "check" ? (
              <Tank level={result.leftNow} line={1 - result.raw / result.taw} low={result.status === "now"} />
            ) : result.kind === "rice" ? (
              <Tank level={Math.min(1, result.leftNow / 100)} line={null} low={result.status === "now"} />
            ) : (
              <Tank level={0.5} line={null} />
            )}
            <div>
              <div className="water-title">{title}</div>
              {lines.map((l, i) => (
                <p key={i} className="water-line">
                  {l}
                </p>
              ))}
            </div>
          </div>

          {result.rows.length > 0 && (
            <>
              <h4 className="flow-title">{result.kind === "rice" ? t.waterStripRice : t.waterStripUpland}</h4>
              <div className="wd-scroll">
                <div className="wd-strip">
                  {result.rows.map((r, i) => {
                    const hit = result.inDays === i;
                    return (
                      <div key={r.date} className={`wd-day${r.low ? " low" : ""}${hit ? " hit" : ""}`}>
                        <div className="wd-flag">{hit ? <Drop /> : null}</div>
                        <div className="wd-bar" title={`${one.format(r.etc)} mm`}>
                          <span style={{ height: `${Math.round(r.level * 100)}%` }} />
                        </div>
                        <div className="wd-rain" title={`${one.format(r.rain)} mm`}>
                          <span style={{ height: `${Math.round(Math.min(1, r.rain / 40) * 100)}%` }} />
                        </div>
                        <div className="wd-mm">{r.rain >= 1 ? whole.format(r.rain) : ""}</div>
                        <div className="wd-lab">{dayLabel.format(new Date(`${r.date}T00:00:00`))}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <p className="muted small">
                {t.waterLegendBar} {t.waterLegendRain}
              </p>
            </>
          )}

          <p className="muted small">
            {result.kind === "rice"
              ? fill(t.waterHowRice, { kc: two.format(result.kc), perc: whole.format(result.perc) })
              : result.status !== "check"
                ? fill(t.waterHowUpland, { kc: two.format(result.kc), taw: whole.format(result.taw), raw: whole.format(result.raw) })
                : ""}
          </p>
          {soilLabel && (
            <p className="muted small">
              {t.cropSoilUsed}: {soilLabel}
            </p>
          )}
        </div>
      )}

      {crop !== "none" && <p className="muted small">{t.waterForecastNote}</p>}

      <details className="crop-sources">
        <summary>{t.waterSources}</summary>
        <ol>
          {WATER_SOURCES.map((s) => (
            <li key={s.id}>
              <strong>{s.id}</strong>{" "}
              <a href={s.url} target="_blank" rel="noreferrer">
                {s.title}
              </a>{" "}
              <span className="muted">({s.by})</span>
            </li>
          ))}
        </ol>
      </details>
    </section>
  );
}