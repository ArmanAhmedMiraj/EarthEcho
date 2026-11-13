import { useCallback, useEffect, useState } from "react";
import SeasonCheck from "./SeasonCheck.jsx";
import SimilarYear from "./SimilarYear.jsx";
import DrySpell from "./DrySpell.jsx";
import Info from "./Info.jsx";
import "./weatherfarmer.css";
import "./weather.css";
import "./weather2.css";
import { SkyChart } from "./Visuals.jsx";
import { fetchWeatherPlus, describeCode, compass, aqiClass, buildAlerts, sprayWindows } from "./weatherPlus.js";
import { SERVICES, TWO_LETTER } from "./i18nWeather.js";

const fill2 = (text, values) => Object.keys(values).reduce((r, k) => r.split(`{${k}}`).join(values[k]), text);
const sum = (list, key) => list.reduce((s, d) => s + (d[key] || 0), 0);

export default function Weather({ t, lang, lat, lon, country: appCountry, soil, onGo }) {
  const country = TWO_LETTER[appCountry] || "none";
  const [plus, setPlus] = useState(null);
  const [state, setState] = useState("loading"); // loading | ok | failed
  const [news, setNews] = useState({ state: "loading", articles: [] });
  const locale = lang === "bn" ? "bn-BD" : "en-GB";

  const load = useCallback(() => {
    setState("loading");
    fetchWeatherPlus(lat, lon).then((p) => { setPlus(p); setState("ok"); }).catch(() => setState("failed"));
  }, [lat, lon]);
  useEffect(load, [load]);

  const askNews = useCallback(() => {
    let alive = true;
    let timer;
    const ask = (tries) => {
      fetch(`/api/news?country=${country}`)
        .then((r) => r.json())
        .then((d) => {
          if (!alive) return;
          if (d.available) setNews({ state: "ok", articles: d.articles, tries });
          else if (d.reason === "country") setNews({ state: "nocountry", articles: [] });
          else if (tries < 4) {
            setNews({ state: "loading", articles: [], tries });
            timer = setTimeout(() => ask(tries + 1), 6000);
          } else setNews({ state: "busy", articles: [] });
        })
        .catch(() => alive && setNews({ state: "busy", articles: [] }));
    };
    setNews({ state: "loading", articles: [], tries: 0 });
    ask(0);
    return () => { alive = false; clearTimeout(timer); };
  }, [country]);
  useEffect(() => askNews(), [askNews]);

  if (state === "loading") return <p className="muted">{t.wxLoading}</p>;
  if (state === "failed" || !plus) {
    return (
      <div>
        <p className="warn">{t.wxFailed}</p>
        <button className="tab" onClick={load}>{t.wxRetry}</button>
      </div>
    );
  }

  const num = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const dec = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const dayLabel = new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short" });
  const monthLabel = new Intl.DateTimeFormat(locale, { month: "short" });
  const timeLabel = new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" });
  const dateOf = (iso) => dayLabel.format(new Date(`${iso.slice(0, 10)}T00:00:00`));
  const fmt = (v, f = num) => (v == null ? "–" : f.format(v));

  const c = plus.current;
  const now = describeCode(c.weather_code, c.is_day === 1);
  const alerts = buildAlerts(plus);
  const spray = sprayWindows(plus.hours);
  const today = plus.days[0];
  const rain24 = sum(plus.hours.slice(0, 24), "rain");
  const rainBefore = plus.past[plus.past.length - 1]?.rain || 0;
  const wet = rain24 >= 15 || rainBefore >= 25;
  const week = plus.days.slice(0, 7);
  const rain7 = sum(week, "rain"), et7 = sum(week, "et0");
  const need = et7 > rain7 * 1.2 && et7 - rain7 > 5;
  const aqi = aqiClass(plus.air?.aqi);
  const service = SERVICES[country];
  const nowMonth = new Date().getMonth();
  const alertText = (a) => {
    const v = a.value == null ? "" : num.format(a.value);
    const when = a.days.length ? ` (${a.days.slice(0, 3).map(dateOf).join(", ")})` : "";
    return t[`alert_${a.id}`].replace("{v}", v) + when;
  };

  // ---- the words of the hero: one plain sentence about today, then the hottest and coolest hour ----
  const first24 = plus.hours.slice(0, 24);
  const hiH = first24.reduce((b, x) => (x.temp > b.temp ? x : b), first24[0]);
  const loH = first24.reduce((b, x) => (x.temp < b.temp ? x : b), first24[0]);
  const hourOnly = new Intl.DateTimeFormat(lang === "bn" ? "bn-BD" : "en-US", { hour: "numeric" });
  const tmrRain = plus.hours.slice(24, 48).find((x) => (x.rain || 0) >= 0.3);
  const headline = rain24 >= 2 ? t.orbWxRain : today.tmax != null && today.tmax >= 36 ? t.orbWxHot : t.orbWxGood;
  const weekday = new Intl.DateTimeFormat(locale, { weekday: "long" }).format(new Date());
  const goodHour = new Set();
  spray.forEach((b) => { const end = new Date(b.to).getTime() + 3600000; plus.hours.forEach((x) => { const ms = new Date(x.time).getTime(); if (ms >= new Date(b.from).getTime() && ms < end) goodHour.add(x.time); }); });
  const barRain = Math.max(0.1, rain7, et7);
  const rainMax = Math.max(10, ...plus.days.map((d) => d.rain || 0), ...plus.past.map((d) => d.rain || 0));
  const strip = [...plus.past.map((d, i) => ({ d, off: i - plus.past.length })), ...plus.days.map((d, i) => ({ d, off: i }))];

  return (
    <div className="wx2">
      <section className={`wx-sky ${c.is_day === 1 ? "day" : "night"}`} aria-label={t[`wxCode_${now.key}`]}>
        <div className="wx-sky-l">
          <p className="wx-today">{fill2(t.orbWxToday, { day: weekday })}</p>
          <h3 className="wx-headline">{headline}</h3>
          <p className="wx-range">{fill2(t.orbWxRange, { hi: fmt(hiH.temp), hiT: hourOnly.format(new Date(hiH.time)), lo: fmt(loH.temp), loT: hourOnly.format(new Date(loH.time)) })}</p>
          <p className="wx-nowline"><span aria-hidden="true">{now.icon}</span> {fmt(c.temperature_2m)}°C · {t[`wxCode_${now.key}`]} · {t.wxFeels} {fmt(c.apparent_temperature)}° <small>· {t.wxUpdated} {timeLabel.format(new Date(c.time))}</small></p>
        </div>
        <div className="wx-sky-r">
          <p className="wx-sky-h">{t.hoursTitle}</p>
          <p className="wx-sky-leg small"><span><i className="a" />{t.wfLegTemp}</span><span><i className="b" />{t.wfLegRain}</span></p>
          <SkyChart compact={typeof window !== "undefined" && window.innerWidth < 700} hours={plus.hours.slice(0, typeof window !== "undefined" && window.innerWidth < 700 ? 24 : 48)} label={t.hoursTitle} rainLabel={t.wfLegRain} tempLabel={t.wfLegTemp} hourFmt={(iso) => new Intl.DateTimeFormat(locale, { hour: "numeric" }).format(new Date(iso))} />
          <p className="wx-tmr small">{tmrRain ? fill2(t.orbWxTmrRain, { t: hourOnly.format(new Date(tmrRain.time)) }) : t.orbWxTmrDry}</p>
        </div>
      </section>

      <div className="wx-pills">
        <b>{t.orbWxNext7}</b>
        {alerts.length === 0 ? <span className="wx-pill calm"><i />{t.alertsNone}</span> : alerts.map((a) => <span key={a.id} className={`wx-pill ${a.level}`}><i />{alertText(a)}</span>)}
        <span className="small muted wf-offi">{t.wfAlertShort || ""}<Info t={t} source="Open-Meteo"><span>{t.alertsNote}</span>{service && <a href={service.url} target="_blank" rel="noopener noreferrer">{service.name}</a>}</Info></span>
      </div>

      <div className="wx-facts">
        <div className="wx-fact"><span>{t.wxHumidity}</span><strong>{fmt(c.relative_humidity_2m)}%</strong></div>
        <div className="wx-fact"><span>{t.wxWind}</span><strong>{fmt(c.wind_speed_10m)} km/h {compass(c.wind_direction_10m)} · {t.wxGust} {fmt(c.wind_gusts_10m)}</strong></div>
        <div className="wx-fact"><span>{t.wxPressure}</span><strong>{fmt(c.pressure_msl)} hPa</strong></div>
        <div className="wx-fact"><span>{t.wxCloud}</span><strong>{fmt(c.cloud_cover)}%</strong></div>
        <div className="wx-fact"><span>{t.wxUv}</span><strong>{fmt(c.uv_index, dec)}</strong></div>
        <div className="wx-fact"><span>{t.wxSoilMoist}</span><strong>{c.soil_moisture_0_to_1cm == null ? "–" : `${num.format(c.soil_moisture_0_to_1cm * 100)}%`}</strong></div>
        <div className="wx-fact"><span>{t.wxSoilTemp}</span><strong>{fmt(c.soil_temperature_0cm)}°C</strong></div>
        {plus.air && <div className="wx-fact"><span>{t.wxAir}</span><strong>{fmt(plus.air.aqi)} · {t[`aqi_${aqi}`]}</strong></div>}
        <div className="wx-fact"><span>{t.wxSunrise} / {t.wxSunset}</span><strong>{timeLabel.format(new Date(today.sunrise))} / {timeLabel.format(new Date(today.sunset))}</strong></div>
      </div>

      <div className="wx-trio">
        <section className="wx-card">
          <h3>{t.workTitle}<Info t={t} source="Open-Meteo"><span>{t.workNote}</span></Info></h3>
          <p className="small muted">{t.sprayTitle}</p>
          <div className="wx-hourbar" role="img" aria-label={t.sprayTitle}>
            {first24.map((x) => <i key={x.time} className={goodHour.has(x.time) ? "on" : ""} />)}
          </div>
          <div className="wx-hourlab small muted" aria-hidden="true">{[0, 6, 12, 18].map((k) => <span key={k}>{hourOnly.format(new Date(first24[k].time))}</span>)}<span>{hourOnly.format(new Date(plus.hours[24] ? plus.hours[24].time : first24[23].time))}</span></div>
          {spray.length ? (
            <>
              <p className="small">{t.sprayYes}</p>
              <ul className="small">{spray.map((b) => (
                <li key={b.from}>{dayLabel.format(new Date(b.from))}, {timeLabel.format(new Date(b.from))} – {timeLabel.format(new Date(new Date(b.to).getTime() + 3600000))}</li>
              ))}</ul>
            </>
          ) : <p className="small">{t.sprayNo}</p>}
          <p className="wx-split"><b>{t.soilWorkTitle}:</b> {wet ? t.soilWorkWet : t.soilWorkOk}</p>
        </section>
        <section className="wx-card"><DrySpell t={t} locale={locale} lat={lat} lon={lon} soilKey={soil} rain7={rain7} onGo={onGo} /></section>
        <section className="wx-card">
          <h3>{t.waterTitle}</h3>
          <div className="wx-bal"><span>{t.orbWxRainComing}</span><b>{num.format(rain7)} mm</b></div>
          <div className="wx-balbar"><i className="rain" style={{ width: `${Math.round((rain7 / barRain) * 100)}%` }} /></div>
          <div className="wx-bal"><span>{t.orbWxWillTake}</span><b>{num.format(et7)} mm</b></div>
          <div className="wx-balbar"><i className="need" style={{ width: `${Math.round((et7 / barRain) * 100)}%` }} /></div>
          <p className="wx-verdict">{need ? fill2(t.orbWxShort, { n: num.format(Math.max(0, et7 - rain7)) }) : t.orbWxEnough}</p>
          <p className="small muted">{(need ? t.waterNeed : t.waterEnough).replace("{et}", num.format(et7)).replace("{rain}", num.format(rain7))}</p>
        </section>
      </div>

      <section className="wx-card wx-strip-card">
        <div className="wx-strip-head"><h3>{t.orbWxStrip}<Info t={t} source="Open-Meteo"><span>{t.outlookNote}</span><span>{t.pastNote}</span></Info></h3><span className="small muted">{t.orbWxStripNote}</span></div>
        <div className="wx-strip" role="list">
          {strip.map(({ d, off }) => {
            const w = describeCode(d.code);
            const hgt = Math.round(((d.rain || 0) / rainMax) * 70);
            return (
              <div key={d.date} role="listitem" className={`wx-col${off === 0 ? " today" : ""}${off > 7 ? " far" : ""}`} title={`${dateOf(d.date)} · ${t[`wxCode_${w.key}`]} · ${fmt(d.tmax)}° / ${fmt(d.tmin)}° · ${fmt(d.rain)} mm${d.chance != null ? ` · ${fmt(d.chance)}%` : ""}`}>
                <b>{fmt(d.tmax)}°</b>
                <span className="ic" aria-hidden="true">{w.icon}</span>
                <span className="wx-colbar"><i style={{ height: `${Math.max((d.rain || 0) > 0 ? 3 : 0, hgt)}px` }} /></span>
                <span className="wx-coloff">{off === 0 ? t.orbWxTodayShort : off > 0 ? `+${num.format(off)}` : `−${num.format(-off)}`}</span>
              </div>
            );
          })}
        </div>
      </section>

      <div className="wx-duo">
        <section className="wx-card"><SeasonCheck t={t} lang={lang} locale={locale} lat={lat} lon={lon} plus={plus} /></section>
        <section className="wx-card"><SimilarYear t={t} locale={locale} lat={lat} lon={lon} /></section>
      </div>

      <div className="wx-duo even">
        <section className="wx-card">
          <h3>{t.newsTitle}<Info t={t} source={t.wfNewsSrc}><span>{t.newsNote}</span></Info></h3>
          {news.state === "loading" && <p className="muted">{t.newsLoading}{news.tries > 0 ? ` ${t.newsSlow}` : ""}</p>}
          {news.state === "busy" && (
            <p className="muted">{t.newsBusy} <button className="tab" onClick={askNews}>{t.wxRetry}</button></p>
          )}
          {news.state === "nocountry" && <p className="muted">{t.newsNoCountry}</p>}
          {news.state === "ok" && (news.articles.length === 0 ? <p className="muted">{t.newsNone}</p> : (
            <ul className="wx-news">
              {news.articles.map((a) => (
                <li key={a.url}>
                  <a href={a.url} target="_blank" rel="noopener noreferrer">{a.title}</a>
                  <div className="muted small">{a.domain}{a.date ? ` · ${a.date}` : ""}</div>
                </li>
              ))}
            </ul>
          ))}
        </section>
        <section className="wx-card"><h3>{t.creditsTitle}<Info t={t} source={t.wfAllSources}><span>{t.credits}</span></Info></h3><p className="small muted">{t.orbWxSources}</p></section>
      </div>
    </div>
  );
}
