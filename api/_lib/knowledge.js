// What the farming assistant may quote besides the farm's own live data. Each piece names its source so the answer can cite it.
// The method pieces repeat what the app itself calculates, so the assistant explains the same numbers the pages show.
import crops from "./ecocrop.js";

const FAO56 = "https://www.fao.org/4/x0490e/x0490e00.htm";
const ECO = "https://gaez.fao.org/pages/ecocrop";

export const DOCS = [
  { id: "irr-method", title: "How the irrigation plan is calculated (FAO-56)", url: FAO56,
    text: "Crop water use each day is ETc = Kc × ET0. ET0 is the reference evapotranspiration from the weather model; Kc is the crop coefficient for the growth stage (small when just planted, highest when the crop is full size and flowering, lower when ripening). Rain under 5 mm a day is ignored and 80% of larger rain is counted. Forecast rain is counted only when the chance of rain is 50% or more. The soil holds a certain amount of water the roots can use (total available water). When the crop has used the allowed share of that water (the depletion fraction p), the crop starts to suffer and it is time to irrigate; irrigation refills the soil to field capacity. Irrigate, watering, schedule, how much water, when to irrigate." },
  { id: "soil-water", title: "Water the soil can hold, by texture (Saxton and Rawls)", url: "https://stormwater.pca.state.mn.us/index.php/Soil_water_storage_properties",
    text: "Plant-available water in millimetres per metre of soil used by the app: sandy 90, sandy loam 90, loam 160, silt loam 170, clay loam 150, clay 120. Sandy soils drain fast and hold little water, so they need smaller and more frequent irrigation. Clay and loam soils hold more water but clay drains slowly and can waterlog. Soil texture, water holding, drainage." },
  { id: "irr-efficiency", title: "Irrigation efficiency by method (FAO)", url: "https://www.fao.org/4/t7202e/t7202e08.htm",
    text: "Not all pumped water reaches the roots. Typical application efficiency: surface irrigation (flood or furrow) about 60%, sprinkler about 75%, drip about 90%. So to give a crop 50 mm of net water, flood irrigation needs about 83 mm pumped, sprinkler about 67 mm and drip about 56 mm. Drip and sprinkler save water." },
  { id: "rice-water", title: "Rice water: seepage and alternate wetting and drying", url: "https://qcat.wocat.net/en/wocat/technologies/view/permalink/4671",
    text: "A rice field loses water by evaporation and crop use and by seepage and percolation: about 4 mm a day on heavy clay, 6 mm on average soil and 8 mm on sandy soil. Alternate wetting and drying (AWD) saves water: let the standing water fall until the water level is about 15 cm below the soil surface (watch it in a perforated tube), then flood again to about 5 cm. Keep the field flooded at flowering. Check local advice for your rice variety. Rice, paddy, boro, aman, aus, irrigation." },
  { id: "rotation", title: "Crop rotation principles", url: "https://www.fao.org/conservation-agriculture/en/",
    text: "Rotating crops lowers disease, pests and weeds that build up when the same crop or the same plant family is grown again and again on a field. A legume (pulses such as lentil, chickpea, mungbean, grasspea, soybean, groundnut, pea) adds nitrogen to the soil for the next crop. Follow a cereal with a legume, and avoid two crops of the same family one after the other (for example tomato, eggplant, potato and chilli are all in the Solanaceae family). Mixing deep-rooted and shallow-rooted crops uses soil water and nutrients better. Rotation, which crop next, legume, nitrogen." },
  { id: "rotation-app", title: "How the app's rotation planner chooses sequences", url: ECO,
    text: "A crop can be sown in a month when its EcoCrop score for that month is at least 50% (temperature, rainfall or irrigation, soil pH and texture). The crop then occupies the field for its growing cycle, assumed to be the shortest cycle plus a quarter of the range. A sequence has up to three crops inside 12 months. The fit number mixes the average score, how much of the year the field is used, a legume in the sequence and different plant families. These are rules of thumb, not a yield forecast." },
  { id: "ecocrop-method", title: "EcoCrop suitability method (limiting factor)", url: ECO,
    text: "The suitability page scores each crop for each possible sowing month from 0 to 1. Every crop has an absolute range and a smaller optimum range for temperature, rainfall during its growing cycle and soil pH. The score follows the worst factor (the limiting factor). The ranges are expert opinion in the FAO EcoCrop database, not exact laws. Soil estimates are uncertain, so soil can lower a score by at most half unless pH is outside the crop's absolute limits. Suitability, why a crop scored low, best month to sow." },
  { id: "soilgrids", title: "Where the soil numbers come from (ISRIC SoilGrids)", url: "https://soilgrids.org",
    text: "Soil texture, pH, carbon, nitrogen and cation exchange capacity come from ISRIC SoilGrids 2.0, a computer map at 250 m resolution made from soil samples and satellite data. It gives a prediction range, and in many places the range is wide, so confidence is often low or medium. It describes the top soil (5 to 15 cm). It is a good first guess, not a lab test. For an exact answer take a soil test at a local soil laboratory or ask the agriculture extension office. Soil map, confidence, soil test." },
  { id: "ph", title: "Soil pH and crops", url: ECO,
    text: "Soil pH measures acidity. Most field crops do best between about 6 and 7.5. Below about 5.5 the soil is strongly acidic: aluminium can harm roots and nutrients like phosphorus become hard for plants to take up; farmers often add agricultural lime after a soil test. Above about 8 the soil is alkaline or sodic and iron and zinc can become short. Rice tolerates a wide range (about 5 to 8). Each crop's own pH range is in its EcoCrop record." },
  { id: "ndvi", title: "What NDVI (greenness) means", url: "https://modis.gsfc.nasa.gov/data/dataprod/mod13.php",
    text: "NDVI is a satellite measure of how green and dense plants are, from MODIS on NASA satellites at about 5 km resolution in this app. Values near 0 are bare land or water, around 0.2 to 0.4 sparse or dry plants, 0.5 to 0.7 healthy crops, and above 0.7 dense healthy vegetation. Compare with the same month in earlier years to see if the land is greener or less green than usual. It mixes fields, trees and buildings in a large area." },
  { id: "smap", title: "NASA SMAP soil moisture", url: "https://smap.jpl.nasa.gov",
    text: "SMAP is a NASA satellite that measures soil moisture. The app shows surface and root zone wetness as dry, moist, almost full of water or wet for the soil type. It describes a large area (about 9 km), so it is a hint, not a measure of one field." },
  { id: "weather-data", title: "Weather and forecast data", url: "https://open-meteo.com/en/docs",
    text: "Forecasts, hourly data, air quality, the last 7 days and ET0 come from Open-Meteo, which uses national weather service models. Forecasts are less certain after about 7 days. Typical monthly rain and temperature normals come from NASA POWER (average of 10 years). The weather alerts in the app apply simple limits to forecast numbers: heavy rain from 50 mm a day, heat from 38 °C, frost at 0 °C or below, strong gusts from 60 km/h. They are not official warnings; use your national weather service for official warnings." },
  { id: "spray", title: "When to spray (app rule)", url: "https://open-meteo.com/en/docs",
    text: "The app suggests spraying in daylight hours when wind is under 12 km/h with gusts under 20 km/h and no rain for the next 3 hours, so spray does not drift or wash off. This is a rule of the app, not a pesticide label. Always follow the product label, wear protective clothing, and keep people and animals away." },
  { id: "heat", title: "Heat and cold stress", url: FAO56,
    text: "In very hot weather irrigate early in the morning or in the evening, give animals shade and water, and protect workers by resting in shade. Frost (0 °C or below) can kill young plants: cover seedlings or irrigate lightly the evening before a cold night. Cold nights (up to 4 °C) can slow young plants." },
  { id: "hazard-safety", title: "Safety for earthquakes, floods, cyclones, fire and drought", url: "https://www.ready.gov/",
    text: "Earthquake: drop, cover and hold on; stay away from windows; outdoors move away from buildings and wires. Flood: move livestock, seed and tools to high ground early; never walk or drive through moving water. Cyclone or storm: follow the official signal, secure roofs and boats, store drinking water and move to a shelter when told. Fire: keep fields and storage free of dry waste and do not burn residue on dry windy days. Drought: save water, mulch, choose short-duration or drought-tolerant crops. Follow your local disaster management office." },
  { id: "hazard-data", title: "Where the hazard data comes from", url: "https://www.gdacs.org",
    text: "Earthquakes: USGS (magnitude 3 and above within 500 km in the last 30 days; usually only magnitude 4.5 and above is felt). Cyclone, flood, drought, volcano and fire alerts: GDACS of the UN and European Commission, with its own green, orange and red colours. Open natural events such as wildfires and storms: NASA EONET. River flow: a computer model (GloFAS through Open-Meteo) on a 5 km grid, not a river gauge." },
  { id: "market", title: "Market prices (WFP)", url: "https://data.humdata.org/organization/wfp",
    text: "Prices come from the UN World Food Programme price database, collected in local markets in Bangladesh, India, Pakistan, Nepal, Myanmar and Bhutan. They are mostly retail prices in towns, so the farm-gate price a farmer receives is usually lower. A single large change may come from a different market or sale size. Profit sums in the rotation planner use only the yield, price and cost the farmer enters." },
  { id: "app-data", title: "The app's data sources", url: "https://www.nasa.gov",
    text: "NASA POWER (climate normals), NASA GIBS MODIS (vegetation and land temperature), NASA SMAP and GPM (soil moisture and rain), Open-Meteo (forecast, ET0, air quality, flood model), ISRIC SoilGrids (soil), FAO EcoCrop (crop ranges), FAO-56 (irrigation method), WFP (prices), USGS, GDACS and NASA EONET (hazards), OpenStreetMap (suppliers and markets), geoBoundaries (administrative areas)." },
  { id: "extension", title: "Local advice", url: "https://www.fao.org",
    text: "For decisions that cost money (what to plant, fertiliser rates, pesticides, seed varieties) also ask the local agriculture extension officer, such as the upazila agriculture office in Bangladesh or the block or district agriculture office in India, the agriculture office in your province or district elsewhere. They know local varieties, pests and recommended doses." },
];

// one record per crop, from the EcoCrop table
for (const c of crops) {
  const [tmin, tlo, thi, tmax] = c.t;
  const [rmin, rlo, rhi, rmax] = c.r;
  const [pmin, plo, phi, pmax] = c.ph;
  DOCS.push({
    id: `crop-${c.id}`,
    title: `${c.en} (EcoCrop ranges)`,
    url: ECO,
    text: `${c.en} (${c.bn}), ${c.sci}, family ${c.family}, group ${c.group}. Growing cycle ${c.gmin} to ${c.gmax} days. Temperature: survives ${tmin} to ${tmax} °C, does best ${tlo} to ${thi} °C. Rainfall during the growing cycle: ${rmin} to ${rmax} mm, best ${rlo} to ${rhi} mm. Soil pH: ${pmin} to ${pmax}, best ${plo} to ${phi}. Expert-opinion ranges from FAO EcoCrop.`,
  });
}
