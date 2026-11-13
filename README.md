# EarthEcho

**What should I plant next?** EarthEcho is a free, bilingual (English and Bengali) farm-planning web app. A farmer saves a field once. The app then reads NASA satellite and climate data for that field, compares crop-rotation strategies, explains each one in plain words, and says how sure it is. It supports the farmer's own judgment and never replaces it.

![React 19](https://img.shields.io/badge/React-19-61dafb) ![Vite 8](https://img.shields.io/badge/Vite-8-646cff) ![MapLibre](https://img.shields.io/badge/MapLibre-GL-396cb2) ![Languages](https://img.shields.io/badge/languages-English%20%7C%20Bengali-2e9e6b) ![Deployed on Vercel](https://img.shields.io/badge/deployed-Vercel-000000)

Built by team **Frontier Zero** for the NASA Space Apps Challenge 2026, challenge **Field Shift: Adapting Farms with NASA Data**. Now in the final round.

**Live app: https://earth-echo-nine.vercel.app/** (works on a phone, installs like an app, opens offline with the last data it saw; an account is optional)

Demo script for judges: [docs/DEMO.md](docs/DEMO.md) · Submission answers: [docs/SUBMISSION.md](docs/SUBMISSION.md) · Licence: [Apache 2.0](LICENSE)

**Try it in one minute:** open the live link, tap the globe on the map to drop a pin on a field (the demo uses Mokamtala, Shibganj, Bogura, Bangladesh), press **Save**, then open **Rotation planner**. Switch to Bengali with the language button.

## Contents

1. [See it](#see-it)
2. [What it does for the Field Shift challenge](#what-it-does-for-the-field-shift-challenge)
3. [How a farmer uses it](#how-a-farmer-uses-it)
4. [How the strategies are worked out](#how-the-strategies-are-worked-out)
5. [Tabs](#tabs)
6. [Data sources](#data-sources)
7. [Honest limits](#honest-limits)
8. [Run it on your computer](#run-it-on-your-computer)
9. [Build and deploy](#build-and-deploy)
10. [Project layout](#project-layout)
11. [Privacy](#privacy)
12. [Team](#team)
13. [Licence](#licence)
14. [Credits and citations](#credits-and-citations)
15. [How this meets the Space Apps terms](#how-this-meets-the-space-apps-terms)

## See it

All pictures below are from the app, using a sample rice field near Mymensingh, Bangladesh. The app's look has been refreshed since these pictures were taken; the features shown are the same. The Bengali versions of every picture are in [docs/screenshots](docs/screenshots) (files ending in `_bn`).

### 1. My Farm: save a field once

The farmer picks the place, and EarthEcho adds its own estimates (soil, height above sea level, slope), always labelled as estimates. Under **My details** the farmer adds what only they know: land size, the crop now and the month it was sown, the crop they want next, past crops, irrigation. Everything the farmer types is marked "You entered" and is used instead of the estimate.

![My Farm](docs/screenshots/01_my_farm_en.jpg)

### 2. Rotation planner: compare strategies side by side

The farmer's own rotation next to the best alternatives. The table shows fit to the place, months the field is in use, bare months, nitrogen-fixing crops, plant families, water needed beyond rain, profit when the farmer has entered prices, and how sure the app is.

![Compare strategies](docs/screenshots/02_compare_strategies_en.jpg)

### 3. Each strategy explained in five parts, with a "How sure are we?" box

Why it was suggested, the evidence, what it may give, what we do not know, and the risks to review locally. The box under it lists what was entered, what was assumed and what is missing. A button sends the strategy to the AI assistant, which explains it in the farmer's language.

![One strategy in detail](docs/screenshots/03_strategy_five_parts_and_how_sure_en.jpg)

### 4. What if the weather changes?

Rain and temperature sliders show how the farmer's crops, and the top strategy, change in a drier, wetter, hotter or cooler season.

![What-if sliders](docs/screenshots/04_what_if_sliders_en.jpg)

### 5. NASA evidence behind the strategies

Twenty-five years of NASA POWER temperature and rain for the place, a month-by-month field calendar (bare months, very wet months, heat and cold limits), and a simple erosion-risk rating. Where the data looks wrong, such as a sudden jump in yearly rain, the app says so and claims no trend.

![NASA evidence](docs/screenshots/05_nasa_evidence_en.jpg)

### 6. NASA map layers with a time slider

Greenness (MODIS NDVI), land temperature (MODIS) and soil moisture (SMAP) from NASA GIBS. The farmer drags the slider through the dates and reads the value at their own field, with a history line for the last dates.

![NASA map layers](docs/screenshots/06_nasa_map_layers_en.jpg)

### 7. Weather: is this season normal?

The past week and the coming week of rain and temperature compared with what NASA data show for the same time of year at this place.

![Is this season normal](docs/screenshots/07_season_check_en.jpg)

## What it does for the Field Shift challenge

The challenge asks for a supportive tool that compares crop-rotation strategies, explains them, and does not replace the farmer's judgment. In the **Rotation planner** tab EarthEcho:

| Challenge need | What EarthEcho does | Where |
|---|---|---|
| Compare several strategies | The farmer's current rotation plus the best alternatives, side by side in one table and in detail cards | Rotation planner, Compare strategies |
| Explain each strategy | Five parts each: why suggested, evidence, benefits, information gaps, risks | Open any strategy card |
| Use NASA data | NASA POWER (25 years of temperature and rain), NASA GIBS layers (MODIS greenness, MODIS land temperature, SMAP soil moisture) with a time slider | NASA evidence; Environment; Weather |
| Let the farmer say what matters | Save water, earn more, improve the soil, lower risk; strategies re-rank. Fit to the place still counts for 40% of each score | Rotation planner, What matters most to you? |
| Show how conditions may change | What-if sliders for rain and temperature | Rotation planner, What if the weather changes? |
| Be honest about uncertainty | A "How sure are we?" box on every strategy: what was entered, assumed or missing | Inside each strategy card |
| Support, not replace, the farmer | The farmer's own values are used and labelled "You entered". Every answer points to the local agriculture officer. No yield or income forecast | My Farm, My details |
| Be understandable | Plain words, a glossary of 21 terms, a "satellite or ground" explainer, English and Bengali, light and dark mode | Data, Learn |
| Explain in the farmer's language | "Explain this strategy" asks the AI assistant, which answers in the app's language | Strategy card |

It is decision support. It never tells a farmer to switch crops, gives no yield or income forecast, and always points to the local agriculture officer.

## Status

All twelve tabs are built and live. A farmer keeps many **locations** (a place such as a village), and each location can hold up to 12 **plots** (parcels of land with their own details); every tab follows the open plot. The app is bilingual, works in light and dark mode, passes Lighthouse accessibility, best-practices and SEO checks at 100 on desktop, and works offline after the first visit.

## How a farmer uses it

1. **Open the app.** It opens on **My Farm**. The first time, the farmer picks the area (country, division, district, upazila, union), then taps the map to drop a pin on **their land (jomi)** or uses their location. The Save button stays off until the pin is placed. The farmer names the location and saves it.
2. **My Farm is the hub.** By default everything is kept on the phone (guest mode). A farmer can also create an account with a phone number, name and password to keep locations on any device. There is no text-message code. A location holds plots, and each plot has:
   - **EarthEcho estimates** (soil, height above sea level, slope), always labelled as estimates, with a confidence when the soil data gives one;
   - **Land size filled in from the drawn boundary** (the farmer can overwrite it);
   - **The farmer's own details** (land size in bigha, acre, decimal, katha, hectare or square metre; crop now and the month it was sown; crop next; irrigation; who farms it; past crops and when they were sown; notes), all optional, saved as they type.
   - If the farmer knows their soil better than the satellite, they set it. Their value is used everywhere and the original estimate is kept.
3. **Every other tab follows the open plot.** Two switchers in the header (Location and Plot) change the data on every tab. Nothing needs to be selected twice.

### Where the farmer's own answers are used

| Answer | Used in |
|---|---|
| Crop now, next crop, past crops | Rotation planner (the current rotation and bare months), field notes in Rotation planner and Suitability, the Irrigation tab (crop and land size), What-if, the AI assistant |
| Sowing months | Rotation planner (timing, bare months, how sure) and the AI assistant. Not used by the Irrigation tab, which has its own growth-stage setting |
| Soil, irrigation | Rotation planner, Suitability, how-sure rating |

Weather, Disaster watch, Market prices, Suppliers and the NASA map do not use these answers.

## How the strategies are worked out

- **Candidate rotations** of two or three crops are built from the FAO EcoCrop climate and soil scores for the place, using NASA POWER monthly averages for temperature and rain.
- **Each rotation is measured**: average fit, months the field is in use, bare months and which of them are very wet, nitrogen-fixing crops, plant families, and the water needed beyond rain.
- **The farmer's own rotation** uses the sowing months they entered. If they did not enter any, the app assumes each crop's best month and says so.
- **Priorities** (save water, earn more, improve the soil, lower risk) change the ranking, but fit to the place always counts for 40%, so a rotation that does not suit the climate cannot win on priorities alone.
- **"How sure"** counts inputs that are known, assumed or missing, and adds flags for weak points (a crop that only moderately fits, a large water gap, a field bare in very wet months). It is a guide, not a statistical confidence interval.
- **Nothing is forecast.** There is no yield or income model.

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
- NASA data describes an area (about 1 to 55 km wide), not one field.
- Crop suitability tells where to look first, not what to plant.
- The strategy comparison is rule-based (fit, bare months, legumes, crop families, water gap, heat and cold months). It is **not a yield model** and does not forecast income.
- In irrigated mode the fit ignores rain, so many alternatives show 100%. A second row shows the fit on rain alone.
- NASA POWER's yearly rainfall for some places (for example Bangladesh) jumps around 2016, which looks like a change in NASA's inputs. The app detects such jumps, claims no trend there and says so.
- The "how sure" rating counts what is measured, assumed or missing. It is a guide, not a statistical confidence interval.
- Data licences are on the Data tab. Still flagged: the FAO EcoCrop page's own user agreement was not read in full, and the Esri satellite basemap's current free-use terms could not be confirmed (fine for a non-commercial demo; check before commercial use).
- The AI assistant answers only from the farm data and its knowledge base, cites its sources, and says when it does not know. It can make mistakes, and it runs on free tiers with a rate limit.
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

Accounts are optional. To turn them on, add a free Upstash Redis database (`KV_REST_API_URL` and `KV_REST_API_TOKEN`). Without it the app runs in guest mode and the sign-in button says accounts are not available. Details: [docs/ACCOUNTS.md](docs/ACCOUNTS.md).

## Build and deploy

```
npm run build
```

Vercel builds and publishes on every push to `main`. `vercel.json` sets the time limits of the slower API functions.

## Project layout

- `src/` the React app. One file per tab, `fields.js` for saved fields, `strategy.js` for the strategy rules, `trust.js` for the how-sure rating, `i18n*.js` for English and Bengali text.
- `api/` the server functions (data feeds, NASA trends and map layers, and the assistant) and `api/_lib/` shared code, including the assistant's knowledge base.
- `public/` boundaries, crop table, prepared photo galleries, the app icons and the offline service worker.
- `docs/` the demo script and the screenshots used in this file.

## Privacy

Guests: no account, no tracking and no advertising. Locations and details stay on the device. With an account: the phone number, name, a scrypt password hash and the saved locations are stored in an Upstash Redis database, and the login cookie is HttpOnly. Phone numbers are not verified by text message. The place's coordinates are sent to the data services (NASA, Open-Meteo, SoilGrids and others) to fetch its data, and the browser loads NASA map pictures for the area directly from NASA. Questions to the assistant, and the strategy sent by "Explain this strategy", go to an AI provider (Groq, or Google Gemini as a backup) together with the place, the crops and the field notes needed to answer. Google may use text sent through its free Gemini tier to improve its products, so the app tells farmers not to write personal details in notes.

The repository contains no real phone numbers, addresses or keys. All secrets are environment variables.

## Team

**Frontier Zero**, NASA Space Apps Challenge 2026, Rangpur local event, Bangladesh.

| Name | Role |
|---|---|
| Arman Ahmed Miraj | Lead developer (CSE student, Dhaka) |
| _add teammate_ | _role_ |
| _add teammate_ | _role_ |

## Licence

The original code and content in this repository are released under the **Apache License 2.0** (see [LICENSE](LICENSE)). This matches the licence NASA uses to distribute Space Apps solutions. Third-party data keeps its own licence (listed below and on the app's Data tab). NASA data is open; no export-controlled information (ITAR or EAR) is included.

## Credits and citations

Everything we used that we did not write ourselves.

**NASA data and services**

- NASA POWER (climate normals and daily history): https://power.larc.nasa.gov/
- NASA GIBS (map layers and readings): MODIS vegetation index (NDVI) and land surface temperature (LP DAAC), SMAP Level 4 soil moisture, GPM IMERG rain rate. https://earthdata.nasa.gov/gibs
- NASA Earthdata (SMAP, GPM, MODIS products): https://www.earthdata.nasa.gov/
- NASA EONET natural events: https://eonet.gsfc.nasa.gov/
- Listed on the Data tab as **planned, not used yet**: GRACE-FO groundwater, ECOSTRESS plant heat stress, NISAR radar.

**Other data**

| Source | Used for | Licence |
|---|---|---|
| ISRIC SoilGrids | Soil properties | CC BY 4.0 |
| FAO EcoCrop | Crop climate and soil limits | FAO data terms (CC BY 4.0 unless stated); the EcoCrop page's own agreement is not fully read, flagged on the Data tab |
| FAO / IIASA HWSD | Bangladesh soil estimate | FAO and IIASA credit; exact terms flagged on the Data tab |
| Open-Meteo | Forecast | CC BY 4.0, non-commercial use |
| USGS, GDACS | Earthquakes and alerts | Free with credit |
| WFP food prices (Humanitarian Data Exchange) | Market prices | CC BY-IGO |
| GDELT Project | News on hazards | Free with credit and link |
| geoBoundaries, Bangladesh Bureau of Statistics | Boundaries | CC BY 3.0 IGO and open licences |
| OpenStreetMap contributors | Suppliers | ODbL |
| Wikimedia Commons | Place photos (free licences only, credit shown) | CC BY, CC BY-SA |
| Esri World Imagery | Satellite basemap | Esri terms; used for a non-commercial competition demo |
| Groq, Google Gemini | AI assistant | Provider terms; see Privacy |

**Open-source software**

React 19 (MIT), Vite 8 (MIT), @vitejs/plugin-react (MIT), MapLibre GL JS (BSD-3-Clause), geotiff (MIT), pngjs (MIT). Fonts: Plus Jakarta Sans, Anek Latin, Anek Bangla, Hind Siliguri through Fontsource (SIL OFL 1.1).

The same list, with each source's resolution and update rate, is on the in-app **Data** tab.

## How this meets the Space Apps terms

Checked against https://www.spaceappschallenge.org/legal/ :

| Term | How EarthEcho meets it |
|---|---|
| Original content freely available or OSI licensed | Apache 2.0 ([LICENSE](LICENSE)) |
| Third-party material public or open source; licences listed | Table above and the Data tab |
| Licences listed in the submission documentation | This README and [docs/SUBMISSION.md](docs/SUBMISSION.md) |
| Cite every source used | Credits and citations above |
| Addresses a published challenge | Field Shift: Adapting Farms with NASA Data |
| No personal data (home addresses, phone numbers) | None in the repository, screenshots or demo data; the demo place is a public village |
| No people under 18 recognisable | None in screenshots or video |
| No commercial promotion | Free, non-commercial; supplier map is neutral OpenStreetMap data |
| No export-controlled information | Only public NASA and open data |
