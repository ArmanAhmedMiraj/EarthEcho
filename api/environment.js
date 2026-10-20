// NASA environment readings for one point:
//   vegetation greenness (MODIS NDVI), land-surface temperature (MODIS) and the NASA POWER climate normals
//   with a monthly water balance (rain minus evapotranspiration).
// Example: /api/environment?lat=25.75&lon=89.25
import { badRequest, cacheFor, fetchJson, readPoint } from "./_lib/answer.js";
import { loadColormap, readPixel, valueOf } from "./_lib/gibs.js";

const NDVI = { layer: "MODIS_Terra_L3_NDVI_Monthly", colormap: "MODIS_L3_NDVI.xml" };
const LST = { layer: "MODIS_Terra_L3_Land_Surface_Temp_8Day_Day", colormap: "MODIS_Land_Surface_Temp.xml" };
const DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

const monthStart = (year, month) => `${year}-${String(month + 1).padStart(2, "0")}-01`;

// the first day of the month, n months before this one
function monthsBack(n) {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - n, 1));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() };
}

async function readNdvi(table, year, month, lat, lon) {
  try {
    const colour = await readPixel(NDVI.layer, monthStart(year, month), lat, lon);
    const range = colour && table.get(colour);
    if (!range) return null;
    return { year, month, value: Number(valueOf(range).mid.toFixed(2)) };
  } catch {
    return null;
  }
}

async function vegetation(lat, lon) {
  const table = await loadColormap(NDVI.colormap);
  // the last 8 months: the newest ones may not be published yet, so gaps are normal
  const recent = await Promise.all(
    Array.from({ length: 8 }, (_, n) => {
      const m = monthsBack(n);
      return readNdvi(table, m.year, m.month, lat, lon);
    }),
  );
  const found = recent.filter(Boolean);
  if (found.length === 0) return null;
  const latest = found[0];
  // the same month in the three years before, to say whether this year looks greener or drier than usual
  const before = (
    await Promise.all([1, 2, 3].map((k) => readNdvi(table, latest.year - k, latest.month, lat, lon)))
  ).filter(Boolean);
  const usual = before.length ? Number((before.reduce((s, r) => s + r.value, 0) / before.length).toFixed(2)) : null;
  return {
    latest,
    usual,
    usualYears: before.map((r) => r.year),
    series: found.slice().reverse(),
  };
}

// The 8-day land temperature pictures are dated Jan 1 + 8 k days. The newest one or two are often missing.
async function landTemperature(lat, lon) {
  const table = await loadColormap(LST.colormap);
  const now = new Date();
  const year = now.getUTCFullYear();
  const dayOfYear = Math.floor((now - Date.UTC(year, 0, 1)) / 86400000);
  const k0 = Math.floor(dayOfYear / 8);
  for (let back = 1; back <= 5; back += 1) {
    const k = k0 - back;
    if (k < 0) break;
    const date = new Date(Date.UTC(year, 0, 1 + 8 * k)).toISOString().slice(0, 10);
    try {
      const colour = await readPixel(LST.layer, date, lat, lon);
      const range = colour && table.get(colour);
      if (range) return { date, celsius: Number((valueOf(range).mid - 273.15).toFixed(1)) };
    } catch {
      /* try the next older picture */
    }
  }
  return null;
}

async function climate(lat, lon) {
  const url =
    "https://power.larc.nasa.gov/api/temporal/climatology/point" +
    `?parameters=T2M,PRECTOTCORR,ALLSKY_SFC_SW_DWN&community=AG` +
    `&longitude=${lon}&latitude=${lat}&format=JSON`;
  const raw = await fetchJson(url);
  const p = raw && raw.properties && raw.properties.parameter;
  if (!p || !p.PRECTOTCORR) return null;
  const ok = (v) => (typeof v === "number" && v > -990 ? v : null);
  const elevationM = raw.geometry && raw.geometry.coordinates ? raw.geometry.coordinates[2] : null;
  const months = MONTHS.map((key, i) => {
    const rainDay = ok(p.PRECTOTCORR[key]);
    const tmean = ok(p.T2M[key]);
    const sun = ok(p.ALLSKY_SFC_SW_DWN[key]);
    const etDay = tmean == null || sun == null ? null : makkink(tmean, sun, elevationM);
    const rain = rainDay == null ? null : Math.round(rainDay * DAYS[i]);
    const et = etDay == null ? null : Math.round(etDay * DAYS[i]);
    return { month: i, tmean, rainMm: rain, etMm: et, balanceMm: rain != null && et != null ? rain - et : null, sun };
  });
  return { months, elevationM };
}

// Reference evapotranspiration (mm per day) by the Makkink method. It needs only the mean air temperature
// and the solar energy reaching the ground, both from NASA POWER. 0 °C and below counts as no evaporation.
function makkink(tempC, sunMJ, elevationM) {
  const pressure = 101.3 * Math.pow((293 - 0.0065 * (elevationM || 0)) / 293, 5.26); // kPa
  const gamma = 0.000665 * pressure;
  const delta = (4098 * 0.6108 * Math.exp((17.27 * tempC) / (tempC + 237.3))) / Math.pow(tempC + 237.3, 2);
  const et = 0.61 * (delta / (delta + gamma)) * (sunMJ / 2.45) - 0.12;
  return tempC <= 0 ? 0 : Math.max(0, Number(et.toFixed(2)));
}

export default async function handler(req, res) {
  const point = readPoint(req.query || {});
  if (!point) return badRequest(res, "Give a real place: ?lat=25.75&lon=89.25");

  const [veg, temp, clim] = await Promise.allSettled([
    vegetation(point.lat, point.lon),
    landTemperature(point.lat, point.lon),
    climate(point.lat, point.lon),
  ]);
  const take = (r) => (r.status === "fulfilled" ? r.value : null);
  if ([veg, temp, clim].every((r) => r.status === "rejected")) {
    return res.status(502).json({ ok: false, error: "NASA did not answer." });
  }

  cacheFor(res, 6 * 3600);
  res.status(200).json({
    ok: true,
    location: point,
    vegetation: take(veg),
    landTemp: take(temp),
    climate: take(clim),
    provenance: {
      vegetation: {
        name: "MODIS Terra vegetation index (NDVI), monthly",
        publisher: "NASA LP DAAC, shown through NASA GIBS",
        url: "https://gibs.earthdata.nasa.gov/",
        resolution: "About 5 km",
        note: "NDVI measures how green the land is, from about 0 (bare) to 1 (dense healthy plants). One pixel is a mix of fields, trees and buildings, so it describes the area, not one field.",
      },
      landTemp: {
        name: "MODIS Terra land-surface temperature, 8-day daytime",
        publisher: "NASA LP DAAC, shown through NASA GIBS",
        resolution: "About 5 km",
        note: "This is the temperature of the ground surface at about 10:30 in the morning, not the air temperature.",
      },
      climate: {
        name: "NASA POWER climatology",
        publisher: "NASA Langley Research Center",
        url: "https://power.larc.nasa.gov/docs/",
        resolution: "About 55 km cell",
        note: "Long-term monthly averages. Evapotranspiration is the Makkink estimate worked out from NASA's temperature and sunlight. Water balance = rain minus evapotranspiration. It is a regional guide, not a field measurement.",
      },
    },
  });
}
