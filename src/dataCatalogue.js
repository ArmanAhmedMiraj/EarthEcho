// The data catalogue: every source EarthEcho uses, with its licence and limits, in English and Bengali.
// status "live" = the app uses it today. "planned" = considered, not used yet (shown as "Not used yet").
// licenceChecked: false means we still have to read the exact terms in full.
// Names of organisations and datasets stay in English on purpose, so a farmer or judge can search for them.
export const GROUPS = [
  { id: "nasa", en: "NASA Earth observation", bn: "নাসার পৃথিবী পর্যবেক্ষণ" },
  { id: "soil", en: "Soil and crops", bn: "মাটি ও ফসল" },
  { id: "weather", en: "Weather, hazards and prices", bn: "আবহাওয়া, দুর্যোগ ও দাম" },
  { id: "geo", en: "Maps, boundaries and photos", bn: "মানচিত্র, সীমানা ও ছবি" },
  { id: "ai", en: "AI assistant", bn: "এআই সহকারী" },
];

export const SOURCES = [
  // ---- NASA, used today ----
  {
    id: "power", group: "nasa", name: "NASA POWER", publisher: "NASA Langley Research Center",
    url: "https://power.larc.nasa.gov/docs/", status: "live", licenceChecked: true,
    en: {
      provides: "Long-term monthly temperature, rain and sunshine (used for crop suitability, rotations and the water balance), and the last 14 days of rain and soil wetness.",
      resolution: "About 55 km cell", update: "Daily, about 2 to 3 days behind", licence: "NASA open data, credit NASA POWER",
      access: "Open API", limit: "Too coarse for one field. Soil wetness is a model estimate, not a measurement.",
    },
    bn: {
      provides: "দীর্ঘমেয়াদি মাসিক তাপমাত্রা, বৃষ্টি ও রোদ (ফসলের উপযোগিতা, শস্যাবর্তন ও পানির হিসাবে ব্যবহার হয়), এবং গত ১৪ দিনের বৃষ্টি ও মাটির ভেজা ভাব।",
      resolution: "প্রায় ৫৫ কিমি চওড়া ঘর", update: "প্রতিদিন, প্রায় ২–৩ দিন পিছিয়ে", licence: "নাসার উন্মুক্ত তথ্য, নাসা POWER-কে কৃতিত্ব দিতে হবে",
      access: "উন্মুক্ত API", limit: "একটি মাঠের জন্য খুব মোটা মাপের। মাটির ভেজা ভাব মডেলের অনুমান, মাপা মান নয়।",
    },
  },
  {
    id: "smap", group: "nasa", name: "SMAP Level 4 soil moisture", publisher: "NASA Soil Moisture Active Passive",
    url: "https://smap.jpl.nasa.gov/data/", status: "live", licenceChecked: true,
    en: {
      provides: "Soil moisture of the top 5 cm and the top 1 m, from SMAP satellite readings combined with a land model.",
      resolution: "About 9 km", update: "Daily, a few days behind", licence: "NASA open data",
      access: "Read through NASA GIBS", limit: "A regional estimate for a 9 km cell. It cannot tell the moisture of one handful of soil. Rounded to a colour step.",
    },
    bn: {
      provides: "মাটির উপরের ৫ সেমি এবং ১ মিটার গভীর পর্যন্ত আর্দ্রতা; SMAP স্যাটেলাইটের পাঠ ও একটি ভূমি-মডেল মিলিয়ে তৈরি।",
      resolution: "প্রায় ৯ কিমি", update: "প্রতিদিন, কয়েক দিন পিছিয়ে", licence: "নাসার উন্মুক্ত তথ্য",
      access: "নাসা GIBS-এর মাধ্যমে পড়া", limit: "৯ কিমি এলাকার আঞ্চলিক অনুমান। এক মুঠো মাটির আর্দ্রতা বলতে পারে না। একটি রঙের ধাপ অনুযায়ী গোল করা।",
    },
  },
  {
    id: "gpm", group: "nasa", name: "GPM IMERG rain rate", publisher: "NASA Global Precipitation Measurement",
    url: "https://gpm.nasa.gov/data", status: "live", licenceChecked: true,
    en: {
      provides: "Satellite estimate of how hard it is raining, in 30-minute slots. Daily rain totals come from NASA POWER.",
      resolution: "About 10 km", update: "Every 30 minutes, about 5 to 6 hours behind", licence: "NASA open data",
      access: "Read through NASA GIBS", limit: "One half-hour slot, not a daily total. Values are rounded to a colour step. Not a forecast.",
    },
    bn: {
      provides: "বৃষ্টি কত জোরে হচ্ছে তার স্যাটেলাইট-অনুমান, ৩০ মিনিটের ঘরে। দৈনিক মোট বৃষ্টি আসে নাসা POWER থেকে।",
      resolution: "প্রায় ১০ কিমি", update: "প্রতি ৩০ মিনিটে, প্রায় ৫–৬ ঘণ্টা পিছিয়ে", licence: "নাসার উন্মুক্ত তথ্য",
      access: "নাসা GIBS-এর মাধ্যমে পড়া", limit: "একটি আধঘণ্টার হার, দৈনিক মোট নয়। মান একটি রঙের ধাপে গোল করা। পূর্বাভাস নয়।",
    },
  },
  {
    id: "modis-ndvi", group: "nasa", name: "MODIS vegetation index (NDVI), monthly", publisher: "NASA LP DAAC",
    url: "https://lpdaac.usgs.gov/products/mod13a3v061/", status: "live", licenceChecked: true,
    en: {
      provides: "How green the land is, month by month, compared with the same month in earlier years.",
      resolution: "About 5 km here (1 km product)", update: "Monthly", licence: "NASA open data",
      access: "Read through NASA GIBS", limit: "Shows greenness of the whole area, so it mixes fields, trees and buildings. It does not identify the crop.",
    },
    bn: {
      provides: "জমি কতটা সবুজ, মাসে মাসে, আগের বছরগুলোর একই মাসের সঙ্গে তুলনা করে।",
      resolution: "এখানে প্রায় ৫ কিমি (১ কিমি পণ্য)", update: "মাসিক", licence: "নাসার উন্মুক্ত তথ্য",
      access: "নাসা GIBS-এর মাধ্যমে পড়া", limit: "পুরো এলাকার সবুজ ভাব দেখায়, তাই মাঠ, গাছ ও দালান মিশে যায়। কোন ফসল তা বলে না।",
    },
  },
  {
    id: "lst", group: "nasa", name: "MODIS land surface temperature (8-day, daytime)", publisher: "NASA LP DAAC",
    url: "https://lpdaac.usgs.gov/products/mod11a2v061/", status: "live", licenceChecked: true,
    en: {
      provides: "How hot the ground surface was at about 10:30 in the morning, averaged over 8 days.",
      resolution: "About 5 km here (1 km product)", update: "Every 8 days", licence: "NASA open data",
      access: "Read through NASA GIBS", limit: "Ground temperature is not air temperature, and afternoons are hotter. Clouds leave gaps.",
    },
    bn: {
      provides: "সকাল প্রায় ১০:৩০-এ মাটির উপরিতল কতটা গরম ছিল, ৮ দিনের গড়।",
      resolution: "এখানে প্রায় ৫ কিমি (১ কিমি পণ্য)", update: "প্রতি ৮ দিনে", licence: "নাসার উন্মুক্ত তথ্য",
      access: "নাসা GIBS-এর মাধ্যমে পড়া", limit: "মাটির তাপমাত্রা বাতাসের তাপমাত্রা নয়, আর বিকেলে আরও গরম থাকে। মেঘ থাকলে ফাঁক পড়ে।",
    },
  },
  {
    id: "gibs", group: "nasa", name: "GIBS (Global Imagery Browse Services)", publisher: "NASA Earthdata",
    url: "https://nasa-gibs.github.io/gibs-api-docs/", status: "live", licenceChecked: true,
    en: {
      provides: "NASA's satellite picture service. EarthEcho reads SMAP, IMERG, NDVI and temperature numbers from its map tiles.",
      resolution: "Varies by layer", update: "Daily for most layers", licence: "NASA open data",
      access: "Open map service", limit: "Numbers are decoded from colours, so they are rounded to one colour step. Shown to the user.",
    },
    bn: {
      provides: "নাসার স্যাটেলাইট-ছবি সেবা। EarthEcho এর মানচিত্র-টাইল থেকে SMAP, IMERG, NDVI ও তাপমাত্রার সংখ্যা পড়ে।",
      resolution: "স্তর অনুযায়ী আলাদা", update: "বেশিরভাগ স্তরে প্রতিদিন", licence: "নাসার উন্মুক্ত তথ্য",
      access: "উন্মুক্ত মানচিত্র সেবা", limit: "সংখ্যা রং থেকে পড়া হয়, তাই একটি রঙের ধাপে গোল করা। ব্যবহারকারীকে তা দেখানো হয়।",
    },
  },
  {
    id: "eonet", group: "nasa", name: "NASA EONET natural events", publisher: "NASA Goddard",
    url: "https://eonet.gsfc.nasa.gov/", status: "live", licenceChecked: true,
    en: {
      provides: "Current storms, floods, wildfires and other natural events, for the Disaster watch tab.",
      resolution: "By event", update: "As events are reported", licence: "NASA open data",
      access: "Open API", limit: "A listed event is not an official warning. Always follow national warnings.",
    },
    bn: {
      provides: "চলমান ঝড়, বন্যা, দাবানল ও অন্যান্য প্রাকৃতিক ঘটনা, দুর্যোগ নজরদারি ট্যাবের জন্য।",
      resolution: "ঘটনা অনুযায়ী", update: "ঘটনা জানানোর সঙ্গে সঙ্গে", licence: "নাসার উন্মুক্ত তথ্য",
      access: "উন্মুক্ত API", limit: "তালিকার ঘটনা সরকারি সতর্কবার্তা নয়। সবসময় জাতীয় সতর্কবার্তা মানুন।",
    },
  },
  // ---- NASA, not used yet ----
  {
    id: "grace", group: "nasa", name: "GRACE and GRACE-FO groundwater", publisher: "NASA JPL",
    url: "https://grace.jpl.nasa.gov/", status: "planned", licenceChecked: false,
    en: {
      provides: "Changes in water stored underground, for long-term water trends.",
      resolution: "Several hundred km", update: "Monthly", licence: "NASA open data",
      access: "Free Earthdata login", limit: "Far too coarse for one field. Useful only as a regional trend.",
    },
    bn: {
      provides: "ভূগর্ভে জমা পানির পরিবর্তন, দীর্ঘমেয়াদি পানির প্রবণতা দেখতে।",
      resolution: "কয়েকশো কিমি", update: "মাসিক", licence: "নাসার উন্মুক্ত তথ্য",
      access: "বিনামূল্যে Earthdata লগইন", limit: "একটি মাঠের জন্য একেবারেই মোটা। শুধু আঞ্চলিক প্রবণতা হিসেবে কাজের।",
    },
  },
  {
    id: "ecostress", group: "nasa", name: "ECOSTRESS plant heat stress", publisher: "NASA JPL",
    url: "https://ecostress.jpl.nasa.gov/", status: "planned", licenceChecked: false,
    en: {
      provides: "Surface temperature and plant water stress from the space station.",
      resolution: "About 70 m", update: "Irregular passes", licence: "NASA open data",
      access: "Free Earthdata login", limit: "Passes are irregular, so many places have few images.",
    },
    bn: {
      provides: "মহাকাশ স্টেশন থেকে ভূপৃষ্ঠের তাপমাত্রা ও গাছের পানির চাপ।",
      resolution: "প্রায় ৭০ মি", update: "অনিয়মিত ফেরা", licence: "নাসার উন্মুক্ত তথ্য",
      access: "বিনামূল্যে Earthdata লগইন", limit: "ফেরা অনিয়মিত, তাই অনেক জায়গায় ছবি কম।",
    },
  },
  {
    id: "nisar", group: "nasa", name: "NISAR radar", publisher: "NASA and ISRO",
    url: "https://nisar.jpl.nasa.gov/", status: "planned", licenceChecked: false,
    en: {
      provides: "Radar images that see through cloud: floods, crop and land change.",
      resolution: "Tens of metres", update: "Every 12 days", licence: "Open through NASA Earthdata and ASF",
      access: "Free Earthdata login", limit: "Soil moisture is not valid over snow, frozen ground and very dense forest.",
    },
    bn: {
      provides: "মেঘ ভেদ করে দেখা রাডার-ছবি: বন্যা, ফসল ও জমির পরিবর্তন।",
      resolution: "কয়েক দশ মিটার", update: "প্রতি ১২ দিনে", licence: "নাসা Earthdata ও ASF-এর মাধ্যমে উন্মুক্ত",
      access: "বিনামূল্যে Earthdata লগইন", limit: "তুষার, জমাট মাটি ও খুব ঘন বনে আর্দ্রতার মান বৈধ নয়।",
    },
  },
  // ---- Soil and crops ----
  {
    id: "soilgrids", group: "soil", name: "SoilGrids", publisher: "ISRIC World Soil Information",
    url: "https://soilgrids.org/", status: "live", licenceChecked: true,
    en: {
      provides: "Sand, silt, clay, pH, carbon and more at six depths. Gives the soil estimate for each field and the Soil tab.",
      resolution: "250 m", update: "Fixed map", licence: "CC BY 4.0",
      access: "Open", limit: "ISRIC warns it is not a farm-level map. The app shows the uncertainty and lets the farmer set the soil.",
    },
    bn: {
      provides: "ছয়টি গভীরতায় বালি, পলি, কাদা, pH, কার্বন ইত্যাদি। প্রতিটি মাঠের মাটির অনুমান ও মাটি ট্যাব এ থেকেই আসে।",
      resolution: "২৫০ মি", update: "স্থির মানচিত্র", licence: "CC BY 4.0",
      access: "উন্মুক্ত", limit: "ISRIC সতর্ক করে এটি খামার-স্তরের মানচিত্র নয়। অ্যাপ অনিশ্চয়তা দেখায় এবং কৃষককে মাটি নিজে ঠিক করতে দেয়।",
    },
  },
  {
    id: "hwsd", group: "soil", name: "Harmonized World Soil Database v2.0", publisher: "FAO and IIASA",
    url: "https://www.fao.org/soils-portal/data-hub/soil-maps-and-databases/harmonized-world-soil-database-v20/en/", status: "live", licenceChecked: false,
    en: {
      provides: "A second opinion on the topsoil type (0 to 20 cm), shown in the Soil tab beside SoilGrids for places in Bangladesh. It checks the main soil estimate and never replaces it.",
      resolution: "About 1 km grid, but drawn from large survey map units", update: "Fixed map", licence: "FAO and IIASA, credit them. Exact terms still to be read in full",
      access: "Open download, simplified into a small file for Bangladesh", limit: "Shows the general soil of an area, not one field. Where it disagrees with SoilGrids the app says so.",
    },
    bn: {
      provides: "মাটির ওপরের স্তরের (০ থেকে ২০ সেমি) ধরনের দ্বিতীয় একটি মতামত। বাংলাদেশের জায়গার জন্য মাটি ট্যাবে SoilGrids-এর পাশে দেখানো হয়। এটি মূল মাটির অনুমান যাচাই করে, বদলে দেয় না।",
      resolution: "প্রায় ১ কিমি গ্রিড, তবে বড় জরিপ-এলাকা থেকে আঁকা", update: "স্থির মানচিত্র", licence: "FAO ও IIASA, কৃতিত্ব দিতে হবে। সম্পূর্ণ শর্ত এখনো পুরো পড়া বাকি",
      access: "উন্মুক্ত ডাউনলোড, বাংলাদেশের জন্য ছোট ফাইলে সরল করা", limit: "একটি এলাকার সাধারণ মাটি দেখায়, একটি মাঠের নয়। SoilGrids-এর সঙ্গে না মিললে অ্যাপ তা বলে দেয়।",
    },
  },
  {
    id: "ecocrop", group: "soil", name: "FAO EcoCrop", publisher: "FAO",
    url: "https://gaez.fao.org/pages/ecocrop", status: "live", licenceChecked: false,
    en: {
      provides: "The temperature, rain and soil limits of each crop, used to score every crop for your place and plan rotations.",
      resolution: "Per crop", update: "Fixed table", licence: "FAO's general data terms: CC BY 4.0 unless a dataset says otherwise, credit FAO, no use to promote a business or imply FAO endorsement. The EcoCrop page has its own user agreement that we have not read in full.",
      access: "Bundled in the app", limit: "General limits for a crop, not for each variety or local practice.",
    },
    bn: {
      provides: "প্রতিটি ফসলের তাপমাত্রা, বৃষ্টি ও মাটির সীমা; আপনার জায়গার জন্য ফসলের নম্বর দিতে ও শস্যাবর্তন সাজাতে ব্যবহার হয়।",
      resolution: "ফসল অনুযায়ী", update: "স্থির তালিকা", licence: "FAO-র সাধারণ তথ্য-শর্ত: অন্যভাবে না বলা থাকলে CC BY 4.0, FAO-কে কৃতিত্ব দিতে হবে, কোনো ব্যবসা প্রচারে বা FAO-র সমর্থন বোঝাতে ব্যবহার নিষিদ্ধ। EcoCrop পাতার নিজস্ব ব্যবহারকারী-চুক্তি আছে, যা আমরা পুরো পড়িনি।",
      access: "অ্যাপের ভেতরে রাখা", limit: "ফসলের সাধারণ সীমা, প্রতিটি জাত বা স্থানীয় চাষপদ্ধতির জন্য নয়।",
    },
  },
  // ---- Weather, hazards and prices ----
  {
    id: "open-meteo", group: "weather", name: "Open-Meteo", publisher: "Open-Meteo",
    url: "https://open-meteo.com/", status: "live", licenceChecked: true,
    en: {
      provides: "The 16-day forecast, the last 7 days of weather, air quality, river flood outlook and elevation.",
      resolution: "About 2 to 11 km", update: "Hourly", licence: "CC BY 4.0, free for non-commercial use",
      access: "Open API", limit: "Not a NASA source. Commercial use needs a paid plan.",
    },
    bn: {
      provides: "১৬ দিনের পূর্বাভাস, গত ৭ দিনের আবহাওয়া, বাতাসের মান, নদীর বন্যা-পূর্বাভাস ও উচ্চতা।",
      resolution: "প্রায় ২–১১ কিমি", update: "ঘণ্টায় ঘণ্টায়", licence: "CC BY 4.0, অবাণিজ্যিক ব্যবহারে বিনামূল্যে",
      access: "উন্মুক্ত API", limit: "নাসার উৎস নয়। বাণিজ্যিক ব্যবহারে অর্থ দিয়ে প্ল্যান লাগে।",
    },
  },
  {
    id: "usgs-gdacs", group: "weather", name: "USGS earthquakes and GDACS alerts", publisher: "US Geological Survey; UN and EU GDACS",
    url: "https://www.gdacs.org/", status: "live", licenceChecked: true,
    en: {
      provides: "Recent earthquakes and the international cyclone, flood and drought alerts shown on Disaster watch.",
      resolution: "By event", update: "As issued", licence: "Free to use with credit",
      access: "Open feeds", limit: "International alerts are not national warnings. Follow BMD, FFWC, IMD and your local authority.",
    },
    bn: {
      provides: "সাম্প্রতিক ভূমিকম্প এবং দুর্যোগ নজরদারিতে দেখানো আন্তর্জাতিক ঘূর্ণিঝড়, বন্যা ও খরার সতর্কবার্তা।",
      resolution: "ঘটনা অনুযায়ী", update: "প্রকাশের সঙ্গে সঙ্গে", licence: "কৃতিত্ব দিয়ে বিনামূল্যে ব্যবহার",
      access: "উন্মুক্ত ফিড", limit: "আন্তর্জাতিক সতর্কবার্তা জাতীয় সতর্কবার্তা নয়। BMD, FFWC, IMD ও স্থানীয় কর্তৃপক্ষের কথা মানুন।",
    },
  },
  {
    id: "wfp-prices", group: "weather", name: "WFP food prices", publisher: "World Food Programme, via Humanitarian Data Exchange",
    url: "https://data.humdata.org/dataset/global-wfp-food-prices", status: "live", licenceChecked: true,
    en: {
      provides: "Prices of food crops from markets near the field, for the Market prices tab.",
      resolution: "By market", update: "Monthly or as published", licence: "CC BY-IGO (Creative Commons Attribution for Intergovernmental Organisations), credit WFP",
      access: "Open download", limit: "Some countries and markets have old or missing records. The app shows the date of each price.",
    },
    bn: {
      provides: "মাঠের কাছের বাজারের খাদ্যশস্যের দাম, বাজারদর ট্যাবের জন্য।",
      resolution: "বাজার অনুযায়ী", update: "মাসিক বা প্রকাশ অনুযায়ী", licence: "CC BY-IGO (আন্তঃসরকারি সংস্থার জন্য ক্রিয়েটিভ কমন্স অ্যাট্রিবিউশন), WFP-কে কৃতিত্ব",
      access: "উন্মুক্ত ডাউনলোড", limit: "কিছু দেশ ও বাজারের তথ্য পুরোনো বা অনুপস্থিত। অ্যাপ প্রতিটি দামের তারিখ দেখায়।",
    },
  },
  {
    id: "gdelt", group: "weather", name: "GDELT news", publisher: "The GDELT Project",
    url: "https://www.gdeltproject.org/about.html", status: "live", licenceChecked: true,
    en: {
      provides: "Recent news headlines about farming near the place.",
      resolution: "By news story", update: "Every 15 minutes", licence: "Free for unlimited and unrestricted use; the GDELT Project must be cited with a link",
      access: "Open API", limit: "Headlines are machine-picked and may be off-topic. We link to the original and never rewrite it.",
    },
    bn: {
      provides: "জায়গাটির কাছের কৃষি-সংক্রান্ত সাম্প্রতিক সংবাদের শিরোনাম।",
      resolution: "সংবাদ অনুযায়ী", update: "প্রতি ১৫ মিনিটে", licence: "সীমাহীন ও নিষেধহীন বিনামূল্যে ব্যবহার; GDELT প্রকল্পকে লিংকসহ উল্লেখ করতে হবে",
      access: "উন্মুক্ত API", limit: "শিরোনাম যন্ত্র বাছাই করে, তাই অপ্রাসঙ্গিক হতে পারে। আমরা মূল লেখার লিংক দিই, নিজে বদলাই না।",
    },
  },
  // ---- Maps, boundaries and photos ----
  {
    id: "geoboundaries", group: "geo", name: "geoBoundaries and Bangladesh Bureau of Statistics", publisher: "William & Mary geoLab; BBS and OCHA ROAP",
    url: "https://www.geoboundaries.org/", status: "live", licenceChecked: true,
    en: {
      provides: "Borders for Bangladesh (down to union), India, Nepal, Myanmar, Pakistan, Bhutan and the USA, used to pick and name a place.",
      resolution: "Varies by country", update: "Fixed files", licence: "CC BY 3.0 IGO (Bangladesh) and open licences for the others",
      access: "Bundled in the app", limit: "Completeness and age differ by country. Borders are not legal land records.",
    },
    bn: {
      provides: "বাংলাদেশ (ইউনিয়ন পর্যন্ত), ভারত, নেপাল, মিয়ানমার, পাকিস্তান, ভুটান ও যুক্তরাষ্ট্রের সীমানা; জায়গা বেছে নিতে ও নাম দেখাতে ব্যবহার হয়।",
      resolution: "দেশ অনুযায়ী আলাদা", update: "স্থির ফাইল", licence: "CC BY 3.0 IGO (বাংলাদেশ) এবং অন্যদের জন্য উন্মুক্ত লাইসেন্স",
      access: "অ্যাপের ভেতরে রাখা", limit: "সম্পূর্ণতা ও বয়স দেশ ভেদে আলাদা। সীমানা আইনি ভূমি-রেকর্ড নয়।",
    },
  },
  {
    id: "osm", group: "geo", name: "OpenStreetMap", publisher: "OpenStreetMap contributors",
    url: "https://www.openstreetmap.org/copyright", status: "live", licenceChecked: true,
    en: {
      provides: "Place search, map labels, and shops, roads and points of interest for the Suppliers map.",
      resolution: "Point data", update: "Continuous", licence: "ODbL, credit required",
      access: "Open", limit: "A shop on the map is not proof of what it has in stock.",
    },
    bn: {
      provides: "জায়গা খোঁজা, মানচিত্রের লেবেল এবং সরবরাহকারী মানচিত্রের জন্য দোকান, রাস্তা ও গুরুত্বপূর্ণ স্থান।",
      resolution: "বিন্দু-তথ্য", update: "নিরন্তর", licence: "ODbL, কৃতিত্ব দিতে হবে",
      access: "উন্মুক্ত", limit: "মানচিত্রে দোকান থাকা মানে সেখানে মাল আছে তার প্রমাণ নয়।",
    },
  },
  {
    id: "esri", group: "geo", name: "Esri World Imagery", publisher: "Esri and its data providers",
    url: "https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9", status: "live", licenceChecked: false,
    en: {
      provides: "The satellite photo base map when you pick or move a field.",
      resolution: "Sharper near towns, softer in the countryside", update: "Varies", licence: "Esri terms apply and credit is shown on the map. We could not confirm the current free-use terms for this tile address, so it is used here for a non-commercial competition demo. Check before any commercial use.",
      access: "Map tiles", limit: "The photo may be a year or more old.",
    },
    bn: {
      provides: "মাঠ বাছাই বা সরানোর সময় স্যাটেলাইট-ছবির পটভূমি মানচিত্র।",
      resolution: "শহরের কাছে স্পষ্ট, গ্রামে কিছুটা ঝাপসা", update: "ভিন্ন ভিন্ন", licence: "Esri-র শর্ত প্রযোজ্য এবং মানচিত্রে কৃতিত্ব দেখানো হয়। এই টাইল ঠিকানার বর্তমান বিনামূল্যে-ব্যবহারের শর্ত আমরা নিশ্চিত করতে পারিনি, তাই এটি অবাণিজ্যিক প্রতিযোগিতার ডেমোর জন্য ব্যবহার হচ্ছে। বাণিজ্যিক ব্যবহারের আগে যাচাই করুন।",
      access: "মানচিত্র-টাইল", limit: "ছবিটি এক বছর বা তারও বেশি পুরোনো হতে পারে।",
    },
  },
  {
    id: "commons", group: "geo", name: "Wikimedia Commons photographs", publisher: "Wikimedia Commons contributors",
    url: "https://commons.wikimedia.org/", status: "live", licenceChecked: true,
    en: {
      provides: "Real photographs of the place for the banner. Only free licences are used, and the photographer and licence are shown on each picture.",
      resolution: "Per photo", update: "Continuous", licence: "Free licences such as CC BY and CC BY-SA, credit shown",
      access: "Open API", limit: "A photo may be from a nearby place, not your exact spot. The banner says how near it is.",
    },
    bn: {
      provides: "ব্যানারের জন্য জায়গাটির আসল ছবি। শুধু মুক্ত লাইসেন্সের ছবি নেওয়া হয়, প্রতিটি ছবিতে আলোকচিত্রী ও লাইসেন্স দেখানো হয়।",
      resolution: "ছবি অনুযায়ী", update: "নিরন্তর", licence: "CC BY ও CC BY-SA-র মতো মুক্ত লাইসেন্স, কৃতিত্ব দেখানো হয়",
      access: "উন্মুক্ত API", limit: "ছবি কাছের কোনো জায়গার হতে পারে, ঠিক আপনার জমির নয়। ব্যানারে কত কাছের তা লেখা থাকে।",
    },
  },
  // ---- AI ----
  {
    id: "llm", group: "ai", name: "Groq and Google Gemini language models", publisher: "Groq; Google",
    url: "https://console.groq.com/docs/your-data", status: "live", licenceChecked: true,
    en: {
      provides: "Write the answers of Ask EarthEcho in plain words, in the language of the app, from the retrieved sources and your field's data.",
      resolution: "Not applicable", update: "Per question", licence: "Groq: requests are not stored by default, but may be logged up to 30 days to check reliability and abuse (can be switched off). Google Gemini free tier: Google may use submitted text to improve its products and people may read it; the paid tier does not.",
      access: "Server-side, key never in the app", limit: "A language model can be wrong. Answers must cite a source, and the assistant says when it does not know. Your question, your place and your field notes are sent to the provider, so do not write personal details.",
    },
    bn: {
      provides: "খুঁজে পাওয়া উৎস ও আপনার মাঠের তথ্য থেকে অ্যাপের ভাষায় সহজ কথায় ‘Ask EarthEcho’-র উত্তর লেখে।",
      resolution: "প্রযোজ্য নয়", update: "প্রতিটি প্রশ্নে", licence: "Groq: অনুরোধ ডিফল্টভাবে জমা থাকে না, তবে নির্ভরযোগ্যতা ও অপব্যবহার যাচাইয়ে ৩০ দিন পর্যন্ত লগ হতে পারে (বন্ধ করা যায়)। Google Gemini বিনামূল্যে স্তর: জমা দেওয়া লেখা Google তাদের পণ্য উন্নত করতে ব্যবহার করতে পারে এবং মানুষ পড়তে পারে; পেইড স্তরে তা হয় না।",
      access: "সার্ভার থেকে, চাবি অ্যাপে থাকে না", limit: "ভাষা-মডেল ভুল করতে পারে। উত্তরে উৎস উল্লেখ থাকতে হয়, আর না জানলে সহকারী তা বলে। আপনার প্রশ্ন, জায়গা ও মাঠের নোট প্রদানকারীর কাছে যায়, তাই ব্যক্তিগত তথ্য লিখবেন না।",
    },
  },
];
