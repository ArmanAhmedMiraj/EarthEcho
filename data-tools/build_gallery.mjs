// Builds the photo library for every country and every first-level area (division, state, province, region):
//   public/gallery/<id>.json   id = BD / IND / USA ... for a country, or the area's id (B1, IND-1-5 ...)
// Deeper places (district, upazila, union, ZIP ...) are searched live in the browser with the same code (src/photos.js).
//
// Run:  node data-tools/build_gallery.mjs            (everything; takes a while, it is slow on purpose)
//       node data-tools/build_gallery.mjs BD IND     (only these countries)
// Photos come from Wikimedia Commons. Each file lists the author, licence and Commons page of every photo.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { countryPhotos, photosForPlace } from "../src/photos.js";

const root = new URL("../public/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const out = `${root}gallery/`;
mkdirSync(out, { recursive: true });

const options = {
  delay: 700,
  headers: { "Api-User-Agent": "EarthEchoGalleryBuilder/1.0 (https://github.com/ArmanAhmedMiraj/EarthEcho; student project)" },
};
const read = (p) => JSON.parse(readFileSync(`${root}${p}`, "utf-8"));
const only = process.argv.slice(2);

const countries = [{ iso: "BD", name: "Bangladesh", bbox: [88.0, 20.55, 92.75, 26.7], level1: "admin/divisions.json" }];
for (const c of read("admin/world/manifest.json").countries) {
  countries.push({ iso: c.iso, name: c.name, bbox: c.bbox, level1: `admin/world/${c.iso}/L1.json` });
}

function save(id, name, kind, about, photos) {
  writeFileSync(`${out}${id}.json`, JSON.stringify({ id, name, kind, about, built: new Date().toISOString().slice(0, 10), photos }, null, 1));
  console.log(`  ${id} ${name}: ${photos.length} photos`);
}

for (const c of countries) {
  if (only.length && !only.includes(c.iso)) continue;
  console.log(c.iso, c.name);
  if (!existsSync(`${out}${c.iso}.json`)) save(c.iso, c.name, "country", c.name, await countryPhotos(c.name, options, c.bbox));
  for (const f of read(c.level1).features) {
    const p = f.properties;
    if (existsSync(`${out}${p.id}.json`)) continue; // already built: delete the file to build it again
    const photos = await photosForPlace(
      { name: p.name, parents: [], country: c.name, lat: p.lat, lon: p.lon, level: 0, bbox: p.bbox, countryBbox: c.bbox },
      options
    );
    save(p.id, p.name, "first-level", `${p.name}, ${c.name}`, photos);
  }
}
console.log("done");
