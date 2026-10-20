// Saved farms live on the device (localStorage). Nothing is sent to any server.
const KEY = "ef-farms";

export function loadFarms() {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(list) ? list.filter((f) => f && Number.isFinite(f.lat) && Number.isFinite(f.lon)) : [];
  } catch {
    return [];
  }
}

export function saveFarms(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

export const newId = () => `f${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

// a file the farmer can keep, and read back on another phone
export function exportFarms(list) {
  return JSON.stringify({ app: "EarthEcho", version: 1, farms: list }, null, 2);
}

export function parseFarms(text) {
  const data = JSON.parse(text);
  const list = Array.isArray(data) ? data : data && data.farms;
  if (!Array.isArray(list)) throw new Error("not a farm list");
  return list
    .filter((f) => f && Number.isFinite(Number(f.lat)) && Number.isFinite(Number(f.lon)) && Math.abs(f.lat) <= 90 && Math.abs(f.lon) <= 180)
    .map((f) => ({ id: newId(), name: String(f.name || "Farm").slice(0, 80), lat: Number(f.lat), lon: Number(f.lon), country: f.country || "other", path: String(f.path || "").slice(0, 160) }));
}
