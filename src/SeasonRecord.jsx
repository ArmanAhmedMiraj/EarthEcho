import { useMemo, useState } from "react";
import SheetButton from "./PlanSheet.jsx";
import { header } from "./sheetData.js";
import { MAX_SEASONS, historyOf, historyPatch } from "./history.js";
import "./record.css";

const fill = (text, values) => Object.keys(values).reduce((s, k) => s.split(`{${k}}`).join(values[k]), text);
const EMPTY = { crop: "", sowDate: "", harvestDate: "", yieldT: "", price: "", cost: "", note: "" };
const numOrNull = (v) => { const n = Number(String(v).replace(",", ".")); return String(v).trim() !== "" && Number.isFinite(n) && n >= 0 ? n : null; };
const cleanRec = (r) => ({
  id: r.id || `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
  crop: String(r.crop || "").trim().slice(0, 60),
  sowDate: /^\d{4}-\d{2}-\d{2}$/.test(r.sowDate || "") ? r.sowDate : "",
  harvestDate: /^\d{4}-\d{2}-\d{2}$/.test(r.harvestDate || "") ? r.harvestDate : "",
  yieldT: String(r.yieldT ?? "").slice(0, 10),
  price: String(r.price ?? "").slice(0, 10),
  cost: String(r.cost ?? "").slice(0, 12),
  note: String(r.note || "").slice(0, 300),
});
// money per hectare from the farmer's own numbers; null unless all three are entered
export const profitOf = (r) => {
  const y = numOrNull(r.yieldT), p = numOrNull(r.price), c = numOrNull(r.cost);
  return y == null || p == null || c == null ? null : y * 1000 * p - c;
};
const sortKey = (r) => r.harvestDate || r.sowDate || "";

// "Season record": what really happened on this field, season by season. It is the farmer's own record (nothing is estimated here).
export default function SeasonRecord({ t, lang, locale, field, onUpdate, cropNames = [] }) {
  const d = (field && field.details) || {};
  const records = useMemo(() => (Array.isArray(d.records) ? d.records.map(cleanRec) : []).sort((a, b) => (sortKey(a) < sortKey(b) ? 1 : -1)), [d.records]);
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState(null);
  const nf = useMemo(() => new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }), [locale]);
  const nf0 = useMemo(() => new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }), [locale]);
  const dateF = useMemo(() => { const f = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" }); return (s) => (s ? f.format(new Date(`${s}T12:00:00`)) : "–"); }, [locale]);
  const monthNames = t.rtMonthsAbbr.split(" ");

  const save = (list) => onUpdate(field.id, { details: { ...d, records: list.map(cleanRec) } });
  const submit = (e) => {
    e.preventDefault();
    if (!form.crop.trim()) return;
    const rec = cleanRec({ ...form, id: editing || undefined });
    const list = editing ? records.map((r) => (r.id === editing ? rec : r)) : [rec, ...records];
    // a finished season (sowing and harvest dates) also goes into "Past seasons" (My details), so the rotation advice knows about it
    let extra = {};
    if (!editing && rec.sowDate && rec.harvestDate) {
      const rows = historyOf(d), year = rec.sowDate.slice(0, 4);
      if (!rows.some((h) => h.crop.trim().toLowerCase() === rec.crop.toLowerCase() && h.year === year) && rows.length < MAX_SEASONS) {
        extra = historyPatch([{ crop: rec.crop, sowMonth: String(Number(rec.sowDate.slice(5, 7)) - 1), year }, ...rows]);
      }
    }
    onUpdate(field.id, { details: { ...d, ...extra, records: list.map(cleanRec) } });
    setForm(EMPTY); setEditing(null);
  };
  const edit = (r) => { setForm({ crop: r.crop, sowDate: r.sowDate, harvestDate: r.harvestDate, yieldT: r.yieldT, price: r.price, cost: r.cost, note: r.note }); setEditing(r.id); };
  const remove = (id) => { save(records.filter((r) => r.id !== id)); if (editing === id) { setForm(EMPTY); setEditing(null); } };
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // the same crop in several seasons: its yields, oldest to newest, and how the latest compares
  const byCrop = useMemo(() => {
    const map = new Map();
    [...records].reverse().forEach((r) => {
      const y = numOrNull(r.yieldT);
      if (y == null) return;
      const k = r.crop.toLowerCase();
      if (!map.has(k)) map.set(k, { name: r.crop, list: [] });
      map.get(k).list.push({ y, year: sortKey(r).slice(0, 4) });
    });
    return [...map.values()].filter((c) => c.list.length >= 2);
  }, [records]);
  const compare = (c) => {
    const last = c.list[c.list.length - 1], prev = c.list[c.list.length - 2];
    const ch = prev.y > 0 ? (last.y - prev.y) / prev.y : 0;
    const word = Math.abs(ch) < 0.05 ? t.srSame : ch > 0 ? t.srUp : t.srDown;
    return fill(t.srCompare, { crop: c.name, list: c.list.map((x) => `${nf.format(x.y)}${x.year ? ` (${x.year})` : ""}`).join(" → "), word });
  };

  const sheetModel = () => {
    const rows = records.map((r) => { const p = profitOf(r); return [r.crop, dateF(r.sowDate), dateF(r.harvestDate), r.yieldT ? nf.format(numOrNull(r.yieldT) ?? 0) : "–", r.price || "–", r.cost || "–", p == null ? "–" : nf0.format(p)]; });
    const blocks = [
      { h: t.srSheetTable, table: { head: [t.srCrop, t.srSown, t.srHarvested, t.srYield, t.srPrice, t.srCost, t.srProfit], rows } },
      ...(byCrop.length ? [{ h: t.srSheetCompare, ul: byCrop.map(compare) }] : []),
      ...(records.some((r) => r.note) ? [{ h: t.srNote, ul: records.filter((r) => r.note).map((r) => `${r.crop}: ${r.note}`) }] : []),
      { h: t.shNotes, lines: 3 },
    ];
    const short = fill(t.srShort, { field: field.name || t.shNoName, list: records.slice(0, 4).map((r) => `${r.crop}${numOrNull(r.yieldT) != null ? ` ${nf.format(numOrNull(r.yieldT))} t/ha` : ""}${sortKey(r) ? ` (${sortKey(r).slice(0, 4)})` : ""}`).join(", ") });
    return { title: t.srSheetTitle, file: field.name || "", meta: header(field, t, locale), blocks, short, foot: t.srSheetFoot };
  };

  const csv = () => {
    const q = (s) => `"${String(s ?? "").replace(/"/g, '""')}"`;
    const head = ["crop", "sowing_date", "harvest_date", "yield_t_per_ha", "price_per_kg", "cost_per_ha", "profit_per_ha", "note"];
    const lines = [head.join(","), ...records.map((r) => { const p = profitOf(r); return [r.crop, r.sowDate, r.harvestDate, r.yieldT, r.price, r.cost, p == null ? "" : Math.round(p), r.note].map(q).join(","); })];
    const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `earthecho-season-record-${(field.name || "field").replace(/[^\wঀ-৿-]+/g, "-")}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  };

  return (
    <section className="fd-card sr-wrap" aria-labelledby="sr-title">
      <h3 id="sr-title" className="sr-h">{t.srTitle}</h3>
      <p className="small muted">{t.srIntro}</p>

      <form className="fd-form sr-form" onSubmit={submit}>
        <label className="fd-field">
          <span>{t.srCrop}</span>
          <input list="sr-crops" value={form.crop} maxLength={60} placeholder={t.fdCropPlaceholder} onChange={(e) => set("crop", e.target.value)} required />
          <datalist id="sr-crops">{cropNames.map((c) => <option key={c} value={c} />)}</datalist>
        </label>
        <label className="fd-field"><span>{t.srSown}</span><input type="date" value={form.sowDate} onChange={(e) => set("sowDate", e.target.value)} /></label>
        <label className="fd-field"><span>{t.srHarvested}</span><input type="date" value={form.harvestDate} onChange={(e) => set("harvestDate", e.target.value)} /></label>
        <label className="fd-field"><span>{t.srYield}</span><input inputMode="decimal" value={form.yieldT} maxLength={10} onChange={(e) => set("yieldT", e.target.value)} /></label>
        <label className="fd-field"><span>{t.srPrice}</span><input inputMode="decimal" value={form.price} maxLength={10} onChange={(e) => set("price", e.target.value)} /></label>
        <label className="fd-field"><span>{t.srCost}</span><input inputMode="decimal" value={form.cost} maxLength={12} onChange={(e) => set("cost", e.target.value)} /></label>
        <label className="fd-field wide"><span>{t.srNote}</span><textarea rows={2} value={form.note} maxLength={300} placeholder={t.srNotePlaceholder} onChange={(e) => set("note", e.target.value)} /></label>
        <div className="fd-field wide sr-actions">
          <button type="submit" className="tab sr-save">{editing ? t.srSaveEdit : t.srAdd}</button>
          {editing && <button type="button" className="tab" onClick={() => { setForm(EMPTY); setEditing(null); }}>{t.srCancel}</button>}
        </div>
      </form>
      {!editing && <p className="small muted">{t.srAddNote}</p>}

      {records.length === 0 ? <p className="small muted">{t.srNone}</p> : (
        <>
          <h4 className="sr-h">{fill(t.srListTitle, { n: nf0.format(records.length) })}</h4>
          <ul className="sr-list">
            {records.map((r) => {
              const p = profitOf(r);
              return (
                <li key={r.id} className={editing === r.id ? "on" : ""}>
                  <div className="sr-top"><b>{r.crop}</b><span className="muted small">{dateF(r.sowDate)} → {dateF(r.harvestDate)}</span></div>
                  <div className="small">
                    {numOrNull(r.yieldT) != null && <span>{t.srYield}: <b>{nf.format(numOrNull(r.yieldT))}</b> </span>}
                    {p != null && <span>· {t.srProfit}: <b>{nf0.format(p)}</b> </span>}
                  </div>
                  {r.note && <div className="small muted">{r.note}</div>}
                  <div className="sr-row-actions">
                    <button type="button" className="fd-link" onClick={() => edit(r)}>{t.srEdit}</button>
                    <button type="button" className="fd-link" onClick={() => remove(r.id)}>{t.srDelete}</button>
                  </div>
                </li>
              );
            })}
          </ul>
          {byCrop.length > 0 && (<><h4 className="sr-h">{t.srSheetCompare}</h4><ul className="small sr-cmp">{byCrop.map((c) => <li key={c.name}>{compare(c)}</li>)}</ul></>)}
          <div className="sr-actions">
            <SheetButton t={t} lang={lang} label={t.srPrintBtn} build={sheetModel} />
            <button type="button" className="tab" onClick={csv}>{t.srCsv}</button>
          </div>
          <p className="muted small">{t.srCsvNote}</p>
        </>
      )}
      <p className="muted small">{t.srStored}</p>
    </section>
  );
}
