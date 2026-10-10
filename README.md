# EarthEcho

**What should I plant next? Plan your field with NASA data.**

EarthEcho is a free, bilingual (English and Bengali) farm-planning web app for farmers in Bangladesh. The farmer taps their field on a map, answers a few simple questions, and gets back a crop rotation for the whole year, the best named varieties for their land, and a live countdown to the next irrigation.

- **Live app:** https://earth-echo-nine.vercel.app/
- **Built for:** NASA Space Apps Challenge 2026, Bangladesh
- **Challenge:** Field Shift: Adapting Farms with NASA Data
- **Team:** Frontier Zero (team lead: Arman Ahmed Miraj)

---

## The challenge

> **Field Shift: Adapting Farms with NASA Data**
>
> Farmers around the world navigate shifting temperatures, changing rainfall patterns, water shortages, extreme weather, and declining soil health. These pressures make it difficult to choose crop rotations that protect fields, conserve water, and support long-term resilience. Your challenge is to create a decision-support tool that uses NASA Earth observations along with local soil information, crop characteristics, and farmer priorities to help farmers explore rotation strategies that could strengthen soil health and adapt their farms to changing conditions.

## How EarthEcho answers the challenge

The challenge names four ingredients. This is what EarthEcho uses for each one today.

| Challenge ingredient | What EarthEcho uses | What the farmer sees |
| --- | --- | --- |
| **NASA Earth observations** | **NASA POWER** (agroclimatology community): monthly rainfall and air temperature for the last 10 full years at the farmer's exact pin. POWER is built from NASA satellite observations and NASA's MERRA-2 weather reanalysis. | The typical rain and temperature for each month at their place, so they see how their climate behaves across the year. |
| **Local soil information** | **ISRIC SoilGrids** soil texture (about 250 m), turned into six simple soil types the farmer can confirm or change. Plus the farmer's own answers about land height, salty water or soil, and irrigation. | The soil type for the pin, with a plain warning that it is a model estimate to be confirmed. |
| **Crop characteristics** | Planting windows, growing days, yield and stress tolerance (flood, drought, salt, cold) for named varieties, from BRRI, FAO and published studies (22 numbered sources in `src/crops.js`). Water-use figures from FAO Irrigation and Drainage Paper 56. | Three ranked rotations, the exact variety to ask for, a year calendar, and the reasons it fits or does not. |
| **Farmer priorities** | Irrigation available or not, low or high land, salt in the water or soil, and the rotation the farmer prefers to compare. | Rotations that match the farm's real limits. When nothing fits well, the app says "Not a good fit" and explains why instead of forcing an answer. |

### Weather that keeps the advice live

The water countdown uses real recent rain (the past 7 days) and a 16-day forecast from **Open-Meteo**, refreshed every 20 minutes. If rain falls, the next irrigation date moves later; if it is dry and hot, it moves sooner. This is not a NASA product, and the app says so on screen.

### How the advice is worked out

This is a transparent rule-based tool, **not** a black-box AI.

- **Rotation score:** starts at 50, then adds or subtracts for irrigation, land height, soil type, salt, and the number of crops in the year. A single rain-fed crop is penalised when the farmer has irrigation.
- **Variety ranking:** adds points for traits that fit the farm (salt tolerance, flood tolerance on low land, drought tolerance without irrigation, cold tolerance in cold districts, early maturity when the next crop is waiting) and removes points for long duration or thin data.
- **Water countdown:** upland crops (potato, mustard, mungbean) use a soil water tank with FAO-56 crop coefficients, root depth and allowed depletion. Rice uses a standing-water depth with seepage by soil type and an alternate wetting and drying tip.
- A few rules are our own simple assumptions (for example, rain under 5 mm is ignored, forecast rain is counted only when the chance is 50 percent or more). They are marked as our own on screen.

## What works today

- Tap the map or search a place; administrative borders, satellite imagery, and a pin label.
- Soil estimated automatically for the pin, with a farmer override.
- Six crop systems: Boro, T. Aman, Aus rice, potato, mustard, mungbean, combined into 7 rotations, including a flood-tolerant T. Aman option and salt-tolerant Boro.
- Named varieties per crop, with days to harvest, yield, and drawn pictures.
- A "your year, step by step" picture flow and a year timeline that shows rest periods.
- Live irrigation countdown with the farmer's last irrigation date remembered on their device.
- A one-page printable plan, "Save this plan as PDF".
- Full English and Bengali interface.
- A first version of the alerts service (Telegram and WhatsApp) in the `alerts/` folder, not yet connected to the app.

## What we will build next

1. **A better look and a better location picker.** We will update the whole interface (UI and UX), and move location selection to its own window so the farmer can place the pin more precisely on a larger map.
2. **Accounts and a dashboard.** A farmer creates an ID (sign up and log in) with name, date of birth, email, and phone number. The dashboard keeps their fields, plans, and irrigation history, and is where the app sends messages or emails with the alerts they want. We will collect only what is needed, ask for consent, and keep it protected.
3. **Beyond these crops and this country.** Farmers will be able to choose any kind of crop, including fruits and vegetables, and use the app in other countries, not only Bangladesh.
4. **Farm alerts on Telegram or WhatsApp.** The farmer chooses one. Alerts include when to irrigate, rain coming so do not spray, heavy rain, and very hot or cold days.
5. **More NASA data.** Next we plan to add NASA soil moisture, vegetation and rainfall observations, and feed the 10-year NASA POWER history directly into rotation suitability.
6. **An assistant for farmers' questions,** answering from FAO, BARI, and BRRI documents with the source shown.

## Data sources and credits

| Data | Provider | Use |
| --- | --- | --- |
| Monthly rain and temperature history | [NASA POWER](https://power.larc.nasa.gov/) | Typical climate for the pin |
| Soil texture | [ISRIC SoilGrids](https://soilgrids.org/) (CC BY 4.0) | Soil type estimate |
| Recent rain, 16-day forecast, reference evapotranspiration, place search | [Open-Meteo](https://open-meteo.com/) | Live water countdown |
| Crop water use and soil water | [FAO Irrigation and Drainage Paper 56](https://www.fao.org/4/x0490e/x0490e00.htm) | Water model |
| Rice varieties and practices | BRRI (Bangladesh Rice Research Institute) | Variety facts, AWD tip |
| Map | [MapLibre GL](https://maplibre.org/), Esri imagery, OpenStreetMap | Map and base layers |

Full source lists with links appear in the app under each variety and the water section.

## Important limits

Everything here is an **estimate** to help a farmer explore options. Soil comes from a model map, not a test of the field. Forecasts can be wrong. Please confirm with your local agriculture officer before making a big decision.

Farmer answers (such as the last irrigation date) are stored only in the farmer's own browser today. Nothing is sent to a server until accounts and alerts are added.

## Run it on your computer

You need [Node.js](https://nodejs.org/) installed.

```bash
npm install
npm run dev
```

Open http://localhost:5173. To make the production build, run `npm run build`; the result is in `dist/`.

## Project structure

```
src/
  App.jsx            page layout, weather loading, language
  MapPicker.jsx      the map and pin
  AdminPicker.jsx    district and area dropdowns
  soil.js            soil lookup from the SoilGrids-based map file
  weather.js         NASA POWER history and Open-Meteo forecast
  crops.js           crops, varieties, rotations, ranking, sources
  Crops.jsx          rotation cards, variety panels, timeline
  water.js           irrigation countdown rules
  Water.jsx          countdown screen
  PlanPrint.jsx      printable one-page plan
  i18n*.js           English and Bengali text
public/
  soil_bd.json       soil texture map for Bangladesh
alerts/              Telegram and WhatsApp alerts service (Cloudflare Worker)
```

---

## বাংলায় সংক্ষেপে

EarthEcho বাংলাদেশের কৃষকদের জন্য একটি বিনামূল্যের দ্বিভাষিক (বাংলা ও ইংরেজি) ফসল পরিকল্পনার অ্যাপ। কৃষক মানচিত্রে নিজের জমি বেছে নিলে অ্যাপ NASA POWER-এর আবহাওয়ার তথ্য, SoilGrids-এর মাটির তথ্য এবং BRRI ও FAO-র ফসলের তথ্য ব্যবহার করে সারা বছরের ফসলের ধারা, সবচেয়ে উপযোগী জাতের নাম এবং পরবর্তী সেচের দিন জানিয়ে দেয়। পরবর্তী ধাপে থাকছে নতুন ডিজাইন, লগইন ও ড্যাশবোর্ড, যেকোনো ফসল ও দেশ, এবং টেলিগ্রাম বা হোয়াটসঅ্যাপে সতর্কবার্তা।
