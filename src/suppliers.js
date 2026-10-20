// Farm suppliers, markets, vets and stores near a point, from OpenStreetMap through the public Overpass API.
// OpenStreetMap is made by volunteers: in many places shops are missing. The page says so and links to where anyone can add one.

const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

export const CATEGORIES = ["inputs", "nursery", "market", "vet", "storage", "office"];

const query = (lat, lon, r) => `[out:json][timeout:20];(
nwr["shop"~"^(agrarian|farm|fertilizer|seed|agricultural_supplies)$"](around:${r},${lat},${lon});
nwr["shop"="garden_centre"](around:${r},${lat},${lon});
nwr["landuse"="plant_nursery"]["name"](around:${r},${lat},${lon});
nwr["amenity"="marketplace"](around:${r},${lat},${lon});
nwr["amenity"="veterinary"](around:${r},${lat},${lon});
nwr["man_made"="silo"](around:${r},${lat},${lon});
nwr["industrial"~"^(cold_storage|agricultural)$"](around:${r},${lat},${lon});
nwr["office"="government"]["government"~"agricultur"](around:${r},${lat},${lon});
nwr["office"~"^(agricultural|agriculture)$"](around:${r},${lat},${lon});
);out center tags 400;`;

export function categoryOf(tags) {
  if (tags.amenity === "marketplace") return "market";
  if (tags.amenity === "veterinary") return "vet";
  if (tags.man_made === "silo" || tags.industrial === "cold_storage" || tags.industrial === "agricultural") return "storage";
  if (tags.office) return "office";
  if (tags.shop === "garden_centre" || tags.landuse === "plant_nursery") return "nursery";
  if (tags.shop) return "inputs";
  return null;
}

const hav = (aLat, aLon, bLat, bLon) => {
  const r = Math.PI / 180;
  const h = Math.sin(((bLat - aLat) * r) / 2) ** 2 + Math.cos(aLat * r) * Math.cos(bLat * r) * Math.sin(((bLon - aLon) * r) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
};

// Second source, used when no Overpass server answers: the OpenStreetMap place search (Nominatim) understands "[shop=agrarian]"
// style phrases. It returns at most 40 places per phrase, and its rules allow one request per second, so the phrases go one by one.
const PHRASES = ["[shop=agrarian]", "[shop=farm]", "[shop=garden_centre]", "[amenity=marketplace]", "[amenity=veterinary]", "[man_made=silo]", "[industrial=cold_storage]"];
async function viaNominatim(lat, lon, radiusKm, reasons) {
  const dLat = radiusKm / 111;
  const dLon = radiusKm / (111 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
  const viewbox = `${lon - dLon},${lat + dLat},${lon + dLon},${lat - dLat}`;
  const out = [];
  for (const phrase of PHRASES) {
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=40&bounded=1&extratags=1&viewbox=${viewbox}&q=${encodeURIComponent(phrase)}`;
      const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      for (const p of await response.json()) out.push(p);
    } catch (e) {
      reasons.push(`nominatim ${phrase}: ${e.message}`);
    }
    await new Promise((r) => setTimeout(r, 1100));
  }
  return {
    elements: out.map((p) => ({
      type: p.osm_type, id: p.osm_id, lat: Number(p.lat), lon: Number(p.lon),
      tags: { name: p.name || undefined, [p.category]: p.type, ...(p.extratags || {}) },
    })),
  };
}

export async function fetchSuppliers(lat, lon, radiusKm) {
  const key = `ef-suppliers-${lat.toFixed(2)},${lon.toFixed(2)},${radiusKm}`;
  try {
    const hit = JSON.parse(sessionStorage.getItem(key) || "null");
    if (hit && Date.now() - hit.at < 3600000) return hit.items;
  } catch { /* no storage: just ask again */ }

  const body = new URLSearchParams({ data: query(lat, lon, radiusKm * 1000) });
  // ask all servers at the same time and take the first good answer (one slow server must not hold the page)
  const reasons = [];
  const ask = (url) =>
    fetch(url, { method: "POST", body, signal: AbortSignal.timeout(25000) })
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const json = await response.json();
        if (!json || !Array.isArray(json.elements)) throw new Error("answer without results");
        return json;
      })
      .catch((e) => {
        reasons.push(`${new URL(url).hostname}: ${e.name === "TimeoutError" ? "no answer in 25 s" : e.message}`);
        throw e;
      });
  let data;
  try {
    data = await Promise.any(ENDPOINTS.map(ask));
  } catch {
    data = await viaNominatim(lat, lon, radiusKm, reasons);
    if (data.elements.length === 0) throw new Error(reasons.join(" | ") || "no OpenStreetMap server answered");
  }

  const seen = new Set();
  const items = [];
  for (const e of data.elements || []) {
    const tags = e.tags || {};
    const category = categoryOf(tags);
    const pLat = e.lat ?? (e.center && e.center.lat);
    const pLon = e.lon ?? (e.center && e.center.lon);
    if (!category || pLat == null || pLon == null) continue;
    const name = tags.name || tags["name:en"] || tags["name:bn"] || null;
    const id = `${e.type}/${e.id}`;
    if (seen.has(id)) continue;
    seen.add(id);
    items.push({
      id, category, lat: pLat, lon: pLon,
      name, nameBn: tags["name:bn"] || null,
      phone: tags.phone || tags["contact:phone"] || null,
      website: tags.website || tags["contact:website"] || null,
      hours: tags.opening_hours || null,
      address: [tags["addr:housename"], tags["addr:street"], tags["addr:suburb"] || tags["addr:city"]].filter(Boolean).join(", ") || null,
      kind: tags.shop || tags.amenity || tags.man_made || tags.industrial || tags.office || tags.landuse,
      km: Number(hav(lat, lon, pLat, pLon).toFixed(1)),
    });
  }
  items.sort((a, b) => a.km - b.km);
  while (items.length && items[items.length - 1].km > radiusKm) items.pop(); // the place search uses a square: keep the circle
  try { sessionStorage.setItem(key, JSON.stringify({ at: Date.now(), items })); } catch { /* ignore */ }
  return items;
}
