import { useEffect, useState } from "react";
import { GROUPS, SOURCES } from "./dataCatalogue.js";

// The Data page: one live NASA reading for the chosen field, then the catalogue of every source.
export default function Sources({ t, lang, lat, lon }) {
  const [live, setLive] = useState({ state: "loading", data: null });
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    let cancelled = false;
    setLive({ state: "loading", data: null });
    fetch(`/api/power-daily?lat=${lat}&lon=${lon}&days=14`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data) => {
        if (!cancelled) setLive({ state: data.ok ? "ok" : "error", data });
      })
      .catch(() => {
        if (!cancelled) setLive({ state: "error", data: null });
      });
    return () => {
      cancelled = true;
    };
  }, [lat, lon]);

  const locale = lang === "bn" ? "bn-BD" : "en-GB";
  const whole = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const day = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" });
  const clock = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  const pct = (v) => (v == null ? t.liveNoData : `${whole.format(v)}%`);

  const liveCount = SOURCES.filter((s) => s.status === "live").length;
  const shown = SOURCES.filter((s) => filter === "all" || s.status === filter);
  const data = live.data;

  return (
    <div className="viewer">
      <h2>{t.dataTitle}</h2>
      <p className="muted">{t.dataIntro}</p>

      <section className="live-card">
        <h3>{t.liveTitle}</h3>
        {live.state === "loading" && <p className="muted">{t.liveLoading}</p>}
        {live.state === "error" && <p className="warn">{t.liveError}</p>}
        {live.state === "ok" && data && (
          <>
            <div className="stats">
              <div className="stat">
                <strong>{pct(data.summary.soilTopPct)}</strong>
                <span>{t.liveSurface}</span>
              </div>
              <div className="stat">
                <strong>{pct(data.summary.soilRootPct)}</strong>
                <span>{t.liveRoot}</span>
              </div>
              <div className="stat">
                <strong>{whole.format(data.summary.rain7Mm)} mm</strong>
                <span>{t.liveRain7}</span>
              </div>
            </div>
            <p className="small muted">
              {data.summary.latestSoilDate && (
                <>
                  {t.liveAsOf}: {day.format(new Date(data.summary.latestSoilDate))} ·{" "}
                </>
              )}
              {t.liveSource}:{" "}
              <a href={data.provenance.url} target="_blank" rel="noreferrer">{data.provenance.name}</a> ·{" "}
              {t.liveResolution}: {data.provenance.resolution} · {t.liveFetched}:{" "}
              {clock.format(new Date(data.provenance.fetchedAt))}
            </p>
            <p className="small warn-soft">{t.liveCaution}</p>
          </>
        )}
      </section>

      <h3>{t.catalogueTitle}</h3>
      <p className="small muted">{t.countLine(SOURCES.length, liveCount)}</p>
      <div className="filters" role="group">
        {[["all", t.filterAll], ["live", t.filterLive], ["planned", t.filterPlanned]].map(([id, label]) => (
          <button key={id} className="chip" aria-pressed={filter === id} onClick={() => setFilter(id)}>
            {label}
          </button>
        ))}
      </div>

      {GROUPS.map((g) => {
        const items = shown.filter((s) => s.group === g.id);
        if (items.length === 0) return null;
        return (
          <section key={g.id}>
            <h3 className="group-title">{g[lang] || g.en}</h3>
            <div className="src-grid">
              {items.map((s) => (
                <article key={s.id} className="src">
                  <header>
                    <strong>{s.name}</strong>
                    <span className={`badge ${s.status}`}>
                      {s.status === "live" ? t.statusLive : t.statusPlanned(s.stage)}
                    </span>
                  </header>
                  <p className="small muted">{s.publisher}</p>
                  <dl>
                    <dt>{t.provides}</dt><dd>{s.provides}</dd>
                    <dt>{t.resolution}</dt><dd>{s.resolution}</dd>
                    <dt>{t.updates}</dt><dd>{s.update}</dd>
                    <dt>{t.licence}</dt>
                    <dd>
                      {s.licence}
                      {!s.licenceChecked && <em className="unchecked"> · {t.licenceUnchecked}</em>}
                    </dd>
                    <dt>{t.access}</dt><dd>{s.access}</dd>
                    <dt>{t.limits}</dt><dd>{s.limit}</dd>
                  </dl>
                  <a className="small" href={s.url} target="_blank" rel="noreferrer">{t.open} ↗</a>
                </article>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}