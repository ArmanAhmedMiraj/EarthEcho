// Read one number from a NASA satellite layer, through NASA GIBS (the Earthdata image service).
//
// How it works, in plain words:
//  1. GIBS draws each satellite layer as a coloured picture. Every colour stands for a small range of values.
//  2. NASA publishes the colour table ("colormap") for each layer.
//  3. We ask GIBS for a tiny picture around the field, read the colour of the middle pixel,
//     and look that colour up in the table to get the value range. Worldview's data readout works the same way.
// Because of this, values are rounded to the size of one colour step. That is shown to the user.
import { PNG } from "pngjs";

const WMS = "https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi";
const COLORMAPS = "https://gibs.earthdata.nasa.gov/colormaps/v1.3/";
const tables = new Map(); // colour tables are kept in memory while the server stays warm

async function getBytes(url, ms = 20000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`NASA GIBS answered ${response.status}`);
    return Buffer.from(await response.arrayBuffer());
  } finally {
    clearTimeout(timer);
  }
}

// colour "r,g,b" -> { low, high } (high is null for the open-ended top step)
export async function loadColormap(file) {
  if (tables.has(file)) return tables.get(file);
  const xml = (await getBytes(COLORMAPS + file)).toString("utf8");
  const map = new Map();
  for (const tag of xml.match(/<ColorMapEntry [^>]*>/g) || []) {
    if (/transparent="true"/.test(tag)) continue;
    const rgb = /rgb="(\d+),(\d+),(\d+)"/.exec(tag);
    const range = /value="\[([-\d.]+),([-\d.+INF]+)\)"/.exec(tag);
    if (!rgb || !range) continue;
    const low = Number(range[1]);
    const high = range[2].includes("INF") ? null : Number(range[2]);
    map.set(`${rgb[1]},${rgb[2]},${rgb[3]}`, { low, high });
  }
  if (map.size === 0) throw new Error("Empty colour table");
  tables.set(file, map);
  return map;
}

// Ask GIBS for a 3 x 3 picture around the point and return the middle pixel (or null if there is no data).
// A single pixel is not requested, because GIBS answers a 1 x 1 picture with nothing.
export async function readPixel(layer, time, lat, lon) {
  const half = 0.02;
  const url =
    `${WMS}?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0&LAYERS=${layer}&STYLES=&CRS=EPSG:4326` +
    `&BBOX=${lat - half},${lon - half},${lat + half},${lon + half}&WIDTH=3&HEIGHT=3` +
    `&FORMAT=image/png&TRANSPARENT=TRUE&TIME=${encodeURIComponent(time)}`;
  const png = PNG.sync.read(await getBytes(url));
  const i = (1 * png.width + 1) * 4; // middle pixel
  if (png.data[i + 3] === 0) return null;
  return `${png.data[i]},${png.data[i + 1]},${png.data[i + 2]}`;
}

// Does this layer have any data at all at this time? (tells "no rain here" apart from "no picture yet")
export async function layerHasData(layer, time) {
  const url =
    `${WMS}?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0&LAYERS=${layer}&STYLES=&CRS=EPSG:4326` +
    `&BBOX=-60,-180,60,180&WIDTH=48&HEIGHT=24&FORMAT=image/png&TRANSPARENT=TRUE&TIME=${encodeURIComponent(time)}`;
  const png = PNG.sync.read(await getBytes(url));
  for (let i = 3; i < png.data.length; i += 4) if (png.data[i] !== 0) return true;
  return false;
}

export function valueOf(range) {
  if (!range) return null;
  const { low, high } = range;
  return { low, high, mid: high == null ? low : Number(((low + high) / 2).toFixed(4)) };
}

export const dayBack = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);