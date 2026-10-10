// The colour of each level, the zoom levels where borders appear, and the legend texts.
export const LEVEL_COLORS = {
  country: "#ff4d6d",
  division: "#b24dff",
  district: "#ffa726",
  upazila: "#2ecc71",
  union: "#29b6f6",
};

// Map zoom levels. A smaller number means the borders appear earlier (when you are further out).
// About 9 = one or two districts fill the screen. About 10.3 = a few upazilas fill the screen.
export const ZOOM = {
  upazila: 9,
  union: 10.3,
};

export const LEGEND_TEXT = {
  en: {
    legendCountry: "Country border (always shown)",
    legendDistrict: "District borders (always shown)",
    legendUpazila: "Upazila / Thana borders (appear when you zoom in to about one district)",
    legendUnion: "Union / ward borders (appear when you zoom in further)",
    legendDivision: "Division outline (when you choose a division)",
    legendSelected: "The area you choose is filled with the colour of its level.",
  },
  bn: {
    legendCountry: "দেশের সীমানা (সবসময় দেখা যায়)",
    legendDistrict: "জেলার সীমানা (সবসময় দেখা যায়)",
    legendUpazila: "উপজেলা / থানার সীমানা (প্রায় একটি জেলা দেখা যায় এমন জুমে আসে)",
    legendUnion: "ইউনিয়ন / ওয়ার্ডের সীমানা (আরও জুম করলে আসে)",
    legendDivision: "বিভাগের রেখা (বিভাগ বাছলে দেখা যায়)",
    legendSelected: "আপনার বাছাই করা এলাকা তার স্তরের রঙে ভরা থাকে।",
  },
};