// Everyday names for the six soil types in the language farmers use in each country.
// These are common usage and can differ between regions, so the page says so. A missing name is left out, not guessed.
export const LOCAL_SOIL = {
  BD: {
    language: "বাংলা",
    sandy: "বেলে মাটি",
    sandyLoam: "বেলে দোআঁশ মাটি",
    loam: "দোআঁশ মাটি",
    siltLoam: "পলি দোআঁশ মাটি",
    clayLoam: "এঁটেল দোআঁশ মাটি",
    clay: "এঁটেল মাটি",
  },
  IND: {
    language: "हिन्दी",
    sandy: "रेतीली मिट्टी",
    sandyLoam: "बलुई दोमट",
    loam: "दोमट मिट्टी",
    clayLoam: "चिकनी दोमट",
    clay: "चिकनी मिट्टी",
  },
  NPL: {
    language: "नेपाली",
    sandy: "बलौटे माटो",
    sandyLoam: "बलौटे दोमट माटो",
    loam: "दोमट माटो",
    clayLoam: "चिम्टाइलो दोमट माटो",
    clay: "चिम्टाइलो माटो",
  },
  PAK: {
    language: "اردو",
    sandy: "ریتلی زمین",
    sandyLoam: "ریتلی میرا زمین",
    loam: "میرا زمین",
    clayLoam: "چکنی میرا زمین",
    clay: "چکنی زمین",
  },
  MMR: {
    language: "မြန်မာ",
    sandy: "သဲမြေ",
    siltLoam: "နုန်းမြေ",
    clay: "ရွှံ့စေးမြေ",
  },
};

export function localSoilName(country, simple) {
  const names = LOCAL_SOIL[country];
  return names && names[simple] ? { name: names[simple], language: names.language } : null;
}

// Rough water held when the soil is full after drainage (field capacity), as a share of soil volume.
// Used only to say whether the satellite's soil wetness is dry or wet *for that kind of soil*.
export const FIELD_CAPACITY = { sandy: 0.14, sandyLoam: 0.2, loam: 0.27, siltLoam: 0.3, clayLoam: 0.34, clay: 0.4 };

export function moistureClass(volumetric, simple) {
  if (volumetric == null) return null;
  const ratio = volumetric / (FIELD_CAPACITY[simple] || 0.27);
  return ratio < 0.4 ? "dry" : ratio < 0.8 ? "moist" : ratio < 1.05 ? "nearFull" : "wet";
}
