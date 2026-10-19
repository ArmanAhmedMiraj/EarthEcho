// Latest NASA satellite readings for one point:
//   SMAP Level 4 soil moisture (surface and root zone) and GPM IMERG rain rate.
// Example: /api/satellite?lat=25.75&lon=89.25
import { badRequest, cacheFor, readPoint } from "./_lib/answer.js";
import { dayBack, layerHasData, loadColormap, readPixel, valueOf } from "./_lib/gibs.js";

const SMAP = {
  surface: "SMAP_L4_Analyzed_Surface_Soil_Moisture",
  root: "SMAP_L4_Analyzed_Root_Zone_Soil_Moisture",
  colormap: "SMAP_Analyzed_Soil_Moisture.xml",
};
const IMERG = { layer: "IMERG_Precipitation_Rate_30min", colormap: "GPM_Precipitation_Rate.xml" };

// SMAP: some days are missing, so look back day by day until a picture has data (at most 8 days).
async function readSmap(layer, lat, lon) {
  const table = await loadColormap(SMAP.colormap);
  for (let back = 1; back <= 8; back += 1) {
    const date = dayBack(back);
    const colour = await readPixel(layer, date, lat, lon);
    if (colour && table.has(colour)) {
      const v = valueOf(table.get(colour));
      return { date, volumetric: v.mid, low: v.low, high: v.high, unit: "m³/m³" };
    }
  }
  return null; // water, ice or no coverage here
}

// IMERG: the newest half-hour picture is a few hours old. Find the newest one that exists.
async function readRain(lat, lon) {
  const table = await loadColormap(IMERG.colormap);
  const start = Math.floor((Date.now() - 4 * 3600e3) / 1800e3) * 1800e3;
  for (let k = 0; k < 24; k += 1) {
    const time = new Date(start - k * 1800e3).toISOString().slice(0, 19) + "Z";
    if (!(await layerHasData(IMERG.layer, time))) continue;
    const colour = await readPixel(IMERG.layer, time, lat, lon);
    if (!colour) return { time, rateMmHr: 0, below: 0.1, unit: "mm/hr" }; // transparent = under 0.1 mm/hr
    const range = table.get(colour);
    if (!range) return { time, rateMmHr: null, unit: "mm/hr" };
    const v = valueOf(range);
    return { time, rateMmHr: Number(v.mid.toFixed(2)), low: v.low, high: v.high, unit: "mm/hr" };
  }
  return null;
}

export default async function handler(req, res) {
  const point = readPoint(req.query || {});
  if (!point) return badRequest(res, "Give a real place: ?lat=25.75&lon=89.25");

  const [surface, root, rain] = await Promise.allSettled([
    readSmap(SMAP.surface, point.lat, point.lon),
    readSmap(SMAP.root, point.lat, point.lon),
    readRain(point.lat, point.lon),
  ]);
  const take = (r) => (r.status === "fulfilled" ? r.value : null);
  const failed = [surface, root, rain].filter((r) => r.status === "rejected").length;
  if (failed === 3) return res.status(502).json({ ok: false, error: "NASA GIBS did not answer." });

  cacheFor(res, 1800);
  res.status(200).json({
    ok: true,
    location: point,
    soilSurface: take(surface),
    soilRoot: take(root),
    rainNow: take(rain),
    provenance: {
      access: {
        name: "NASA GIBS (Global Imagery Browse Services)",
        url: "https://nasa-gibs.github.io/gibs-api-docs/",
        method:
          "Values are read from NASA's coloured satellite pictures using NASA's own colour tables, so each number is rounded to one colour step.",
      },
      soil: {
        name: "SMAP Level 4 soil moisture",
        publisher: "NASA Global Modeling and Assimilation Office",
        resolution: "About 9 km",
        note: "SMAP satellite readings combined with a land-surface model. 12:00 UTC value, surface is the top 5 cm and root zone is the top 1 m.",
        licence: "NASA open data",
      },
      rain: {
        name: "GPM IMERG rain rate",
        publisher: "NASA Global Precipitation Measurement mission",
        resolution: "About 10 km, one 30-minute slot",
        note: "Satellite estimate of how hard it was raining in one half-hour, a few hours ago. It is not a daily total and not a forecast.",
        licence: "NASA open data",
      },
      fetchedAt: new Date().toISOString(),
    },
  });
}