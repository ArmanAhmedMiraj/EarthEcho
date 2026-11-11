// What goes on the plan sheet and in the short text. Everything here comes from numbers the app already worked out;
// nothing new is calculated. The sheet is a starting idea to talk through, not a forecast.
import { seasonLabel } from "./bdseasons.js";
const fill = (text, values) => Object.keys(values).reduce((s, k) => s.split(`{${k}}`).join(values[k]), text);

// what the farmer typed, and what the app estimated, about the field
export function fieldFacts(field, t, month, nf) {
  const d = (field && field.details) || {};
  const sys = (field && field.system) || {};
  const told = [];
  const mm = (v) => (v !== "" && v != null && Number.isInteger(Number(v)) ? month(Number(v)) : "");
  if (d.currentCrop) told.push([t.shCurrent, d.currentCrop + (mm(d.currentSowMonth) ? ` (${t.shSown} ${mm(d.currentSowMonth)})` : "")]);
  if (d.previousCrops) told.push([t.shBefore, d.previousCrops]);
  if (d.plannedCrop) told.push([t.shPlanned, d.plannedCrop]);
  if (d.irrigation) told.push([t.shIrrigation, d.irrigation]);
  if (d.soil) told.push([t.shSoil, (t.soilNames && t.soilNames[d.soil]) || d.soil]);
  const est = [];
  if (!d.soil && sys.soil && sys.soil.key) {
    const lv = sys.soil.level ? ` (${{ high: t.confHigh, medium: t.confMedium, low: t.confLow }[sys.soil.level] || ""})` : "";
    est.push([t.shSoil, ((t.soilNames && t.soilNames[sys.soil.key]) || sys.soil.key) + lv]);
  }
  if (sys.elevationM != null) est.push([t.shElevation, `${nf.format(Math.round(sys.elevationM))} m`]);
  if (sys.slopePct != null) est.push([t.shSlope, `${nf.format(Math.round(sys.slopePct * 10) / 10)} %`]);
  return { told, est };
}

function header(field, t, locale) {
  const date = new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric" }).format(new Date());
  const meta = [[t.shField, (field && field.name) || t.shNoName]];
  if (field && field.path) meta.push([t.shPlace, field.path]);
  if (field && field.lat != null) meta.push([t.shCoords, `${Number(field.lat).toFixed(4)}, ${Number(field.lon).toFixed(4)}`]);
  meta.push([t.shDate, date]);
  return meta;
}

const factBlocks = (facts, t) => {
  const out = [];
  out.push({ h: t.shTold, rows: facts.told.length ? facts.told : null, empty: t.shToldNone });
  if (facts.est.length) out.push({ h: t.shEst, rows: facts.est, note: t.shEstNote });
  return out;
};

// A strategy card (one column of the comparison)
export function strategySheet({ c, t, field, locale, nf, name, month, tableRows, sections, roleLabel, mode, country }) {
  const range = (o) => `${month(o.at)}–${month(o.at + o.months - 1)}`;
  const bd = country === "BD";
  const facts = fieldFacts(field, t, month, nf);
  const chain = c.steps.map((o) => `${name(o.crop)} (${range(o)})`).join(" → ");
  const bare = c.m.bare.length ? c.m.bare.map(month).join(", ") : "";
  const level = t[`trLevel_${c.trust.level}`];
  const blocks = [
    ...factBlocks(facts, t),
    { h: t.shCrops, table: { head: bd ? [t.shCrop, t.shSowHarvest, t.shMonths, t.bdColumn] : [t.shCrop, t.shSowHarvest, t.shMonths], rows: c.steps.map((o) => (bd ? [name(o.crop), range(o), nf.format(o.months), seasonLabel(o.crop, o.at, t)] : [name(o.crop), range(o), nf.format(o.months)])) } },
    { h: t.shNumbers, rows: tableRows.map(([label, fn, tags]) => [tags ? `${label} (${tags.map((k) => t[`src_${k}`]).join(", ")})` : label, fn(c)]), note: t.srcSheetNote },
    ...sections.map(([key, title]) => ({ h: title, ul: c.text[key] })),
    { h: `${t.trTitle}: ${level}`, ul: [t[`trLead_${c.trust.level}`], ...c.trust.factors.map((f) => `${t[`trState_${f.state}`]}: ${t[`trF_${f.key}_${f.state}`]}`), ...c.trust.sensitive.map((k) => t[`trS_${k}`])] },
    { h: t.shNotes, lines: 4 },
  ];
  const short = fill(t.shTextStrategy, { field: (field && field.name) || t.shNoName, chain, bare: bare ? fill(t.shTextBare, { m: bare }) : "", level });
  return { title: `${t.shTitle} – ${roleLabel(c.role)}`, file: (field && field.name) || "", meta: header(field, t, locale), blocks, short: short.replace(/\s+/g, " ").trim(), foot: t.shFoot, mode };
}

// The plan for several years
export function yearsSheet({ plan, t, field, locale, nf, name, month, keep }) {
  const range = (o) => `${month(o.abs)}–${month(o.abs + o.months - 1)}`;
  const facts = fieldFacts(field, t, month, nf);
  const yearLine = (placed) => placed.map((o) => `${name(o.crop)} (${range(o)})`).join(" → ");
  const backNames = [...new Set(plan.returns.map((c) => name(c)))].join(", ");
  const checks = [
    plan.returns.length ? fill(t.mpFamBad, { n: nf.format(plan.returns.length), total: nf.format(plan.seasons), list: backNames }) : fill(t.mpFamOk, { total: nf.format(plan.seasons) }),
    fill(t.mpLegume, { a: nf.format(plan.legumeYears), n: nf.format(plan.years) }),
    fill(t.mpCover, { list: plan.monthsInYear.map((n) => nf.format(n)).join(", ") }),
  ];
  if (keep) checks.push(fill(t.mpKeepNote, { crop: name(keep) }));
  const blocks = [
    ...factBlocks(facts, t),
    { h: plan.start.length ? fill(t.mpStart, { list: plan.start.map((c) => name(c)).join(" → ") }) : t.mpStartNone, p: fill(t.mpStartsIn, { m: month(plan.origin) }) },
    { h: t.shYearTable, table: { head: [t.shYear, t.shCropsSown], rows: plan.rows.map((placed, y) => [fill(t.mpYear, { n: nf.format(y + 1) }), yearLine(placed)]) } },
    { h: t.mpChecks, ul: checks },
    { h: t.shNotes, lines: 4 },
  ];
  const lines = plan.rows.map((placed, y) => `${fill(t.mpYear, { n: nf.format(y + 1) })}: ${yearLine(placed)}`).join(". ");
  const short = fill(t.shTextYears, { field: (field && field.name) || t.shNoName, n: nf.format(plan.years), lines });
  return { title: fill(t.mpTitle, { n: nf.format(plan.years) }), file: (field && field.name) || "", meta: header(field, t, locale), blocks, short: short.replace(/\s+/g, " ").trim(), foot: `${t.mpCaveat} ${t.shFoot}` };
}

// SMS size: one message holds 160 characters (70 when any Bangla letter is in it); longer texts are split into parts of 153 (67)
export function smsSize(text) {
  const len = Array.from(text).length;
  const wide = /[^\u0000-ÿ]/.test(text);
  const one = wide ? 70 : 160, part = wide ? 67 : 153;
  return { len, parts: len <= one ? 1 : Math.ceil(len / part) };
}
