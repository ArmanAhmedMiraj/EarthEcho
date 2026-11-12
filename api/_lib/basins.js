// Simplified map of the rivers that reach Bangladesh and the places upstream that feed them.
//
// This is a hand-made guide, not a survey: each river is a rough line of points through Bangladesh, and each upstream
// "station" is one point on the river (or in the hills that feed it) that we watch. Lead times are rough travel times
// of a flood wave to Bangladesh, in days. The model reads the real flow at the strongest river cell near each point.
export const STATIONS = {
  tsetang: { lat: 29.26, lon: 91.77, country: "CN", lead: [10, 15], kind: "river" },
  pasighat: { lat: 28.07, lon: 95.33, country: "IN", lead: [7, 10], kind: "river" },
  dibrugarh: { lat: 27.48, lon: 94.91, country: "IN", lead: [5, 8], kind: "river" },
  guwahati: { lat: 26.18, lon: 91.75, country: "IN", lead: [2, 4], kind: "river" },
  dhubri: { lat: 26.02, lon: 89.98, country: "IN", lead: [1, 2], kind: "river" },
  varanasi: { lat: 25.32, lon: 83.01, country: "IN", lead: [7, 10], kind: "river" },
  patna: { lat: 25.61, lon: 85.14, country: "IN", lead: [4, 6], kind: "river" },
  kosi: { lat: 26.52, lon: 87.0, country: "NP", lead: [5, 8], kind: "river" },
  farakka: { lat: 24.8, lon: 87.92, country: "IN", lead: [1, 2], kind: "river" },
  silchar: { lat: 24.83, lon: 92.78, country: "IN", lead: [2, 3], kind: "river" },
  cherra: { lat: 25.28, lon: 91.72, country: "IN", lead: [0, 1], kind: "hill" },
  imphal: { lat: 24.8, lon: 93.94, country: "IN", lead: [3, 5], kind: "hill" },
  rangpo: { lat: 27.18, lon: 88.53, country: "IN", lead: [1, 3], kind: "river" },
  jalpaiguri: { lat: 26.55, lon: 88.72, country: "IN", lead: [1, 2], kind: "river" },
  aizawl: { lat: 23.73, lon: 92.72, country: "IN", lead: [1, 3], kind: "hill" },
  agartala: { lat: 23.83, lon: 91.28, country: "IN", lead: [0, 1], kind: "hill" },
};

// reach: points along the river inside Bangladesh. chain: stations from far upstream to near the border.
export const RIVERS = {
  jamuna: {
    reach: [[25.75, 89.72], [25.55, 89.72], [25.18, 89.69], [24.9, 89.7], [24.45, 89.72], [24.15, 89.74], [23.8, 89.75]],
    chain: ["tsetang", "pasighat", "dibrugarh", "guwahati", "dhubri"],
  },
  padma: {
    reach: [[24.4, 88.35], [24.07, 89.03], [23.95, 89.4], [23.78, 89.75], [23.55, 90.2], [23.25, 90.65]],
    chain: ["varanasi", "patna", "kosi", "farakka"],
  },
  meghna: {
    reach: [[25.07, 91.4], [25.04, 91.67], [24.89, 91.87], [24.7, 91.93], [24.6, 91.37], [24.05, 90.98], [23.55, 90.72], [23.25, 90.65]],
    chain: ["imphal", "silchar", "cherra"],
  },
  teesta: {
    reach: [[26.17, 88.97], [25.95, 89.2], [25.8, 89.4], [25.6, 89.62]],
    chain: ["rangpo", "jalpaiguri"],
  },
  karnaphuli: {
    reach: [[22.5, 92.2], [22.45, 92.0], [22.33, 91.9], [22.25, 91.8]],
    chain: ["aizawl"],
  },
  gumti: {
    reach: [[23.45, 91.18], [23.2, 91.2], [23.01, 91.4], [22.95, 91.45]],
    chain: ["agartala"],
  },
};

const RAD = Math.PI / 180;
export const kmBetween = (aLat, aLon, bLat, bLon) => {
  const h = Math.sin(((bLat - aLat) * RAD) / 2) ** 2 + Math.cos(aLat * RAD) * Math.cos(bLat * RAD) * Math.sin(((bLon - aLon) * RAD) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
};

// the closest point of a river line to a place (flat-map approximation, fine at this size)
function nearestOnLine(points, lat, lon) {
  let best = null;
  for (let i = 0; i < points.length - 1; i += 1) {
    const [aLat, aLon] = points[i], [bLat, bLon] = points[i + 1];
    const cosL = Math.cos(lat * RAD);
    const ax = (aLon - lon) * cosL, ay = aLat - lat, bx = (bLon - lon) * cosL, by = bLat - lat;
    const dx = bx - ax, dy = by - ay;
    const len = dx * dx + dy * dy;
    const s = len ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len)) : 0;
    const pLat = aLat + (bLat - aLat) * s, pLon = aLon + (bLon - aLon) * s;
    const km = kmBetween(lat, lon, pLat, pLon);
    if (!best || km < best.km) best = { km, lat: pLat, lon: pLon };
  }
  return best;
}

// the river that passes closest to the place
export function nearestRiver(lat, lon) {
  let best = null;
  for (const [id, r] of Object.entries(RIVERS)) {
    const hit = nearestOnLine(r.reach, lat, lon);
    if (hit && (!best || hit.km < best.km)) best = { id, ...hit };
  }
  return best;
}
