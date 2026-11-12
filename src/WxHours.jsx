import { useEffect, useMemo, useRef, useState } from "react";
import Info from "./Info.jsx";

const fill = (text, values) => Object.keys(values).reduce((s, k) => s.split(`{${k}}`).join(values[k]), text);

// "Next 2 days": one answer per day (hottest, coolest, rain, what to do), then a labelled chart of the ups and downs.
export default function WxHours({ t, locale, hours, days }) {
  const wrap = useRef(null);
  const [width, setWidth] = useState(720);
  useEffect(() => {
    const el = wrap.current;
    if (!el) return undefined;
    const set = () => setWidth(Math.max(300, Math.min(1100, Math.round(el.clientWidth || 720))));
    set();
    if (typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const nf = useMemo(() => new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }), [locale]);
  const nf1 = useMemo(() => new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }), [locale]);
  const hourF = useMemo(() => new Intl.DateTimeFormat(locale, { hour: "numeric", hour12: true }), [locale]);
  const at = (iso) => hourF.format(new Date(iso));

  const groups = useMemo(() => {
    const out = [];
    hours.forEach((h, i) => {
      const date = h.time.slice(0, 10);
      let g = out[out.length - 1];
      if (!g || g.date !== date) { g = { date, from: i, to: i, items: [] }; out.push(g); }
      g.to = i; g.items.push({ ...h, i });
    });
    return out.map((g) => {
      const hi = g.items.reduce((b, x) => (x.temp > b.temp ? x : b), g.items[0]);
      const lo = g.items.reduce((b, x) => (x.temp < b.temp ? x : b), g.items[0]);
      const rain = g.items.reduce((s, x) => s + (x.rain || 0), 0);
      const wet = g.items.reduce((b, x) => ((x.rain || 0) > (b.rain || 0) ? x : b), g.items[0]);
      return { ...g, hi, lo, rain, wet };
    });
  }, [hours]);

  const sun = useMemo(() => { const m = {}; (days || []).forEach((d) => { m[d.date] = [new Date(d.sunrise).getTime(), new Date(d.sunset).getTime()]; }); return m; }, [days]);

  const narrow = width < 540;
  const W = width, H = narrow ? 270 : 310, L = 38, R = 12, T = 30, B = 40;
  const n = hours.length;
  const temps = hours.map((h) => h.temp);
  const lo = Math.floor(Math.min(...temps) - 2), hi = Math.ceil(Math.max(...temps) + 2);
  const maxRain = Math.max(3, ...hours.map((h) => h.rain || 0));
  const x = (i) => L + (i * (W - L - R)) / Math.max(n - 1, 1);
  const y = (v) => T + ((hi - v) * (H - T - B)) / (hi - lo);
  const bw = Math.max(2, (W - L - R) / n - 1.5);
  const base = H - B;
  const line = hours.map((h, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(h.temp).toFixed(1)}`).join(" ");
  const step = Math.max(2, Math.round((hi - lo) / 4));
  const grid = []; for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) grid.push(v);
  const night = [];
  hours.forEach((h, i) => {
    const s = sun[h.time.slice(0, 10)];
    const tm = new Date(h.time).getTime();
    const isNight = s ? tm < s[0] || tm >= s[1] : false;
    if (isNight) { const last = night[night.length - 1]; if (last && last.to === i - 1) last.to = i; else night.push({ from: i, to: i }); }
  });
  const tickEvery = narrow ? 12 : 6;

  const names = [t.wfToday, t.wfTomorrow];
  const cards = groups.slice(0, 2).map((g, gi) => {
    const r = g.rain;
    const rainKey = r < 0.5 ? "none" : r < 5 ? "light" : r < 20 ? "mid" : "heavy";
    const tip = rainKey === "heavy" ? t.wfTipHeavy : rainKey === "mid" || (rainKey === "light" && g.wet.rain >= 1.5) ? t.wfTipRain : g.hi.temp >= 35 ? t.wfTipHot : t.wfTipOk;
    const icon = rainKey === "heavy" ? "🌧️" : rainKey === "mid" ? "🌦️" : rainKey === "light" ? "⛅" : g.hi.temp >= 35 ? "🔥" : "☀️";
    return { g, name: names[gi], rainKey, tip, icon };
  });

  return (
    <section className="wf-sec" aria-labelledby="wf-next">
      <h3 id="wf-next">{t.wfNextTitle}<Info t={t} source={t.wfNextSrc}><span>{t.wfNextInfo}</span></Info></h3>
      <div className="wf-days">
        {cards.map(({ g, name, rainKey, tip, icon }) => (
          <div className="wf-day" key={g.date}>
            <div className="wf-day-head"><span className="wf-ic" aria-hidden="true">{icon}</span><b>{name}</b></div>
            <div className="wf-temps"><span><small>{t.wfHottest}</small><strong>{nf.format(g.hi.temp)}°</strong><small>{at(g.hi.time)}</small></span><span><small>{t.wfCoolest}</small><strong>{nf.format(g.lo.temp)}°</strong><small>{at(g.lo.time)}</small></span></div>
            <div className={`wf-rain ${rainKey}`}>
              {rainKey === "none" ? t.wfRainNone : fill(t[`wfRain${rainKey === "light" ? "Light" : rainKey === "mid" ? "Mid" : "Heavy"}`], { mm: nf1.format(g.rain) })}
              {rainKey !== "none" && <small> · {fill(t.wfRainPeak, { t: at(g.wet.time) })}</small>}
            </div>
            <p className="wf-tip">{tip}</p>
          </div>
        ))}
      </div>

    </section>
  );
}
