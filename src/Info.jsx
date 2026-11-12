import { useEffect, useLayoutEffect, useRef, useState } from "react";
import "./info.css";

// A small ⓘ button. It shows where a number comes from and the details, so the page itself can stay short.
// Click or tap to open and close; on a mouse, hovering also shows it.
export default function Info({ t, source, children }) {
  const [pinned, setPinned] = useState(false);
  const [hover, setHover] = useState(false);
  const box = useRef(null);
  const pop = useRef(null);
  const [dx, setDx] = useState(0);
  const open = pinned || hover;

  // keep the box on screen: slide it sideways when it would run off an edge
  useLayoutEffect(() => {
    if (!open || !pop.current) { setDx(0); return; }
    const r = pop.current.getBoundingClientRect();
    const shift = r.right - dx > window.innerWidth - 8 ? window.innerWidth - 8 - (r.right - dx) : 0;
    setDx(Math.max(shift, 8 - (r.left - dx)));
  }, [open]);

  useEffect(() => {
    if (!pinned) return undefined;
    const away = (e) => { if (box.current && !box.current.contains(e.target)) setPinned(false); };
    const esc = (e) => { if (e.key === "Escape") setPinned(false); };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", esc); };
  }, [pinned]);

  return (
    <span className="inf" ref={box} onMouseEnter={(e) => { if (e.pointerType !== "touch") setHover(true); }} onMouseLeave={() => setHover(false)}>
      {source && <span className="inf-src">{source}</span>}
      <button type="button" className="inf-btn" aria-expanded={open} aria-label={t.wfInfo} title={t.wfInfo} onClick={() => setPinned((p) => !p)}>i</button>
      {open && (
        <span className="inf-pop" role="note" ref={pop} style={dx ? { left: dx } : undefined}>
          {source && <b className="inf-head">{t.wfSource}: {source}</b>}
          {children}
        </span>
      )}
    </span>
  );
}
