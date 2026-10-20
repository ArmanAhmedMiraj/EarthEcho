// Height above sea level and how steep the ground is, from the Open-Meteo elevation service
// (Copernicus 90 m height model). Five heights are read: the point and four neighbours about 550 m away.
const STEP = 0.005; // degrees, about 550 m

export async function fetchTerrain(lat, lon, signal) {
  const lats = [lat, lat + STEP, lat - STEP, lat, lat];
  const lons = [lon, lon, lon, lon + STEP, lon - STEP];
  const url = `https://api.open-meteo.com/v1/elevation?latitude=${lats.join(",")}&longitude=${lons.join(",")}`;
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`elevation ${response.status}`);
  const data = await response.json();
  const z = data.elevation;
  if (!Array.isArray(z) || z.length < 5 || z.some((v) => typeof v !== "number")) throw new Error("no elevation");
  const metresPerDegreeLat = 111320;
  const metresPerDegreeLon = 111320 * Math.cos((lat * Math.PI) / 180);
  const dzdy = (z[1] - z[2]) / (2 * STEP * metresPerDegreeLat);
  const dzdx = (z[3] - z[4]) / (2 * STEP * metresPerDegreeLon);
  const slopePct = Math.sqrt(dzdx * dzdx + dzdy * dzdy) * 100;
  return { elevationM: Math.round(z[0]), slopePct: Number(slopePct.toFixed(1)) };
}
