import { Fragment, useEffect, useMemo, useState } from "react";
import { GROUPS, SOURCES } from "./dataCatalogue.js";
import "./data2.css";

// The Data page: where every number comes from. Live NASA readings, the satellites, how to read them, then every source.
export default function Sources({ t, lang, lat, lon }) {
  const [live, setLive] = useState({ state: "loading", data: null });
  const [sat, setSat] = useState({ state: "loading", data: null });
  const [group, setGroup] = useState("nasa");
  const [status, setStatus] = useState("all");
  const [open, setOpen] = useState(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLive({ state: "loading", data: null });
    fetch(`/api/power-daily?lat=${lat}&lon=${lon}&days=14`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data) => { if (!cancelled) setLive({ state: data.ok ? "ok" : "error", data }); })
      .catch(() => { if (!cancelled) setLive({ state: "error", data: null }); });
    return () => { cancelled = true; };
  }, [lat, lon]);

  useEffect(() => {
    let cancelled = false;
    setSat({ state: "loading", data: null });
    fetch(`/api/satellite?lat=${lat}&lon=${lon}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data) => { if (!cancelled) setSat({ state: data.ok ? "ok" : "error", data }); })
      .catch(() => { if (!cancelled) setSat({ state: "error", data: null }); });
    return () => { cancelled = true; };
  }, [lat, lon]);

  const locale = lang === "bn" ? "bn-BD" : "en-GB";
  const whole = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const one = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const day = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" });
  const clock = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  const pct = (v) => (v == null ? t.liveNoData : `${whole.format(v)}%`);
  const daysOld = (iso) => Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 86400000));
  const waterPct = (v) => whole.format(v * 100);

  const data = live.data;
  const satData = sat.data;
  const latest = useMemo(() => {
    const rows = (data && data.days) || [];
    for (let i = rows.length - 1; i >= 0; i -= 1) if (rows[i].tmax != null) return rows[i];
    return null;
  }, [data]);

  const words = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return t.glossary.filter((g) => !needle || g.term.toLowerCase().includes(needle) || g.def.toLowerCase().includes(needle));
  }, [q, t.glossary]);

  const liveCount = SOURCES.filter((s) => s.status === "live").length;
  const rows = SOURCES.filter((s) => s.group === group && (status === "all" || s.status === status));
  const list = (items) => <ul>{items.map((x) => <li key={x}>{x}</li>)}</ul>;
  const go = (tab) => { window.location.hash = `/${tab}`; };

  const readings = {
    smap: satData && satData.soilSurface
      ? `${t.orbDaSmapNow(waterPct(satData.soilSurface.volumetric))} · ${day.format(new Date(satData.soilSurface.date))} (${t.satDaysOld(daysOld(satData.soilSurface.date))})`
      : sat.state === "ok" ? t.satNoSoil : null,
    gpm: satData && satData.rainNow
      ? `${t.satRain}: ${satData.rainNow.rateMmHr === 0 ? t.satRainNone : `${satData.rainNow.rateMmHr} mm/hr`}`
      : null,
    power: data && data.summary && data.summary.latestSoilDate
      ? `${t.liveAsOf}: ${day.format(new Date(data.summary.latestSoilDate))}`
      : null,
  };

  return (
    <div className="viewer da">
      <h2 className="sr-only">{t.dataTitle}</h2>

      <section className="da-hero">
        <div className="da-hero-text">
          <h3>{t.orbDaTitle}</h3>
          <p>{t.orbDaIntro}</p>
          {live.state === "loading" && <p className="da-note">{t.liveLoading}</p>}
          {live.state === "error" && <p className="da-note warn">{t.liveError}</p>}
          {live.state === "ok" && data && (
            <>
              <div className="da-tiles">
                <div><span>{t.orbDaHot}</span><strong>{latest ? `${whole.format(latest.tmax)}°` : "–"}</strong></div>
                <div><span>{t.orbDaCold}</span><strong>{latest ? `${whole.format(latest.tmin)}°` : "–"}</strong></div>
                <div><span>{t.orbDaRain}</span><strong>{latest && latest.rainMm != null ? `${one.format(latest.rainMm)} mm` : "–"}</strong></div>
                <div><span>{t.orbDaSun}</span><strong>{latest && latest.solarKwhM2 != null ? `${one.format(latest.solarKwhM2)} kWh/m²` : "–"}</strong></div>
              </div>
              <div className="da-tiles da-tiles2">
                <div><span>{t.liveSurface}</span><strong>{pct(data.summary.soilTopPct)}</strong></div>
                <div><span>{t.liveRoot}</span><strong>{pct(data.summary.soilRootPct)}</strong></div>
                <div><span>{t.liveRain7}</span><strong>{whole.format(data.summary.rain7Mm)} mm</strong></div>
              </div>
              <p className="da-note">
                {t.orbDaLive(latest ? day.format(new Date(latest.date)) : "–")} ·{" "}
                {t.liveSource}: <a href={data.provenance.url} target="_blank" rel="noreferrer">{data.provenance.name}</a> ·{" "}
                {t.liveResolution}: {data.provenance.resolution} · {t.liveFetched}: {clock.format(new Date(data.provenance.fetchedAt))}
              </p>
              <p className="da-note">{t.liveCaution}</p>
            </>
          )}
        </div>
        <div className="da-orbit" aria-hidden="true">
          <svg viewBox="0 0 420 300">
            <ellipse cx="210" cy="150" rx="96" ry="96" fill="none" stroke="#f6cf6a" strokeWidth="1.2" strokeDasharray="2 6" />
            <ellipse cx="210" cy="150" rx="132" ry="132" fill="none" stroke="#7fb2ff" strokeWidth="1.2" strokeDasharray="2 6" />
            <ellipse cx="210" cy="150" rx="168" ry="168" fill="none" stroke="#3ddbc0" strokeWidth="1.2" strokeDasharray="2 6" />
            <circle cx="210" cy="150" r="58" fill="#2f7de0" />
            <path d="M192 130c14-12 40-10 48 6-16 8-34 12-48-6z" fill="#5fcf7c" />
            <path d="M200 176c10-6 24-4 28 6-10 6-22 6-28-6z" fill="#5fcf7c" />
            <rect x="-9" y="-5" width="18" height="10" rx="2" fill="#f6cf6a"><animateMotion dur="20s" repeatCount="indefinite" path="M 306 150 A 96 96 0 1 1 114 150 A 96 96 0 1 1 306 150" /></rect>
            <rect x="-9" y="-5" width="18" height="10" rx="2" fill="#7fb2ff"><animateMotion dur="30s" repeatCount="indefinite" path="M 342 150 A 132 132 0 1 0 78 150 A 132 132 0 1 0 342 150" /></rect>
            <rect x="-9" y="-5" width="18" height="10" rx="2" fill="#3ddbc0"><animateMotion dur="40s" repeatCount="indefinite" path="M 378 150 A 168 168 0 1 1 42 150 A 168 168 0 1 1 378 150" /></rect>
          </svg>
        </div>
      </section>

      <h3 className="da-h">{t.satTitle}</h3>
      {sat.state === "error" && <p className="da-note warn">{t.satError}</p>}
      <div className="da-sats">
        {t.orbDaSats.map((s) => (
          <article key={s.id} className={`da-sat ${s.id}`}>
            <h4>{s.name}</h4>
            <p>{s.what}</p>
            <p className="da-cover">{t.orbDaCovers} <b>{s.size}</b> · {t.orbDaNew} <b>{s.every}</b></p>
            {readings[s.id] && <p className="da-reading">{readings[s.id]}</p>}
            <p className="da-used">
              {t.orbDaUsedOn}{" "}
              {s.used.map(([label, tab], i) => (
                <Fragment key={tab}>{i > 0 && ", "}<a href={`#/${tab}`} onClick={(e) => { e.preventDefault(); go(tab); }}>{label}</a></Fragment>
              ))}
            </p>
          </article>
        ))}
      </div>
      {sat.state === "ok" && satData && satData.soilSurface && (
        <p className="da-note">{satData.provenance.soil.name}, {satData.provenance.soil.resolution} · {t.satRead} · {t.satRounded}. {t.satRainNote}</p>
      )}

      <div className="da-learn">
        <section className="da-card">
          <h3>{t.lnSatTitle}</h3>
          <div className="da-three">
            <div className="good"><h4>{t.lnSatSee}</h4>{list(t.lnSatSeeList)}</div>
            <div className="miss"><h4>{t.lnSatMiss}</h4>{list(t.lnSatMissList)}</div>
            <div className="gnd"><h4>{t.lnSatGround}</h4>{list(t.lnSatGroundList)}</div>
          </div>
          <p className="da-rule">{t.lnSatRule}</p>
          <h4 className="da-sub">{t.lnScaleTitle}</h4>
          <div className="da-scale" role="img" aria-label={t.lnScaleAria}>
            <figure><i className="s1" /><figcaption>{t.orbDaScale[0]}</figcaption></figure>
            <figure><i className="s2" /><figcaption>{t.orbDaScale[1]}</figcaption></figure>
            <figure><i className="s3" /><figcaption>{t.orbDaScale[2]}</figcaption></figure>
            <p>{t.orbDaScaleNote}</p>
          </div>
        </section>
        <section className="da-card da-words">
          <h3>{t.orbDaWords(words.length)}</h3>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.lnSearch} aria-label={t.lnSearch} />
          {words.length === 0 && <p className="da-note">{t.lnNone}</p>}
          <dl>
            {words.map((g) => (<div key={g.term}><dt>{g.term}</dt><dd>{g.def}</dd></div>))}
          </dl>
        </section>
      </div>

      <section className="da-card da-table-card">
        <div className="da-table-head">
          <h3>{t.catalogueTitle}</h3>
          <div className="da-tabs" role="tablist">
            {GROUPS.map((g) => (
              <button key={g.id} role="tab" aria-selected={group === g.id} onClick={() => { setGroup(g.id); setOpen(null); }}>{g[lang] || g.en}</button>
            ))}
          </div>
        </div>
        <div className="da-filter">
          <span>{t.countLine(SOURCES.length, liveCount)}</span>
          <div role="group">
            {[["all", t.filterAll], ["live", t.filterLive], ["planned", t.filterPlanned]].map(([id, label]) => (
              <button key={id} aria-pressed={status === id} onClick={() => { setStatus(id); setOpen(null); }}>{label}</button>
            ))}
          </div>
        </div>
        <div className="da-table" role="table">
          <div className="da-tr da-th" role="row">
            <span>{t.orbDaColSource}</span><span>{t.orbDaColUse}</span><span>{t.resolution}</span><span>{t.licence}</span>
          </div>
          {rows.length === 0 && <p className="da-note">{t.lnNone}</p>}
          {rows.map((raw) => {
            const s = { ...raw, ...(raw[lang] || raw.en) };
            const isOpen = open === s.id;
            return (
              <div key={s.id} className={`da-row${isOpen ? " open" : ""}`}>
                <button className="da-tr" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : s.id)}>
                  <b>{s.name}</b>
                  <span className="da-use">{s.provides}</span>
                  <span>{s.resolution}</span>
                  <span className={s.licenceChecked ? "ok" : "gold"}>{s.licenceChecked ? t.orbDaOpenFree : t.orbDaNotChecked}</span>
                </button>
                {isOpen && (
                  <div className="da-detail">
                    <p className="da-pub">{s.publisher} · <span className={`da-badge ${s.status}`}>{s.status === "live" ? t.statusLive : t.statusPlanned}</span></p>
                    <dl>
                      <dt>{t.provides}</dt><dd>{s.provides}</dd>
                      <dt>{t.updates}</dt><dd>{s.update}</dd>
                      <dt>{t.licence}</dt><dd>{s.licence}{!s.licenceChecked && <em> · {t.licenceUnchecked}</em>}</dd>
                      <dt>{t.access}</dt><dd>{s.access}</dd>
                      <dt>{t.limits}</dt><dd>{s.limit}</dd>
                    </dl>
                    <a href={s.url} target="_blank" rel="noreferrer">{t.open} ↗</a>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <p className="da-note">{t.orbDaFoot}</p>
      </section>
    </div>
  );
}
