import { useEffect, useState } from "react";
import { localSoilName, moistureClass } from "./soilNames.js";
import SoilCrosscheck from "./SoilCrosscheck.jsx";
import Info from "./Info.jsx";
import { loadSecondMap, lookupSecond, compareSoil, GROUP } from "./soilcheck.js";
import { SOIL_TYPES } from "./soil.js";
import "./soilpage.css";
import "./soil2.css";
import "./weatherfarmer.css";

// The Soil page: soil type with how sure the map is, local name, satellite wetness and fertility.
export default function Soil({ t, lang, lat, lon, country, initial, satellite, onGo, chosen, suggested, onFieldChange }) {
  const fill = (text, v) => Object.keys(v).reduce((a, k) => a.split(`{${k}}`).join(v[k]), text);
  const [state, setState] = useState(initial ? "ok" : "loading");
  const [data, setData] = useState(initial || null);
  const [attempt, setAttempt] = useState(0);
  const [second, setSecond] = useState(null); // the second soil map (Bangladesh only)
  useEffect(() => {
    let cancelled = false;
    if (country !== "BD") return undefined;
    loadSecondMap().then((m) => { if (!cancelled) setSecond(m || null); });
    return () => { cancelled = true; };
  }, [country]);

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
        <h2 className="sr-only">{t.soilPageTitle}</h2>
        <p className="muted">{t.soilLoading}</p>
      </div>
    );
  }
  if (state === "error" || !data) {
    return (
      <div className="viewer soilpage">
        <h2 className="sr-only">{t.soilPageTitle}</h2>
        <p className="warn-soft">{t.soilFailed}</p>
        <button className="btn" onClick={() => setAttempt((n) => n + 1)}>{t.soilRetry}</button>
      </div>
    );
  }
  if (!data.available) {
    return (
      <div className="viewer soilpage">
        <h2 className="sr-only">{t.soilPageTitle}</h2>
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
  const verdict = country === "BD" && tex && second ? compareSoil({ name: tex.class, group: GROUP[tex.class] || tex.group }, lookupSecond(second, lat, lon)) : null;
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

  const tone = tex ? { sandy: ["#e0c58a", "#bf9d5c", "#8f7440"], sandyLoam: ["#c9a56d", "#a3834f", "#6e8aa5"], loam: ["#8a6038", "#6f4c2c", "#4a617a"], siltLoam: ["#9a8466", "#7a6850", "#4a617a"], clayLoam: ["#6e4a30", "#8a5f38", "#4b5f7a"], clay: ["#6a3f2e", "#7e4e35", "#475b78"] }[tex.simple] || ["#6e4a30", "#8a5f38", "#4b5f7a"] : null;
  const sentences = (x) => String(x || "").split(/(?<=[.।])\s+/).filter(Boolean);
  const gauge = (v, max) => `${Math.max(2, Math.min(98, (v / max) * 100))}%`;
  const place = (cls, order) => { const i = order.indexOf(cls); return i < 0 ? null : `${((i + 0.5) / order.length) * 100}%`; };
  const pickSoil = (e) => { if (onFieldChange) onFieldChange({ soil: e.target.value }); };
  const soilSel = chosen || "";

  const fert = [
    top.phh2o != null && { k: "ph", name: t.sPh, big: num(top.phh2o, 1), pos: gauge(top.phh2o - 4, 5), cls: classes.ph, word: t.sPhClass[classes.ph], mean: t.sPhMean[classes.ph], rng: range("phh2o", 1), good: ["slightAcid", "neutral"].includes(classes.ph) },
    top.soc != null && { k: "carbon", name: t.sCarbon, big: t.sLevel[classes.carbon], small: `${num(top.soc, 1)} g/kg`, pos: place(classes.carbon, ["low", "moderate", "good", "rich"]), word: t.sLevel[classes.carbon], mean: t.sCarbonMean[classes.carbon], rng: range("soc", 0), good: ["good", "rich"].includes(classes.carbon) },
    top.nitrogen != null && { k: "n", name: t.sNitrogen, big: t.sLevel[classes.nitrogen], small: `${num(top.nitrogen, 2)} g/kg`, pos: place(classes.nitrogen, ["low", "moderate", "good"]), word: t.sLevel[classes.nitrogen], mean: t.sNitrogenMean[classes.nitrogen], good: classes.nitrogen === "good" },
    top.cec != null && { k: "cec", name: t.sCec, big: t.sLevel[classes.cec], small: `${num(top.cec, 0)} cmol/kg`, pos: place(classes.cec, ["low", "medium", "high"]), word: t.sLevel[classes.cec], mean: t.sCecMean[classes.cec], good: classes.cec === "high" },
  ].filter(Boolean);

  return (
    <div className="viewer soilpage so2">
      <h2 className="sr-only">{t.soilPageTitle}</h2>

      <section className="so2-hero">
        {tex && (
          <svg className="so2-block" viewBox="0 0 380 260" role="img" aria-label={t.soilNames[tex.simple]}>
            <g transform="translate(60 14)">
              <polygon points="130,0 260,64 130,128 0,64" fill="#5fcf7c" />
              <polygon points="0,64 130,128 130,160 0,96" fill={tone[0]} /><polygon points="260,64 130,128 130,160 260,96" fill={tone[0]} opacity="0.78" />
              <polygon points="0,96 130,160 130,200 0,136" fill={tone[1]} /><polygon points="260,96 130,160 130,200 260,136" fill={tone[1]} opacity="0.78" />
              <polygon points="0,136 130,200 130,232 0,168" fill={tone[2]} /><polygon points="260,136 130,200 130,232 260,168" fill={tone[2]} opacity="0.78" />
              <g stroke="#2e9d5a" strokeWidth="4" strokeLinecap="round"><line x1="70" y1="40" x2="170" y2="88" /><line x1="104" y1="22" x2="204" y2="70" /><line x1="140" y1="12" x2="226" y2="54" /></g>
            </g>
            <g fill="currentColor" fontSize="13" fontWeight="700"><text x="0" y="116">{t.orbSoTop}</text><text x="0" y="170">{t.orbSoSub}</text><text x="0" y="222">{t.orbSoDeep}</text></g>
            <g fill="currentColor" fontSize="11" opacity="0.8"><text x="326" y="100">0–15 cm</text><text x="326" y="152">15–60</text><text x="326" y="204">60+</text></g>
          </svg>
        )}
        <div className="so2-hero-txt">
          {tex ? (
            <>
              <p className="so2-eyebrow">{t.orbSoProbably}</p>
              <h3>{t.soilNames[tex.simple]}</h3>
              <p className="so2-desc">{t.orbSoDesc[tex.simple]}</p>
              <p className="small muted">
                {t.sTexLikely}: {t.sTexClassNames[tex.class] || tex.class}
                {local && <> · {t.sTexLocal} ({local.language}): <strong lang={country === "BD" ? "bn" : undefined}>{local.name}</strong></>}
              </p>
            </>
          ) : <p className="muted">{t.soilPageIntro}</p>}
          <div className="so2-pills">
            {tex && tex.groupConfidence != null && <span className={`so2-pill ${tex.confidenceLevel || ""}`}>{fill(t.orbSure, { n: num(tex.groupConfidence) })}</span>}
            <span className="so2-pill soft">{t.orbSoEstimate}</span>
          </div>
          <label className="so2-know">
            <span>{t.orbSoKnow}</span>
            <select id="so2-pick" value={soilSel} onChange={pickSoil} disabled={!onFieldChange}>
              <option value="">{tex ? fill(t.orbSoUse, { n: t.soilNames[tex.simple].toLowerCase() }) : t.orbSoKnow}</option>
              {SOIL_TYPES.map((k) => <option key={k} value={k}>{t.soilNames[k]}</option>)}
            </select>
          </label>
        </div>
      </section>

      <div className="so2-trio">
        {tex && (
          <section className="so2-card">
            <h3>{t.orbSoMade}</h3>
            <div className="soil-bar so2-bar" role="img" aria-label={`${t.sTexSand} ${tex.sand}%, ${t.sTexSilt} ${tex.silt}%, ${t.sTexClay} ${tex.clay}%`}>
              <span style={{ width: `${tex.sand}%`, background: "#e0bf7e" }}>{tex.sand >= 12 ? `${num(tex.sand)}%` : ""}</span>
              <span style={{ width: `${tex.silt}%`, background: "#a9c0b0" }}>{tex.silt >= 12 ? `${num(tex.silt)}%` : ""}</span>
              <span style={{ width: `${tex.clay}%`, background: "#c9846a" }}>{tex.clay >= 12 ? `${num(tex.clay)}%` : ""}</span>
            </div>
            <p className="so2-legend">
              <span><i style={{ background: "#e0bf7e" }} />{t.orbSoSand}</span>
              <span><i style={{ background: "#a9c0b0" }} />{t.orbSoSilt}</span>
              <span><i style={{ background: "#c9846a" }} />{t.orbSoClay}</span>
            </p>
            {ranges.clay && ranges.sand && (
              <p className="small muted">{t.sRange}: {t.sTexClay} {num(ranges.clay[0])}–{num(ranges.clay[1])}% · {t.sTexSand} {num(ranges.sand[0])}–{num(ranges.sand[1])}%</p>
            )}
          </section>
        )}

        {tex && tex.groupConfidence != null && (
          <section className="so2-card">
            <h3>{t.sTexConf}</h3>
            <div className="so2-meter conf" role="img" aria-label={`${num(tex.groupConfidence)}%`}><i style={{ width: `${tex.groupConfidence}%` }} /></div>
            {verdict === "agree" && tex.confidenceLevel === "low" ? (
              <p className="small">{t.sxAgreeConf}</p>
            ) : (
              <p className="so2-line"><strong className={`soil-conf ${tex.confidenceLevel}`}>{confWord}</strong> {t.sTexGroupLine} <strong>{groupWord}</strong>: <strong>{num(tex.groupConfidence)}%</strong></p>
            )}
            {tex.alternatives && tex.alternatives.length > 0 && (
              <ul className="soil-alts">
                {tex.alternatives.map((a) => (
                  <li key={a.name}>
                    <span>{t.sTexClassNames[a.name] || a.name}</span>
                    <span className="alt-bar"><i style={{ width: `${a.share}%` }} /></span>
                    <span>{num(a.share)}%</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="small muted"><Info t={t} source="SoilGrids"><span>{t.sTexConfWhy}</span></Info></p>
          </section>
        )}

        <section className="so2-card">
          <h3>{t.sMoistTitle}<Info t={t} source="NASA SMAP"><span>{t.sMoistHow}</span></Info></h3>
          {surface || root ? (
            <div className="so2-wet">
              {[[t.sMoistSurface, surface, satellite.soilSurface], [t.sMoistRoot, root, satellite.soilRoot]].map(([label, m, raw]) =>
                m ? (
                  <div key={label}>
                    <p className="so2-wetlabel"><span>{label}</span><b>{num(raw.volumetric * 100)}%</b></p>
                    <div className="so2-meter wet"><u style={{ left: { dry: "11%", moist: "37%", nearFull: "65%", wet: "89%" }[m.key] }} /></div>
                    <p className="so2-scale"><span>{t.orbSoDry}</span><span>{t.orbSoMoist}</span><span>{t.orbSoAlmost}</span><span>{t.orbSoWaterlogged}</span></p>
                    <p className="soil-sentence">{m.text}</p>
                    <p className="small muted">{raw.date}</p>
                  </div>
                ) : null,
              )}
            </div>
          ) : (
            <p className="muted">{t.sMoistNone}</p>
          )}
          {root && (
            <div className="wf-actions">
              <button className="tab" onClick={() => onGo && onGo("weather")}>{t.wfSoilGoWeather} →</button>
              <button className="tab so2-go" onClick={() => onGo && onGo("irrigation")}>{t.wfGoIrr} →</button>
            </div>
          )}
        </section>
      </div>

      <SoilCrosscheck t={t} lang={lang} lat={lat} lon={lon} country={country} tex={tex} compact />

      <h3 className="so2-h">{t.orbSoFert}</h3>
      <div className="so2-fert">
        {fert.map((f) => (
          <article key={f.k} className="so2-card so2-f">
            <p className="so2-fname">{f.name}</p>
            <p className="so2-fbig">{f.big}{f.small && <small> {f.small}</small>}</p>
            <div className="so2-meter fert">{f.pos && <u style={{ left: f.pos }} />}</div>
            <p className={`so2-fword ${f.good ? "good" : "mid"}`}>{f.word}</p>
            <p className="small muted">{f.mean}</p>
            {f.rng && <p className="small muted">{f.rng}</p>}
          </article>
        ))}
      </div>
      <p className="small muted so2-fsrc">{t.sxFertSource}</p>

      <div className="so2-two">
        {tex && (
          <section className="so2-card so2-means">
            <h3>{t.orbSoMeans}</h3>
            <ul>
              <li>{t.sAdvice[tex.simple]}</li>
              {root && <li>{t[`wfSoilDo_${root.key}`]}</li>}
              {chosen && chosen !== tex.simple && <li>{t.soilPickNote}</li>}
            </ul>
          </section>
        )}
        <section className="so2-card">
          <h3>{t.orbSoTest}</h3>
          <p>{t.sTest}</p>
          <button type="button" className="tab" onClick={() => { const el = document.getElementById("so2-pick"); if (el) { el.scrollIntoView({ block: "center", behavior: "smooth" }); el.focus(); } }}>{t.orbSoMine}</button>
        </section>
      </div>

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
