// Soil types a farmer can choose, a lookup in the SoilGrids-based map file,
// and a rough regional default used only if the map file is missing.

const BASE = import.meta.env.BASE_URL;

export const SOIL_TYPES = ["sandy", "sandyLoam", "loam", "siltLoam", "clayLoam", "clay"];

// The map uses 12 USDA texture classes. The app shows 6 simpler soil types.
const CLASS_TO_SOIL = {
  Clay: "clay",
  "Silty Clay": "clay",
  "Sandy Clay": "clay",
  "Clay Loam": "clayLoam",
  "Silty Clay Loam": "clayLoam",
  "Sandy Clay Loam": "clayLoam",
  Loam: "loam",
  "Silty Loam": "siltLoam",
  Silt: "siltLoam",
  "Sandy Loam": "sandyLoam",
  "Loamy Sand": "sandy",
  Sand: "sandy",
};

export const SOIL_NOTE = {
  en: {
    map: "Estimated from ISRIC SoilGrids, a satellite- and sample-based soil map (about 250 m, CC BY 4.0). It is a model estimate, not a test of your field. Please confirm or change it.",
    region: "Typical for this region (a rough guide, not measured). Please confirm or change it.",
  },
  bn: {
    map: "ISRIC SoilGrids (স্যাটেলাইট ও নমুনা-ভিত্তিক মাটির মানচিত্র, প্রায় ২৫০ মিটার, CC BY 4.0) থেকে অনুমান করা হয়েছে। এটি মডেলের অনুমান, আপনার মাঠের পরীক্ষা নয়। নিশ্চিত করুন বা বদলে নিন।",
    region: "এই অঞ্চলে সাধারণত এমন মাটি থাকে (মোটামুটি ধারণা, মাপা নয়)। নিশ্চিত করুন বা বদলে নিন।",
  },
};

export function loadSoilMap() {
  return fetch(`${BASE}soil_bd.json`)
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);
}

// Looks up the soil at a point. If that cell has no data (a city or a river),
// it checks the surrounding cells, up to 5 cells (about 10 km) away.
export function lookupSoil(map, lat, lon) {
  if (!map || !map.grid) return null;
  const col0 = Math.round((lon - map.lon0) / map.dlon);
  const row0 = Math.round((lat - map.lat0) / map.dlat);
  for (let radius = 0; radius <= 5; radius++) {
    for (let dr = -radius; dr <= radius; dr++) {
      for (let dc = -radius; dc <= radius; dc++) {
        if (Math.max(Math.abs(dr), Math.abs(dc)) !== radius) continue;
        const row = row0 + dr;
        const col = col0 + dc;
        if (row < 0 || row >= map.rows || col < 0 || col >= map.cols) continue;
        const code = map.grid[row].charCodeAt(col) - 96;
        if (code >= 1 && code <= 12) return CLASS_TO_SOIL[map.classes[code]] || null;
      }
    }
  }
  return null;
}

// Fallback only. A rough regional guess from general knowledge of Bangladesh.
export function typicalSoil(lat, lon) {
  const inBangladesh = lat >= 20.5 && lat <= 26.7 && lon >= 88.0 && lon <= 92.7;
  if (!inBangladesh) return null;
  if (lat < 22.9 && lon < 91.0) return "clay";
  if (lat >= 24.0 && lon >= 91.0) return "clay";
  if (lat >= 25.0 && lon < 90.0) return "loam";
  return "siltLoam";
}