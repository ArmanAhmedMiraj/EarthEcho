import { useEffect, useRef, useState } from "react";
import { countryPhotos, photosForPlace } from "./photos.js";
import "./gallery.css";

const BASE = import.meta.env.BASE_URL;
const memory = new Map();
const KEEP = 7 * 24 * 3600e3; // a live search is remembered in this browser for a week

function readCache(id) {
  try {
    const raw = localStorage.getItem(`ef-photos:${id}`);
    if (!raw) return null;
    const saved = JSON.parse(raw);
    return Date.now() - saved.t < KEEP ? saved.photos : null;
  } catch {
    return null;
  }
}

function writeCache(id, photos) {
  try {
    localStorage.setItem(`ef-photos:${id}`, JSON.stringify({ t: Date.now(), photos }));
  } catch {
    /* storage blocked: the search just runs again next time */
  }
}

// the ready-made library (countries and first-level areas), built by data-tools/build_gallery.mjs
async function fromLibrary(id, signal) {
  try {
    const r = await fetch(`${BASE}gallery/${id}.json`, { signal });
    if (!r.ok) return null;
    const lib = await r.json();
    return lib.photos && lib.photos.length > 0 ? lib.photos : null;
  } catch {
    return null;
  }
}

// The photos of the chosen place. The answer always carries the id it was found for,
// so a slow answer for a place you already left can never show up under the new one.
export function usePlacePhotos(target) {
  const [state, setState] = useState({ id: null, status: "idle", photos: [] });
  const id = target ? target.id : null;

  useEffect(() => {
    if (!target) {
      setState({ id: null, status: "idle", photos: [] });
      return undefined;
    }
    const known = memory.get(target.id) || readCache(target.id);
    if (known) {
      memory.set(target.id, known);
      setState({ id: target.id, status: "ok", photos: known });
      return undefined;
    }
    const controller = new AbortController();
    setState({ id: target.id, status: "loading", photos: [] });
    (async () => {
      let photos = null;
      if (target.kind === "country" || target.level === 0) photos = await fromLibrary(target.id, controller.signal);
      if (!photos) {
        try {
          const options = { signal: controller.signal };
          photos =
            target.kind === "country"
              ? await countryPhotos(target.name, options, target.bbox)
              : await photosForPlace(target, options);
        } catch {
          photos = null;
        }
      }
      if (controller.signal.aborted) return;
      if (photos && photos.length > 0) {
        memory.set(target.id, photos);
        writeCache(target.id, photos);
      }
      setState({ id: target.id, status: photos && photos.length > 0 ? "ok" : "empty", photos: photos || [] });
    })();
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // never hand out photos that belong to another place
  return state.id === id ? state : { id, status: id ? "loading" : "idle", photos: [] };
}

function chipText(t, p) {
  if (p.match === "nearby") return t.galNear.replace("{about}", p.about);
  if (p.match === "region") return t.galRegion.replace("{about}", p.about);
  return t.galPlace.replace("{about}", p.about);
}

// A photo carousel: arrows, dots, swipe, and a strip of small pictures. "banner" is the compact one
// used in the dashboard header; it also moves on by itself every few seconds.
export default function Gallery({ t, title, subtitle, state, banner }) {
  const [index, setIndex] = useState(0);
  const [broken, setBroken] = useState(() => new Set());
  const [hover, setHover] = useState(false);
  const start = useRef(null);
  const photos = state.photos.filter((p) => !broken.has(p.image));
  const count = photos.length;
  const current = photos[Math.min(index, Math.max(count - 1, 0))];

  useEffect(() => {
    setIndex(0);
    setBroken(new Set());
  }, [state.id]);

  useEffect(() => {
    if (!banner || count < 2 || hover) return undefined;
    const timer = setInterval(() => setIndex((i) => (i + 1) % count), 6000);
    return () => clearInterval(timer);
  }, [banner, count, hover]);

  const go = (step) => setIndex((i) => (i + step + count) % count);

  const swipe = {
    onPointerDown: (e) => {
      start.current = e.clientX;
    },
    onPointerUp: (e) => {
      if (start.current == null) return;
      const dx = e.clientX - start.current;
      start.current = null;
      if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
    },
  };

  let body;
  if (state.status === "loading") {
    body = <div className="gal-frame gal-skeleton" aria-label={t.galLoading}><span>{t.galLoading}</span></div>;
  } else if (!current) {
    body = <div className="gal-frame gal-empty"><span>{t.galNone}</span></div>;
  } else {
    body = (
      <figure className="gal-frame" {...swipe} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
        <img
          key={current.image}
          src={current.image}
          alt={current.caption}
          loading="lazy"
          draggable="false"
          onError={() => setBroken((set) => new Set(set).add(current.image))}
        />
        <figcaption>
          <span className={`gal-chip ${current.match}`}>{chipText(t, current)}</span>
          {!banner && <span className="gal-caption">{current.caption}</span>}
          <span className="gal-credit">
            <a href={current.page} target="_blank" rel="noreferrer">{current.author}</a>
            {" · "}
            {current.licenceUrl ? <a href={current.licenceUrl} target="_blank" rel="noreferrer">{current.licence}</a> : current.licence}
            {" · "}{current.source}
          </span>
        </figcaption>
        {count > 1 && (
          <>
            <button className="gal-arrow prev" onClick={() => go(-1)} aria-label={t.galPrev}>‹</button>
            <button className="gal-arrow next" onClick={() => go(1)} aria-label={t.galNext}>›</button>
            <div className="gal-dots" role="tablist">
              {photos.map((p, k) => (
                <button key={p.image} className={k === index ? "on" : ""} onClick={() => setIndex(k)} aria-label={`${k + 1} / ${count}`} />
              ))}
            </div>
          </>
        )}
      </figure>
    );
  }

  if (banner) return <div className="gal gal-banner">{body}</div>;

  return (
    <section className="gal panel">
      <h2 className="gal-title">{title}</h2>
      {subtitle && <p className="muted small gal-sub">{subtitle}</p>}
      {body}
      {count > 1 && (
        <div className="gal-thumbs">
          {photos.map((p, k) => (
            <button key={p.image} className={k === index ? "on" : ""} onClick={() => setIndex(k)} aria-label={p.caption}>
              <img src={p.image} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      )}
      <p className="muted small">{t.galNote}</p>
    </section>
  );
}
