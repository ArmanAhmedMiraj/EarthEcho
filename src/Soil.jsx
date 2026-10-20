import { useEffect, useState } from "react";
import { localSoilName, moistureClass } from "./soilNames.js";
import "./soilpage.css";

function Droplet({ level }) {
  // level 0 to 1: how full the drop is
  const top = 28 - level * 22;
  return (
    <svg className="drop" viewBox="0 0 24 32" width="46" height="60" aria-hidden="true">
      <defs>
        <clipPath id="dropclip">
          <path d="M12 2 C12 2 3 13 3 20 a9 9 0 0 0 18 0 C21 13 12 2 12 2Z" />
        </clipPath>
      </defs>
      <path d="M12 2 C12 2 3 13 3 20 a9 9 0 0 0 18 0 C21 13 12 2 12 2Z" fill="none" stroke="var(--accent)" strokeWidth="1.6" />
      <rect x="0" y={top} width="24" height="32" fill="#3a8fd9" opacity="0.85" clipPath="url(#dropclip)" />
    </svg>
  );
}

const LEVEL = { dry: 0.12, moist: 0.45, nearFull: 0.8, wet: 1 };

// The Soil page: soil type with how sure the map is, local name, satellite wetness and fertility.
export default function Soil({ t, lang, lat, lon, country, initial, satellite, chosen, suggested }) {
  const [state, setState] = useState(initial ? "ok" : "loading");
  const [data, setData] = useState(initial || null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (initial && attempt === 0) return undefined;
    let cancelled = false;
    setState("loading");
    fetch(`/api/soil?lat=${lat}&lon=${lon}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setState(d.ok ? "ok" : "error");
      })
      .catch(() => {
        if (!cancelled) setState("error");
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lon, attempt]);

  const locale = lang === "bn" ? "bn-BD" : "en-GB";
  const num = (v, d = 0) => new Intl.NumberFormat(locale, { maximumFractionDigits: d, minimumFractionDigits: d }).format(v);

  if (state === "loading") {
    return (
      <div className="viewer soilpage">
        <h2>{t.soilPageTitle}</h2>
        <p className="muted">{t.soilLoading}</p>
      </div>
    );
  }
  if (state === "error" || !data) {
    return (
      <div className="viewer soilpage">
        <h2>{t.soilPageTitle}</h2>
        <p className="warn-soft">{t.soilFailed}</p>
        <button className="btn" onClick={() => setAttempt((n) => n + 1)}>{t.soilRetry}</button>
      </div>
    );
  }
  if (!data.available) {
    return (
      <div className="viewer soilpage">
        <h2>{t.soilPageTitle}</h2>
        <p className="muted">{t.soilNone}</p>
        <button className="btn" onClick={() => setAttempt((n) => n + 1)}>{t.soilRetry}</button>
      </div>
    );
  }

  const tex = data.texture;
  const top = data.topsoil;
  const ranges = data.intervals || {};
  const classes = data.classes || {};
  const prov = data.provenance || {};
  const local = tex && !(lang === "bn" && country === "BD") ? localSoilName(country, tex.simple) : null;
  const confWord = tex && tex.confidenceLevel ? { high: t.confHigh, medium: t.confMedium, low: t.confLow }[tex.confidenceLevel] : null;
  const groupWord = tex ? { fine: t.sTexGroupFine, medium: t.sTexGroupMedium, coarse: t.sTexGroupCoarse }[tex.group] : "";

  // wetness for the soil type the map found (or, failing that, the one in use)
  const simple = tex ? tex.simple : suggested || "loam";
  const moist = (v) => {
    const key = moistureClass(v, simple);
    return key ? { key, text: { dry: t.sMoistDry, moist: t.sMoistMoist, nearFull: t.sMoistNearFull, wet: t.sMoistWet }[key] } : null;
  };
  const surface = satellite && satellite.soilSurface ? moist(satellite.soilSurface.volumetric) : null;
  const root = satellite && satellite.soilRoot ? moist(satellite.soilRoot.volumetric) : null;

  const range = (key, digits) => (ranges[key] ? `${t.sRange}: ${num(ranges[key][0], digits)} – ${num(ranges[key][1], digits)}` : null);

  return (
    <div className="viewer soilpage">
      <h2>{t.soilPageTitle}</h2>
      <p className="muted">{t.soilPageIntro}</p>

      <div className="soil-grid">
        {tex && (
          <section className="soil-card">
            <h3>{t.sTexTitle}</h3>
            <p className="soil-big">{t.soilNames[tex.simple]}</p>
            <p className="small muted">
              {t.sTexLikely}: {t.sTexClassNames[tex.class] || tex.class}
            </p>
            {local && (
              <p className="soil-local">
                {t.sTexLocal} ({local.language}): <strong lang={country === "BD" ? "bn" : undefined}>{local.name}</strong>
                <span className="small muted"> · {t.sTexLocalNote}</span>
              </p>
            )}
            <p className="small muted">{t.sTexBars}</p>
            <div className="soil-bar" role="img" aria-label={`${t.sTexSand} ${tex.sand}%, ${t.sTexSilt} ${tex.silt}%, ${t.sTexClay} ${tex.clay}%`}>
              <span style={{ width: `${tex.sand}%`, background: "#d9b36a" }}>{tex.sand >= 12 ? `${num(tex.sand)}%` : ""}</span>
              <span style={{ width: `${tex.silt}%`, background: "#9bb3a1" }}>{tex.silt >= 12 ? `${num(tex.silt)}%` : ""}</span>
              <span style={{ width: `${tex.clay}%`, background: "#b4684c" }}>{tex.clay >= 12 ? `${num(tex.clay)}%` : ""}</span>
            </div>
            <p className="soil-legend small">
              <span><i style={{ background: "#d9b36a" }} /> {t.sTexSand}</span>
              <span><i style={{ background: "#9bb3a1" }} /> {t.sTexSilt}</span>
              <span><i style={{ background: "#b4684c" }} /> {t.sTexClay}</span>
            </p>
            {ranges.clay && ranges.sand && (
              <p className="small muted">
                {t.sRange}: {t.sTexClay} {num(ranges.clay[0])}–{num(ranges.clay[1])}% · {t.sTexSand} {num(ranges.sand[0])}–{num(ranges.sand[1])}%
              </p>
            )}
          </section>
        )}

        {tex && tex.groupConfidence != null && (
          <section className="soil-card">
            <h3>{t.sTexConf}</h3>
            <p className={`soil-conf ${tex.confidenceLevel}`}>{confWord}</p>
            <p className="soil-sentence">
              {t.sTexGroupLine} <strong>{groupWord}</strong>: <strong>{num(tex.groupConfidence)}%</strong>
            </p>
            {tex.alternatives && tex.alternatives.length > 0 && (
              <>
                <p className="small muted">{t.sTexOthers}</p>
                <ul className="soil-alts">
                  {tex.alternatives.map((a) => (
                    <li key={a.name}>
                      <span>{t.sTexClassNames[a.name] || a.name}</span>
                      <span className="alt-bar"><i style={{ width: `${a.share}%` }} /></span>
                      <span>{num(a.share)}%</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <p className="small muted">{t.sTexConfWhy}</p>
          </section>
        )}

        <section className="soil-card">
          <h3>{t.sMoistTitle}</h3>
          {surface || root ? (
            <div className="moist-row">
              {[[t.sMoistSurface, surface, satellite.soilSurface], [t.sMoistRoot, root, satellite.soilRoot]].map(([label, m, raw]) =>
                m ? (
                  <div key={label} className="moist">
                    <Droplet level={LEVEL[m.key]} />
                    <div>
                      <strong>{label}</strong>
                      <p className="soil-sentence">{m.text}</p>
                      <p className="small muted">{num(raw.volumetric * 100)}% · {raw.date}</p>
                    </div>
                  </div>
                ) : null,
              )}
            </div>
          ) : (
            <p className="muted">{t.sMoistNone}</p>
          )}
          <p className="small muted">{t.sMoistHow}</p>
        </section>
      </div>

      <section className="soil-card soil-wide">
        <h3>{t.sFertTitle}</h3>
        <div className="fert-grid">
          {top.phh2o != null && (
            <div className="fert">
              <p className="fert-name">{t.sPh}</p>
              <p className="soil-big">{num(top.phh2o, 1)}</p>
              <p><strong>{t.sPhClass[classes.ph]}</strong></p>
              <p className="small muted">{t.sPhMean[classes.ph]}</p>
              {range("phh2o", 1) && <p className="small muted">{range("phh2o", 1)}</p>}
            </div>
          )}
          {top.soc != null && (
            <div className="fert">
              <p className="fert-name">{t.sCarbon}</p>
              <p className="soil-big">{num(top.soc, 1)} <small>g/kg</small></p>
              <p><strong>{t.sLevel[classes.carbon]}</strong></p>
              <p className="small muted">{t.sCarbonMean[classes.carbon]}</p>
              {range("soc", 0) && <p className="small muted">{range("soc", 0)}</p>}
            </div>
          )}
          {top.nitrogen != null && (
            <div className="fert">
              <p className="fert-name">{t.sNitrogen}</p>
              <p className="soil-big">{num(top.nitrogen, 2)} <small>g/kg</small></p>
              <p><strong>{t.sLevel[classes.nitrogen]}</strong></p>
              <p className="small muted">{t.sNitrogenMean[classes.nitrogen]}</p>
            </div>
          )}
          {top.cec != null && (
            <div className="fert">
              <p className="fert-name">{t.sCec}</p>
              <p className="soil-big">{num(top.cec, 0)} <small>cmol/kg</small></p>
              <p><strong>{t.sLevel[classes.cec]}</strong></p>
              <p className="small muted">{t.sCecMean[classes.cec]}</p>
            </div>
          )}
        </div>
      </section>

      {tex && (
        <section className="soil-card soil-wide">
          <h3>{t.sAdviceTitle}</h3>
          <p className="soil-sentence">{t.sAdvice[tex.simple]}</p>
          {chosen && chosen !== tex.simple && <p className="small muted">{t.soilPickNote}</p>}
          <h4>{t.sTestTitle}</h4>
          <p className="small muted">{t.sTest}</p>
        </section>
      )}

      <p className="env-source small">
        {t.sSourceLabel}: <a href={prov.url} target="_blank" rel="noreferrer">{prov.name}</a> · {prov.publisher} · {prov.licence} · {prov.resolution}
        <br />
        {t.sMethod}
        <br />
        {t.sNote}
        {data.widened ? ` ${t.sWidened}` : ""}
      </p>
    </div>
  );
}
