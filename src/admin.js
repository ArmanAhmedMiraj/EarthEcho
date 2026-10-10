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

export const COUNTRY_BBOX = [88.0, 20.55, 92.75, 26.7];
export const COUNTRY_CENTER = { lat: 23.7, lon: 90.35 };

export const LEVELS = ["division", "district", "upazila", "union"];

export function loadAdmin() {
  return Promise.all([
    getJson("country.json"),
    getJson("divisions.json"),
    getJson("districts.json"),
    getJson("upazilas.json"),
  ]).then(([country, divisions, districts, upazilas]) => ({ country, divisions, districts, upazilas }));
}

export const loadUnions = (districtId) => getJson(`unions/${districtId}.json`);
export const loadSearchIndex = () => getJson("search_index.json");

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

function find(features, x, y) {
  for (const f of features) {
    if (inBox(f.properties.bbox, x, y, 0) && contains(f.geometry, x, y)) return f;
  }
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

export const EMPTY_CHAIN = { division: null, district: null, upazila: null, union: null };

// Which division, district, upazila and union is this point in? null if it is outside Bangladesh.
export async function locate(admin, lat, lon) {
  const district = find(admin.districts.features, lon, lat);
  if (!district) return null;
  const d = district.properties;

  const upazila = find(
    admin.upazilas.features.filter((f) => f.properties.parent === d.id),
    lon,
    lat
  );

  let union = null;
  if (upazila) {
    try {
      const unions = await loadUnions(d.id);
      union = find(
        unions.features.filter((f) => f.properties.parent === upazila.properties.id),
        lon,
        lat
      );
    } catch {
      /* union file missing: stop at upazila */
    }
  }

  const division = admin.divisions.features.find((f) => f.properties.id === d.parent);
  return {
    division: division ? division.properties : null,
    district: d,
    upazila: upazila ? upazila.properties : null,
    union: union ? union.properties : null,
  };
}

export function deepestOf(chain) {
  for (const level of ["union", "upazila", "district", "division"]) {
    if (chain[level]) return { level, item: chain[level] };
  }
  return null;
}

export function titleOf(chain) {
  const d = deepestOf(chain);
  if (!d) return null;
  // many unions are just called "Paurashava" or "Ward No-14", so add the upazila
  return d.level === "union" && chain.upazila ? `${d.item.name} (${chain.upazila.name})` : d.item.name;
}

export function pathText(chain) {
  return LEVELS.map((level) => chain[level] && chain[level].name)
    .filter(Boolean)
    .join(" › ");
}

// ---- name search ----
const ORDER = { division: 0, district: 1, upazila: 2, union: 3 };
const rank = (a, b) => ORDER[a.l] - ORDER[b.l] || a.n.localeCompare(b.n);

export function searchNames(index, query, limit = 8) {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const starts = [];
  const inside = [];
  for (const entry of index) {
    const name = entry.n.toLowerCase();
    if (name.startsWith(q)) starts.push(entry);
    else if (name.includes(q)) inside.push(entry);
  }
  return [...starts.sort(rank), ...inside.sort(rank)].slice(0, limit);
}