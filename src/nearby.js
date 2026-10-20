// The nearest named village, neighbourhood or town for a point, from OpenStreetMap (Nominatim).
// Boundary shapes stop at the levels in admin.js. This adds a place name below them, for any country.
// Nominatim asks for at most one request per second, so the app asks once per chosen point, after a short pause.

const KINDS = ["hamlet", "village", "isolated_dwelling", "neighbourhood", "suburb", "quarter", "town", "city_district", "municipality", "city"];

export async function nearestPlace(lat, lon, lang, signal) {
  const url =
    "https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=16&addressdetails=1" +
    `&accept-language=${lang === "bn" ? "bn,en" : "en"}&lat=${lat}&lon=${lon}`;
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Nominatim ${response.status}`);
  const data = await response.json();
  const a = data.address || {};
  const kind = KINDS.find((k) => a[k]);
  if (!kind) return null;
  return { name: a[kind], kind: kind.replace("_", " "), postcode: a.postcode || null };
}
