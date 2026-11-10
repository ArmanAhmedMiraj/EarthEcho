# EarthEcho

**What should I plant next?** EarthEcho is a free, bilingual (English and Bengali) farm-planning web app. A farmer saves their fields once. The app then reads NASA satellite and climate data for each field and answers in plain words: how suitable the crops are, when to sow, when to irrigate, what hazards are coming, and what prices are. It also has an AI assistant that answers from a sourced knowledge base.

Built by team **Frontier Zero** for the NASA Space Apps Challenge 2026 (Field Shift).

Live: https://earth-echo-nine.vercel.app/

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
| Weather | Forecast and recent weather for the field |
| Disaster watch | Earthquakes, flood and cyclone alerts, river level |
| Irrigation | Water plan for rice and upland crops; uses the crop and land size from My Farm |
| Rotation planner | Crop sequences for a year, with profit workings; favours the farmer's next crop |
| Market prices | Local food prices from the nearest markets |
| Suppliers | Map of nearby agricultural suppliers |
| Ask EarthEcho | AI assistant with cited answers, in the app's language |
| Suitability | Every crop scored for the place (FAO EcoCrop method); rates the farmer's own crops |
| Soil | SoilGrids soil properties for the place |
| Environment | Vegetation greenness, land temperature, soil moisture |
| Data | Every data source, with licence and how it is used |

## Data sources

NASA POWER (climate), NASA SMAP soil moisture and GPM IMERG rain (through NASA GIBS), MODIS vegetation and land temperature (through NASA GIBS), ISRIC SoilGrids (soil), FAO EcoCrop (crop limits), Open-Meteo (forecast), USGS and GDACS (earthquakes and alerts), geoBoundaries and Bangladesh Bureau of Statistics (boundaries), WFP food prices from the Humanitarian Data Exchange, Wikimedia Commons (place photographs, free licences only), OpenStreetMap (suppliers). The **Data** tab lists each source with its licence.

Countries: Bangladesh (down to union level), India, Nepal, Myanmar, Pakistan, Bhutan and the USA.

## Honest limits

- Everything is an **estimate**. Soil comes from a 250 m satellite model, climate from monthly averages. The app says so and asks farmers to confirm with their local agriculture officer.
- Crop suitability tells where to look first, not what to plant.
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

No account, no tracking and no advertising. Fields and details stay on the device. Only the place's coordinates are sent to the data services to fetch its data. Questions to the assistant go to the AI service together with the farm data needed to answer.
