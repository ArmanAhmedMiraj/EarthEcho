// A second soil opinion for Bangladesh, used only as a cross-check (never to replace the main soil estimate).
// The file hwsd_bd.json is made from the FAO/IIASA Harmonized World Soil Database v2.0: for each map unit it holds
// the topsoil (0-20 cm) texture class of the main soil in that unit, and how big that main soil's share of the unit is.

const BASE = import.meta.env.BASE_URL;

export const GROUP = {
  Sand: "coarse", "Loamy Sand": "coarse", "Sandy Loam": "coarse",
  Loam: "medium", "Silty Loam": "medium", Silt: "medium", "Sandy Clay Loam": "medium",
  "Clay Loam": "fine", "Silty Clay Loam": "fine", "Sandy Clay": "fine", "Silty Clay": "fine", Clay: "fine",
};

let pending = null;
export function loadSecondMap() {
  if (!pending) {
    pending = fetch(`${BASE}hwsd_bd.json`)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
    pending.then((m) => { if (!m) pending = null; });
  }
  return pending;
}

// the class of the map cell at the point; if that cell is blank (water, built-up land) the nearest cell within 5 cells (about 5 km)
export function lookupSecond(map, lat, lon) {
  if (!map || !map.grid) return null;
  const col0 = Math.floor((lon - map.lon0) / map.dlon);
  const row0 = Math.floor((lat - map.lat0) / map.dlat);
  for (let radius = 0; radius <= 5; radius += 1) {
    for (let dr = -radius; dr <= radius; dr += 1) {
      for (let dc = -radius; dc <= radius; dc += 1) {
        if (Math.max(Math.abs(dr), Math.abs(dc)) !== radius) continue;
        const row = row0 + dr;
        const col = col0 + dc;
        if (row < 0 || row >= map.rows || col < 0 || col >= map.cols) continue;
        const code = map.grid[row].charCodeAt(col) - 96;
        if (code >= 1 && code < map.classes.length) {
          const name = map.classes[code];
          const share = (Number(map.share[row][col]) || 0) * 10; // lower end of the 10% step
          return { name, group: GROUP[name] || null, share, movedCells: radius };
        }
      }
    }
  }
  return null;
}

// agree = same texture class, close = same group (heavy, medium, light), differ = different group
export function compareSoil(first, second) {
  if (!first || !second) return null;
  if (first.name === second.name) return "agree";
  if (first.group && first.group === second.group) return "close";
  return "differ";
}
