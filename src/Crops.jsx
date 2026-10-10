import { useMemo, useState } from "react";
import {
  CROPS,
  MONTHS,
  ROTATIONS,
  SLOTS,
  SOURCES,
  chooseVarieties,
  flowOf,
  isColdDistrict,
  isCoastalDistrict,
  nowPosition,
  poorReasons,
  rankRotations,
  segmentsOf,
  soilClass,
  whenLabel,
} from "./crops.js";
import { CropPicture, TraitIcon } from "./cropart.jsx";
import Water from "./Water.jsx";
import PlanPrint from "./PlanPrint.jsx";
import { guessField } from "./water.js";

const say = (obj, lang) => (obj ? obj[lang] || obj.en : "");
const fill = (text, values) => Object.keys(values).reduce((s, k) => s.split(`{${k}}`).join(values[k]), text);

// the little icons shown for a variety, in a fixed order
const TRAIT_ORDER = ["salt", "flood", "drought", "cold", "coldmod", "early", "highyield", "blast", "long"];
const TRAIT_ICON = { coldmod: "cold", highyield: "yield" };
const TRAIT_WORD = {
  salt: "traitSalt", flood: "traitFlood", drought: "traitDrought", cold: "traitCold", coldmod: "traitCold",
  early: "traitEarly", highyield: "traitYield", blast: "traitBlast", long: "traitLong",
};
const WHY_WORD = { salt: "whySalt", flood: "whyFlood", drought: "whyDrought", cold: "whyCold", early: "whyEarly", yield: "whyYield" };

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

function Timeline({ rotation, daysMap, lang, t, now }) {
  const segs = layout(segmentsOf(rotation, daysMap));
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
            const isGap = s.kind !== "crop";
            const isFallow = s.kind === "fallow";
            const crop = isGap ? null : CROPS[s.crop];
            const days = isGap ? 0 : Math.round(daysMap[s.crop] != null ? daysMap[s.crop] : crop.days);
            const classes = ["tl-bar", s.kind, s.cutLeft ? "cut-left" : "", s.cutRight ? "cut-right" : ""]
              .filter(Boolean)
              .join(" ");
            return (
              <div
                key={i}
                className={classes}
                data-crop={isGap ? s.kind : s.crop}
                style={{ gridColumn: `${s.c1} / ${s.c2}` }}
                title={isFallow ? t.cropFallowHelp : isGap ? t.cropTurnaround : `${say(crop.name, lang)} · ~${days} ${t.cropDays}`}
              >
                {s.c2 - s.c1 >= 5 ? (isFallow ? t.cropFallow : isGap ? "" : say(crop.short, lang)) : ""}
              </div>
            );
          })}
          <i className="tl-now" style={{ left: `${(now / SLOTS) * 100}%` }} title={t.cropToday} />
        </div>
      </div>
    </div>
  );
}

function Traits({ variety, t }) {
  const tags = TRAIT_ORDER.filter((k) => variety.tags.includes(k));
  if (tags.length === 0) return null;
  return (
    <span className="traits">
      {tags.map((k) => (
        <span key={k} className="trait" title={t[TRAIT_WORD[k]]}>
          <TraitIcon tag={TRAIT_ICON[k] || k} size={20} />
          <span>{t[TRAIT_WORD[k]]}</span>
        </span>
      ))}
    </span>
  );
}

function VarietyPanel({ cropKey, info, fitsCalendar, onPick, t, lang, number }) {
  const list = info.lists[cropKey];
  const sel = info.chosen[cropKey];
  const v = sel.variety;
  const crop = CROPS[cropKey];
  const best = list[0];
  const d = sel.days;
  let daysLine;
  if (d == null) daysLine = fill(t.cropDaysUnknown, { n: number(crop.days) });
  else if (Array.isArray(d)) daysLine = fill(t.cropDaysRange, { a: number(d[0]), b: number(d[1]) });
  else daysLine = fill(t.cropDaysOne, { n: number(d) });

  return (
    <div className="var-panel">
      <h4 className="var-head">
        <CropPicture kind={cropKey} size={36} label={say(crop.short, lang)} />
        <span>{fill(t.cropVarietyFor, { crop: say(crop.short, lang) })}</span>
      </h4>

      <div className="var-main">
        {v.photo ? <img className="var-photo" src={v.photo} alt={say(v.name, lang)} /> : <CropPicture kind={cropKey} size={72} label={say(v.name, lang)} />}
        <div className="var-body">
          <div className="var-name">
            {say(v.name, lang)}
            {sel === best && <span className="var-tag best">{t.cropBestMatch}</span>}
            {sel !== best && !fitsCalendar && <span className="var-tag">{t.cropChosen}</span>}
            {sel !== best && fitsCalendar && <span className="var-tag cal">{t.cropFitsCalendar}</span>}
            {v.thin && <span className="var-tag thin">{t.cropLittleData}</span>}
          </div>
          <Traits variety={v} t={t} />
          {sel.why.filter((w) => w !== "early" && w !== "yield").length > 0 && (
            <ul className="var-why">
              {sel.why.filter((w) => w !== "early" && w !== "yield").map((w) => (
                <li key={w}>{t[WHY_WORD[w]]}</li>
              ))}
            </ul>
          )}
          <p className="var-line">{daysLine}</p>
          {v.yText && (
            <p className="var-line">
              <strong>{t.cropYield}:</strong> {say(v.yText, lang)}
            </p>
          )}
          <p className="var-line">{say(v.note, lang)}</p>
          <p className="muted small">
            {t.cropVarietySources}: {v.src.join(", ")}
          </p>
        </div>
      </div>

      {list.length > 1 && (
        <>
          <p className="muted small var-others-title">{t.cropOthers}</p>
          <div className="var-others">
            {list.map((x) => (
              <button
                key={x.variety.id}
                type="button"
                className={`var-chip${x.variety.id === v.id ? " on" : ""}`}
                onClick={() => onPick(cropKey, x.variety.id)}
                aria-pressed={x.variety.id === v.id}
              >
                <span className="var-chip-name">{say(x.variety.name, lang)}</span>
                <Traits variety={x.variety} t={{ ...t, traitSalt: "", traitFlood: "", traitDrought: "", traitCold: "", traitEarly: "", traitYield: "", traitBlast: "", traitLong: "" }} />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function Crops({ t, lang, districtName, soil, soilLabel, forecast, place }) {
  const [land, setLand] = useState("medium");
  const [water, setWater] = useState("yes");
  const [salt, setSalt] = useState("auto");
  const [picks, setPicks] = useState({}); // { rotationId: { cropKey: varietyId } }
  const [waterNow, setWaterNow] = useState(null); // the answer of the water countdown, for the printed plan
  const [planId, setPlanId] = useState(null); // which card the printed plan is made from

  const coastal = isCoastalDistrict(districtName);
  const cold = isColdDistrict(districtName);
  const saltOn = salt === "yes" || (salt === "auto" && coastal);
  const soilKind = soilClass(soil);
  const now = nowPosition();
  const ctx = useMemo(
    () => ({ land, irrigation: water === "yes", salt: saltOn, soil: soilKind, cold }),
    [land, water, saltOn, soilKind, cold]
  );

  const ranked = useMemo(() => rankRotations(ctx).slice(0, 3), [ctx]);
  const nothingFits = ranked.length > 0 && ranked[0].score < 35;
  const reasons = poorReasons(ctx);
  const rankWords = [t.cropRank1, t.cropRank2, t.cropRank3];
  const number = (n) => n.toLocaleString(lang === "bn" ? "bn-BD" : "en-US");

  const change = (setter) => (e) => {
    setter(e.target.value);
    setPicks({});
  };
  const pick = (rotationId) => (cropKey, varietyId) =>
    setPicks((p) => ({ ...p, [rotationId]: { ...(p[rotationId] || {}), [cropKey]: varietyId } }));

  const restText = (slots) => {
    const days = slots * 15.2;
    if (days < 12) return null;
    const weeks = days < 45;
    const n = weeks ? Math.max(2, Math.round(days / 7)) : Math.max(2, Math.round(days / 30));
    return fill(t.cropRestText, { n: number(n), unit: weeks ? t.cropWeeks : t.cropMonths });
  };

  const savePlan = (id) => {
    setPlanId(id);
    // wait one moment so the plan page is drawn, then open the print dialog (choose "Save as PDF")
    setTimeout(() => window.print(), 150);
  };

  // what is probably growing today, from the first card, to start the water countdown
  const first = ranked[0];
  const firstInfo = chooseVarieties(first.rotation, ctx, picks[first.rotation.id] || {});
  const guess = guessField(flowOf(first.rotation, firstInfo.daysMap, now), now);

  // the plan the farmer asked to save
  let plan = null;
  const planCard = ranked.find((x) => x.rotation.id === planId);
  if (planCard) {
    const pinfo = chooseVarieties(planCard.rotation, ctx, picks[planCard.rotation.id] || {});
    plan = {
      rotation: planCard.rotation,
      flow: flowOf(planCard.rotation, pinfo.daysMap, now),
      chosen: pinfo.chosen,
      ctx: { ...ctx, landLabel: land === "high" ? t.cropLandHigh : land === "low" ? t.cropLandLow : t.cropLandMedium },
      place: place || { title: districtName || "—", path: "", lat: "", lon: "" },
      soilLabel,
      water: waterNow,
      warns: planCard.warns,
      restText,
    };
  }

  return (
    <section className="crops">
      <h2>{t.cropTitle}</h2>
      <p className="muted small">{fill(t.cropIntro, { n: number(ROTATIONS.length) })}</p>

      <div className="crops-form">
        <label>
          {t.cropLand}
          <select className="wide-select" value={land} onChange={change(setLand)}>
            <option value="high">{t.cropLandHigh}</option>
            <option value="medium">{t.cropLandMedium}</option>
            <option value="low">{t.cropLandLow}</option>
          </select>
        </label>
        <label>
          {t.cropWater}
          <select className="wide-select" value={water} onChange={change(setWater)}>
            <option value="yes">{t.cropWaterYes}</option>
            <option value="no">{t.cropWaterNo}</option>
          </select>
        </label>
        <label>
          {t.cropSalt}
          <select className="wide-select" value={salt} onChange={change(setSalt)}>
            <option value="auto">{t.cropSaltAuto}</option>
            <option value="no">{t.cropSaltNo}</option>
            <option value="yes">{t.cropSaltYes}</option>
          </select>
        </label>
      </div>
      <p className="muted small">
        {t.cropSoilUsed}: {soilLabel || "—"}
        {salt === "auto" && coastal ? ` · ${t.cropSaltAutoNote}` : ""}
        {cold ? ` · ${t.cropColdNote}` : ""}
      </p>

      {nothingFits && (
        <div className="crop-banner" role="status">
          <strong>{fill(t.cropNoneTitle, { n: number(ROTATIONS.length) })}</strong>
          {reasons.length > 0 && (
            <ul>
              {reasons.map((m, k) => (
                <li key={k}>{say(m, lang)}</li>
              ))}
            </ul>
          )}
          <p>{t.cropNoneBody}</p>
        </div>
      )}
      <p className="muted small">
        {fill(t.cropShown, { n: number(ROTATIONS.length) })} {t.cropFallowHelp}
      </p>

      {ranked.map((r, i) => {
        const info = chooseVarieties(r.rotation, ctx, picks[r.rotation.id] || {});
        const flow = flowOf(r.rotation, info.daysMap, now);
        const poor = r.score < 35;
        const own = picks[r.rotation.id] || {};
        return (
          <article key={r.rotation.id} className={`rot-card${i === 0 && !poor ? " top" : ""}`}>
            <div className="rot-head">
              <span className={`rot-badge${poor ? " poor" : ""}`}>{poor ? t.cropPoorFit : rankWords[i]}</span>
              <h3>{say(r.rotation.name, lang)}</h3>
              <span className="muted small">
                {r.rotation.steps.length === 1 ? t.cropPerYear1 : t.cropPerYear.replace("{n}", number(r.rotation.steps.length))}
              </span>
            </div>

            <h4 className="flow-title">{t.cropFlowTitle}</h4>
            <p className="muted small">{t.cropFlowHelp}</p>
            <ol className="flow">
              {flow.map((s, k) => {
                const v = info.chosen[s.crop].variety;
                const rest = restText(s.rest);
                return (
                  <li key={s.crop} className="flow-item">
                    <div className={`flow-card${k === 0 ? " first" : ""}`}>
                      <div className="flow-top">
                        <span className="flow-step">{fill(t.cropStep, { n: number(k + 1) })}</span>
                        {k === 0 && <span className="flow-next">{s.d <= 0.5 ? t.cropNowBadge : t.cropNextBadge}</span>}
                      </div>
                      {v.photo ? (
                        <img className="crop-pic" src={v.photo} alt={say(v.name, lang)} width="72" height="72" />
                      ) : (
                        <CropPicture kind={s.crop} size={72} label={say(CROPS[s.crop].short, lang)} />
                      )}
                      <div className="flow-crop">{say(CROPS[s.crop].short, lang)}</div>
                      <div className="flow-variety">{say(v.name, lang)}</div>
                      <div className="flow-when">
                        <span className="dot plant" /> {t.cropPlant}: <strong>{whenLabel(s.plant, lang)}</strong>
                      </div>
                      <div className="flow-when">
                        <span className="dot harvest" /> {t.cropHarvest}: <strong>{whenLabel(s.harvest, lang)}</strong>
                      </div>
                    </div>
                    <div className="flow-arrow" aria-hidden="true">
                      {rest ? (
                        <span className="flow-rest">
                          <CropPicture kind="fallow" size={34} label={t.cropFallow} />
                          <span>{rest}</span>
                        </span>
                      ) : null}
                      <span className="arrow">{k === flow.length - 1 ? "↻" : "→"}</span>
                    </div>
                  </li>
                );
              })}
            </ol>

            {info.clashes.length > 0 && (
              <div className="crop-banner" role="alert">
                <strong>{t.cropClashTitle}</strong>
                <ul>
                  {info.clashes.map((c, k) => (
                    <li key={k}>
                      {fill(t.cropClashBody, {
                        crop: say(CROPS[c.crop].short, lang),
                        next: say(CROPS[c.next].short, lang),
                      })}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <h4 className="flow-title">{t.cropVarietyTitle}</h4>
            {flow.map((s) => (
              <VarietyPanel
                key={s.crop}
                cropKey={s.crop}
                info={info}
                fitsCalendar={!own[s.crop] && info.chosen[s.crop] !== info.lists[s.crop][0]}
                onPick={pick(r.rotation.id)}
                t={t}
                lang={lang}
                number={number}
              />
            ))}

            <h4 className="flow-title">{t.cropCalendar}</h4>
            <Timeline rotation={r.rotation} daysMap={info.daysMap} lang={lang} t={t} now={now} />

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

            <button type="button" className="plan-btn" onClick={() => savePlan(r.rotation.id)}>
              {t.planButton}
            </button>
            <p className="muted small">{t.planHelp}</p>
          </article>
        );
      })}

      <Water
        key={`${guess.crop}-${guess.stage}`}
        t={t}
        lang={lang}
        forecast={forecast}
        soil={soil}
        soilLabel={soilLabel}
        guess={guess}
        onSummary={setWaterNow}
      />

      <PlanPrint t={t} lang={lang} plan={plan} />

      <p className="muted small">{t.cropPictureNote}</p>
      <p className="muted small">{t.cropVarietyNote}</p>
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