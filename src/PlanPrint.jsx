import { createPortal } from "react-dom";
import { CROPS, whenLabel } from "./crops.js";
import "./plan.css";

const say = (obj, lang) => (obj ? obj[lang] || obj.en : "");

// The one-page plan. It stays hidden on screen and is the only thing shown when the farmer prints or saves as PDF.
export default function PlanPrint({ t, lang, plan }) {
  if (!plan) return null;
  const locale = lang === "bn" ? "bn-BD" : "en-GB";
  const date = new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric" }).format(new Date());
  const whole = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const { rotation, flow, chosen, ctx, place, soilLabel, water, warns, restText } = plan;

  const ids = new Set(rotation.sources);
  Object.values(chosen).forEach((c) => c.variety.src.forEach((s) => ids.add(s)));

  const daysText = (c) => {
    const d = c.days;
    if (d == null) return "";
    if (Array.isArray(d)) return `${whole.format(d[0])}–${whole.format(d[1])}`;
    return whole.format(d);
  };

  return createPortal(
    <div className="print-plan" lang={lang}>
      <h1>{t.planTitle}</h1>
      <div className="pp-small">
        {t.planMade}: {date}
      </div>

      <h2>{t.planField}</h2>
      <ul>
        <li>
          {t.planPlace}: <strong>{place.title}</strong>
          {place.path ? ` (${place.path})` : ""}
        </li>
        <li>
          {t.planCoords}: {place.lat}, {place.lon}
        </li>
        <li>
          {t.planSoil}: {soilLabel || "—"}
        </li>
      </ul>
      <div className="pp-small">
        {t.planAnswers}: {t.planLand}: {ctx.landLabel}; {t.planWater}: {ctx.irrigation ? t.planYes : t.planNo}; {t.planSalt}:{" "}
        {ctx.salt ? t.planYes : t.planNo}
      </div>

      <h2>
        {t.planRotation}: {say(rotation.name, lang)}
      </h2>
      <table>
        <thead>
          <tr>
            <th>{t.planCrop}</th>
            <th>{t.planVariety}</th>
            <th>{t.planPlant}</th>
            <th>{t.planHarvest}</th>
            <th>{t.planRest}</th>
          </tr>
        </thead>
        <tbody>
          {flow.map((s) => (
            <tr key={s.crop}>
              <td>{say(CROPS[s.crop].short, lang)}</td>
              <td>{say(chosen[s.crop].variety.name, lang)}</td>
              <td>{whenLabel(s.plant, lang)}</td>
              <td>{whenLabel(s.harvest, lang)}</td>
              <td>{restText(s.rest) || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>{t.planVarietyFacts}</h2>
      <ul>
        {flow.map((s) => {
          const c = chosen[s.crop];
          const v = c.variety;
          return (
            <li key={s.crop}>
              <strong>{say(v.name, lang)}</strong>
              {[daysText(c) ? `${daysText(c)} ${t.cropDays}` : "", v.yText ? say(v.yText, lang) : "", say(v.note, lang)]
                .filter(Boolean)
                .map((x) => ` · ${x}`)
                .join("")}
            </li>
          );
        })}
      </ul>

      {warns.length > 0 && (
        <>
          <h2>{t.planWatch}</h2>
          <ul>
            {warns.map((m, i) => (
              <li key={i}>{say(m, lang)}</li>
            ))}
          </ul>
        </>
      )}

      {water && (
        <>
          <h2>
            {t.planWaterNow}: {say(CROPS[water.crop].short, lang)}
          </h2>
          <div className="pp-water">
            <strong>{water.title}</strong>
            {water.lines.map((l, i) => (
              <div key={i}>{l}</div>
            ))}
          </div>
        </>
      )}

      <p className="pp-small">{t.planDisclaimer}</p>
      <p className="pp-small">{t.planSourcesLine.replace("{ids}", [...ids].join(", "))}</p>
    </div>,
    document.body
  );
}