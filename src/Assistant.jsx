import { useEffect, useRef, useState } from "react";
import "./assistant.css";
import { buildAlerts, fetchWeatherPlus } from "./weatherPlus.js";
import { evaluateCrops, loadCropTable, soilInput } from "./suitability.js";

// Everything the assistant is told about this farm. It is built from data the app already has, so the answer is about THIS place.
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
    if (fd.plannedCrop) own.wantsToGrowNext = fd.plannedCrop;
    if (fd.previousCrops) own.grownBefore = fd.previousCrops;
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

// [S1] in the answer becomes a small badge
function renderAnswer(text) {
  return text.split("\n").map((line, i) => (
    <p key={i}>
      {line.split(/([\[【]S\d+[\]】])/g).map((part, j) => (/^[\[【]S\d+[\]】]$/.test(part) ? <sup key={j} className="as-cite">{part.slice(1, -1)}</sup> : part.replace(/\*\*/g, ""))) }
    </p>
  ));
}

export default function Assistant({ t, lang, lat, lon, label, country, soilData, env, field }) {
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
      if (!ctxRef.current) ctxRef.current = buildContext({ lat, lon, label, country, soilData, env, field });
      const context = await ctxRef.current;
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question, lang, context }),
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
        {busy && !messages.some((m) => m.streaming) && <div className="as-msg bot"><p className="muted">{t.asThinking}</p></div>}
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
