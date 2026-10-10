import { useEffect, useMemo, useState } from "react";
import { CROPS } from "./crops.js";
import { WATER_SOURCES, isRice, isUpland, riceCountdown, uplandCountdown } from "./water.js";
import "./water.css";

const say = (obj, lang) => (obj ? obj[lang] || obj.en : "");
const fill = (text, values) => Object.keys(values).reduce((s, k) => s.split(`{${k}}`).join(values[k]), text);

const CROP_CHOICES = ["boro", "taman", "aus", "mustard", "potato", "mungbean"];
const SINCE_CHOICES = ["0", "1", "2", "3", "4", "5", "6", "7", "more"];

// ---- what the farmer told us is remembered on this phone, by date, so the countdown keeps moving by itself ----
const dayNumber = (iso) => {
  const [y, m, d] = String(iso).split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86400000);
};
const dateFromNumber = (n) => new Date(n * 86400000).toISOString().slice(0, 10);

function readStore(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || "{}") || {};
  } catch {
    return {};
  }
}
function writeStore(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage blocked: the answer just won't be remembered */
  }
}

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

export default function Water({ t, lang, forecast, updatedAt, refreshing, onRefresh, placeKey, soil, soilLabel, guess, onSummary }) {
  const [crop, setCrop] = useState(guess.crop ? (guess.crop === "boroSalt" ? "boro" : guess.crop) : "none");
  const [stage, setStage] = useState(guess.stage);
  const storeKey = `ef-water-${placeKey}`;
  const [saved, setSaved] = useState(() => readStore(storeKey)); // { wet: "YYYY-MM-DD", stand: { mm, date } }

  const locale = lang === "bn" ? "bn-BD" : "en-GB";
  const whole = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const one = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const two = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
  const dayLabel = new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric" });
  const timeLabel = new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" });

  const past = forecast ? forecast.past || [] : [];
  const days = forecast ? forecast.days || [] : [];
  const today = days.length ? days[0].date : null; // today in the field's own time zone
  const rice = isRice(crop);
  const upland = isUpland(crop);

  // days since the field was last irrigated or soaked (null = more than 7 days, or never told)
  const defaultWet = today ? dateFromNumber(dayNumber(today) - 2) : null;
  const wetDate = saved.wet || defaultWet;
  const sinceNum = today && wetDate ? dayNumber(today) - dayNumber(wetDate) : 2;
  const sinceValue = sinceNum > 7 ? "more" : String(Math.max(0, sinceNum));

  // standing water on the day the farmer last looked
  const stand = saved.stand || (today ? { mm: "20", date: today } : null);
  const standAgo = stand && today ? dayNumber(today) - dayNumber(stand.date) : 0;
  const standValue = stand ? stand.mm : "20";

  const save = (next) => {
    const merged = { ...saved, ...next };
    setSaved(merged);
    writeStore(storeKey, merged);
  };

  const result = useMemo(() => {
    if (!forecast) return null;
    if (rice) {
      const st = standValue === "dry" ? null : Number(standValue);
      return riceCountdown({ crop, stage, soil, standing: st, ago: standAgo > 7 ? null : Math.max(0, standAgo), past, days });
    }
    if (upland) {
      return uplandCountdown({ crop, stage, soil, since: sinceNum > 7 ? null : Math.max(0, sinceNum), past, days });
    }
    return null;
  }, [forecast, rice, upland, crop, stage, soil, sinceNum, standValue, standAgo, past, days]);

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
      if (result.status === "stale" || result.status === "check") {
        title = t.waterRiceStaleTitle;
        lines.push(t.waterRiceStaleBody);
      } else {
        if (result.status === "now") title = t.waterRiceNowTitle;
        else if (result.status === "today") title = t.waterRiceTodayTitle;
        else if (result.status === "later") title = n === 1 ? t.waterRiceTomorrowTitle : fill(t.waterRiceLaterTitle, { n: whole.format(n) });
        else title = fill(t.waterRiceNoneTitle, { n: whole.format(horizon) });
        lines.push(t.waterRiceTip);
      }
    }
    if (result.rainSoon >= 1) lines.push(fill(t.waterRainSoon, { mm: whole.format(result.rainSoon) }));
    if (!result.soilKnown) lines.push(t.waterSoilUnknown);
  }

  // hand the answer to the printable plan
  const summaryKey = JSON.stringify([crop, title, lines]);
  useEffect(() => {
    if (onSummary) onSummary(crop === "none" || !result ? null : { crop, title, lines });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summaryKey]);

  const cropName = (k) => say(CROPS[k].short, lang);
  const current = forecast ? forecast.current : null;
  const raining = current && current.rain >= 0.1;
  const toldWhen = (ago) => (ago <= 0 ? t.waterToldToday : fill(t.waterToldDays, { n: whole.format(ago) }));
  const irrigatedToday = () => {
    if (!today) return;
    if (rice) save({ stand: { mm: "50", date: today } });
    else save({ wet: today });
  };

  return (
    <section className="water">
      <h2>{t.waterTitle}</h2>
      <p className="muted small">{t.waterIntro}</p>

      <div className="live-row">
        <span className={`live-dot${refreshing ? " busy" : ""}`} aria-hidden="true" />
        <span className="small">{updatedAt ? fill(t.waterUpdated, { time: timeLabel.format(updatedAt) }) : ""}</span>
        {onRefresh && (
          <button type="button" className="live-btn" onClick={onRefresh} disabled={refreshing}>
            {refreshing ? t.waterRefreshing : t.waterRefresh}
          </button>
        )}
        {raining && <span className="live-rain">{fill(t.waterRainingNow, { mm: one.format(current.rain) })}</span>}
      </div>
      <p className="muted small">{t.waterLive}</p>

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
            <select
              className="wide-select"
              value={sinceValue}
              onChange={(e) => today && save({ wet: e.target.value === "more" ? dateFromNumber(dayNumber(today) - 8) : dateFromNumber(dayNumber(today) - Number(e.target.value)) })}
            >
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
            <select className="wide-select" value={standValue} onChange={(e) => today && save({ stand: { mm: e.target.value, date: today } })}>
              <option value="50">{t.waterStanding50}</option>
              <option value="20">{t.waterStanding20}</option>
              <option value="0">{t.waterStanding0}</option>
              <option value="dry">{t.waterStandingDry}</option>
            </select>
          </label>
        )}
      </div>
      {crop !== "none" && forecast && (upland || rice) && (
        <p className="small">
          <button type="button" className="live-btn" onClick={irrigatedToday}>
            {t.waterIrrigatedToday}
          </button>{" "}
          {(upland && saved.wet && sinceNum >= 0) || (rice && saved.stand) ? (
            <span className="muted">{fill(t.waterToldAgo, { when: toldWhen(rice ? standAgo : sinceNum) })}</span>
          ) : null}
        </p>
      )}
      {guess.crop && <p className="muted small">{t.waterGuessNote}</p>}

      {crop === "none" && <p className="water-empty">{t.waterNothing}</p>}
      {crop !== "none" && !forecast && <p className="warn">{t.waterNoWeather}</p>}

      {result && (
        <div className={`water-card ${result.status}`}>
          <div className="water-head">
            {result.kind === "upland" && result.status !== "check" ? (
              <Tank level={result.leftNow} line={1 - result.raw / result.taw} low={result.status === "now"} />
            ) : result.kind === "rice" && result.leftNow != null ? (
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
                      <div key={r.date} className={`wd-day${r.low ? " low" : ""}${hit ? " hit" : ""}${r.counted ? "" : " uncounted"}`}>
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
                {t.waterLegendBar} {t.waterLegendRain} {t.waterRainOnStrip}
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

      {crop !== "none" && (
        <p className="muted small">
          {t.waterForecastNote} {t.waterRainUnlikely}
        </p>
      )}

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