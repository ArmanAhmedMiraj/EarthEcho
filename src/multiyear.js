// A plan for several years in a row. Each year is one of the rotations EarthEcho already works out for the place
// (crops with sowing months). The years are chosen one after the other so that a crop from the same plant family does not
// come back within two seasons, starting from what the field grew before (My Farm). Simple rules, not a yield model.
import { historyOf } from "./history.js";
import { findCrop } from "./suitability.js";
import { isLegume } from "./rotation.js";

const BEAM = 10;

// extra cost of putting crop c after the crops already grown (oldest first)
function penalty(seq, c) {
  const last = seq[seq.length - 1], prev = seq[seq.length - 2];
  let p = 0;
  if (last && last.family === c.family) p += 0.3;
  if (prev && prev.family === c.family) p += 0.15;
  if (last && last.id === c.id) p += 0.15;
  // the same crop again soon: a little for the last three seasons, less for the three before them
  if (seq.slice(-3).some((x) => x.id === c.id)) p += 0.12;
  else if (seq.slice(-6, -3).some((x) => x.id === c.id)) p += 0.06;
  return p;
}
// does the family of c appear in the last two seasons?
const comesBack = (seq, c) => {
  const last = seq[seq.length - 1], prev = seq[seq.length - 2];
  return !!((last && last.family === c.family) || (prev && prev.family === c.family));
};

const inOrder = (steps) => [...steps].sort((a, b) => a.at - b.at);
const place = (steps, year) => inOrder(steps).map((o) => ({ ...o, abs: year * 12 + o.at }));
const clash = (occ, placed) => placed.some((o) => { for (let k = 0; k < o.months; k += 1) if (occ.has(o.abs + k)) return true; return false; });
const occupy = (occ, placed) => { const next = new Set(occ); placed.forEach((o) => { for (let k = 0; k < o.months; k += 1) next.add(o.abs + k); }); return next; };

// the crops this field grew before and the one growing now, oldest first
export function startSequence(field, results) {
  const d = (field && field.details) || {};
  const hit = (name) => { const r = results.find((x) => findCrop([x.crop], name)); return r ? r.crop : null; };
  const past = historyOf(d).filter((r) => r.crop.trim()).map((r) => hit(r.crop)).filter(Boolean).reverse();
  const now = d.currentCrop ? hit(d.currentCrop) : null;
  return now ? [...past, now] : past;
}

// How many seasons bring back a plant family within two seasons, for a list of placed years
function countReturns(start, yearsPlaced) {
  const seq = [...start];
  const back = [];
  let seasons = 0;
  yearsPlaced.forEach((placed) => {
    placed.forEach((o) => {
      if (comesBack(seq, o.crop)) back.push(o.crop);
      seq.push(o.crop);
      seasons += 1;
    });
  });
  return { back, seasons };
}

// pool: the rotations from planRotations. years: 3 or 4. current: the farmer's current rotation steps, or null.
export function planYears(pool, { start = [], years = 3, current = null, afterMonth = null } = {}) {
  if (!pool || !pool.length) return null;
  let states = [{ seq: [...start], occ: new Set(), placed: [], score: 0, origin: null }];
  for (let y = 0; y < years; y += 1) {
    const next = [];
    for (const st of states) {
      for (const r of pool) {
        const placed = place(r.steps, y);
        const first = placed[0].abs - y * 12; // the month the first crop of this year is sown
        // later years start within two months of year 1's first sowing, so each row of the timeline is one year of the plan
        if (y > 0 && (first < st.origin || first > st.origin + 2)) continue;
        if (clash(st.occ, placed)) continue;
        const seq = [...st.seq];
        let pen = 0;
        placed.forEach((o) => { pen += penalty(seq, o.crop); seq.push(o.crop); });
        // year 1 should begin soon after the crop growing now is harvested
        if (y === 0 && afterMonth != null) { const gap = (((first - afterMonth) % 12) + 12) % 12; if (gap > 3) pen += 0.04 * (gap - 3); }
        next.push({ seq, occ: occupy(st.occ, placed), placed: [...st.placed, placed], score: st.score + r.score - pen, origin: y === 0 ? first : st.origin });
      }
    }
    if (!next.length) return null;
    next.sort((a, b) => b.score - a.score);
    states = next.slice(0, BEAM);
  }
  const best = states[0];
  const origin = best.origin;
  // every crop gets rel: the month of the plan it starts in, counted from the first sowing
  const rows = best.placed.map((placed) => placed.map((o) => ({ ...o, rel: o.abs - origin })));
  const mine = countReturns(start, rows);
  const monthsInYear = rows.map((_, y) => { let n = 0; for (let m = 0; m < 12; m += 1) if (best.occ.has(origin + y * 12 + m)) n += 1; return n; });
  const legumeYears = rows.filter((placed) => placed.some((o) => isLegume(o.crop))).length;
  let baseline = null;
  if (current && current.length) {
    const repeated = Array.from({ length: years }, (_, y) => place(current, y));
    baseline = countReturns(start, repeated);
  }
  return { rows, origin, returns: mine.back, seasons: mine.seasons, monthsInYear, legumeYears, baseline, years };
}
