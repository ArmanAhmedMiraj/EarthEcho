// Long-term climate trend for one point, from NASA POWER monthly data (2001 to last full year).
// Example: /api/trend?lat=25.75&lon=89.25
import { badRequest, cacheFor, fetchJson, readPoint } from "./_lib/answer.js";

const START = 2001;
const clean = (v) => (typeof v === "number" && v > -990 ? v : null);
const DAYS = [31, 28.25, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const sd = (a) => { const m = mean(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1)); };

// Ordinary least squares line through (year, value). Gives slope per year and a rough 95% check.
export function fitTrend(years, values) {
  const n = values.length;
  const mx = mean(years), my = mean(values);
  let sxx = 0, sxy = 0;
  years.forEach((x, i) => { sxx += (x - mx) ** 2; sxy += (x - mx) * (values[i] - my); });
  const slope = sxy / sxx;
  const resid = values.map((v, i) => v - (my + slope * (years[i] - mx)));
  const se = Math.sqrt(resid.reduce((s, r) => s + r * r, 0) / (n - 2) / sxx);
  const t = se > 0 ? slope / se : 0;
  const df = n - 2;
  const crit = 1.96 + 2.4 / df + 1.5 / (df * df); // 95% two-sided t value, close enough for df >= 8
  return { slopePerYear: slope, t, clear: Math.abs(t) > crit };
}

// Look for one sudden step in a yearly series (a change of satellite or model input shows up like this, not like climate).
// Returns { year, before, after, change } for the best split when the step is large, else null.
export function findStep(years, values) {
  let best = null;
  for (let k = 5; k <= values.length - 5; k += 1) {
    const a = values.slice(0, k), b = values.slice(k);
    const pooled = Math.sqrt(((a.length - 1) * sd(a) ** 2 + (b.length - 1) * sd(b) ** 2) / (values.length - 2));
    const z = pooled > 0 ? Math.abs(mean(b) - mean(a)) / pooled : 0;
    const change = (mean(b) - mean(a)) / Math.abs(mean(a));
    if (!best || z > best.z) best = { z, year: years[k], before: mean(a), after: mean(b), change };
  }
  return best && best.z > 1.5 && Math.abs(best.change) > 0.3 ? best : null;
}

export default async function handler(req, res) {
  const point = readPoint(req.query || {});
  if (!point) return badRequest(res, "Give a real place: ?lat=25.75&lon=89.25");
  const end = new Date().getUTCFullYear() - 1;
  const thisYear = end + 1; // this year's finished months are read too, for the "a year most like this one" comparison
  const url =
    "https://power.larc.nasa.gov/api/temporal/monthly/point" +
    `?parameters=T2M,PRECTOTCORR&community=AG&longitude=${point.lon}&latitude=${point.lat}` +
    `&start=${START}&end=${thisYear}&format=JSON`;

  let raw;
  try { raw = await fetchJson(url, 25000); }
  catch (error) { return res.status(502).json({ ok: false, error: `NASA POWER did not answer (${error.message}).` }); }
  const p = raw && raw.properties && raw.properties.parameter;
  if (!p || !p.T2M || !p.PRECTOTCORR) return res.status(502).json({ ok: false, error: "NASA POWER sent an unexpected answer." });

  const years = [], temp = [], rain = [];
  const monthRain = Array.from({ length: 12 }, () => []);
  const monthTemp = Array.from({ length: 12 }, () => []);
  const rainByYear = [], tempByYear = [];
  for (let y = START; y <= end; y += 1) {
    const ts = [], rs = [];
    for (let m = 1; m <= 12; m += 1) {
      const key = `${y}${String(m).padStart(2, "0")}`;
      const t = clean(p.T2M[key]), r = clean(p.PRECTOTCORR[key]);
      if (t == null || r == null) break;
      ts.push(t); rs.push(r * DAYS[m - 1]); // mm per day to mm per month
    }
    if (ts.length === 12) {
      years.push(y); temp.push(mean(ts)); rain.push(rs.reduce((s, x) => s + x, 0));
      rainByYear.push(rs.map((v) => Math.round(v))); tempByYear.push(ts.map((v) => Number(v.toFixed(1))));
      rs.forEach((r, i) => monthRain[i].push(r));
      ts.forEach((v, i) => monthTemp[i].push(v));
    }
  }
  if (years.length < 10) return res.status(502).json({ ok: false, error: "Not enough years of NASA POWER data for this place." });

  // this year, month by month, up to the last finished month (the month in progress is not used)
  const doneMonths = new Date().getUTCMonth();
  const nowRain = [], nowTemp = [];
  for (let m = 1; m <= doneMonths; m += 1) {
    const key = `${thisYear}${String(m).padStart(2, "0")}`;
    const t = clean(p.T2M[key]), r = clean(p.PRECTOTCORR[key]);
    if (t == null || r == null) break;
    nowRain.push(Math.round(r * DAYS[m - 1])); nowTemp.push(Number(t.toFixed(1)));
  }

  const rainStep = findStep(years, rain), tempStep = findStep(years, temp);
  const tf = fitTrend(years, temp), rf = fitTrend(years, rain);
  const round = (v, d) => Number(v.toFixed(d));
  const stats = (rainSets, tempSets, from) => rainSets.map((all, i) => {
    const a = all.slice(from), tt = tempSets[i].slice(from);
    const m = mean(a), s = sd(a);
    return { mean: round(m, 0), sd: round(s, 0), cv: m > 5 ? round(s / m, 2) : null, min: round(Math.min(...a), 0), max: round(Math.max(...a), 0), tmean: round(mean(tt), 1) };
  });
  const months = stats(monthRain, monthTemp, 0);
  const recentFrom = Math.max(0, years.length - 10); // the last ten years, used when the series has a jump
  const monthsRecent = stats(monthRain, monthTemp, recentFrom);

  cacheFor(res, 2 * 86400); // the history changes once a year, but this year's months are added as they finish
  res.status(200).json({
    ok: true,
    location: point,
    from: years[0], to: years[years.length - 1], n: years.length,
    years,
    temp: temp.map((v) => round(v, 2)),
    rain: rain.map((v) => round(v, 0)),
    tempTrend: { perDecade: round(tf.slopePerYear * 10, 2), clear: tf.clear && !tempStep },
    rainTrend: { perDecade: round(rf.slopePerYear * 10, 0), meanMm: round(mean(rain), 0), clear: rf.clear && !rainStep },
    // a sudden jump in the series is more likely a change in NASA's inputs than in the climate, so no trend is claimed
    rainStep: rainStep ? { year: rainStep.year, before: round(rainStep.before, 0), after: round(rainStep.after, 0) } : null,
    tempStep: tempStep ? { year: tempStep.year, before: round(tempStep.before, 2), after: round(tempStep.after, 2) } : null,
    rainCv: round(sd(rain) / mean(rain), 3),
    wettest: years[rain.indexOf(Math.max(...rain))], driest: years[rain.indexOf(Math.min(...rain))],
    driestMm: round(Math.min(...rain), 0), wettestMm: round(Math.max(...rain), 0),
    perYear: { rain: rainByYear, temp: tempByYear },
    thisYear: { year: thisYear, rain: nowRain, temp: nowTemp },
    months,
    monthsRecent, recentFrom: years[Math.max(0, years.length - 10)],
    source: { name: "NASA POWER monthly (MERRA-2 / IMERG based)", url: "https://power.larc.nasa.gov/docs/", resolution: "About 0.5° × 0.625° per cell (roughly 55 km)" },
  });
}
