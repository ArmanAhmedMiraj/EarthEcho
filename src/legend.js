// The colour of each level, the zoom levels where borders and names appear, and the legend texts.
export const LEVEL_COLORS = {
  country: "#ff4d6d",
  division: "#b24dff",
  district: "#ffa726",
  upazila: "#2ecc71",
  union: "#29b6f6",
};

// Map zoom levels where the border LINES fade in. A smaller number means earlier (further out).
// Division lines are always shown. About 7.3 = one division fills the screen.
// About 9 = one or two districts. About 10.3 = a few upazilas.
export const ZOOM = {
  district: 7.3,
  upazila: 9,
  union: 10.3,
};

// Map zoom levels where the NAMES show: [first zoom, last zoom]. null = no last zoom.
// Each level hands over to the next, so names of different levels do not mix.
export const LABEL_ZOOM = {
  division: [3, 7.4],
  district: [7.0, 9.2],
  upazila: [9.2, 10.9],
  union: [10.9, null],
};

// The colour of the name text for each level (a pale tint of the border colour)
export const LABEL_COLORS = {
  division: "#ecd5ff",
  district: "#ffe0b2",
  upazila: "#c8f7dc",
  union: "#d4f1ff",
};

export const LEGEND_TEXT = {
  en: {
    legendCountry: "Country border (always shown)",
    legendDivision: "Division borders (always shown)",
    legendDistrict: "District borders (appear when you zoom in to a division)",
    legendUpazila: "Upazila / Thana borders (appear when you zoom in to about one district)",
    legendUnion: "Union / ward borders (appear when you zoom in further)",
    legendSelected: "The area you choose is filled with the colour of its level.",
    legendNames:
      "Names: divisions first, then districts, upazilas and unions as you zoom in. Map names are shown in English letters.",
  },
  bn: {
    legendCountry: "দেশের সীমানা (সবসময় দেখা যায়)",
    legendDivision: "বিভাগের সীমানা (সবসময় দেখা যায়)",
    legendDistrict: "জেলার সীমানা (একটি বিভাগ দেখা যায় এমন জুমে আসে)",
    legendUpazila: "উপজেলা / থানার সীমানা (প্রায় একটি জেলা দেখা যায় এমন জুমে আসে)",
    legendUnion: "ইউনিয়ন / ওয়ার্ডের সীমানা (আরও জুম করলে আসে)",
    legendSelected: "আপনার বাছাই করা এলাকা তার স্তরের রঙে ভরা থাকে।",
    legendNames:
      "নাম: প্রথমে বিভাগ, জুম করলে জেলা, উপজেলা ও ইউনিয়ন। মানচিত্রের নাম ইংরেজি অক্ষরে দেখানো হয়।",
  },
};