// Farmland geometry: area, centre, box and a shape check for a boundary drawn on the map.
// A plot is { id, name, points: [[lon, lat], ...] } (3 or more points make a closed shape).

export const MAX_PARCELS = 12;
export const MAX_POINTS = 120;

const round6 = (n) => Math.round(n * 1e6) / 1e6;

// area in square metres, using a flat local projection (accurate to well under 1% for farm-sized land)
export function areaSqm(points) {
  if (!points || points.length < 3) return 0;
  const lat0 = points.reduce((s, p) => s + p[1], 0) / points.length;
  const kx = 111320 * Math.cos((lat0 * Math.PI) / 180);
  const ky = 110574;
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = [points[i][0] * kx, points[i][1] * ky];
    const [x2, y2] = [points[(i + 1) % points.length][0] * kx, points[(i + 1) % points.length][1] * ky];
    sum += x1 * y2 - x2 * y1;
  }
  return Math.abs(sum) / 2;
}

export const totalSqm = (parcels) => (parcels || []).reduce((s, p) => s + areaSqm(p.points), 0);

// the units a farmer thinks in (a bigha differs by region, so it is marked as approximate by the caller)
export function inUnits(sqm) {
  return {
    sqm,
    decimal: sqm / 40.4686,
    acre: sqm / 4046.86,
    hectare: sqm / 10000,
    bigha: sqm / 1337.8, // the common Bangladesh bigha of 33 decimal
  };
}

export function centroid(points) {
  if (!points || !points.length) return null;
  const n = points.length;
  return [points.reduce((s, p) => s + p[0], 0) / n, points.reduce((s, p) => s + p[1], 0) / n];
}

export function boundsOf(parcels) {
  let w = 181, s = 91, e = -181, n = -91;
  for (const p of parcels || []) for (const [x, y] of p.points) { w = Math.min(w, x); e = Math.max(e, x); s = Math.min(s, y); n = Math.max(n, y); }
  return w > e ? null : [[w, s], [e, n]];
}

// do two segments cross each other (not just touch at a shared end)
const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
function segCross(p1, p2, p3, p4) {
  const d1 = cross(p3, p4, p1), d2 = cross(p3, p4, p2), d3 = cross(p1, p2, p3), d4 = cross(p1, p2, p4);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}
// a boundary that crosses itself (a "bow-tie") has no sensible area
export function selfCrosses(points) {
  const n = points ? points.length : 0;
  if (n < 4) return false;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (Math.abs(i - j) <= 1 || (i === 0 && j === n - 1)) continue;
      if (segCross(points[i], points[(i + 1) % n], points[j], points[(j + 1) % n])) return true;
    }
  }
  return false;
}

export function distanceM(a, b) {
  const kx = 111320 * Math.cos((((a[1] + b[1]) / 2) * Math.PI) / 180);
  return Math.hypot((a[0] - b[0]) * kx, (a[1] - b[1]) * 110574);
}

// the parcels as GeoJSON, for drawing
export function toGeoJSON(parcels, activeId) {
  const features = [];
  for (const p of parcels) {
    const pts = p.points;
    const props = { id: p.id, name: p.name, active: p.id === activeId ? 1 : 0 };
    if (pts.length >= 3) features.push({ type: "Feature", properties: props, geometry: { type: "Polygon", coordinates: [[...pts, pts[0]]] } });
    else if (pts.length === 2) features.push({ type: "Feature", properties: props, geometry: { type: "LineString", coordinates: pts } });
  }
  return { type: "FeatureCollection", features };
}

// everything outside the plots, as one polygon with holes, so the surroundings can be dimmed
export function surroundingsMask(parcels) {
  const holes = parcels.filter((p) => p.points.length >= 3).map((p) => [...p.points, p.points[0]].reverse());
  return {
    type: "Feature",
    properties: {},
    geometry: { type: "Polygon", coordinates: [[[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]], ...holes] },
  };
}

// read plots from saved data and keep only what is safe to draw and store
export function cleanParcels(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const p of list.slice(0, MAX_PARCELS)) {
    if (!p || !Array.isArray(p.points)) continue;
    const points = p.points
      .filter((q) => Array.isArray(q) && Number.isFinite(Number(q[0])) && Number.isFinite(Number(q[1])) && Math.abs(q[0]) <= 180 && Math.abs(q[1]) <= 90)
      .slice(0, MAX_POINTS)
      .map((q) => [round6(Number(q[0])), round6(Number(q[1]))]);
    if (points.length < 3) continue;
    out.push({ id: String(p.id || `p${out.length + 1}${Math.random().toString(36).slice(2, 6)}`).slice(0, 20), name: String(p.name || "").slice(0, 60), points });
  }
  return out;
}

export const newParcelId = () => `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
