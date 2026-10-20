// Boundaries for every country the app knows, behind one set of functions.
// Each country has up to four levels. The four "slots" below are only names for level 1 to 4:
// for Bangladesh they are division / district / upazila / union, for the USA they are state / county / ZIP code.
// What each slot is CALLED for a country comes from that country's own list of level names.

const BASE = `${import.meta.env.BASE_URL}admin/`;
const cache = new Map();

function getJson(name) {
  if (!cache.has(name)) {
    cache.set(
      name,
      fetch(BASE + name)
        .then((r) => {
          if (!r.ok) throw new Error(`${name}: HTTP ${r.status}`);
          return r.json();
        })
        .catch((e) => {
          cache.delete(name); // let a later try start fresh
          throw e;
        })
    );
  }
  return cache.get(name);
}

export const SLOTS = ["division", "district", "upazila", "union"];
export const LEVELS = SLOTS;
export const EMPTY_CHAIN = { division: null, district: null, upazila: null, union: null };

// ---- the list of countries ----
const BANGLADESH = {
  iso: "BD",
  name: { en: "Bangladesh", bn: "বাংলাদেশ" },
  centre: { lat: 23.7, lon: 90.35 },
  bbox: [88.0, 20.55, 92.75, 26.7],
  levels: [
    { en: "Division", bn: "বিভাগ" },
    { en: "District", bn: "জেলা" },
    { en: "Upazila / Thana", bn: "উপজেলা / থানা" },
    { en: "Union / ward area", bn: "ইউনিয়ন / ওয়ার্ড এলাকা" },
  ],
};
export const COUNTRY_BBOX = BANGLADESH.bbox;
export const COUNTRY_CENTER = BANGLADESH.centre;

const NAME_BN = {
  IND: "ভারত", PAK: "পাকিস্তান", NPL: "নেপাল", MMR: "মিয়ানমার", BTN: "ভুটান", USA: "যুক্তরাষ্ট্র",
};
const LABEL_BN = {
  "State / Union territory": "রাজ্য / কেন্দ্রশাসিত অঞ্চল",
  District: "জেলা",
  "Sub-district / Tehsil / Block": "উপজেলা / তহসিল / ব্লক",
  "Province / Territory": "প্রদেশ / অঞ্চল",
  Tehsil: "তহসিল",
  Province: "প্রদেশ",
  "Local level (municipality)": "স্থানীয় স্তর (পৌরসভা)",
  "State / Region": "রাজ্য / অঞ্চল",
  Township: "টাউনশিপ",
  Dzongkhag: "জোংখাগ",
  Gewog: "গেওয়াং",
  State: "রাজ্য",
  County: "কাউন্টি",
  "ZIP code area (ZCTA)": "জিপ কোড এলাকা",
};

let registryPromise = null;
// Bangladesh first, then the countries listed in public/admin/world/manifest.json
export function loadRegistry() {
  if (!registryPromise) {
    registryPromise = getJson("world/manifest.json")
      .then((m) => [
        BANGLADESH,
        ...m.countries.map((c) => ({
          iso: c.iso,
          name: { en: c.name, bn: NAME_BN[c.iso] || c.name },
          centre: c.centre,
          bbox: c.bbox,
          levels: c.levels.map((l) => ({ en: l.label, bn: LABEL_BN[l.label] || l.label })),
          meta: c,
        })),
      ])
      .catch(() => {
        registryPromise = null;
        return [BANGLADESH];
      });
  }
  return registryPromise;
}

// ---- loading one country ----
const countries = new Map();

// A level is either "all" (one file, loaded at once) or "lazy" (one file per top-level area, loaded when needed).
export function loadCountry(info) {
  if (!countries.has(info.iso)) {
    const job =
      info.iso === "BD"
        ? Promise.all([
            getJson("country.json"),
            getJson("divisions.json"),
            getJson("districts.json"),
            getJson("upazilas.json"),
          ]).then(([country, divisions, districts, upazilas]) => ({
            iso: "BD",
            info,
            country,
            levels: [
              { slot: "division", fc: divisions },
              { slot: "district", fc: districts },
              { slot: "upazila", fc: upazilas },
              { slot: "union", fc: null, lazy: { keySlot: "district", file: (k) => `unions/${k}.json` } },
            ],
          }))
        : Promise.all([
            getJson(`world/${info.iso}/country.json`),
            ...info.meta.levels.map((lv, i) =>
              lv.layout === "all" ? getJson(`world/${info.iso}/L${i + 1}.json`) : Promise.resolve(null)
            ),
          ]).then(([country, ...fcs]) => ({
            iso: info.iso,
            info,
            country,
            levels: info.meta.levels.map((lv, i) => ({
              slot: SLOTS[i],
              fc: fcs[i],
              lazy: fcs[i] ? undefined : { keySlot: "division", file: (k) => `world/${info.iso}/L${i + 1}/${k}.json` },
            })),
          }));
    countries.set(
      info.iso,
      job.catch((e) => {
        countries.delete(info.iso);
        throw e;
      })
    );
  }
  return countries.get(info.iso);
}

// the key of the part file a lazy level needs, taken from the chain (null if the chain has no such area yet)
export function partKey(admin, index, chain) {
  const lv = admin.levels[index];
  if (!lv || !lv.lazy) return null;
  const parent = chain[lv.lazy.keySlot];
  return parent ? parent.id : null;
}

export const loadPart = (admin, index, key) => getJson(admin.levels[index].lazy.file(key));

async function poolOf(admin, index, chain) {
  const lv = admin.levels[index];
  if (!lv) return null;
  if (!lv.lazy) return lv.fc;
  const key = partKey(admin, index, chain);
  if (!key) return null;
  try {
    return await loadPart(admin, index, key);
  } catch {
    return null;
  }
}

const searchCache = new Map();
// the names of one country, for the search box: [{ l: slot, i, n, p, y, x, b }]
export function loadSearchIndex(info) {
  if (!searchCache.has(info.iso)) {
    const job =
      info.iso === "BD"
        ? getJson("search_index.json")
        : getJson(`world/${info.iso}/search.json`).then((list) => list.map((e) => ({ ...e, l: SLOTS[e.l - 1] })));
    searchCache.set(
      info.iso,
      job.catch((e) => {
        searchCache.delete(info.iso);
        throw e;
      })
    );
  }
  return searchCache.get(info.iso);
}

// ---- point in polygon ----
function inRing(x, y, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function inPolygon(x, y, polygon) {
  if (!inRing(x, y, polygon[0])) return false;
  for (let k = 1; k < polygon.length; k++) if (inRing(x, y, polygon[k])) return false; // a hole
  return true;
}

function contains(geometry, x, y) {
  if (geometry.type === "Polygon") return inPolygon(x, y, geometry.coordinates);
  if (geometry.type === "MultiPolygon") return geometry.coordinates.some((p) => inPolygon(x, y, p));
  return false;
}

function inBox(b, x, y, pad) {
  return x >= b[0] - pad && x <= b[2] + pad && y >= b[1] - pad && y <= b[3] + pad;
}

function segmentDistance(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const len = dx * dx + dy * dy;
  let t = len ? ((px - ax) * dx + (py - ay) * dy) / len : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function geometryDistance(geometry, x, y) {
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  let best = Infinity;
  for (const polygon of polygons) {
    for (const ring of polygon) {
      for (let i = 1; i < ring.length; i++) {
        best = Math.min(best, segmentDistance(x, y, ring[i - 1][0], ring[i - 1][1], ring[i][0], ring[i][1]));
      }
    }
  }
  return best;
}

// The shapes are simplified, so a tap on a river or on a hairline gap can miss every polygon.
// In that case take the closest one if it is within about 3 km.
const NEAR = 0.03;

function findInside(features, x, y) {
  for (const f of features) {
    if (inBox(f.properties.bbox, x, y, 0) && contains(f.geometry, x, y)) return f;
  }
  return null;
}

function findNear(features, x, y) {
  let best = null;
  let bestDistance = NEAR;
  for (const f of features) {
    if (!inBox(f.properties.bbox, x, y, NEAR)) continue;
    const d = geometryDistance(f.geometry, x, y);
    if (d < bestDistance) {
      best = f;
      bestDistance = d;
    }
  }
  return best;
}

// Which country is this point in? Returns its code, or null if it is in none of them.
export async function detectCountry(registry, lat, lon) {
  const area = (c) => (c.bbox[2] - c.bbox[0]) * (c.bbox[3] - c.bbox[1]);
  const outline = async (c) => {
    try {
      return await getJson(c.iso === "BD" ? "country.json" : `world/${c.iso}/country.json`);
    } catch {
      return null;
    }
  };
  const candidates = registry.filter((c) => inBox(c.bbox, lon, lat, 0)).sort((a, b) => area(a) - area(b));
  for (const c of candidates) {
    const shape = await outline(c);
    if (shape && contains(shape.geometry, lon, lat)) return c.iso;
  }
  // a tap on the coast or a river mouth can miss the simplified outline: take the closest country within ~5 km
  let best = null;
  let bestDistance = 0.05;
  for (const c of registry.filter((r) => inBox(r.bbox, lon, lat, 0.06))) {
    const shape = await outline(c);
    if (!shape) continue;
    const d = geometryDistance(shape.geometry, lon, lat);
    if (d < bestDistance) {
      best = c.iso;
      bestDistance = d;
    }
  }
  return best;
}

// Which area of each level is this point in? null if it is outside the country.
export async function locate(admin, lat, lon) {
  const first = findInside(admin.levels[0].fc.features, lon, lat) || findNear(admin.levels[0].fc.features, lon, lat);
  if (!first) return null;
  const chain = { ...EMPTY_CHAIN, division: first.properties };
  let previous = first.properties;

  for (let i = 1; i < admin.levels.length; i++) {
    const pool = await poolOf(admin, i, chain);
    if (!pool) break;
    // the areas of the level above own their children, but a ZIP area may cross a county line,
    // so look among the children first, then among everything in the file
    const children = pool.features.filter((f) => f.properties.parent === previous.id);
    const found =
      findInside(children, lon, lat) || findInside(pool.features, lon, lat) || findNear(children, lon, lat);
    if (!found) break;
    chain[SLOTS[i]] = found.properties;
    previous = found.properties;
  }

  // if the area found is listed under a different parent, show that parent so the dropdowns agree
  for (let i = admin.levels.length - 1; i >= 1; i--) {
    const current = chain[SLOTS[i]];
    const above = chain[SLOTS[i - 1]];
    if (!current || !above || !current.parent || above.id === current.parent) continue;
    const pool = await poolOf(admin, i - 1, chain);
    const owner = pool && pool.features.find((f) => f.properties.id === current.parent);
    if (owner) chain[SLOTS[i - 1]] = owner.properties;
  }
  return chain;
}

// The chain of areas above a chosen area, from its parent ids.
export async function buildChain(admin, index, props) {
  const chain = { ...EMPTY_CHAIN };
  let current = props;
  for (let i = index; i >= 0 && current; i--) {
    chain[SLOTS[i]] = current;
    if (i === 0) break;
    const level = admin.levels[i - 1];
    let pool = level.fc;
    if (!pool) {
      // a lazy level above: its file is named after the top-level area, which every area carries as "top"
      try {
        pool = await loadPart(admin, i - 1, current.top);
      } catch {
        pool = null;
      }
    }
    const parent = pool && pool.features.find((f) => f.properties.id === current.parent);
    current = parent ? parent.properties : null;
  }
  return chain;
}

export function deepestOf(chain) {
  for (let i = SLOTS.length - 1; i >= 0; i--) {
    if (chain[SLOTS[i]]) return { level: SLOTS[i], index: i, item: chain[SLOTS[i]] };
  }
  return null;
}

export function titleOf(chain) {
  const d = deepestOf(chain);
  if (!d) return null;
  // many areas are just called "Paurashava", "Ward No-14" or a ZIP number, so add the area above
  const above = d.index > 0 ? chain[SLOTS[d.index - 1]] : null;
  const vague = d.level === "union" || /^[\d\s-]+$/.test(d.item.name);
  return vague && above ? `${d.item.name} (${above.name})` : d.item.name;
}

export function pathText(chain) {
  return SLOTS.map((slot) => chain[slot] && chain[slot].name)
    .filter(Boolean)
    .join(" › ");
}

// ---- name search ----
const rank = (a, b) => SLOTS.indexOf(a.l) - SLOTS.indexOf(b.l) || a.n.localeCompare(b.n);

const fold = (text) =>
  text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

export function searchNames(index, query, limit = 8) {
  const q = fold(query.trim());
  if (q.length < 2) return [];
  const starts = [];
  const inside = [];
  for (const entry of index) {
    if (entry.s === undefined) entry.s = fold(entry.n);
    if (entry.s.startsWith(q)) starts.push(entry);
    else if (entry.s.includes(q)) inside.push(entry);
  }
  return [...starts.sort(rank), ...inside.sort(rank)].slice(0, limit);
}
