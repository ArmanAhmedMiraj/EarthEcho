import { useCallback, useEffect, useState } from "react";
import SeasonCheck from "./SeasonCheck.jsx";
import SimilarYear from "./SimilarYear.jsx";
import DrySpell from "./DrySpell.jsx";
import WxHours from "./WxHours.jsx";
import Info from "./Info.jsx";
import "./weatherfarmer.css";
import "./weather.css";
import { SkyChart } from "./Visuals.jsx";
import { fetchWeatherPlus, describeCode, compass, aqiClass, buildAlerts, sprayWindows } from "./weatherPlus.js";
import { SERVICES, TWO_LETTER } from "./i18nWeather.js";

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

  return (
    <div>
      <section className={`wx-sky ${c.is_day === 1 ? "day" : "night"}`} aria-label={t[`wxCode_${now.key}`]}>
        <div className="wx-sky-l">
          <div className="wx-big" aria-hidden="true">{now.icon}</div>
          <div className="wx-temp">{fmt(c.temperature_2m)}°C</div>
          <div className="wx-sky-d">{t[`wxCode_${now.key}`]} · {t.wxFeels} {fmt(c.apparent_temperature)}°</div>
          <div className="small wx-sky-u">{t.wxUpdated} {timeLabel.format(new Date(c.time))}</div>
        </div>
        <div className="wx-sky-r">
          <p className="wx-sky-h">{t.hoursTitle}</p>
          <p className="wx-sky-leg small"><span><i className="a" />{t.wfLegTemp}</span><span><i className="b" />{t.wfLegRain}</span></p>
          <SkyChart compact={typeof window !== "undefined" && window.innerWidth < 700} hours={plus.hours.slice(0, typeof window !== "undefined" && window.innerWidth < 700 ? 24 : 48)} label={t.hoursTitle} rainLabel={t.wfLegRain} tempLabel={t.wfLegTemp} hourFmt={(iso) => new Intl.DateTimeFormat(locale, { hour: "numeric" }).format(new Date(iso))} />
        </div>
      </section>
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

      <section className="vc">
      <h3>{t.alertsTitle}</h3>
      {alerts.length === 0 ? <p className="muted">{t.alertsNone}</p> : alerts.map((a) => (
        <div key={a.id} className={`wx-alert ${a.level}`}><b>{t[`level_${a.level}`]}</b><span>{alertText(a)}</span></div>
      ))}
      <p className="small muted wf-offi">
        {t.wfAlertShort || ""}
        <Info t={t} source="Open-Meteo">
          <span>{t.alertsNote}</span>
          {service && <a href={service.url} target="_blank" rel="noopener noreferrer">{service.name}</a>}
        </Info>
      </p>

      <WxHours t={t} locale={locale} hours={plus.hours} days={plus.days} />

      </section>

      <section className="vc">
      <h3 className="wf-h">{t.workTitle}<Info t={t} source="Open-Meteo"><span>{t.workNote}</span></Info></h3>
      <div className="wx-two">
        <div className="wx-box">
          <h4>{t.sprayTitle}</h4>
          {spray.length ? (
            <>
              <p className="small">{t.sprayYes}</p>
              <ul>{spray.map((b) => (
                <li key={b.from}>{dayLabel.format(new Date(b.from))}, {timeLabel.format(new Date(b.from))} – {timeLabel.format(new Date(new Date(b.to).getTime() + 3600000))}</li>
              ))}</ul>
            </>
          ) : <p className="small">{t.sprayNo}</p>}
        </div>
        <div className="wx-box">
          <h4>{t.soilWorkTitle}</h4>
          <p className="small">{wet ? t.soilWorkWet : t.soilWorkOk}</p>
        </div>
        <div className="wx-box">
          <h4>{t.waterTitle}</h4>
          <p className="small">
            {(need ? t.waterNeed : t.waterEnough).replace("{et}", num.format(et7)).replace("{rain}", num.format(rain7))}
          </p>
        </div>
      </div>

      </section>

      <section className="vc"><DrySpell t={t} locale={locale} lat={lat} lon={lon} soilKey={soil} rain7={rain7} onGo={onGo} /></section>
      <section className="vc"><SeasonCheck t={t} lang={lang} locale={locale} lat={lat} lon={lon} plus={plus} /></section>
      <section className="vc"><SimilarYear t={t} locale={locale} lat={lat} lon={lon} /></section>

      <section className="vc">
      <h3 className="wf-h">{t.wfOutlookTitle}<Info t={t} source="Open-Meteo"><span>{t.outlookNote}</span></Info></h3>
      <div className="wx-outlook">
        {plus.days.map((d) => {
          const w = describeCode(d.code);
          return (
            <div className="card" key={d.date}>
              <div className="card-day small">{dateOf(d.date)}</div>
              <div className="ic" title={t[`wxCode_${w.key}`]}>{w.icon}</div>
              <div className="card-temp">{fmt(d.tmax)}° / {fmt(d.tmin)}°</div>
              <div className="small">{fmt(d.rain)} mm</div>
              <div className="muted small">{fmt(d.chance)}%</div>
            </div>
          );
        })}
      </div>

      </section>

      <section className="vc">
      <h3 className="wf-h">{t.wfPastTitle}<Info t={t} source="Open-Meteo"><span>{t.pastNote}</span></Info></h3>
      <div className="wx-outlook">
        {plus.past.map((d) => {
          const w = describeCode(d.code);
          return (
            <div className="card" key={d.date}>
              <div className="card-day small">{dateOf(d.date)}</div>
              <div className="ic">{w.icon}</div>
              <div className="card-temp">{fmt(d.tmax)}° / {fmt(d.tmin)}°</div>
              <div className="small">{fmt(d.rain)} mm</div>
            </div>
          );
        })}
      </div>

      </section>

      <section className="vc">
      <h3 className="wf-h">{t.newsTitle}<Info t={t} source={t.wfNewsSrc}><span>{t.newsNote}</span></Info></h3>
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

      <section className="vc"><h3 className="wf-h">{t.creditsTitle}<Info t={t} source={t.wfAllSources}><span>{t.credits}</span></Info></h3></section>
    </div>
  );
}
