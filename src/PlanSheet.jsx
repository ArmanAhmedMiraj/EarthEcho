import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { smsSize } from "./sheetData.js";
import { buildIcs, downloadIcs } from "./ics.js";
import "./sheet.css";

const fill = (text, values) => Object.keys(values).reduce((s, k) => s.split(`{${k}}`).join(values[k]), text);

function Sheet({ t, lang, model, onClose }) {
  const [text, setText] = useState(model.short);
  const [note, setNote] = useState("");
  const box = useRef(null);
  const nfL = new Intl.NumberFormat(lang === "bn" ? "bn-BD" : "en-US");
  const size = smsSize(text);

  useEffect(() => {
    const prevTitle = document.title;
    document.title = `${t.shFilePrefix} - ${model.file || model.title}`;
    document.body.classList.add("ef-sheet-open");
    const restore = () => { document.title = `${t.shFilePrefix} - ${model.file || model.title}`; };
    const after = () => { document.title = prevTitle; setTimeout(restore, 0); };
    window.addEventListener("afterprint", after);
    const key = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", key);
    if (box.current) box.current.focus();
    return () => {
      window.removeEventListener("afterprint", after);
      window.removeEventListener("keydown", key);
      document.body.classList.remove("ef-sheet-open");
      document.title = prevTitle;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const flash = (m) => { setNote(m); setTimeout(() => setNote(""), 3500); };
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); flash(t.shCopied); }
    catch {
      const ta = document.createElement("textarea");
      ta.value = text; document.body.appendChild(ta); ta.select();
      let ok = false; try { ok = document.execCommand("copy"); } catch { ok = false; }
      document.body.removeChild(ta); flash(ok ? t.shCopied : t.shCopyFail);
    }
  };
  const share = async () => { try { await navigator.share({ text }); } catch { /* closed by the person */ } };
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
  const enc = encodeURIComponent(text);
  const field = model.file || "";
  const makeIcs = () => {
    const ics = buildIcs(model.events || [], { field, calName: `${t.shTitle}${field ? ` - ${field}` : ""}`, text: { sow: t.icSow, harvest: t.icHarvest, note: t.icNote } });
    if (!ics) return;
    downloadIcs(ics, `earthecho-${(field || "plan").replace(/[^\w\u0980-\u09FF-]+/g, "-")}.ics`);
    flash(t.icDone);
  };

  const renderBlock = (b, i) => (
    <section className="sh-block" key={i}>
      <h2>{b.h}</h2>
      {b.p && <p>{b.p}</p>}
      {b.rows && <dl className="sh-facts">{b.rows.map(([k, v], n) => <div key={n}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>}
      {b.rows === null && <p className="sh-muted">{b.empty}</p>}
      {b.note && <p className="sh-small">{b.note}</p>}
      {b.table && (
        <table className="sh-table">
          <thead><tr>{b.table.head.map((h, n) => <th key={n}>{h}</th>)}</tr></thead>
          <tbody>{b.table.rows.map((r, n) => <tr key={n}>{r.map((c, k) => (k === 0 ? <th scope="row" key={k}>{c}</th> : <td key={k}>{c}</td>))}</tr>)}</tbody>
        </table>
      )}
      {b.ul && <ul>{b.ul.map((l, n) => <li key={n}>{l}</li>)}</ul>}
      {b.lines && <div className="sh-lines" aria-hidden="true">{Array.from({ length: b.lines }, (_, n) => <span key={n} />)}</div>}
    </section>
  );

  return createPortal(
    <div className="sh-overlay" role="dialog" aria-modal="true" aria-label={model.title} lang={lang}>
      <div className="sh-panel" ref={box} tabIndex={-1}>
        <div className="sh-bar">
          <button type="button" className="tab sh-close" onClick={onClose}>{t.shClose}</button>
          <button type="button" className="tab sh-print" onClick={() => window.print()}>{t.shPrint}</button>
        </div>
        <p className="sh-hint">{t.shPrintHint}</p>

        <div className="sh-short">
          <label htmlFor="sh-text"><b>{t.shShortTitle}</b></label>
          <textarea id="sh-text" rows={5} value={text} onChange={(e) => setText(e.target.value)} />
          <p className="sh-small">{fill(t.shCount, { n: nfL.format(size.len), p: nfL.format(size.parts) })} {t.shCountNote}</p>
          <div className="sh-actions">
            <button type="button" className="tab" onClick={copy}>{t.shCopy}</button>
            {canShare && <button type="button" className="tab" onClick={share}>{t.shShare}</button>}
            <a className="tab" href={`https://wa.me/?text=${enc}`} target="_blank" rel="noopener noreferrer">{t.shWhatsapp}</a>
            <a className="tab" href={`sms:?&body=${enc}`}>{t.shSms}</a>
          </div>
          <p className="sh-small" role="status">{note}</p>
        </div>

        {model.events && model.events.length > 0 && (
          <div className="sh-short">
            <b>{t.icTitle}</b>
            <p className="sh-small">{t.icIntro}</p>
            <div className="sh-actions"><button type="button" className="tab" onClick={makeIcs}>{t.icButton}</button></div>
          </div>
        )}

        <article className="sh-paper">
          <h1>{model.title}</h1>
          <dl className="sh-meta">{model.meta.map(([k, v], n) => <div key={n}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
          {model.blocks.map(renderBlock)}
          <p className="sh-small sh-foot">{model.foot}</p>
          <p className="sh-small">{t.shMadeWith}</p>
        </article>
      </div>
    </div>,
    document.body
  );
}

// A button that opens the sheet. build() makes the sheet from the current numbers when the button is pressed.
export default function SheetButton({ t, lang, label, build, className = "tab" }) {
  const [model, setModel] = useState(null);
  return (
    <>
      <button type="button" className={className} onClick={() => setModel(build())}>{label || t.shOpen}</button>
      {model && <Sheet t={t} lang={lang} model={model} onClose={() => setModel(null)} />}
    </>
  );
}
