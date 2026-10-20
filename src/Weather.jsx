import { useCallback, useEffect, useState } from "react";
import "./weather.css";
import { fetchWeatherPlus, describeCode, compass, aqiClass, buildAlerts, sprayWindows } from "./weatherPlus.js";
import { SERVICES, TWO_LETTER } from "./i18nWeather.js";

const sum = (list, key) => list.reduce((s, d) => s + (d[key] || 0), 0);

// 48 hours: temperature line over hourly rain bars
function HourChart({ hours, t, locale }) {
  const W = 960, H = 190, L = 28, R = 8, T = 10, B = 24;
  const n = hours.length;
  const temps = hours.map((h) => h.temp);
  const lo = Math.floor(Math.min(...temps) - 1), hi = Math.ceil(Math.max(...temps) + 1);
  const maxRain = Math.max(2, ...hours.map((h) => h.rain || 0));
  const x = (i) => L + (i * (W - L - R)) / (n - 1);
  const y = (v) => T + ((hi - v) * (H - T - B)) / (hi - lo);
  const bw = (W - L - R) / n;
  const line = hours.map((h, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(h.temp).toFixed(1)}`).join(" ");
  const hr = new Intl.DateTimeFormat(locale, { hour: "numeric", hour12: false });
  return (
    <svg className="wx-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t.hoursTitle}>
      {hours.map((h, i) => {
        const ht = ((h.rain || 0) / maxRain) * (H - T - B) * 0.6;
        return <rect key={i} x={x(i) - bw / 2 + 1} y={H - B - ht} width={bw - 2} height={ht} fill="var(--a2)" opacity="0.55" />;
      })}
      <path d={line} fill="none" stroke="var(--amber)" strokeWidth="2.2" />
      <text x="2" y={y(hi) + 4}>{hi}°</text>
      <text x="2" y={y(lo) + 4}>{lo}°</text>
      {hours.map((h, i) =>
        i % 6 === 0 ? <text key={i} x={x(i)} y={H - 8} textAnchor="middle">{hr.format(new Date(h.time))}</text> : null,
      )}
    </svg>
  );
}

export default function Weather({ t, lang, lat, lon, country: appCountry, history }) {
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
  const maxRain = history ? Math.max(1, ...history.months.map((m) => m.rainMm || 0)) : 1;
  const alertText = (a) => {
    const v = a.value == null ? "" : num.format(a.value);
    const when = a.days.length ? ` (${a.days.slice(0, 3).map(dateOf).join(", ")})` : "";
    return t[`alert_${a.id}`].replace("{v}", v) + when;
  };

  return (
    <div>
      <div className="wx-now">
        <div className="wx-big" aria-hidden="true">{now.icon}</div>
        <div>
          <div className="wx-temp">{fmt(c.temperature_2m)}°C</div>
          <div>{t[`wxCode_${now.key}`]} · {t.wxFeels} {fmt(c.apparent_temperature)}°</div>
          <div className="muted small">{t.wxUpdated} {timeLabel.format(new Date(c.time))}</div>
        </div>
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

      <h3>{t.alertsTitle}</h3>
      {alerts.length === 0 ? <p className="muted">{t.alertsNone}</p> : alerts.map((a) => (
        <div key={a.id} className={`wx-alert ${a.level}`}><b>{t[`level_${a.level}`]}</b><span>{alertText(a)}</span></div>
      ))}
      <p className="muted small">
        {t.alertsNote}{" "}
        {service && <a href={service.url} target="_blank" rel="noopener noreferrer">{service.name}</a>}
      </p>

      <h3>{t.hoursTitle}</h3>
      <HourChart hours={plus.hours} t={t} locale={locale} />
      <p className="muted small">{t.hoursNote}</p>

      <h3>{t.workTitle}</h3>
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
      <p className="muted small">{t.workNote}</p>

      <h3>{t.outlookTitle}</h3>
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
      <p className="muted small">{t.outlookNote}</p>

      <h3>{t.pastTitle}</h3>
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
      <p className="muted small">{t.pastNote}</p>

      <h3>{t.normalsTitle}</h3>
      {history ? (
        <>
          <div className="bars">
            {history.months.map((m, i) => (
              <div key={i} className={`bar${i === nowMonth ? " now" : ""}`}>
                <span className="val">{m.rainMm == null ? "–" : num.format(m.rainMm)}</span>
                <div className="col"><span className="fill" style={{ height: `${m.rainMm == null ? 0 : Math.round((m.rainMm / maxRain) * 100)}%` }} /></div>
                <span className="lab">{monthLabel.format(new Date(2000, i, 1))}</span>
              </div>
            ))}
          </div>
          <p className="muted small">mm · {t.typicalSource.replace("{years}", history.years)} · {t.thisMonth}: {monthLabel.format(new Date(2000, nowMonth, 1))}</p>
        </>
      ) : <p className="muted small">{t.historyMissing}</p>}

      <h3>{t.newsTitle}</h3>
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
      <p className="muted small">{t.newsNote}</p>

      <h3>{t.creditsTitle}</h3>
      <p className="muted small">{t.credits}</p>
    </div>
  );
}
