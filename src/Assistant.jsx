import { useEffect, useRef, useState } from "react";
import "./assistant.css";
import "./assistant2.css";
import { buildAlerts, fetchWeatherPlus } from "./weatherPlus.js";
import { evaluateCrops, loadCropTable, soilInput } from "./suitability.js";
import { historyOf } from "./history.js";

// Everything the assistant is told about this farm. It is built from data the app already has, so the answer is about THIS place.
const fill = (text, v) => Object.keys(v).reduce((a, k) => a.split(`{${k}}`).join(v[k]), text);

async function buildContext({ lat, lon, label, country, soilData, env, field }) {
  const ctx = { place: label || `${lat.toFixed(2)}, ${lon.toFixed(2)}`, latitude: +lat.toFixed(3), longitude: +lon.toFixed(3), country };
  // what the farmer told us about this field (the farmer's own words, not measured by EarthEcho)
  const fd = field && field.details ? field.details : null;
  if (fd) {
    const own = {};
    if (field.name) own.fieldName = field.name;
    if (fd.area && String(fd.area.value || "").trim()) own.landSize = `${fd.area.value} ${fd.area.unit}`;
    if (fd.ownership) own.landUse = fd.ownership;
    if (fd.irrigation) own.irrigation = fd.irrigation;
    if (fd.currentCrop) own.growingNow = fd.currentCrop;
    if (fd.currentCrop && fd.currentSowMonth !== undefined && fd.currentSowMonth !== "") own.currentCropSownInMonthNumber = Number(fd.currentSowMonth) + 1;
    if (fd.plannedCrop) own.wantsToGrowNext = fd.plannedCrop;
    if (fd.keepCrop) own.cropTheFarmerWantsToKeepInEveryRotation = fd.keepCrop;
    const seasons = historyOf(fd).filter((r) => r.crop.trim());
    if (seasons.length) own.seasonsBeforeNowNewestFirst = seasons.map((r) => ({ crop: r.crop.trim(), sownInMonthNumber: r.sowMonth !== "" ? Number(r.sowMonth) + 1 : undefined, year: r.year || undefined }));
    if (fd.soil) own.soilTypeSetByFarmer = fd.soil;
    if (fd.notes) own.notes = String(fd.notes).slice(0, 300);
    if (Object.keys(own).length > 1) ctx.farmerProvidedDetails = own;
  }
  const soil = soilInput(soilData);
  if (soil) {
    ctx.soil = { pH: soil.ph != null ? +Number(soil.ph).toFixed(1) : null, texture: soil.simple || null, source: "ISRIC SoilGrids (250 m model)" };
  }
  try {
    const plus = await fetchWeatherPlus(lat, lon);
    const c = plus.current || {};
    ctx.weatherNow = { tempC: c.temperature_2m ?? c.temp ?? null, humidity: c.relative_humidity_2m ?? null, windKmh: c.wind_speed_10m ?? null };
    ctx.forecast = plus.days.slice(0, 5).map((d) => ({ date: d.date, tmaxC: d.tmax, tminC: d.tmin, rainMm: d.rain, rainChancePct: d.chance, windMaxKmh: d.wind, et0Mm: d.et0 }));
    ctx.pastWeekRainMm = Math.round(plus.past.reduce((s, d) => s + (d.rain || 0), 0));
    ctx.weatherAlerts = buildAlerts(plus).map((a) => ({ type: a.id, level: a.level, days: a.days, value: a.value ?? null }));
    if (plus.air && plus.air.aqi != null) ctx.airQualityUsAqi = plus.air.aqi;
  } catch { /* the answer is then given without live weather */ }
  try {
    const table = await loadCropTable();
    const climate = env && env.climate;
    if (table && climate) {
      const months = climate.months.map((m) => ({ tmean: m.tmean, rainMm: m.rainMm }));
      const scored = evaluateCrops(table.crops, months, soil);
      const pick = (key) => scored.slice().sort((a, b) => b[key].now - a[key].now).slice(0, 6).map((r) => ({ crop: r.crop.en, score: +r[key].now.toFixed(2) }));
      ctx.bestCropsNow = { scale: "0 to 1, FAO EcoCrop method", irrigated: pick("irrigated"), rainfed: pick("rainfed") };
    }
  } catch { /* skipped */ }
  return ctx;
}

// [S1] in the answer becomes a small badge; lines that start with "- " or "• " become a list
const cites = (line) => line.split(/([\[【]S\d+[\]】])/g).map((part, j) => (/^[\[【]S\d+[\]】]$/.test(part) ? <sup key={j} className="as-cite">{part.slice(1, -1)}</sup> : part.replace(/\*\*/g, "")));
function renderAnswer(text) {
  const out = [];
  let list = [];
  const flush = () => { if (list.length) { out.push(<ul key={`u${out.length}`}>{list}</ul>); list = []; } };
  text.split("\n").filter((line) => line.trim() !== "").forEach((line, i) => {
    const m = line.match(/^\s*(?:[-•*]|\d+[.)])\s+(.*)$/);
    if (m && !/^\s*\*\*/.test(line)) { list.push(<li key={i}>{cites(m[1])}</li>); return; }
    flush();
    out.push(<p key={i} className={/^\s*\*\*[^*]+\*\*\s*$/.test(line) ? "as-head" : undefined}>{cites(line)}</p>);
  });
  flush();
  return out;
}

export default function Assistant({ t, lang, lat, lon, label, country, soilData, env, field, request = null, onRequestHandled = null }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const ctxRef = useRef(null);
  const endRef = useRef(null);
  // the farm's weather and best crops are gathered as soon as the tab opens, so the first question does not wait for them
  useEffect(() => {
    ctxRef.current = buildContext({ lat, lon, label, country, soilData, env, field });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lon, env, soilData, JSON.stringify(field && field.details), field && field.name]);
  useEffect(() => { if (endRef.current) endRef.current.scrollIntoView({ block: "nearest" }); }, [messages, busy]);

  async function ask(q, extra) {
    const question = (q ?? text).trim();
    if (!question || busy) return;
    setText("");
    setMessages((m) => [...m, { role: "user", text: question }]);
    if (!navigator.onLine) {
      setMessages((m) => [...m, { role: "bot", error: t.asOffline }]);
      return;
    }
    setBusy(true);
    try {
      if (!ctxRef.current) ctxRef.current = buildContext({ lat, lon, label, country, soilData, env, field });
      const base = await ctxRef.current;
      // the strategy goes first, so it is never the part cut off if the farm data is long
      const context = extra && extra.strategy ? { strategy: extra.strategy, ...base } : base;
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question, lang, context, mode: extra && extra.strategy ? "strategy" : undefined }),
      });
      const failWith = (data) => {
        const map = { nokey: t.asNoKey, quota: t.asQuota, rate: t.asRate, badkey: t.asBadKey };
        setMessages((m) => [...m.filter((x) => !x.streaming), { role: "bot", error: map[data && data.error] || t.asFail, detail: data && data.detail }]);
      };
      const type = response.headers.get("content-type") || "";
      if (!type.includes("ndjson") || !response.body) {
        failWith(await response.json().catch(() => ({ detail: `server replied HTTP ${response.status}` })));
      } else {
        // the answer arrives piece by piece: show each piece as soon as it comes
        let sources = [];
        let answer = "";
        let started = false;
        let failed = false;
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        const show = () => setMessages((m) => {
          const rest = m.filter((x) => !x.streaming);
          return [...rest, { role: "bot", text: answer, sources, streaming: true }];
        });
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let i;
          while ((i = buffer.indexOf("\n")) >= 0) {
            const line = buffer.slice(0, i).trim();
            buffer = buffer.slice(i + 1);
            if (!line) continue;
            let o = null;
            try { o = JSON.parse(line); } catch { continue; }
            if (o.sources) sources = o.sources;
            else if (o.d) { answer += o.d; started = true; show(); }
            else if (o.error && !started) { failed = true; failWith(o); }
          }
        }
        setMessages((m) => m.map((x) => (x.streaming ? { role: "bot", text: x.text, sources: x.sources } : x)));
        if (!started && !failed) setMessages((m) => [...m, { role: "bot", error: t.asFail }]);
      }
    } catch (e) {
      setMessages((m) => [...m, { role: "bot", error: t.asFail, detail: String(e && e.message).slice(0, 120) }]);
    } finally {
      setBusy(false);
    }
  }

  // a strategy sent from the Rotation tab is asked once, as soon as this tab opens
  const handled = useRef(null);
  useEffect(() => {
    if (!request || handled.current === request.id) return;
    handled.current = request.id;
    ask(request.question, { strategy: request.strategy });
    if (onRequestHandled) onRequestHandled();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request]);

  const suggestions = [t.asQ1, t.asQ2, t.asQ3, t.asQ4, t.asQ5];
  const d = (field && field.details) || {};
  const locale = lang === "bn" ? "bn-BD" : "en-GB";
  const monthName = (m) => new Intl.DateTimeFormat(locale, { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2021, Number(m), 1)));
  const sow = d.currentSowMonth !== undefined && d.currentSowMonth !== "" ? monthName(d.currentSowMonth) : "";
  const texSimple = soilData && soilData.available && soilData.texture ? soilData.texture.simple : null;
  const knows = [
    d.currentCrop && (sow ? `${d.currentCrop}, ${fill(t.orbAsSown, { m: sow })}` : d.currentCrop),
    d.soil ? t.soilNames[d.soil] : texSimple ? t.soilNames[texSimple] : null,
    d.irrigation && t[`fdIrr_${d.irrigation}`],
    soilData && soilData.available && soilData.topsoil && soilData.topsoil.phh2o != null ? `pH ${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(soilData.topsoil.phh2o)}` : null,
    d.plannedCrop && fill(t.orbAsNext, { c: d.plannedCrop }),
    d.area && String(d.area.value || "").trim() ? `${d.area.value} ${d.area.unit}` : null,
    t.orbAsWeather,
  ].filter(Boolean);
  const warn = String(t.asWarn || "").split(/(?<=[.।])\s+/).filter(Boolean);

  return (
    <div className="as as2">
      <section className="as2-chat">
        <header className="as2-head">
          <div className="as-orb" aria-hidden="true"><i /><i /><i /></div>
          <div>
            <h3>{t.orbAsTitle}</h3>
            <p>{t.asIntro}</p>
          </div>
        </header>
        <div className="as-log as2-log" aria-live="polite">
          {messages.length === 0 && <p className="as2-empty">{t.orbAsEmpty}</p>}
          {messages.map((m, i) => (
            <div key={i} className={`as-msg ${m.role}${m.error ? " err" : ""}`}>
              <b className="sr-only">{m.role === "user" ? t.asYou : t.asBot}</b>
              {m.error ? <><p>{m.error}</p>{m.detail && <p className="small muted">{m.detail}</p>}</> : m.role === "user" ? <p>{m.text}</p> : renderAnswer(m.text)}
              {m.sources && m.sources.length > 0 && (
                <div className="as2-used">
                  <span>{t.orbAsUsed}</span>
                  {m.sources.map((s) => (s.url
                    ? <a key={s.n} href={s.url} target="_blank" rel="noreferrer">{s.title}</a>
                    : <em key={s.n}>{s.title}</em>))}
                </div>
              )}
            </div>
          ))}
          {busy && !messages.some((m) => m.streaming) && <div className="as-msg bot as2-wait"><p className="muted">{t.asThinking} <span className="as2-dots"><i /><i /><i /></span></p></div>}
          <div ref={endRef} />
        </div>
        <form className="as-form as2-form" onSubmit={(e) => { e.preventDefault(); ask(); }}>
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder={t.asPlaceholder} maxLength={500} aria-label={t.asPlaceholder} />
          <button className="tab as2-ask" type="submit" disabled={busy || !text.trim()}>{t.asAsk}</button>
          {messages.length > 0 && <button className="tab as2-clear" type="button" onClick={() => setMessages([])}>{t.asClear}</button>}
        </form>
      </section>

      <aside className="as2-side">
        <section className="as2-box">
          <h3>{t.asSuggest}</h3>
          <div className="as2-try">
            {suggestions.map((s) => <button key={s} type="button" onClick={() => ask(s)} disabled={busy}>{s}</button>)}
          </div>
        </section>
        <section className="as2-box">
          <h3>{t.orbAsKnows}</h3>
          <div className="as2-chips">{knows.map((k) => <span key={k}>{k}</span>)}</div>
        </section>
        <section className="as2-box as2-warn">
          <h3>{t.orbAsMind}</h3>
          <ul>{warn.map((w) => <li key={w}>{w}</li>)}</ul>
        </section>
      </aside>
    </div>
  );
}
