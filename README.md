# EarthEcho

**What should I plant next? Plan your field with NASA data.**

EarthEcho is a free, bilingual (English and Bengali) farm-planning web app. A farmer picks their field on a map and gets live weather, hazard watch, an irrigation schedule, a crop rotation for the year, crop suitability from climate and soil, market prices, nearby suppliers, saved farms with alerts, and an assistant that answers farming questions with its sources shown. It works for Bangladesh in the most detail, and for India, Pakistan, Nepal, Myanmar, Bhutan, the USA and other places with the data that exists for them.

- **Live app:** https://earth-echo-nine.vercel.app/
- **Built for:** NASA Space Apps Challenge 2026, Bangladesh
- **Challenge:** Field Shift: Adapting Farms with NASA Data
- **Team:** Frontier Zero (team lead: Arman Ahmed Miraj)

New here? Read [DEMO.md](DEMO.md) for a 5-minute walkthrough.

---

## The challenge

> **Field Shift: Adapting Farms with NASA Data.** Farmers around the world navigate shifting temperatures, changing rainfall patterns, water shortages, extreme weather, and declining soil health. These pressures make it difficult to choose crop rotations that protect fields, conserve water, and support long-term resilience. Your challenge is to create a decision-support tool that uses NASA Earth observations along with local soil information, crop characteristics, and farmer priorities to help farmers explore rotation strategies that could strengthen soil health and adapt their farms to changing conditions.

## What the app does (the tabs)

| Tab | What the farmer gets | Main data |
| --- | --- | --- |
| **Weather** | Now, hourly and 16-day forecast, farm alerts (heavy rain, heat, frost, wind, dry spell, air quality), calm hours for spraying, local news headlines | Open-Meteo, GDELT |
| **Disaster watch** | One hazard level for the place from recent earthquakes, UN disaster alerts, active NASA events and river flood forecast, with safety steps | USGS, GDACS, NASA EONET, Open-Meteo flood |
| **Irrigation** | Day-by-day irrigation schedule per crop (upland soil-water tank, rice standing water), with water saved by method | Open-Meteo ET0, FAO-56 |
| **Rotation planner** | Two or three crops per year that fit the place, with legume nitrogen credit, year calendar and an editable profit estimate | FAO EcoCrop, SoilGrids |
| **Market prices** | Recent retail prices for food items where the UN WFP publishes them, with trend | WFP food prices (HDX, CC BY-IGO) |
| **Suppliers** | Nearby agro shops, seed, fertiliser and equipment sellers on a map | OpenStreetMap |
| **My farms** | Save several places on the device, see their alerts at a glance, export and import, install the app on a phone | Stored on the device |
| **Ask EarthEcho** | A question box. Answers use the farm's own live data and a curated knowledge base, cite their sources, and say so when they do not know | Google Gemini, EarthEcho knowledge notes |
| **Crop planner** (Bangladesh) | Three ranked rice-based rotations, named BRRI varieties, year timeline, live irrigation countdown, printable plan | BRRI, FAO, NASA POWER |
| **Crop suitability** | 67 crops scored for the place month by month, rain-fed and irrigated, with limiting factors | FAO EcoCrop method, NASA POWER |
| **Soil** | Soil texture and pH with ranges, and a farmer override | ISRIC SoilGrids |
| **NASA environment** | Vegetation (NDVI), land temperature, soil moisture and 10-year climate for the pin | NASA GIBS, NASA SMAP, NASA POWER |
| **Data** | Every dataset used, with source, licence and how it is used | |

The first screen is an Earth explorer: the farmer taps the globe or searches for a place, confirms the pin, and the app prepares all the data above for that spot.

## How EarthEcho answers the challenge

| Challenge ingredient | What EarthEcho uses | What the farmer sees |
| --- | --- | --- |
| **NASA Earth observations** | NASA POWER (10-year monthly rain and temperature), NASA GIBS (vegetation index, land surface temperature), NASA SMAP (soil moisture), NASA EONET (natural events) | Typical climate for the place, how green and how hot the land is, current hazards |
| **Local soil information** | ISRIC SoilGrids texture and pH (about 250 m), shown with a range, and a farmer override | A soil type with a plain warning that it is a model estimate |
| **Crop characteristics** | FAO EcoCrop ranges for 67 crops; BRRI rice varieties; FAO-56 crop water factors | Suitability scores, rotations, planting windows, water needs |
| **Farmer priorities** | Irrigation available or not, land height, salt, crop choice, farm size and prices | Plans that match the farm's real limits. When nothing fits, the app says so |

### How the advice is worked out

Everything except the assistant is a transparent rule-based calculation, not a black box.

- **Suitability** follows the FAO EcoCrop method: each crop has ranges for temperature, rain and pH; the score for a sowing month is set by the worst factor.
- **Rotation** picks crops whose growing windows fit one after another in 12 months, rewards legumes before cereals and mixing plant families, and shows the reasons.
- **Irrigation** uses a daily soil-water balance (FAO Irrigation and Drainage Paper 56) with forecast rain counted only when likely.
- **Alerts and hazard level** are simple thresholds on public model data. They are not official warnings, and the app says so on screen.

### The assistant (retrieval, not guesswork)

The assistant searches EarthEcho's own knowledge notes (about 19 method notes and one note per crop, each with a source link), adds the farm's live data from the page, and asks Google Gemini to answer only from that material. Answers cite their notes as [S1], [S2]. It is told to say "I don't have that" and send the farmer to the local agriculture officer when the material does not cover the question, and not to give pesticide or fertiliser doses. Bengali questions are turned into English search words first. It can still make mistakes, and the screen says so. The Gemini key lives only on the server.

## Data sources and licences

| Data | Provider | Licence or terms |
| --- | --- | --- |
| Climate, soil moisture, vegetation, land temperature, events | NASA POWER, GIBS, SMAP, EONET | NASA open data |
| Soil properties | [ISRIC SoilGrids](https://soilgrids.org/) | CC BY 4.0 |
| Weather, forecast, ET0, air quality, river flood | [Open-Meteo](https://open-meteo.com/) | CC BY 4.0, non-commercial free tier |
| Earthquakes | [USGS](https://earthquake.usgs.gov/) | Public domain |
| Disaster alerts | [GDACS](https://www.gdacs.org/) | Free with attribution |
| News headlines | [GDELT](https://www.gdeltproject.org/) | Free with attribution |
| Food prices | [UN WFP via HDX](https://data.humdata.org/) | CC BY-IGO |
| Shops and places | [OpenStreetMap](https://www.openstreetmap.org/copyright) (Overpass, Nominatim) | ODbL |
| Crop ranges | [FAO EcoCrop](https://gaez.fao.org/pages/ecocrop) | FAO terms |
| Crop water | [FAO-56](https://www.fao.org/4/x0490e/x0490e00.htm) | FAO terms |
| Place photos | Wikimedia Commons | Each photo shows its author and licence |
| Maps | MapLibre GL, Esri imagery, geoBoundaries | Attribution shown in the app |

## Honest limits

- Everything is an **estimate** to help a farmer explore options. Soil is a model map, not a test of the field. Forecasts can be wrong. Confirm big decisions with the local agriculture officer.
- Market prices exist only where WFP publishes them (not for the USA). News needs a country with headlines in GDELT. Supplier results depend on what volunteers have mapped in OpenStreetMap.
- The assistant needs internet and a free Gemini quota. Without a key the rest of the app works and the assistant says it is switched off.
- Farm data, rotation choices and irrigation dates are stored only on the farmer's own device. There are no accounts and no personal data is sent to our server; the assistant sends only the question and the farm's weather, soil and crop summary.

## Run it on your computer

You need [Node.js](https://nodejs.org/).

```bash
npm install
npm run dev
```

Open http://localhost:5173. The `/api` folder runs locally the same way it runs on Vercel.

To use the assistant locally, create a file `.env.local` in the project folder with one line `GEMINI_API_KEY=your_key` (a free key from https://aistudio.google.com) and restart `npm run dev`. This file is ignored by git. On Vercel add the same name under Project Settings, Environment Variables, then redeploy. Optional: `GEMINI_MODEL` to choose the first model to try.

`npm run build` makes the production build in `dist/`. Pushing to `main` deploys it on Vercel.

## Project structure

```
src/
  App.jsx               layout, tabs, place and language state
  Globe.jsx, MapPicker.jsx, AdminPicker.jsx, Prepare.jsx   choosing and preparing a place
  Weather.jsx, weatherPlus.js        weather, alerts, spraying windows, news
  Disasters.jsx                      hazard watch
  Irrigation.jsx, Water.jsx, water.js   irrigation schedules and rules
  RotationPlanner.jsx, rotation.js   rotation planner
  Market.jsx, Suppliers.jsx, suppliers.js
  Farms.jsx, farms.js                saved farms, alerts, install
  Assistant.jsx                      assistant chat
  Suitability.jsx, suitability.js    EcoCrop scoring
  Soil.jsx, Environment.jsx, Crops.jsx, crops.js
  i18n*.js                           English and Bengali text for each part
api/                    serverless functions (soil, environment, news, disasters, markets, assistant)
api/_lib/               knowledge notes, search, EcoCrop table, NASA image reader
public/                 data files, icons, web app manifest and offline service worker
data-tools/             scripts that built the data files
```

---

## বাংলায় সংক্ষেপে

EarthEcho একটি বিনামূল্যের দ্বিভাষিক (বাংলা ও ইংরেজি) কৃষি পরিকল্পনার অ্যাপ। কৃষক মানচিত্রে জমি বেছে নিলে পান সরাসরি আবহাওয়া ও সতর্কতা, দুর্যোগ পর্যবেক্ষণ, সেচের সময়সূচি, ফসল আবর্তন, মাটি ও জলবায়ু অনুযায়ী ফসলের উপযুক্ততা, বাজারদর, কাছের সার-বীজের দোকান, একাধিক খামার সংরক্ষণ এবং উৎস দেখানো এআই সহকারী। তথ্য আসে NASA, ISRIC, FAO, WFP, Open-Meteo ও OpenStreetMap থেকে। সব ফল অনুমান; বড় সিদ্ধান্তের আগে স্থানীয় কৃষি কর্মকর্তার সঙ্গে মিলিয়ে নিন।
