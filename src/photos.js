// Real photographs of a place, from Wikimedia Commons (free licences only, never generated pictures).
//
// For a chosen place the search goes from the most exact to the widest:
//   "place"   the Commons category of that very place (or files named after it)
//   "nearby"  photographs whose GPS tag is within a few kilometres of the point
//   "region"  the same search for the area above (district, then state/division, then the country)
// Every photo says which of these it is, so a village is never shown with a picture of another place
// without saying so. Each photo carries its author, licence and a link to its Commons page.
//
// This file has no browser-only code, so data-tools/build_gallery.mjs uses it too.

const API = "https://commons.wikimedia.org/w/api.php";
const WANT = 6; // stop searching wider once this many photos are found
const MAX = 8; // never keep more than this many

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// one API call; waits and tries again when Wikimedia says "too many requests"
async function api(params, options = {}) {
  const url = new URL(API);
  const all = { action: "query", format: "json", formatversion: "2", origin: "*", ...params };
  for (const [k, v] of Object.entries(all)) url.searchParams.set(k, v);
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const response = await (options.fetch || fetch)(url, { signal: options.signal, headers: options.headers });
      const text = await response.text();
      if (options.delay) await sleep(options.delay); // the build script goes slowly, to be kind to Wikimedia
      if (response.status === 429 || text.startsWith("You are making too many")) {
        await sleep(1500 * (attempt + 1));
        continue;
      }
      return JSON.parse(text);
    } catch (error) {
      if (options.signal && options.signal.aborted) throw error;
      await sleep(600);
    }
  }
  return null;
}

const FILE_PARAMS = {
  prop: "imageinfo",
  iiprop: "url|size|mime|extmetadata",
  iiurlwidth: "1000",
  iiextmetadatafilter: "ImageDescription|Artist|LicenseShortName|LicenseUrl|GPSLatitude|GPSLongitude",
};

const stripHtml = (s) =>
  String(s || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const BAD_TITLE = /\b(map|flag|logo|seal|coat of arms|emblem|diagram|chart|locator|location|signature|stamp|banner|poster|screenshot|scan|portrait|cover|infographic|census|election|statistic|graph|workshop|meeting|conference|training|ceremony|wikipedia|wikimedia|edit-a-thon|participants|photowalk|certificate|invitation|restaurant|popeyes|mcdonald|kfc|chicken|pizza|burger|hotel|atm|billboard|advertis)\b/i;
const OK_LICENCE = /^(CC[ -]BY(?![ -]NC)|CC[ -]BY[ -]SA|CC0|Public domain|PD|Attribution|GFDL-with|Copyrighted free use)/i;
const BAD_LICENCE = /(NC|ND|fair use|non-?free)/i;

// Pictures taken from space (astronaut and satellite photos carry a GPS tag too) are not photos of a place on the ground.
const SPACE = /(earth science and remote sensing|johnson space center|\bNASA\b|astronaut|\bISS\d|expedition \d|international space station|night ?lights|from space|\bSTS-?\d)/i;
export const usable = (photo) => !SPACE.test(`${photo.author} ${photo.title} ${photo.caption}`);

// Turns one API page into a photo record, or null when it is not a good photo for this use.
function toPhoto(page, match, about, bounds) {
  const info = page.imageinfo && page.imageinfo[0];
  if (!info || info.mime !== "image/jpeg") return null;
  const title = String(page.title || "").replace(/^File:/, "").replace(/\.\w+$/, "").replace(/_/g, " ");
  if (BAD_TITLE.test(title)) return null;
  const meta = info.extmetadata || {};
  const licence = stripHtml(meta.LicenseShortName && meta.LicenseShortName.value);
  if (!licence || !OK_LICENCE.test(licence) || BAD_LICENCE.test(licence.replace(/CC BY-SA/i, ""))) return null;
  // a photo that has a GPS tag far outside the place is somewhere else (categories sometimes hold such strays)
  const lat = Number(meta.GPSLatitude && meta.GPSLatitude.value);
  const lon = Number(meta.GPSLongitude && meta.GPSLongitude.value);
  if (bounds && Number.isFinite(lat) && Number.isFinite(lon) && lat !== 0 && lon !== 0) {
    if (lon < bounds[0] || lon > bounds[2] || lat < bounds[1] || lat > bounds[3]) return null;
  }
  const ratio = info.width / info.height;
  if (info.width < 900 || info.height < 500 || ratio < 1.2 || ratio > 2.4) return null; // a wide, big photo suits the frame
  const description = stripHtml(meta.ImageDescription && meta.ImageDescription.value);
  const author = stripHtml(meta.Artist && meta.Artist.value) || "Unknown author";
  const photo = {
    title,
    caption: (description && description.length > 8 ? description : title).slice(0, 150),
    image: info.thumburl || info.url,
    full: info.url,
    page: info.descriptionurl || `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title)}`,
    author: author.slice(0, 80),
    licence,
    licenceUrl: (meta.LicenseUrl && meta.LicenseUrl.value) || "",
    source: "Wikimedia Commons",
    match, // "place" | "nearby" | "region"
    about, // the place this photo is really about
  };
  return usable(photo) ? photo : null;
}

function photosFromData(data, match, about, bounds) {
  const pages = (data && data.query && data.query.pages) || [];
  return pages
    .slice()
    .sort((a, b) => (a.index || 0) - (b.index || 0))
    .map((p) => toPhoto(p, match, about, bounds))
    .filter(Boolean);
}

// at most two photos by the same author, and no photo twice
function mix(list) {
  const seen = new Set();
  const byAuthor = new Map();
  const out = [];
  for (const p of list) {
    if (seen.has(p.title)) continue;
    const n = byAuthor.get(p.author) || 0;
    if (n >= 2 && p.author !== "Unknown author") continue;
    seen.add(p.title);
    byAuthor.set(p.author, n + 1);
    out.push(p);
  }
  return out;
}

const VAGUE = /(^\d+$|\bward\b|paurashava|pourashava|\(part\)|^unnamed|^union$|^sadar$|^town$|^city corporation)/i;
export const isVague = (name) => VAGUE.test(name.trim());

const TYPE_WORDS = /(division|district|upazila|thana|state|county|province|region|township|dzongkhag|gewog|tehsil|tahsil|taluk|block|municipality|city|town)/i;
const THE = { "United States": "the United States" };

// the Commons category of a place, found by name (Commons names them in many ways, so the best match is chosen)
const fold = (text) => text.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");

async function findCategory(name, hints, options) {
  const found = await findCategoryExact(name, hints, options);
  // spelled with accents in our boundary data, often without them on Commons ("Tamil Nādu" / "Tamil Nadu")
  return found || (fold(name) !== name ? findCategoryExact(fold(name), hints, options) : null);
}

async function findCategoryExact(name, hints, options) {
  const data = await api(
    { list: "search", srsearch: `intitle:"${name}"`, srnamespace: "14", srlimit: "12" },
    options
  );
  const hits = (data && data.query && data.query.search) || [];
  let best = null;
  let bestScore = 0;
  for (const h of hits) {
    const title = h.title.replace(/^Category:/, "");
    if (!new RegExp(`(^|[^\\p{L}])${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^\\p{L}]|$)`, "iu").test(title)) continue;
    if (/(by year|by month|by date|history|people|births|deaths|politic|election|disambig|schools|buildings of|companies|sport|football|railway|airport|road|route|highway|interstate|freeway|parkway|street|avenue|toll|exit|bus |transit|metro|station|\bSR\b|\bUS \d|\bFL\b|\bNH \d)/i.test(title)) continue;
    let score = 1;
    if (title.toLowerCase() === name.toLowerCase()) score += 3; // the category named exactly like the place
    if (hints.some((x) => x && title.toLowerCase().includes(x.toLowerCase()))) score += 2;
    if (TYPE_WORDS.test(title)) score += 1;
    if (title.length <= name.length + 28) score += 1; // "Kafrul Thana" beats "Kafrul Thana in the 1970s"
    if (score > bestScore) {
      best = title;
      bestScore = score;
    }
  }
  return bestScore >= 3 ? best : null; // a category that only shares the name is not enough
}

async function categoryPhotos(category, about, options, limit = 24) {
  const bounds = options.bounds;
  const data = await api(
    { generator: "search", gsrsearch: `deepcat:"${category}" filetype:bitmap`, gsrnamespace: "6", gsrlimit: String(limit), ...FILE_PARAMS },
    options
  );
  return photosFromData(data, "place", about, bounds);
}

async function nearbyPhotos(lat, lon, radius, about, options) {
  const data = await api(
    {
      generator: "geosearch",
      ggscoord: `${lat}|${lon}`,
      ggsradius: String(radius),
      ggsnamespace: "6",
      ggslimit: "30",
      ...FILE_PARAMS,
    },
    options
  );
  return photosFromData(data, "nearby", `${about} (within ${Math.round(radius / 1000)} km)`, options.bounds);
}

// the landscape, farming and river categories of a place (they exist for countries, states and many districts)
async function themePhotos(name, about, options) {
  const out = [];
  for (const theme of [`Landscapes of ${name}`, `Agriculture in ${name}`, `Rivers of ${name}`]) {
    const got = mix(await categoryPhotos(theme, about, options, 12)).slice(0, 3);
    out.push(...got);
  }
  return out;
}

// photographs named after the place, when it has no category of its own
async function namedPhotos(name, country, about, options) {
  const data = await api(
    { generator: "search", gsrsearch: `"${name}" ${country} filetype:bitmap`, gsrnamespace: "6", gsrlimit: "20", ...FILE_PARAMS },
    options
  );
  const lower = name.toLowerCase();
  return photosFromData(data, "place", about, options.bounds).filter((p) => (p.title + " " + p.caption).toLowerCase().includes(lower));
}

const pad = (b, d) => (b ? [b[0] - d, b[1] - d, b[2] + d, b[3] + d] : null);

// A country: a few photos from each of its landscape, farming and river categories, so the set is varied.
export async function countryPhotos(countryName, options = {}, countryBbox = null) {
  options = { ...options, bounds: pad(countryBbox, 0.5) };
  const c = THE[countryName] || countryName;
  const themes = [`Landscapes of ${c}`, `Agriculture in ${c}`, `Rivers of ${c}`, `Villages of ${c}`, `Mountains of ${c}`, `Farmland in ${c}`];
  const out = [];
  for (const theme of themes) {
    const got = await categoryPhotos(theme, countryName, options, 14);
    out.push(...mix(got).slice(0, 3));
    if (mix(out).length >= MAX + 2) break;
  }
  return mix(out).slice(0, MAX);
}

// One place (not a country): its own photos first, then the areas above it.
// target = { name, parents: [names from the level above up to the first level], country, lat, lon, level }
export async function photosForPlace(target, options = {}) {
  const { name, parents = [], country, lat, lon, level, bbox, countryBbox } = target;
  const ownOptions = { ...options, bounds: pad(bbox, level >= 2 ? 0.3 : 0.6) };
  const wideOptions = { ...options, bounds: pad(countryBbox, 0.5) };
  const collected = [];
  const add = (list) => {
    collected.push(...list);
    return mix(collected).length >= WANT;
  };

  const own = async () => {
    if (!isVague(name) && level <= 1) {
      const themed = [...(await themePhotos(name, name, ownOptions)), ...(fold(name) !== name ? await themePhotos(fold(name), name, ownOptions) : [])];
      if (add(themed)) return true;
    }
    if (!isVague(name)) {
      const category = await findCategory(name, [...parents, country], ownOptions);
      if (category && add(await categoryPhotos(category, name, ownOptions))) return true;
      if (!category && add(await namedPhotos(name, country, name, ownOptions))) return true;
    }
    if (level >= 1 && lat != null && lon != null) {
      if (add(await nearbyPhotos(lat, lon, level >= 2 ? 6000 : 10000, isVague(name) ? parents[0] || country : name, ownOptions))) return true;
    }
    return false;
  };
  if (await own()) return mix(collected).slice(0, MAX);

  // not enough: the areas above, nearest first
  for (let i = 0; i < parents.length; i += 1) {
    const region = parents[i];
    if (isVague(region)) continue;
    {
      const themed = (await themePhotos(fold(region), region, wideOptions)).map((p) => ({ ...p, match: "region" }));
      if (add(themed)) break;
    }
    const category = await findCategory(region, [...parents.slice(i + 1), country], options);
    if (category) {
      const got = (await categoryPhotos(category, region, wideOptions)).map((p) => ({ ...p, match: "region" }));
      if (add(got)) break;
    }
  }
  if (mix(collected).length < WANT) {
    const nation = (await countryPhotos(country, options, countryBbox)).map((p) => ({ ...p, match: "region" }));
    add(nation);
  }
  return mix(collected).slice(0, MAX);
}
