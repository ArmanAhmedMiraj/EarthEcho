// Read ISRIC SoilGrids 2.0 values for one point straight from ISRIC's map files (cloud-optimised GeoTIFFs).
//
// In plain words:
//  1. SoilGrids stores the world as many small square map files in a special projection (Interrupted Goode Homolosine).
//  2. We turn the latitude and longitude into that projection, work out which small file holds the place,
//     and read only a few pixels from it. The web service ISRIC offers for this is slow, so we read the files.
//  3. Built-up land and water are blank in SoilGrids, so we read a small square of pixels and take the middle value
//     of the pixels that do have data (and widen the square once if all of them are blank).
import { fromUrl } from "geotiff";

const ROOT = "https://files.isric.org/soilgrids/latest/data";
const R = 6378137;
const Y_COR = 0.05280353;
const LIMIT = ((40 + 44 / 60 + 11.8 / 3600) * Math.PI) / 180; // where Goode switches from sinusoidal to Mollweide
const DEG = Math.PI / 180;

// The fixed corner of the SoilGrids tile grid, and one top-level tile = 450 km.
const GRID_X = -20037500;
const GRID_Y = 8600750;
const SUPER = 450000;
const NODATA = -32768;

// Each lobe of the interrupted map has its own centre line and its own shift (found by checking against PROJ).
const SHIFT = { "-100": -11131949.0793, 30: 3339584.7238, "-160": -17811118.5265, "-60": -6679169.4476, 20: 2226389.8159, 140: 15584728.7111 };

function lobe(lon, lat) {
  if (lat >= 0) return lon < -40 ? -100 : 30;
  if (lon < -100) return -160;
  if (lon < -20) return -60;
  if (lon < 80) return 20;
  return 140;
}

function mollweide(lam, phi) {
  let t = phi;
  if (Math.abs(Math.abs(phi) - Math.PI / 2) < 1e-10) t = Math.sign(phi) * (Math.PI / 2);
  else {
    const k = Math.PI * Math.sin(phi);
    for (let i = 0; i < 60; i += 1) {
      const d = (2 * t + Math.sin(2 * t) - k) / (2 + 2 * Math.cos(2 * t));
      t -= d;
      if (Math.abs(d) < 1e-13) break;
    }
  }
  return [((2 * Math.SQRT2) / Math.PI) * lam * Math.cos(t), Math.SQRT2 * Math.sin(t)];
}

// latitude and longitude (degrees) -> metres in the SoilGrids projection
export function project(lat, lon) {
  const cm = lobe(lon, lat);
  const lam = (lon - cm) * DEG;
  const phi = lat * DEG;
  let x;
  let y;
  if (Math.abs(phi) <= LIMIT) {
    x = lam * Math.cos(phi);
    y = phi;
  } else {
    [x, y] = mollweide(lam, phi);
    y -= phi >= 0 ? Y_COR : -Y_COR;
  }
  return [x * R + SHIFT[cm], y * R];
}

// Tile file for a point. Properties are cut into 450 or 600 pixel tiles, so the size is a parameter.
export function tileFor(X, Y, size) {
  const side = size * 250; // metres per tile
  const c = Math.floor((X - GRID_X) / SUPER);
  const r = Math.floor((GRID_Y - Y) / SUPER);
  const sc = Math.floor((X - GRID_X - c * SUPER) / side);
  const sr = Math.floor((GRID_Y - Y - r * SUPER) / side);
  const x0 = GRID_X + c * SUPER + sc * side;
  const y0 = GRID_Y - r * SUPER - sr * side;
  const pad = (n) => String(n).padStart(3, "0");
  const name = `tileSG-${pad(r)}-${pad(c)}`;
  return { path: `${name}/${name}_${sr + 1}-${sc + 1}.tif`, px: Math.floor((X - x0) / 250), py: Math.floor((y0 - Y) / 250), size };
}

const TILE_SIZE = { phh2o: 600, bdod: 600 };
const images = new Map(); // open tile files are kept while the server stays warm

async function openTile(prop, layer, X, Y) {
  const sizes = TILE_SIZE[prop] === 600 ? [600, 450] : [450, 600];
  for (const size of sizes) {
    const tile = tileFor(X, Y, size);
    const url = `${ROOT}/${prop}/${prop}_${layer}/${tile.path}`;
    try {
      let image = images.get(url);
      if (!image) {
        let tiff = null;
        for (let attempt = 0; attempt < 3 && !tiff; attempt += 1) {
          try {
            tiff = await fromUrl(url, { allowFullFile: false });
          } catch (error) {
            if (/404|not found/i.test(String(error && error.message))) throw error;
            await new Promise((done) => setTimeout(done, 250 * (attempt + 1)));
          }
        }
        if (!tiff) throw new Error("no file");
        image = await tiff.getImage();
        images.set(url, image);
        if (images.size > 80) images.delete(images.keys().next().value);
      }
      const [tx, ty] = image.getOrigin();
      // the point must really lie inside this file, otherwise the file name guess was wrong
      const px = Math.floor((X - tx) / 250);
      const py = Math.floor((ty - Y) / 250);
      if (px >= 0 && py >= 0 && px < image.getWidth() && py < image.getHeight()) return { image, px, py };
    } catch {
      /* no such file (sea, ice, or the other tile size): try the next size */
    }
  }
  return null;
}

function median(values) {
  const s = values.slice().sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

// at most 6 downloads at the same time, so ISRIC's server is not flooded
let running = 0;
const queue = [];
function limited(job) {
  return new Promise((resolve, reject) => {
    const start = () => {
      running += 1;
      job().then(resolve, reject).finally(() => {
        running -= 1;
        if (queue.length) queue.shift()();
      });
    };
    if (running < 6) start();
    else queue.push(start);
  });
}

// one number (in ISRIC's stored units) or null
export function readValue(prop, layer, X, Y) {
  return limited(() => readOne(prop, layer, X, Y));
}

async function readOne(prop, layer, X, Y) {
  const tile = await openTile(prop, layer, X, Y);
  if (!tile) return null;
  const { image, px, py } = tile;
  for (const half of [2, 8]) {
    const x0 = Math.max(0, px - half);
    const y0 = Math.max(0, py - half);
    const x1 = Math.min(image.getWidth(), px + half + 1);
    const y1 = Math.min(image.getHeight(), py + half + 1);
    let data = null;
    for (let attempt = 0; attempt < 3 && !data; attempt += 1) {
      try {
        data = (await image.readRasters({ window: [x0, y0, x1, y1], samples: [0] }))[0];
      } catch {
        await new Promise((done) => setTimeout(done, 250 * (attempt + 1))); // ISRIC sometimes drops a connection: wait, try again
      }
    }
    if (!data) return null;
    const good = Array.from(data).filter((v) => v !== NODATA && v > -32000);
    if (good.length) return { value: median(good), pixels: good.length, half };
  }
  return null;
}
