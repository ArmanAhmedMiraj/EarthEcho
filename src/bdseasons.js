// Bangladesh season names for a month (0 = January). The usual way farmers talk about the year: Rabi (winter crops),
// Kharif-1 (pre-monsoon) and Kharif-2 (monsoon). Dates change by region and year, so these are month-level guides.
// Rabi runs from about November to March and Kharif-1 starts in late March (Banglapedia, "Crop"); the end of Kharif-1 and
// the split into Kharif-2 are our reading of the rest of the rainy season.
export const BD_SEASONS = [
  { key: "rabi", from: 0, to: 2 },
  { key: "k1", from: 3, to: 5 },
  { key: "k2", from: 6, to: 9 },
  { key: "rabi", from: 10, to: 11 },
];
export const bdSeason = (m) => { const i = ((m % 12) + 12) % 12; return BD_SEASONS.find((s) => i >= s.from && i <= s.to).key; };
// Rice by sowing month: Aus (March to May), Aman (July to August), June fits either, Boro (November to February). September and October: none of the three.
export const riceType = (m) => {
  const i = ((m % 12) + 12) % 12;
  if (i >= 2 && i <= 4) return "aus";
  if (i === 5) return "both";
  if (i >= 6 && i <= 7) return "aman";
  if (i >= 10 || i <= 1) return "boro";
  return null;
};
// the label for a crop sown in month m: "Rabi" or "Aman rice, Kharif-2"
export function seasonLabel(crop, m, t) {
  const s = t[`bdSeason_${bdSeason(m)}`];
  const r = crop && crop.id === "rice" ? riceType(m) : null;
  return r ? `${t[`bdRice_${r}`]} · ${s}` : s;
}
