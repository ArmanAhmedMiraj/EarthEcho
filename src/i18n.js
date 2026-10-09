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
    tagline: "See how the Earth's surface is changing, measured by NASA-ISRO NISAR radar.",
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
    modeChange: "What changed",
    modeRadar: "Radar view",
    legendDarker: "Blue: likely more water or wetter ground",
    legendBrighter: "Orange: likely drier land, sand bars or crops",
    summary: (from, to, wet, dry, total) =>
      `Between ${from} and ${to}, about ${wet} km² of this area looks like more water or wetter ground, and about ${dry} km² looks drier (sand bars, dry land or crops). The area covered is about ${total} km².`,
    captionChange:
      "The colours are laid over a normal satellite photo. Only places where the radar measured a real change are coloured. Everything else did not change enough to be sure.",
    captionRadar:
      "This is the raw radar picture. Dark areas are smooth or wet surfaces such as water. Bright areas are rough surfaces such as buildings, sandbars and fields. Radar has no real colour, so it is shown in grey.",
    why: "Why it matters: the Jamuna moves its channels every monsoon, washing away farmland and homes on its banks. Seeing where water and sand are changing helps people and planners prepare.",
    themeLight: "Light",
    themeDark: "Dark",
    language: "Language",
    footer:
      "NISAR data is provisional. Radar shows likely surface change, not a certain cause.",
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
    tagline: "NASA-ISRO NISAR রাডারে মাপা পৃথিবীর পৃষ্ঠের পরিবর্তন দেখুন।",
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
    modeChange: "কী বদলেছে",
    modeRadar: "রাডার দৃশ্য",
    legendDarker: "নীল: সম্ভবত বেশি পানি বা ভেজা মাটি",
    legendBrighter: "কমলা: সম্ভবত শুকনো জমি, বালুচর বা ফসল",
    summary: (from, to, wet, dry, total) =>
      `${from} থেকে ${to} এর মধ্যে এই এলাকার প্রায় ${wet} বর্গকিমি জায়গায় সম্ভবত পানি বা ভেজা মাটি বেড়েছে, আর প্রায় ${dry} বর্গকিমি জায়গা শুকনো হয়েছে (বালুচর, শুকনো জমি বা ফসল)। মোট দেখা এলাকা প্রায় ${total} বর্গকিমি।`,
    captionChange:
      "সাধারণ স্যাটেলাইট ছবির ওপর রঙগুলো বসানো হয়েছে। যেখানে রাডার সত্যিকারের পরিবর্তন মেপেছে শুধু সেখানেই রং আছে। বাকি জায়গায় নিশ্চিত হওয়ার মতো পরিবর্তন হয়নি।",
    captionRadar:
      "এটি রাডারের মূল ছবি। গাঢ় অংশ মসৃণ বা ভেজা পৃষ্ঠ, যেমন পানি। উজ্জ্বল অংশ অমসৃণ পৃষ্ঠ, যেমন ঘরবাড়ি, বালুচর ও ক্ষেত। রাডারের নিজস্ব রং নেই, তাই ছবিটি ধূসর।",
    why: "কেন গুরুত্বপূর্ণ: প্রতি বর্ষায় যমুনা তার গতিপথ বদলায়, নদীর পাড়ের ফসলি জমি ও ঘরবাড়ি ভেঙে যায়। কোথায় পানি ও বালু বদলাচ্ছে তা দেখলে মানুষ ও পরিকল্পনাকারীরা আগে থেকে প্রস্তুত হতে পারেন।",
    themeLight: "দিন",
    themeDark: "রাত",
    language: "ভাষা",
    footer:
      "NISAR ডেটা সাময়িক। রাডার সম্ভাব্য পরিবর্তন দেখায়, নিশ্চিত কারণ নয়।",
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