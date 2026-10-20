// Recent local headlines about weather, farming and disasters, from the GDELT DOC API (free, open news index).
// GDELT lists only the title, the link and the publisher; we show those and link to the publisher. No article text is copied.
// Example: /api/news?country=BD
import { cacheFor } from "./_lib/answer.js";

// GDELT uses FIPS country codes
const FIPS = { BD: "BG", IN: "IN", PK: "PK", NP: "NP", MM: "BM", BT: "BT", US: "US" };
// the app also sends three-letter codes
const TWO = { BGD: "BD", IND: "IN", PAK: "PK", NPL: "NP", MMR: "MM", BTN: "BT", USA: "US" };

const QUERY =
  "(weather OR rain OR flood OR cyclone OR drought OR heatwave OR farmers OR crop OR agriculture OR harvest " +
  "OR আবহাওয়া OR বৃষ্টি OR বন্যা OR ঘূর্ণিঝড় OR কৃষি OR কৃষক OR ফসল OR মৌসম OR बारिश OR बाढ़ OR किसान OR फसल OR کسان OR بارش)";

// GDELT matches words anywhere in an article, so keep only headlines that themselves mention the topic
const ENGLISH = [
  "weather", "rain", "flood", "cyclone", "storm", "drought", "heat", "monsoon", "farmer", "crop", "harvest", "agricultur",
  "paddy", "rice", "wheat", "fertili[sz]er", "irrigation", "landslide", "earthquake", "fog", "cold wave", "frost",
];
const LOCAL = [
  "আবহাওয়া", "বৃষ্টি", "বন্যা", "ঘূর্ণিঝড়", "কৃষি", "কৃষক", "ফসল", "ধানের", "ধান চাষ", "ধান কাট", "সারের", "তাপপ্রবাহ", "শৈত্য", "নিম্নচাপ", "ভূমিধস",
  "बारिश", "बाढ़", "किसान", "फसल", "मौसम", "सूखा", "کسان", "بارش", "سیلاب", "موسم",
];
// English words must start a word, so "rain" does not match "training" and "rice" does not match "price"
const TITLE = new RegExp(`\\b(?:${ENGLISH.join("|")})|${LOCAL.join("|")}`, "i");

let last = 0; // GDELT allows one request every 5 seconds

export default async function handler(req, res) {
  const raw = String(req.query.country || "").toUpperCase();
  const country = TWO[raw] || raw;
  const fips = FIPS[country];
  if (!fips) return res.status(200).json({ ok: true, available: false, reason: "country", articles: [] });

  const wait = last + 5200 - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  last = Date.now();

  const url =
    "https://api.gdeltproject.org/api/v2/doc/doc?" +
    new URLSearchParams({ query: `${QUERY} sourcecountry:${fips}`, mode: "ArtList", format: "json", maxrecords: "75", sort: "datedesc", timespan: "3d" });
  try {
    // one try: if GDELT is slow or says "too many requests", the page asks again a few seconds later
    let text = "";
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
      text = response.status === 429 ? "" : await response.text();
    } catch {
      text = "";
    }
    if (!text.trim().startsWith("{")) {
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json({ ok: true, available: false, reason: "busy", articles: [] });
    }
    const data = JSON.parse(text);
    const seen = new Set();
    const articles = [];
    for (const a of data.articles || []) {
      if (!a.title || !a.url || !/^https?:\/\//.test(a.url) || !TITLE.test(a.title)) continue;
      const key = a.title.trim().toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const d = String(a.seendate || "");
      articles.push({
        title: a.title.replace(/\s+([,.!?:;।])/g, "$1").trim(),
        url: a.url,
        domain: a.domain,
        language: a.language,
        date: d.length >= 8 ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}` : null,
      });
      if (articles.length >= 10) break;
    }
    cacheFor(res, 3 * 3600);
    res.status(200).json({
      ok: true,
      available: true,
      articles,
      provenance: {
        name: "GDELT Project, DOC 2.0 API",
        url: "https://www.gdeltproject.org/",
        note: "News headlines found automatically. Each link goes to the publisher. We do not check or endorse the stories.",
      },
    });
  } catch {
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({ ok: true, available: false, reason: "busy", articles: [] });
  }
}
