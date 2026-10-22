// "My Farm": the fields a farmer has saved. Everything lives on the device (localStorage); nothing is sent to any server.
// A field = a place + a name + optional details the farmer typed (details) + what EarthEcho worked out by itself (system).
// The two are kept apart, so a farmer's correction never overwrites the original system estimate.
const KEY = "ef-fields";
const ACTIVE = "ef-active-field";
const OLD_KEY = "ef-farms"; // the first version of "My farms" (places only)

export const AREA_UNITS = ["bigha", "acre", "decimal", "katha", "hectare", "sqm"];
// units with an exact size, for the hectare hint (a bigha or katha differs from region to region)
export const HECTARES_PER = { acre: 0.404686, decimal: 0.00404686, hectare: 1, sqm: 0.0001 };
export const OWNERSHIP = ["owned", "leased", "sharecrop", "shared", "other"];
export const IRRIGATION = ["none", "canal", "tubewell", "pump", "drip", "other"];

export const newId = () => `f${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const clean = (f) => ({
  id: f.id || newId(),
  name: String(f.name || "Field").slice(0, 80),
  lat: Number(f.lat),
  lon: Number(f.lon),
  country: f.country || "other",
  path: String(f.path || "").slice(0, 160),
  createdAt: f.createdAt || Date.now(),
  updatedAt: f.updatedAt || Date.now(),
  details: f.details && typeof f.details === "object" ? f.details : {},
  system: f.system && typeof f.system === "object" ? f.system : null,
});

const valid = (f) => f && Number.isFinite(Number(f.lat)) && Number.isFinite(Number(f.lon)) && Math.abs(f.lat) <= 90 && Math.abs(f.lon) <= 180;

export function loadFields() {
  try {
    let raw = localStorage.getItem(KEY);
    if (raw == null) raw = localStorage.getItem(OLD_KEY); // carry the old saved farms over
    const list = JSON.parse(raw || "[]");
    return Array.isArray(list) ? list.filter(valid).map(clean) : [];
  } catch {
    return [];
  }
}

export function saveFields(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

export function loadActiveId() {
  try {
    return localStorage.getItem(ACTIVE) || "";
  } catch {
    return "";
  }
}

export function saveActiveId(id) {
  try {
    if (id) localStorage.setItem(ACTIVE, id);
    else localStorage.removeItem(ACTIVE);
  } catch { /* the field is then simply not remembered */ }
}

// ask the browser not to clear what the farmer saved when the phone is short of space
export function keepStorage() {
  try {
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist();
  } catch { /* not supported */ }
}

export const sameSpot = (a, b) => Math.abs(a.lat - b.lat) < 0.005 && Math.abs(a.lon - b.lon) < 0.005;

// a file the farmer can keep, and read back on another phone
export function exportFields(list) {
  return JSON.stringify({ app: "EarthEcho", version: 2, fields: list }, null, 2);
}

export function parseFields(text) {
  const data = JSON.parse(text);
  const list = Array.isArray(data) ? data : data && (data.fields || data.farms);
  if (!Array.isArray(list)) throw new Error("not a field list");
  return list.filter(valid).map((f) => clean({ ...f, id: newId() }));
}

// how many of the optional details are filled in (for the small "details added" line)
export const DETAIL_KEYS = ["area", "ownership", "irrigation", "currentCrop", "plannedCrop", "previousCrops", "notes", "soil"];
export function detailCount(details) {
  const d = details || {};
  return DETAIL_KEYS.filter((k) => (k === "area" ? d.area && String(d.area.value || "").trim() : String(d[k] || "").trim())).length;
}
