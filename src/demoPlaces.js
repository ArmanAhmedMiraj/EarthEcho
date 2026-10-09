// Places that have (or will have) a prepared NISAR layer.
//
// IMPORTANT: real NISAR layers exist ONLY for the places listed here.
// For any other place the app must show the "No prepared radar layer here yet"
// message instead of pretending to have data.
//
// lon/lat are approximate map centres. They are refined from each place's
// meta.json once its layer is processed. Only Jamuna is processed so far.

export const DEMO_PLACES = [
  { id: "jamuna", type: "river", lon: 89.78, lat: 24.4, zoom: 11, ready: true },
  { id: "mozambique", type: "flood", lon: 33.5, lat: -24.9, zoom: 8, ready: false },
  { id: "venezuela", type: "earthquake", lon: -67.0, lat: 10.4, zoom: 8, ready: false },
  { id: "tonlesap", type: "wetland", lon: 104.0, lat: 12.8, zoom: 8, ready: false },
  { id: "mexicocity", type: "subsidence", lon: -99.13, lat: 19.43, zoom: 10, ready: false },
  { id: "himalaya", type: "glacier", lon: 85.5, lat: 28.2, zoom: 10, ready: false },
];