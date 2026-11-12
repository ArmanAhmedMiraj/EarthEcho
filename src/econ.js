// Money numbers for the rotation planner. Each number says where it came from:
//   "you"    typed or chosen by the farmer
//   "market" the latest price reported by WFP (UN) for the nearest market, times the farmer's share (see FARM_SHARE)
//   "est"    a rough EarthEcho estimate from typical farm-gate prices, yields and costs. It is NOT a measurement.
// Nothing here is a forecast. Prices move with the season; costs and yields change with variety, land and care.
import { TYPICAL_YIELD } from "./rotation.js";

// Share of the shop (retail) price that a farmer usually gets at the farm gate. WFP prices are mostly retail. Rough: 55 to 80 percent.
export const FARM_SHARE = 0.65;

// Rough farm-gate price in US dollars per kg (south Asia, typical year). Rounded.
const PRICE_USD_KG = {
  rice: 0.28, wheat: 0.3, maize: 0.22, barley: 0.25, sorghum: 0.25, pearlmillet: 0.3, fingermillet: 0.35, lentil: 0.9, chickpea: 0.8,
  mungbean: 1.0, urd: 1.0, pigeonpea: 0.8, pea: 0.6, cowpea: 0.7, grasspea: 0.5, hyacinth: 0.5, soybean: 0.5, groundnut: 0.9,
  sesame: 1.3, sunflower: 0.5, mustard: 0.6, safflower: 0.5, linseed: 0.6, castor: 0.5, potato: 0.18, tomato: 0.25, eggplant: 0.25,
  cabbage: 0.12, cauliflower: 0.18, onion: 0.3, garlic: 0.8, okra: 0.4, carrot: 0.25, radish: 0.12, spinach: 0.2, cucumber: 0.25,
  pumpkin: 0.15, bittergourd: 0.35, bottlegourd: 0.15, ridgedgourd: 0.3, snakegourd: 0.25, waxgourd: 0.15, sweetpepper: 0.5,
  chilli: 0.6, ceylonspinach: 0.2, coriander: 0.5, sweetpotato: 0.2, cassava: 0.1, ginger: 0.9, turmeric: 0.6, whitejute: 0.6,
  tossajute: 0.6, cotton: 0.6, sugarcane: 0.04,
};
// Rough yields for small farms in south Asia, tonnes per hectare. These replace the world averages (rotation.js), which are higher
// than most small farms get. They are a starting point: the farmer's own yield is better.
const YIELD_T_HA = {
  rice: 4, wheat: 3, maize: 6, barley: 2, sorghum: 1.5, pearlmillet: 1.2, fingermillet: 1.4, lentil: 1.1, chickpea: 1, mungbean: 0.9, urd: 0.9,
  pigeonpea: 1, pea: 1.5, cowpea: 1, grasspea: 1, hyacinth: 1, soybean: 1.8, groundnut: 1.8, sesame: 0.7, sunflower: 1.8, mustard: 1.3,
  safflower: 1, linseed: 0.8, castor: 1.2, potato: 18, tomato: 20, eggplant: 16, cabbage: 25, cauliflower: 16, onion: 11, garlic: 5, okra: 7,
  carrot: 15, radish: 15, spinach: 8, cucumber: 12, pumpkin: 15, bittergourd: 8, bottlegourd: 18, ridgedgourd: 8, snakegourd: 10,
  waxgourd: 16, sweetpepper: 9, chilli: 3, ceylonspinach: 12, coriander: 6, sweetpotato: 15, cassava: 12, ginger: 12, turmeric: 8,
  whitejute: 2.5, tossajute: 2.5, cotton: 1.5, sugarcane: 60,
};
const GROUP_PRICE = { cereal: 0.28, pulse: 0.8, oilseed: 0.7, vegetable: 0.3, root: 0.2, fibre: 0.6, cash: 0.1, fruit: 0.4 };

// Rough cost of growing one hectare for one crop cycle (seed, fertiliser, labour, water, other), US dollars. Rounded.
const COST_USD_HA = {
  rice: 750, wheat: 520, maize: 650, barley: 400, sorghum: 350, pearlmillet: 300, fingermillet: 320, lentil: 350, chickpea: 380,
  mungbean: 300, urd: 300, pigeonpea: 400, pea: 450, cowpea: 350, grasspea: 250, hyacinth: 300, soybean: 450, groundnut: 650,
  sesame: 300, sunflower: 500, mustard: 350, safflower: 350, linseed: 300, castor: 350, potato: 2400, tomato: 3000, eggplant: 2800,
  cabbage: 2000, cauliflower: 2100, onion: 2200, garlic: 2400, okra: 1600, carrot: 1700, radish: 900, spinach: 900, cucumber: 1700,
  pumpkin: 1200, bittergourd: 1800, bottlegourd: 1400, ridgedgourd: 1600, snakegourd: 1500, waxgourd: 1300, sweetpepper: 2400,
  chilli: 1800, ceylonspinach: 900, coriander: 1000, sweetpotato: 1200, cassava: 900, ginger: 3000, turmeric: 2400, whitejute: 700,
  tossajute: 700, cotton: 800, sugarcane: 2500,
};
const GROUP_COST = { cereal: 600, pulse: 350, oilseed: 400, vegetable: 2000, root: 1500, fibre: 700, cash: 1500, fruit: 1500 };
const GROUP_YIELD = { cereal: 3, pulse: 1, oilseed: 1.5, vegetable: 15, root: 12, fibre: 2, cash: 40, fruit: 10 };

const num = (v) => { const n = Number(v); return v !== "" && v != null && Number.isFinite(n) && n >= 0 ? n : null; };

// ctx: { inputs: { [cropId]: { yield, price, cost } } typed by the farmer, market: { [cropId]: { perKg, market, km, month } },
//        rate: local money per US dollar (from the WFP file) or null, currency }
export function econFor(crop, ctx) {
  const u = (ctx.inputs && ctx.inputs[crop.id]) || {};
  const rate = ctx.rate || null;
  const local = (usd) => (rate ? usd * rate : usd);

  let yv = num(u.yield), ys = "you";
  if (!(yv > 0)) { yv = YIELD_T_HA[crop.id] != null ? YIELD_T_HA[crop.id] : TYPICAL_YIELD[crop.id] != null ? TYPICAL_YIELD[crop.id] : GROUP_YIELD[crop.group] || 5; ys = "est"; }

  let pv = num(u.price), ps = "you", pm = null;
  if (!(pv > 0)) {
    const m = ctx.market && ctx.market[crop.id];
    if (m && m.perKg > 0) { pv = m.perKg * (ctx.share || FARM_SHARE); ps = "market"; pm = m; }
    else { pv = local(PRICE_USD_KG[crop.id] != null ? PRICE_USD_KG[crop.id] : GROUP_PRICE[crop.group] || 0.3); ps = "est"; }
  }
  let cv = num(u.cost), cs = "you";
  if (cv == null || u.cost === "") { cv = local(COST_USD_HA[crop.id] != null ? COST_USD_HA[crop.id] : GROUP_COST[crop.group] || 800); cs = "est"; }
  const revenue = yv * 1000 * pv;
  return { yield: { v: yv, src: ys }, price: { v: pv, src: ps, market: pm }, cost: { v: cv, src: cs }, revenue, profit: revenue - cv };
}

export function rotationProfit(steps, ctx) {
  const parts = steps.map((o) => ({ crop: o.crop, ...econFor(o.crop, ctx) }));
  const total = parts.reduce((s, p) => s + p.profit, 0);
  // how much of the number rests on rough estimates: 0 (all typed or from market data) to 1 (all rough)
  const rough = parts.reduce((s, p) => s + (p.yield.src === "est" ? 1 : 0) + (p.price.src === "est" ? 1 : 0) + (p.cost.src === "est" ? 1 : 0), 0) / (parts.length * 3);
  return { parts, total, rough };
}
