import { useMemo, useState } from "react";
import {
  CROPS,
  MONTHS,
  SLOTS,
  SOURCES,
  isCoastalDistrict,
  nextStep,
  nowPosition,
  rankRotations,
  segmentsOf,
  soilClass,
  whenLabel,
} from "./crops.js";

const say = (obj, lang) => (obj ? obj[lang] || obj.en : "");

// Puts each piece on a 48-column grid (quarter months) and stops pieces from overlapping by rounding.
function layout(segs) {
  const sorted = [...segs].sort((x, y) => x.a - y.a);
  let used = 1;
  return sorted.map((s) => {
    const c1 = Math.min(Math.max(Math.round(s.a * 2) + 1, used), 48);
    const c2 = Math.min(Math.max(Math.round(s.b * 2) + 1, c1 + 1), 49);
    used = c2;
    return { ...s, c1, c2 };
  });
}

function Timeline({ rotation, lang, t, now }) {
  const segs = layout(segmentsOf(rotation));
  return (
    <div className="tl-scroll">
      <div className="tl">
        <div className="tl-months" aria-hidden="true">
          {MONTHS[lang].map((m) => (
            <span key={m}>{m}</span>
          ))}
        </div>
        <div className="tl-lane">
          {segs.map((s, i) => {
            const isFallow = s.kind === "fallow";
            const crop = isFallow ? null : CROPS[s.crop];
            const classes = ["tl-bar", s.kind, s.cutLeft ? "cut-left" : "", s.cutRight ? "cut-right" : ""]
              .filter(Boolean)
              .join(" ");
            return (
              <div
                key={i}
                className={classes}
                data-crop={isFallow ? "fallow" : s.crop}
                style={{ gridColumn: `${s.c1} / ${s.c2}` }}
                title={isFallow ? t.cropFallow : `${say(crop.name, lang)} · ~${crop.days} ${t.cropDays}`}
              >
                {s.c2 - s.c1 >= 5 ? (isFallow ? t.cropFallow : say(crop.short, lang)) : ""}
              </div>
            );
          })}
          <i className="tl-now" style={{ left: `${(now / SLOTS) * 100}%` }} title={t.cropToday} />
        </div>
      </div>
    </div>
  );
}

export default function Crops({ t, lang, districtName, soil, soilLabel }) {
  const [land, setLand] = useState("medium");
  const [water, setWater] = useState("yes");
  const [salt, setSalt] = useState("auto");

  const coastal = isCoastalDistrict(districtName);
  const saltOn = salt === "yes" || (salt === "auto" && coastal);
  const soilKind = soilClass(soil);
  const now = nowPosition();

  const ranked = useMemo(
    () => rankRotations({ land, irrigation: water === "yes", salt: saltOn, soil: soilKind }).slice(0, 3),
    [land, water, saltOn, soilKind]
  );
  const rankWords = [t.cropRank1, t.cropRank2, t.cropRank3];
  const number = (n) => n.toLocaleString(lang === "bn" ? "bn-BD" : "en-US");

  return (
    <section className="crops">
      <h2>{t.cropTitle}</h2>
      <p className="muted small">{t.cropIntro}</p>

      <div className="crops-form">
        <label>
          {t.cropLand}
          <select className="wide-select" value={land} onChange={(e) => setLand(e.target.value)}>
            <option value="high">{t.cropLandHigh}</option>
            <option value="medium">{t.cropLandMedium}</option>
            <option value="low">{t.cropLandLow}</option>
          </select>
        </label>
        <label>
          {t.cropWater}
          <select className="wide-select" value={water} onChange={(e) => setWater(e.target.value)}>
            <option value="yes">{t.cropWaterYes}</option>
            <option value="no">{t.cropWaterNo}</option>
          </select>
        </label>
        <label>
          {t.cropSalt}
          <select className="wide-select" value={salt} onChange={(e) => setSalt(e.target.value)}>
            <option value="auto">{t.cropSaltAuto}</option>
            <option value="no">{t.cropSaltNo}</option>
            <option value="yes">{t.cropSaltYes}</option>
          </select>
        </label>
      </div>
      <p className="muted small">
        {t.cropSoilUsed}: {soilLabel || "—"}
        {salt === "auto" && coastal ? ` · ${t.cropSaltAutoNote}` : ""}
      </p>

      {ranked.map((r, i) => {
        const nx = nextStep(r.rotation, now);
        const when = whenLabel(nx.step.plant, lang);
        const poor = r.score < 35;
        return (
          <article key={r.rotation.id} className={`rot-card${i === 0 && !poor ? " top" : ""}`}>
            <div className="rot-head">
              <span className={`rot-badge${poor ? " poor" : ""}`}>{poor ? t.cropPoorFit : rankWords[i]}</span>
              <h3>{say(r.rotation.name, lang)}</h3>
              <span className="muted small">{t.cropPerYear.replace("{n}", number(r.rotation.steps.length))}</span>
            </div>

            <Timeline rotation={r.rotation} lang={lang} t={t} now={now} />

            <p className="rot-next">
              {t.cropNext}: {say(CROPS[nx.step.crop].short, lang)} ·{" "}
              {nx.status === "now" ? `${t.cropNow} (${when})` : `${t.cropAround} ${when}`}
            </p>

            <div className="rot-lists">
              {r.fits.length > 0 && (
                <div>
                  <h4>{t.cropFits}</h4>
                  <ul className="fits">
                    {r.fits.map((m, k) => (
                      <li key={k}>{say(m, lang)}</li>
                    ))}
                  </ul>
                </div>
              )}
              {r.warns.length > 0 && (
                <div>
                  <h4>{t.cropWarns}</h4>
                  <ul className="warns">
                    {r.warns.map((m, k) => (
                      <li key={k}>{say(m, lang)}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <p className="muted small">
              <strong>{t.cropTrial}:</strong> {say(r.rotation.trial, lang)} [{r.rotation.sources.join(", ")}]
            </p>
          </article>
        );
      })}

      <p className="muted small">{t.cropDurationNote}</p>
      <p className="muted small">{t.cropScoreNote}</p>

      <details className="crop-sources">
        <summary>{t.cropSources}</summary>
        <ol>
          {SOURCES.map((s) => (
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