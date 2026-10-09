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
    mapPlaceholder: "The interactive map appears here in the next step.",
    noLayer: "No prepared radar layer here yet.",
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
    mapPlaceholder: "ইন্টারঅ্যাকটিভ মানচিত্র পরের ধাপে এখানে দেখা যাবে।",
    noLayer: "এখানে এখনো কোনো রাডার স্তর প্রস্তুত নেই।",
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