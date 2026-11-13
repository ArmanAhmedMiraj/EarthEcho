# EarthEcho: submission answers (NASA Space Apps Challenge 2026)

Copy-ready answers for the final project submission. Team **Frontier Zero**, Rangpur local event, challenge **Field Shift: Adapting Farms with NASA Data**.

> The Rangpur submission page needs a login, so the exact field names could not be checked from outside. The answers below cover the usual fields. Anything marked **CONFIRM** must be matched against the live form before submitting.

## Links

| Item | Value |
|---|---|
| Live app | https://earth-echo-nine.vercel.app/ |
| Source code | https://github.com/ArmanAhmedMiraj/EarthEcho |
| Demo login | Phone `018564344011`, password `1234567890` (or tap *Start as a guest*) |
| Demo video | **TODO** (to be recorded; see "Video checklist") |
| Presentation / slides | **TODO** if the form asks for one |
| Licence | Apache 2.0, file `LICENSE` in the repository |

## Project title

EarthEcho

## One-line summary (about 140 characters)

A free English and Bengali farm planner that reads NASA data for a farmer's own land and compares crop-rotation strategies in plain words.

## Short summary (about 500 characters)

EarthEcho helps a farmer decide what to plant next. The farmer drops a pin on their land, and the app reads NASA POWER climate history and NASA GIBS satellite layers (greenness, land temperature, soil moisture) for that exact place. It compares the farmer's own rotation with the best alternatives, explains each in five parts, shows what was measured, assumed or missing, and lets the farmer test a drier or hotter season. It supports the farmer's judgment and never replaces it. English and Bengali.

## Full description

**The problem.** Rainfall and heat are shifting, and a farmer choosing the next crop has little local evidence in a language and format they can use. The Field Shift challenge asks for a supportive tool that compares rotation strategies, explains them, and leaves the decision to the farmer.

**What we built.** A web app (phone first, installable, works offline with the last data) in English and Bengali.

1. The farmer saves a **location** (a village) and draws or pins a **plot** of land. Land size is filled in from the boundary.
2. EarthEcho adds its own estimates (soil, height above sea level, slope), always labelled as estimates. The farmer adds what only they know (crop now, sowing month, past crops, irrigation). Those values are marked "You entered" and override estimates.
3. **Rotation planner** compares the farmer's current rotation with alternatives: fit to the place, months in use, bare months, nitrogen-fixing crops, plant families, water needed beyond rain, and profit when the farmer enters prices.
4. Every strategy has five parts (why suggested, evidence, benefits, information gaps, risks) and a **How sure are we?** box.
5. **What-if sliders** for rain and temperature show how crops and the top strategy change.
6. Supporting tabs: Weather (is this season normal against 25 years of NASA data), Disaster watch, Irrigation, Market prices, Suppliers, Suitability, Soil, Environment (NASA map layers with a time slider), Data (every source, licence and limit), and an AI assistant that answers from cited sources.

**How NASA data is used.** NASA POWER (temperature and rain, normals and history) drives crop fit, bare-month and wet-month calendars and the season check. NASA GIBS provides MODIS vegetation index and land surface temperature, SMAP soil moisture and GPM IMERG rain for the map layers and field readings. NASA EONET feeds natural-event alerts.

**What makes it honest.** No yield or income forecast. Every number says whether it was entered, assumed or estimated. Where NASA POWER's yearly rainfall jumps (around 2016 in Bangladesh), the app detects it, claims no trend and says so. The priorities a farmer picks can re-rank strategies, but fit to the place always counts for 40%.

**Who it is for.** Smallholder farmers in Bangladesh first (down to union level), with India, Nepal, Myanmar, Pakistan, Bhutan and the USA supported.

**Limits.** Estimates describe an area (about 1 to 55 km wide), not one field. The comparison is rule-based, not a yield model. Phone numbers for accounts are not verified. Full list in the README.

## Challenge selected

Field Shift: Adapting Farms with NASA Data

## NASA data and tools used (cite each)

- NASA POWER, https://power.larc.nasa.gov/
- NASA GIBS, https://earthdata.nasa.gov/gibs (MODIS NDVI and land surface temperature, SMAP L4 soil moisture, GPM IMERG)
- NASA EONET, https://eonet.gsfc.nasa.gov/

## Other resources and licences (cite each)

See the "Credits and citations" section of the README for the full table. In short: ISRIC SoilGrids (CC BY 4.0), FAO EcoCrop (FAO terms), FAO/IIASA HWSD, Open-Meteo (CC BY 4.0), USGS and GDACS, WFP prices (CC BY-IGO), GDELT, geoBoundaries and BBS, OpenStreetMap (ODbL), Wikimedia Commons (CC BY / BY-SA), Esri World Imagery (non-commercial demo), Groq and Google Gemini (AI assistant). Software: React, Vite, MapLibre GL JS, geotiff, pngjs (MIT / BSD-3-Clause), fonts under SIL OFL 1.1.

## AI usage statement (CONFIRM whether the form asks)

- **Inside the product:** the "Ask EarthEcho" assistant and "Explain this strategy" use large language models from Groq (with Google Gemini as backup). They answer only from the farm data and a sourced knowledge base, cite their sources, and say when they do not know.
- **In building it:** _team to state honestly which AI tools helped write code, text or images, if the form asks._

## Terms checklist (https://www.spaceappschallenge.org/legal/)

- [x] Original work under an OSI licence (Apache 2.0)
- [x] Third-party data and code are public or open, licences listed
- [x] Every source cited (README and this file)
- [x] No personal data (phone numbers, home addresses) in repository or screenshots
- [x] No recognisable people under 18 in screenshots or video
- [x] No commercial promotion
- [x] No export-controlled information
- [ ] Video is original; any music, footage or voices are licensed or ours
- [ ] Written consent from every identifiable adult in the video (keep proof)
- [ ] Team members all added on the form

## Before pressing submit

- [ ] Latest stages pushed; live app opens and the demo location (Mokamtala, Shibganj, Bogura) saves
- [ ] README top section shows live link, repo link, licence
- [ ] Teammate names filled in the README Team table
- [ ] Repository is public and has the LICENSE file
- [x] Screenshots in `docs/screenshots` show the current design (English, Bengali, phone, light)
- [ ] Register the demo account once on the live site and add the two plots so judges see data
- [ ] Video link works while logged out
- [ ] Match every field above to the live form (**CONFIRM** items)

## Video checklist (to do later)

- Length and format: **CONFIRM** against the form (typically a short public YouTube link)
- Suggested order: pitch (15 s), pin the land, save, Rotation planner comparison, one strategy and "How sure", what-if sliders, NASA map layer, Bengali assistant answer, close with "farmer decides"
- Script source: `docs/DEMO.md`
