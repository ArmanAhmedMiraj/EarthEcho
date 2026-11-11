// "A past year most like this one": compare the last few finished months of this year (rain and temperature, NASA POWER)
// with the same calendar months of earlier years, and list the closest years. This is a comparison with the past,
// not a forecast: what followed in a similar year is shown only as one example of what has happened before.
const WINDOW = 6;
const NEXT = 3;
const RAIN_SD_FLOOR = 15; // mm: in a dry month the spread is tiny, so a floor stops a few mm from counting as a big difference
const TEMP_SD_FLOOR = 0.5; // °C

const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const sd = (a) => { if (a.length < 2) return 0; const m = mean(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1)); };

// closeness words from the typical gap in "usual spread" units
export const closeness = (d) => (d <= 0.7 ? "close" : d <= 1.1 ? "fair" : "weak");

export function findAnalogues(trend, { len = WINDOW, take = 3 } = {}) {
  if (!trend || !trend.perYear || !trend.thisYear || !Array.isArray(trend.years)) return null;
  const { years } = trend;
  const cur = trend.thisYear;
  const series = new Map(); // month number since year 0 -> { rain, temp }
  years.forEach((y, i) => { for (let m = 0; m < 12; m += 1) series.set(y * 12 + m, { rain: trend.perYear.rain[i][m], temp: trend.perYear.temp[i][m] }); });
  cur.rain.forEach((r, m) => series.set(cur.year * 12 + m, { rain: r, temp: cur.temp[m] }));
  const T = Math.max(...series.keys()); // the last finished month
  const at = (abs) => series.get(abs);
  for (let k = 0; k < len; k += 1) if (!at(T - k)) return null;

  // NASA's rainfall series can jump in one year (a change of inputs, not of climate): then only years from the jump are compared
  const minYear = trend.rainStep ? trend.rainStep.year : 0;
  const poolYears = years.filter((y) => y >= minYear);
  const stats = Array.from({ length: 12 }, (_, m) => {
    const r = [], t = [];
    poolYears.forEach((y) => { const v = at(y * 12 + m); if (v) { r.push(v.rain); t.push(v.temp); } });
    return { rainSd: Math.max(sd(r), RAIN_SD_FLOOR), tempSd: Math.max(sd(t), TEMP_SD_FLOOR), rainMean: r.length ? mean(r) : null, rainMin: r.length ? Math.min(...r) : null, rainMax: r.length ? Math.max(...r) : null };
  });

  const rowOf = (abs) => ({ m0: ((abs % 12) + 12) % 12, year: Math.floor(abs / 12), ...at(abs) });
  const window = Array.from({ length: len }, (_, k) => rowOf(T - len + 1 + k));

  const found = [];
  for (let shift = 1; shift <= years.length; shift += 1) {
    const start = T - len + 1 - 12 * shift;
    if (Math.floor(start / 12) < minYear) break;
    const idx = Array.from({ length: len }, (_, k) => start + k);
    if (!idx.every((i) => at(i))) continue;
    let sum = 0;
    idx.forEach((abs, k) => {
      const now = window[k], then = at(abs), m = now.m0;
      const dr = (now.rain - then.rain) / stats[m].rainSd, dt = (now.temp - then.temp) / stats[m].tempSd;
      sum += (dr * dr + dt * dt) / 2;
    });
    const d = Math.sqrt(sum / len);
    const next = Array.from({ length: NEXT }, (_, k) => T + 1 + k - 12 * shift).filter((i) => at(i)).map(rowOf);
    found.push({ shift, d, endYear: Math.floor((T - 12 * shift) / 12), rows: idx.map(rowOf), next });
  }
  found.sort((a, b) => a.d - b.d);

  const nextRange = Array.from({ length: NEXT }, (_, k) => {
    const m0 = (T + 1 + k) % 12;
    return { m0, ...stats[m0] };
  });
  return {
    window, matches: found.slice(0, take), nextRange,
    from: poolYears[0] != null ? poolYears[0] : null, usedJump: !!trend.rainStep, jumpYear: trend.rainStep ? trend.rainStep.year : null,
    pool: found.length,
  };
}
