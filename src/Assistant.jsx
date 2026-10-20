import { useEffect, useRef, useState } from "react";
import "./assistant.css";
import { buildAlerts, fetchWeatherPlus } from "./weatherPlus.js";
import { evaluateCrops, loadCropTable, soilInput } from "./suitability.js";

// Everything the assistant is told about this farm. It is built from data the app already has, so the answer is about THIS place.
async function buildContext({ lat, lon, label, country, soilData, env }) {
  const ctx = { place: label || `${lat.toFixed(2)}, ${lon.toFixed(2)}`, latitude: +lat.toFixed(3), longitude: +lon.toFixed(3), country };
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

// [S1] in the answer becomes a small badge
function renderAnswer(text) {
  return text.split("\n").map((line, i) => (
    <p key={i}>
      {line.split(/(\[S\d+\])/g).map((part, j) => (/^\[S\d+\]$/.test(part) ? <sup key={j} className="as-cite">{part.slice(1, -1)}</sup> : part.replace(/\*\*/g, ""))) }
    </p>
  ));
}

export default function Assistant({ t, lang, lat, lon, label, country, soilData, env }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const ctxRef = useRef(null);
  const endRef = useRef(null);
  useEffect(() => { ctxRef.current = null; }, [lat, lon]);
  useEffect(() => { if (endRef.current) endRef.current.scrollIntoView({ block: "nearest" }); }, [messages, busy]);

  async function ask(q) {
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
      if (!ctxRef.current) ctxRef.current = await buildContext({ lat, lon, label, country, soilData, env });
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question, lang, context: ctxRef.current }),
      });
      const data = await response.json().catch(() => null);
      if (data && data.ok) setMessages((m) => [...m, { role: "bot", text: data.answer, sources: data.sources || [] }]);
      else {
        const map = { nokey: t.asNoKey, quota: t.asQuota, rate: t.asRate, badkey: t.asBadKey };
        setMessages((m) => [...m, { role: "bot", error: map[data && data.error] || t.asFail, detail: data && data.detail }]);
      }
    } catch {
      setMessages((m) => [...m, { role: "bot", error: t.asFail }]);
    } finally {
      setBusy(false);
    }
  }

  const suggestions = [t.asQ1, t.asQ2, t.asQ3, t.asQ4, t.asQ5];
  return (
    <div className="as">
      <p className="small muted">{t.asIntro}</p>
      <p className="as-warn">{t.asWarn}</p>
      {messages.length === 0 && (
        <div className="as-suggest">
          <span className="small muted">{t.asSuggest}</span>
          {suggestions.map((s) => (
            <button key={s} className="tab" onClick={() => ask(s)}>{s}</button>
          ))}
        </div>
      )}
      <div className="as-log" aria-live="polite">
        {messages.map((m, i) => (
          <div key={i} className={`as-msg ${m.role}${m.error ? " err" : ""}`}>
            <b>{m.role === "user" ? t.asYou : t.asBot}</b>
            {m.error ? <><p>{m.error}</p>{m.detail && <p className="small muted">{m.detail}</p>}</> : m.role === "user" ? <p>{m.text}</p> : renderAnswer(m.text)}
            {m.sources && m.sources.length > 0 && (
              <details className="as-src">
                <summary>{t.asSources} ({m.sources.length})</summary>
                <ol>
                  {m.sources.map((s) => (
                    <li key={s.n} value={s.n}>
                      {s.url ? <a href={s.url} target="_blank" rel="noreferrer">{s.title}</a> : s.title}
                    </li>
                  ))}
                </ol>
              </details>
            )}
          </div>
        ))}
        {busy && <div className="as-msg bot"><p className="muted">{t.asThinking}</p></div>}
        <div ref={endRef} />
      </div>
      <form className="as-form" onSubmit={(e) => { e.preventDefault(); ask(); }}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder={t.asPlaceholder} maxLength={500} aria-label={t.asPlaceholder} />
        <button className="tab" type="submit" disabled={busy || !text.trim()}>{t.asAsk}</button>
        {messages.length > 0 && <button className="tab" type="button" onClick={() => setMessages([])}>{t.asClear}</button>}
      </form>
    </div>
  );
}
