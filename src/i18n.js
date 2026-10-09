// All text shown in the app lives here, one block per language.
// More languages (Hindi, Spanish, Arabic, Chinese, French, Portuguese)
// are added later by adding another block with the same keys.

export const LANGUAGES = [
  { code: "en", label: "English", dir: "ltr" },
  { code: "bn", label: "বাংলা", dir: "ltr" },
];

export const TEXT = {
  en: {
    appName: "EarthEcho",
    tagline: "Hear how the Earth's surface is changing, seen by NASA-ISRO NISAR radar.",
    searchPlaceholder: "Search a city, country or landmark",
    useMyLocation: "Use my location",
    changeType: "Type of change",
    demoPlaces: "Places with radar layers",
    ready: "Radar layer ready",
    comingSoon: "Layer coming soon",
    noLayer: "No prepared radar layer here yet.",
    loading: "Loading radar layer…",
    loadError: "Could not load the radar layer.",
    before: "Before",
    after: "After",
    slideHint: "Drag the slider to fade from before to after.",
    showChange: "Show detected changes",
    comparePeriods: "Compare periods",
    legendDarker: "Darker later: likely more water or wetter ground",
    legendBrighter: "Brighter later: likely drier land, sand or crops",
    caption:
      "What am I looking at? NISAR radar brightness. Dark areas are smooth or wet surfaces such as water; bright areas are rough surfaces such as buildings, sandbars and fields. Colours mark changes that are statistically significant.",
    themeLight: "Light",
    themeDark: "Dark",
    language: "Language",
    footer:
      "NISAR data is provisional. Radar brightness shows likely surface change, not certain cause.",
    types: {
      flood: "Flood",
      wetland: "Wetland and water",
      river: "River and monsoon",
      earthquake: "Earthquake",
      subsidence: "Land sinking",
      glacier: "Glacier and mountain",
    },
    places: {
      mozambique: "Southern Mozambique",
      venezuela: "Northern Venezuela",
      tonlesap: "Tonle Sap, Cambodia",
      jamuna: "Jamuna river, Bangladesh",
      mexicocity: "Mexico City",
      himalaya: "Langtang, Nepal",
    },
  },
  bn: {
    appName: "EarthEcho",
    tagline: "NASA-ISRO NISAR রাডারে দেখা পৃথিবীর পৃষ্ঠের পরিবর্তন।",
    searchPlaceholder: "শহর, দেশ বা কোনো স্থান খুঁজুন",
    useMyLocation: "আমার অবস্থান ব্যবহার করুন",
    changeType: "পরিবর্তনের ধরন",
    demoPlaces: "রাডার স্তর আছে এমন স্থান",
    ready: "রাডার স্তর প্রস্তুত",
    comingSoon: "স্তর শীঘ্রই আসছে",
    noLayer: "এখানে এখনো কোনো রাডার স্তর প্রস্তুত নেই।",
    loading: "রাডার স্তর লোড হচ্ছে…",
    loadError: "রাডার স্তর লোড করা যায়নি।",
    before: "আগে",
    after: "পরে",
    slideHint: "আগে থেকে পরে দেখতে স্লাইডার টানুন।",
    showChange: "শনাক্ত করা পরিবর্তন দেখান",
    comparePeriods: "সময়কাল তুলনা",
    legendDarker: "পরে গাঢ়: সম্ভবত বেশি পানি বা ভেজা মাটি",
    legendBrighter: "পরে উজ্জ্বল: সম্ভবত শুকনো জমি, বালু বা ফসল",
    caption:
      "আমি কী দেখছি? NISAR রাডারের উজ্জ্বলতা। গাঢ় অংশ মসৃণ বা ভেজা পৃষ্ঠ, যেমন পানি; উজ্জ্বল অংশ অমসৃণ পৃষ্ঠ, যেমন ঘরবাড়ি, বালুচর ও ক্ষেত। রঙিন অংশ পরিসংখ্যানগতভাবে উল্লেখযোগ্য পরিবর্তন।",
    themeLight: "দিন",
    themeDark: "রাত",
    language: "ভাষা",
    footer:
      "NISAR ডেটা সাময়িক। রাডারের উজ্জ্বলতা সম্ভাব্য পরিবর্তন দেখায়, নিশ্চিত কারণ নয়।",
    types: {
      flood: "বন্যা",
      wetland: "জলাভূমি ও পানি",
      river: "নদী ও বর্ষা",
      earthquake: "ভূমিকম্প",
      subsidence: "ভূমি দেবে যাওয়া",
      glacier: "হিমবাহ ও পাহাড়",
    },
    places: {
      mozambique: "দক্ষিণ মোজাম্বিক",
      venezuela: "উত্তর ভেনেজুয়েলা",
      tonlesap: "টনলে সাপ, কম্বোডিয়া",
      jamuna: "যমুনা নদী, বাংলাদেশ",
      mexicocity: "মেক্সিকো সিটি",
      himalaya: "লাংটাং, নেপাল",
    },
  },
};