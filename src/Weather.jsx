const HOT = 36;
const total = (days) => days.reduce((sum, d) => sum + (d.rain ?? 0), 0);

export default function Weather({ t, lang, forecast, history, loading, error }) {
  if (loading) return <p className="muted">{t.loading}</p>;
  if (error || !forecast) return <p className="warn">{t.weatherError}</p>;

  const locale = lang === "bn" ? "bn-BD" : "en-GB";
  const dayLabel = new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short" });
  const monthLabel = new Intl.DateTimeFormat(locale, { month: "short" });
  const whole = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });

  const week = forecast.days.slice(0, 7);
  const hotDays = week.filter((d) => d.tmax != null && d.tmax >= HOT).length;
  const nowMonth = new Date().getMonth();
  const maxRain = history ? Math.max(1, ...history.months.map((m) => m.rainMm || 0)) : 1;

  return (
    <div>
      <div className="stats">
        <div className="stat">
          <strong>{whole.format(total(week))} mm</strong>
          <span>{t.rain7}</span>
        </div>
        <div className="stat">
          <strong>{whole.format(total(forecast.days))} mm</strong>
          <span>{t.rain16}</span>
        </div>
      </div>

      <p className={hotDays > 0 ? "warn small" : "muted small"}>
        {hotDays > 0 ? t.hotWarn.replace("{n}", whole.format(hotDays)) : t.noHot}
      </p>

      <h3>{t.forecastTitle}</h3>
      <div className="cards">
        {week.map((d) => (
          <div className="card" key={d.date}>
            <div className="card-day">{dayLabel.format(new Date(`${d.date}T00:00:00`))}</div>
            <div className="card-temp">
              {d.tmax == null ? "–" : whole.format(d.tmax)}° / {d.tmin == null ? "–" : whole.format(d.tmin)}°
            </div>
            <div>{d.rain == null ? "–" : whole.format(d.rain)} mm</div>
            <div className="muted small">
              {d.chance == null ? "–" : whole.format(d.chance)}% {t.chance}
            </div>
          </div>
        ))}
      </div>
      <p className="muted small">{t.forecastNote}</p>

      <h3>{t.typicalRain}</h3>
      {history ? (
        <>
          <div className="bars">
            {history.months.map((m, i) => (
              <div key={i} className={`bar${i === nowMonth ? " now" : ""}`}>
                <span className="val">{m.rainMm == null ? "–" : whole.format(m.rainMm)}</span>
                <div className="col">
                  <span
                    className="fill"
                    style={{ height: `${m.rainMm == null ? 0 : Math.round((m.rainMm / maxRain) * 100)}%` }}
                  />
                </div>
                <span className="lab">{monthLabel.format(new Date(2000, i, 1))}</span>
              </div>
            ))}
          </div>
          <p className="muted small">
            mm · {t.typicalSource.replace("{years}", history.years)} · {t.thisMonth}: {monthLabel.format(new Date(2000, nowMonth, 1))}
          </p>
        </>
      ) : (
        <p className="muted small">{t.historyMissing}</p>
      )}
    </div>
  );
}