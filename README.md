# EarthEcho

**What should I plant next?** EarthEcho is a free, bilingual (English and Bengali) farm-planning web app. A farmer saves their fields once. The app then reads NASA satellite and climate data for each field and answers in plain words: how suitable the crops are, when to sow, when to irrigate, what hazards are coming, and what prices are. It also has an AI assistant that answers from a sourced knowledge base.

![React 19](https://img.shields.io/badge/React-19-61dafb) ![Vite 8](https://img.shields.io/badge/Vite-8-646cff) ![MapLibre](https://img.shields.io/badge/MapLibre-GL-396cb2) ![Languages](https://img.shields.io/badge/languages-English%20%7C%20Bengali-2e9e6b) ![Deployed on Vercel](https://img.shields.io/badge/deployed-Vercel-000000)

Built by team **Frontier Zero** for the NASA Space Apps Challenge 2026, challenge **Field Shift: Adapting Farms with NASA Data**. Now in the final round.

**Live app: https://earth-echo-nine.vercel.app/** (works on a phone, installs like an app, opens offline with the last data it saw)

Demo script for judges: [docs/DEMO.md](docs/DEMO.md)

## What it does for the Field Shift challenge

The challenge asks for a supportive tool that compares crop-rotation strategies, explains them, and does not replace the farmer's judgment. In the **Rotation planner** tab EarthEcho:

- **Compares at least three strategies side by side**: the farmer's own current rotation (from My Farm) and the best alternatives, in one table and in detail cards.
- **Explains each one in five parts**: why it was suggested, the evidence, the benefits, the information gaps and the risks.
- **Lets the farmer say what matters** (save water, income, soil health, lower risk) and re-ranks the strategies with that.
- **Shows what-if climates** with rain and temperature sliders, and how the farmer's crops and the top strategy change.
- **Shows NASA evidence**: the 25-year temperature and rain history for the place, a month-by-month field calendar of bare and exposed seasons, and a simple erosion-risk rating.
- **Says how sure it is** on every strategy: what was measured, what was assumed and what is missing.
- **Explains any strategy with the AI assistant** on request, in the farmer's language.
- **Teaches**: the Data tab has a glossary and a "satellite or ground" explainer, and the Environment tab has NASA map layers (greenness, land temperature, soil moisture) with a time slider and the value at the farmer's field.

It is decision support. It never tells a farmer to switch crops, gives no yield or income forecast, and always points to the local agriculture officer.

## Status

All twelve tabs are built and live. Farmers keep many fields; every tab follows the open field. The app is bilingual, works in light and dark mode, passes Lighthouse accessibility, best-practices and SEO checks at 100 on desktop, and works offline after the first visit.

## How a farmer uses it

1. **Open the app.** It opens on **My Farm**. The first time, the farmer picks where their field is (country, division, district, upazila, union, or by tapping the globe or using their location), names it and saves it.
2. **My Farm is the hub.** Every saved field is kept on the phone. There is no login and no account. A field has:
   - **EarthEcho estimates** (soil, height above sea level, slope), always labelled as estimates, with a confidence when the soil data gives one;
   - **The farmer's own details** (land size in bigha, acre, decimal, katha, hectare or square metre; crop now; crop next; irrigation; who farms it; past crops; notes), all optional, saved as they type.
   - If the farmer knows their soil better than the satellite, they set it. Their value is used everywhere and the original estimate is kept.
3. **Every other tab follows the open field.** A field switcher in the banner changes the field on every tab. Nothing needs to be selected twice.

## Tabs

| Tab | What it gives |
|---|---|
| My Farm | Saved fields, estimates, optional details, alerts for each field, backup file |
| Weather | Forecast and recent weather for the field, and "Is this season normal?" against 25 years of NASA data |
| Disaster watch | Earthquakes, flood and cyclone alerts, river level |
| Irrigation | Water plan for rice and upland crops; uses the crop and land size from My Farm |
| Rotation planner | Strategy comparison, priorities, what-if sliders, NASA evidence, how-sure boxes, profit workings, "Explain this strategy" |
| Market prices | Local food prices from the nearest markets |
| Suppliers | Map of nearby agricultural suppliers |
| Ask EarthEcho | AI assistant with cited answers, in the app's language |
| Suitability | Every crop scored for the place (FAO EcoCrop method); rates the farmer's own crops |
| Soil | SoilGrids soil properties for the place |
| Environment | Vegetation greenness, land temperature, soil moisture, and NASA map layers with a time slider |
| Data | Learn section (glossary, satellite vs ground), then every data source with licence and how it is used |

## Data sources

NASA POWER (climate normals and 2001 to last full year history), NASA SMAP soil moisture and GPM IMERG rain (through NASA GIBS), MODIS vegetation and land temperature (through NASA GIBS, also shown as map layers), ISRIC SoilGrids (soil), FAO EcoCrop (crop limits), Open-Meteo (forecast), USGS and GDACS (earthquakes and alerts), geoBoundaries and Bangladesh Bureau of Statistics (boundaries), WFP food prices from the Humanitarian Data Exchange, Wikimedia Commons (place photographs, free licences only), OpenStreetMap (suppliers). The **Data** tab lists each source with its licence.

Countries: Bangladesh (down to union level), India, Nepal, Myanmar, Pakistan, Bhutan and the USA.

## Honest limits

- Everything is an **estimate**. Soil comes from a 250 m satellite model, climate from monthly averages. The app says so and asks farmers to confirm with their local agriculture officer.
- Crop suitability tells where to look first, not what to plant.
- The strategy comparison is rule-based (fit, bare months, legumes, crop families, water gap, heat and cold months). It is **not a yield model** and does not forecast income.
- In irrigated mode the fit ignores rain, so many alternatives show 100%. A second row shows the fit on rain alone.
- NASA POWER's yearly rainfall for some places (for example Bangladesh) jumps around 2016, which looks like a change in NASA's inputs. The app detects such jumps, claims no trend there and says so.
- The "how sure" rating counts what is measured, assumed or missing. It is a guide, not a statistical confidence interval.
- Data licences are on the Data tab. Still flagged: the FAO EcoCrop page's own user agreement was not read in full, and the Esri satellite basemap's current free-use terms could not be confirmed (fine for a non-commercial demo; check before commercial use).
- The AI assistant answers only from the farm data and its knowledge base, cites its sources, and says when it does not know.
- Saved fields live in the browser of one phone. Clearing browser data removes them. The **Download my fields** file is the backup.

## Run it on your computer

```
npm install
npm run dev
```

Open http://localhost:5173. The `/api` folder runs locally the same way it runs on Vercel.

For the AI assistant, create a file `.env.local` in the project folder (it is never committed):

```
GROQ_API_KEY=your-key
```

`GEMINI_API_KEY` can be added as a backup. On Vercel, add the same names under Project Settings, Environment Variables.

## Build and deploy

```
npm run build
```

Vercel builds and publishes on every push to `main`. `vercel.json` sets the time limits of the slower API functions.

## Project layout

- `src/` the React app. One file per tab, `fields.js` for saved fields, `i18n*.js` for English and Bengali text.
- `api/` the server functions (data feeds and the assistant) and `api/_lib/` shared code, including the assistant's knowledge base.
- `public/` boundaries, crop table, prepared photo galleries, the app icons and the offline service worker.

## Privacy

No account, no tracking and no advertising. Fields and details stay on the device. The place's coordinates are sent to the data services (NASA, Open-Meteo, SoilGrids and others) to fetch its data, and the browser loads NASA map pictures for the area directly from NASA. Questions to the assistant, and the strategy sent by "Explain this strategy", go to an AI provider (Groq, or Google Gemini as a backup) together with the place, the crops and the field notes needed to answer. Google may use text sent through its free Gemini tier to improve its products, so the app tells farmers not to write personal details in notes.
