// NASA POWER daily data for one point: weather, rain and the NASA model's soil wetness.
// Example: /api/power-daily?lat=25.75&lon=89.25&days=14
import { NASA_POWER_SOURCE, badRequest, cacheFor, fetchJson, readPoint } from "./_lib/answer.js";

const PARAMETERS = "T2M,T2M_MAX,T2M_MIN,PRECTOTCORR,RH2M,WS2M,ALLSKY_SFC_SW_DWN,GWETTOP,GWETROOT,GWETPROF";

const ymd = (date) => date.toISOString().slice(0, 10).replaceAll("-", "");
const iso = (key) => `${key.slice(0, 4)}-${key.slice(4, 6)}-${key.slice(6, 8)}`;
// POWER writes -999 where a value is not available yet. We turn that into null.
const clean = (value) => (typeof value === "number" && value > -990 ? value : null);
const round = (value, digits) => (value == null ? null : Number(value.toFixed(digits)));

export default async function handler(req, res) {
  const point = readPoint(req.query || {});
  if (!point) return badRequest(res, "Give a real place: ?lat=25.75&lon=89.25");
  const days = Math.min(60, Math.max(1, Math.round(Number(req.query.days) || 14)));

  const end = new Date();
  const start = new Date(end.getTime() - (days - 1) * 86400000);
  const url =
    "https://power.larc.nasa.gov/api/temporal/daily/point" +
    `?parameters=${PARAMETERS}&community=AG&longitude=${point.lon}&latitude=${point.lat}` +
    `&start=${ymd(start)}&end=${ymd(end)}&format=JSON`;

  let raw;
  try {
    raw = await fetchJson(url);
  } catch (error) {
    return res.status(502).json({ ok: false, error: `NASA POWER did not answer (${error.message}).` });
  }

  const p = raw && raw.properties && raw.properties.parameter;
  if (!p || !p.T2M) return res.status(502).json({ ok: false, error: "NASA POWER sent an unexpected answer." });

  const rows = Object.keys(p.T2M)
    .sort()
    .map((key) => ({
      date: iso(key),
      tmean: clean(p.T2M[key]),
      tmax: clean(p.T2M_MAX[key]),
      tmin: clean(p.T2M_MIN[key]),
      rainMm: clean(p.PRECTOTCORR[key]),
      humidity: clean(p.RH2M[key]),
      windMs: clean(p.WS2M[key]),
      solarKwhM2: clean(p.ALLSKY_SFC_SW_DWN[key]),
      soilTop: clean(p.GWETTOP[key]), // surface soil wetness, 0 (dry) to 1 (saturated)
      soilRoot: clean(p.GWETROOT[key]), // root-zone wetness
      soilProfile: clean(p.GWETPROF[key]), // whole-profile wetness
    }));

  const withSoil = rows.filter((r) => r.soilTop != null);
  const latest = withSoil[withSoil.length - 1] || null;
  const last7 = rows.slice(-7);

  cacheFor(res, 3 * 3600); // NASA POWER updates once a day, so three hours is safe
  res.status(200).json({
    ok: true,
    location: point,
    days: rows,
    summary: {
      latestSoilDate: latest ? latest.date : null,
      soilTopPct: latest ? round(latest.soilTop * 100, 0) : null,
      soilRootPct: latest && latest.soilRoot != null ? round(latest.soilRoot * 100, 0) : null,
      soilProfilePct: latest && latest.soilProfile != null ? round(latest.soilProfile * 100, 0) : null,
      rain7Mm: round(last7.reduce((sum, r) => sum + (r.rainMm || 0), 0), 1),
      rain7Days: last7.filter((r) => r.rainMm != null).length,
    },
    provenance: {
      ...NASA_POWER_SOURCE,
      fetchedAt: new Date().toISOString(),
      variables: {
        soilTop: "GWETTOP: surface soil wetness (about the top 5 cm), model estimate",
        soilRoot: "GWETROOT: root-zone soil wetness (about the top 1 m), model estimate",
        soilProfile: "GWETPROF: whole soil profile wetness, model estimate",
        rainMm: "PRECTOTCORR: corrected daily rain, mm",
        tmean: "T2M: air temperature at 2 m, °C",
      },
    },
  });
}