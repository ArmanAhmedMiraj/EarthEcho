// The satellite map used by the farmland tools (same imagery as the place picker).
export const FONT = ["Noto Sans Medium"];
export const SAT_STYLE = {
  version: 8,
  glyphs: "https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf",
  sources: {
    satellite: {
      type: "raster",
      tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
      tileSize: 256,
      maxzoom: 18,
      attribution: "Imagery © Esri, Maxar, Earthstar Geographics",
    },
  },
  layers: [{ id: "satellite", type: "raster", source: "satellite" }],
};
export const PLOT_COLORS = ["#ffd54f", "#4fc3f7", "#ff8a65", "#ba68c8", "#81c784", "#f06292"];
