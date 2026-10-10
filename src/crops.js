// Crop data and rotation ranking for EarthEcho Farm.
// The year is split into 24 half-months: 0 = 1-15 Jan, 1 = 16-31 Jan, 2 = 1-15 Feb ... 23 = 16-31 Dec.
// Planting positions and the ranking come from the published trials listed in SOURCES (see "sources" on each rotation).
// Days in the field marked "typical" are a normal range for the crop and change with variety and weather.

export const SLOTS = 24;
const DAYS_PER_SLOT = 15.2;

export const MONTHS = {
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  bn: ["জানু", "ফেব্রু", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্টে", "অক্টো", "নভে", "ডিসে"],
};

const MONTHS_LONG = {
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  bn: ["জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"],
};

const PART = {
  en: ["early", "mid", "late"],
  bn: ["মাসের শুরুতে", "মাসের মাঝামাঝি", "মাসের শেষে"],
};

// "late Jul" / "জুলাই মাসের শেষে"
export function whenLabel(pos, lang) {
  const p = ((pos % SLOTS) + SLOTS) % SLOTS;
  const month = Math.floor(p / 2);
  const fraction = (p - month * 2) / 2; // 0..1 inside the month
  const part = fraction < 0.33 ? 0 : fraction < 0.66 ? 1 : 2;
  const m = MONTHS_LONG[lang][month];
  return lang === "en" ? `${PART.en[part]} ${m.slice(0, 3)}` : `${m} ${PART.bn[part]}`;
}

// where "today" sits on the 0..24 line
export function nowPosition(date = new Date()) {
  const month = date.getMonth();
  const dim = new Date(date.getFullYear(), month + 1, 0).getDate();
  return month * 2 + ((date.getDate() - 1) / dim) * 2;
}

export const CROPS = {
  boro: {
    name: { en: "Boro rice (dry season)", bn: "বোরো ধান (শুষ্ক মৌসুম)" },
    short: { en: "Boro", bn: "বোরো" },
    days: 115, // typical field time after transplanting
  },
  boroSalt: {
    name: { en: "Early Boro, salt-tolerant variety", bn: "আগাম বোরো (লবণসহনশীল জাত)" },
    short: { en: "Early Boro", bn: "আগাম বোরো" },
    days: 130, // early planting runs longer, BRRI/BAU trials
  },
  taman: {
    name: { en: "T. Aman rice (monsoon)", bn: "রোপা আমন ধান (বর্ষা)" },
    short: { en: "T. Aman", bn: "রোপা আমন" },
    days: 100, // short-duration varieties: 88 to 120 days in trials, BRRI dhan62 about 99
  },
  aus: {
    name: { en: "T. Aus rice (summer)", bn: "রোপা আউশ ধান (গ্রীষ্ম)" },
    short: { en: "T. Aus", bn: "রোপা আউশ" },
    days: 105, // typical
  },
  mustard: {
    name: { en: "Mustard (BARI Sarisha-14 / 15)", bn: "সরিষা (বারি সরিষা-১৪ / ১৫)" },
    short: { en: "Mustard", bn: "সরিষা" },
    days: 85, // typical for these short-duration varieties
  },
  potato: {
    name: { en: "Potato", bn: "আলু" },
    short: { en: "Potato", bn: "আলু" },
    days: 90, // typical
  },
  mungbean: {
    name: { en: "Mungbean (BARI Mung-6)", bn: "মুগডাল (বারি মুগ-৬)" },
    short: { en: "Mungbean", bn: "মুগডাল" },
    days: 55, // field duration of BARI Mung-6, S9
  },
};

// Plain messages used by the ranking (shown as "why it fits" and "watch out").
const MSG = {
  fitIrrigation: {
    en: "You have dry-season water, so Boro rice is possible.",
    bn: "আপনার শুষ্ক মৌসুমে সেচের পানি আছে, তাই বোরো ধান সম্ভব।",
  },
  fitRain: {
    en: "Works mostly on rain, so no dry-season irrigation is needed.",
    bn: "মূলত বৃষ্টির পানিতেই চলে, শুষ্ক মৌসুমে সেচ লাগে না।",
  },
  fitLand: { en: "Suits your land height.", bn: "আপনার জমির উচ্চতার সাথে মানায়।" },
  fitSoil: { en: "Suits your soil type.", bn: "আপনার মাটির ধরনের সাথে মানায়।" },
  fitSalt: {
    en: "Uses salt-tolerant rice planted early, which suits salty fields.",
    bn: "লবণসহনশীল ধান আগাম রোপণ করা হয়, যা লবণাক্ত জমির জন্য উপযোগী।",
  },
  fitMore: {
    en: "Grows more crops on the same land in one year.",
    bn: "একই জমিতে এক বছরে বেশি ফসল হয়।",
  },
  warnIrrigationRequired: {
    en: "Needs dry-season irrigation for Boro. Without water this does not work.",
    bn: "বোরোর জন্য শুষ্ক মৌসুমে সেচ লাগে। পানি ছাড়া এটি চলবে না।",
  },
  warnIrrigationSome: {
    en: "Potato and mungbean need some irrigation. Plan a water source.",
    bn: "আলু ও মুগডালে কিছু সেচ লাগে। পানির উৎস ঠিক করে নিন।",
  },
  warnLand: {
    en: "Water can stay on low land, and this needs drained land.",
    bn: "নিচু জমিতে পানি জমে থাকে, আর এতে নিকাশযুক্ত জমি লাগে।",
  },
  warnSoil: { en: "Your soil type is not ideal for this one.", bn: "আপনার মাটির ধরন এর জন্য আদর্শ নয়।" },
  warnSalt: {
    en: "Salt in soil or water can damage it. In a Satkhira trial, Boro planted after 15 January gave no yield.",
    bn: "মাটি বা পানির লবণে ক্ষতি হতে পারে। সাতক্ষীরার এক পরীক্ষায় ১৫ জানুয়ারির পরে রোপণ করা বোরোতে কোনো ফলন হয়নি।",
  },
  warnNotSalty: {
    en: "Made for salty fields. If yours is not salty, a regular rotation fits better.",
    bn: "লবণাক্ত জমির জন্য তৈরি। আপনার জমি লবণাক্ত না হলে সাধারণ ধারা বেশি মানায়।",
  },
};

const NOTE = {
  idleWinter: {
    en: "The land sits idle for about 2 to 3 months in winter.",
    bn: "শীতে জমি প্রায় ২ থেকে ৩ মাস খালি থাকে।",
  },
  borolate: {
    en: "Boro goes in early February. Sow its seedlings in a nursery before the first crop is cut.",
    bn: "বোরো ফেব্রুয়ারির শুরুতে রোপণ হয়। প্রথম ফসল কাটার আগেই বীজতলায় চারা তৈরি শুরু করুন।",
  },
  labour: {
    en: "Needs the most labour of these options (about 537 man-days per hectare in a BARI trial).",
    bn: "এই বিকল্পগুলোর মধ্যে সবচেয়ে বেশি শ্রম লাগে (বারির এক পরীক্ষায় হেক্টরে প্রায় ৫৩৭ জন-দিন)।",
  },
  tight: {
    en: "Tight timing: every crop must go in on time, and the rice must be a very short-duration variety.",
    bn: "সময় খুব চাপা: প্রতিটি ফসল ঠিক সময়ে লাগাতে হবে, আর ধান হতে হবে খুব স্বল্পমেয়াদি জাতের।",
  },
};

// plant = position on the 0..24 line where the crop goes into the field
export const ROTATIONS = [
  {
    id: "boroFallow",
    name: { en: "Boro – Fallow – T. Aman", bn: "বোরো – পতিত – রোপা আমন" },
    steps: [
      { crop: "boro", plant: 1.0 },
      { crop: "taman", plant: 13.6 },
    ],
    needs: {
      irrigation: "required",
      land: { good: ["low", "medium"], bad: [] },
      soil: { good: ["heavy", "medium"], bad: ["light"] },
      salt: "sensitive",
    },
    notes: [NOTE.idleWinter],
    trial: {
      en: "The most common pattern in Bangladesh. The land often stays fallow for about 3 months before Boro.",
      bn: "বাংলাদেশে সবচেয়ে প্রচলিত ধারা। বোরোর আগে জমি প্রায় ৩ মাস পতিত থাকে।",
    },
    sources: ["S2", "S7"],
  },
  {
    id: "mustardBoro",
    name: { en: "Mustard – Boro – T. Aman", bn: "সরিষা – বোরো – রোপা আমন" },
    steps: [
      { crop: "mustard", plant: 20.5 },
      { crop: "boro", plant: 2.5 },
      { crop: "taman", plant: 13.6 },
    ],
    needs: {
      irrigation: "required",
      land: { good: ["medium", "high"], bad: ["low"] },
      soil: { good: ["medium"], bad: ["light"] },
      salt: "sensitive",
    },
    notes: [NOTE.borolate],
    trial: {
      en: "BARI trials in Tangail and Netrakona found this among the most profitable patterns, using the idle winter months for mustard.",
      bn: "টাঙ্গাইল ও নেত্রকোনায় বারির পরীক্ষায় এটি সবচেয়ে লাভজনক ধারাগুলোর একটি, শীতের খালি সময়ে সরিষা চাষ হয়।",
    },
    sources: ["S6", "S7", "S8"],
  },
  {
    id: "potatoBoro",
    name: { en: "Potato – Boro – T. Aman", bn: "আলু – বোরো – রোপা আমন" },
    steps: [
      { crop: "potato", plant: 20.5 },
      { crop: "boro", plant: 2.5 },
      { crop: "taman", plant: 13.6 },
    ],
    needs: {
      irrigation: "required",
      land: { good: ["high", "medium"], bad: ["low"] },
      soil: { good: ["medium", "light"], bad: ["heavy"] },
      salt: "sensitive",
    },
    notes: [NOTE.borolate, NOTE.labour],
    trial: {
      en: "In BARI Tangail trials it gave the highest rice-equivalent yield of the patterns tested.",
      bn: "টাঙ্গাইলে বারির পরীক্ষায় পরীক্ষিত ধারাগুলোর মধ্যে এতে ধানের সমতুল্য ফলন সবচেয়ে বেশি হয়েছে।",
    },
    sources: ["S7", "S9"],
  },
  {
    id: "fourCrop",
    name: { en: "T. Aman – Potato – Mungbean – T. Aus", bn: "রোপা আমন – আলু – মুগডাল – রোপা আউশ" },
    steps: [
      { crop: "taman", plant: 14.5 },
      { crop: "potato", plant: 21.5 },
      { crop: "mungbean", plant: 3.5 },
      { crop: "aus", plant: 7.5 },
    ],
    needs: {
      irrigation: "some",
      land: { good: ["high", "medium"], bad: ["low"] },
      soil: { good: ["medium", "light"], bad: ["heavy"] },
      salt: "sensitive",
    },
    notes: [NOTE.tight],
    trial: {
      en: "A BRRI trial at Rangpur found this four-crop pattern the most suitable and profitable on medium-high land in the Rangpur region.",
      bn: "রংপুরে ব্রির এক পরীক্ষায় এই চার ফসলের ধারা রংপুর অঞ্চলের মাঝারি উঁচু জমিতে সবচেয়ে উপযোগী ও লাভজনক হয়েছে।",
    },
    sources: ["S9", "S10"],
  },
  {
    id: "mustardMung",
    name: { en: "T. Aman – Mustard – Mungbean", bn: "রোপা আমন – সরিষা – মুগডাল" },
    steps: [
      { crop: "taman", plant: 13.6 },
      { crop: "mustard", plant: 20.5 },
      { crop: "mungbean", plant: 3.0 },
    ],
    needs: {
      irrigation: "none",
      land: { good: ["medium", "high"], bad: ["low"] },
      soil: { good: ["medium"], bad: [] },
      salt: "medium",
    },
    notes: [],
    trial: {
      en: "In a BARI trial at Rajshahi, a pattern with mustard and mungbean after Aman had the highest benefit-cost ratio (2.24).",
      bn: "রাজশাহীতে বারির এক পরীক্ষায় আমনের পর সরিষা ও মুগডালের ধারায় লাভ-খরচের অনুপাত সবচেয়ে বেশি (২.২৪) হয়েছে।",
    },
    sources: ["S6", "S9", "S11"],
  },
  {
    id: "saltBoro",
    name: { en: "Early salt-tolerant Boro – T. Aman", bn: "আগাম লবণসহনশীল বোরো – রোপা আমন" },
    steps: [
      { crop: "boroSalt", plant: 22.9 },
      { crop: "taman", plant: 13.6 },
    ],
    needs: {
      irrigation: "required",
      land: { good: ["low", "medium"], bad: [] },
      soil: { good: ["heavy"], bad: [] },
      salt: "tolerant",
      saltOnly: true,
    },
    notes: [],
    trial: {
      en: "In a Satkhira trial, BRRI dhan67 transplanted on 15 December gave 5.58 t/ha. Boro planted after 15 January gave no yield there because of salt.",
      bn: "সাতক্ষীরার এক পরীক্ষায় ১৫ ডিসেম্বর রোপণ করা ব্রি ধান৬৭ থেকে হেক্টরে ৫.৫৮ টন ফলন হয়েছে। লবণের কারণে ১৫ জানুয়ারির পরে রোপণ করা বোরোতে কোনো ফলন হয়নি।",
    },
    sources: ["S4"],
  },
];

export const SOURCES = [
  { id: "S1", by: "FAO", title: "Rice in Bangladesh: three seasons, Aus, Aman and Boro", url: "https://www.fao.org/4/y4347e/y4347e08.htm" },
  { id: "S2", by: "FEWS NET", title: "Bangladesh Data Book: seasons and crop definitions", url: "https://devhelp.fews.net/fde/v1/bangladesh-data-book" },
  { id: "S3", by: "BRRI", title: "Grain yield and water productivity of irrigated rice by transplanting date", url: "https://www.banglajol.info/index.php/BRJ/article/view/62704" },
  { id: "S4", by: "Bangladesh Agronomy Journal, 2024", title: "Transplanting date of salt-tolerant Boro varieties in Satkhira", url: "https://banglajol.info/index.php/BAJ/article/view/84549" },
  { id: "S5", by: "Rajshahi Univ., 2022", title: "Variety and transplanting date of short-duration T. Aman rice", url: "https://csa.ru.ac.bd/bjals/Volume3(2022)/v0302202210.pdf" },
  { id: "S6", by: "Bazzaz et al., 2020", title: "Sowing dates of BARI Sarisha-14 and 15 after T. Aman", url: "https://pakbs.org/pjbot/paper_details.php?id=8372" },
  { id: "S7", by: "BARI Tangail", title: "Rice-based cropping patterns in Tangail", url: "https://banglajol.info/index.php/BJAR/article/view/91447" },
  { id: "S8", by: "BARI", title: "Mustard in the T. Aman – Fallow – Boro pattern", url: "https://banglajol.info/index.php/BJAR/article/view/91535/58788" },
  { id: "S9", by: "BARI / BRRI Rangpur", title: "Potato-based patterns with short-duration mungbean and T. Aman", url: "https://ageconsearch.umn.edu/record/305366/files/22645-Article%20Text-81300-1-10-20150320.pdf" },
  { id: "S10", by: "BRRI Rangpur", title: "Four-crop pattern with potato in Rangpur", url: "https://discovery.researcher.life/topic/2nd-crop/8593154?page=3" },
  { id: "S11", by: "BARI Rajshahi", title: "Four-crop pattern studies in the Rajshahi region", url: "https://banglajol.info/index.php/BAJ/article/view/24652" },
];

// ---- field inputs ----

// light = sandy, medium = loam types, heavy = clay types. Works with any spelling of the soil key.
export function soilClass(key) {
  const s = String(key || "").toLowerCase().replace(/[^a-z]/g, "");
  if (!s) return "unknown";
  if (s.includes("sand") && !s.includes("clay")) return "light";
  if (s.includes("clay") && !s.includes("sand")) return "heavy";
  return "medium";
}

// Districts of the coastal belt where salt in soil or water is common (approximate; the farmer can override).
const COASTAL = [
  "satkhira", "khulna", "bagerhat", "barguna", "patuakhali", "bhola", "pirojpur",
  "jhalokati", "jhalakati", "jhalokathi", "jhalakathi", "noakhali", "laxmipur", "lakshmipur",
  "chattogram", "chittagong", "cox", "feni",
];

export function isCoastalDistrict(name) {
  const s = String(name || "").toLowerCase().replace(/[^a-z]/g, "");
  return !!s && COASTAL.some((c) => s.includes(c));
}

// ---- ranking: simple rules, not an AI model ----
// ctx = { land: "high"|"medium"|"low", irrigation: boolean, salt: boolean, soil: "light"|"medium"|"heavy"|"unknown" }
export function rankRotations(ctx) {
  const list = ROTATIONS.map((rotation, order) => {
    let score = 50;
    const fits = [];
    const warns = [];
    const n = rotation.needs;

    if (n.irrigation === "required") {
      if (ctx.irrigation) {
        score += 10;
        fits.push(MSG.fitIrrigation);
      } else {
        score -= 60;
        warns.push(MSG.warnIrrigationRequired);
      }
    } else if (n.irrigation === "some") {
      if (!ctx.irrigation) {
        score -= 20;
        warns.push(MSG.warnIrrigationSome);
      }
    } else if (!ctx.irrigation) {
      score += 15;
      fits.push(MSG.fitRain);
    }

    if (n.land.good.includes(ctx.land)) {
      score += 15;
      fits.push(MSG.fitLand);
    }
    if (n.land.bad.includes(ctx.land)) {
      score -= 35;
      warns.push(MSG.warnLand);
    }

    if (ctx.soil !== "unknown") {
      if (n.soil.good.includes(ctx.soil)) {
        score += 12;
        fits.push(MSG.fitSoil);
      }
      if (n.soil.bad.includes(ctx.soil)) {
        score -= 15;
        warns.push(MSG.warnSoil);
      }
    }

    if (ctx.salt) {
      if (n.salt === "tolerant") {
        score += 35;
        fits.push(MSG.fitSalt);
      } else if (n.salt === "sensitive") {
        score -= 35;
        warns.push(MSG.warnSalt);
      } else {
        score -= 12;
        warns.push(MSG.warnSalt);
      }
    } else if (n.saltOnly) {
      score -= 30;
      warns.push(MSG.warnNotSalty);
    }

    const extra = rotation.steps.length - 2;
    if (extra > 0 && score >= 50) {
      score += 4 * extra;
      fits.push(MSG.fitMore);
    }

    return { rotation, score, fits, warns: [...warns, ...rotation.notes], order };
  });
  return list.sort((a, b) => b.score - a.score || a.order - b.order);
}

// ---- timeline ----

const endOf = (s) => s.plant + CROPS[s.crop].days / DAYS_PER_SLOT;

// Pieces to draw on a 0..24 line: crop bars and fallow gaps. A bar that crosses 31 Dec is split in two.
export function segmentsOf(rotation) {
  const items = [...rotation.steps].sort((a, b) => a.plant - b.plant);
  const out = [];
  const add = (kind, crop, a, b) => {
    if (b <= a) return;
    if (b > SLOTS) {
      out.push({ kind, crop, a, b: SLOTS, cutRight: true });
      out.push({ kind, crop, a: 0, b: b - SLOTS, cutLeft: true });
    } else {
      out.push({ kind, crop, a, b });
    }
  };
  items.forEach((s, i) => {
    add("crop", s.crop, s.plant, endOf(s));
    let from = endOf(s);
    let to = i === items.length - 1 ? items[0].plant + SLOTS : items[i + 1].plant;
    if (from >= SLOTS) {
      from -= SLOTS;
      to -= SLOTS;
    }
    const gap = to - from;
    if (gap >= 1) add("fallow", null, from, to); // idle land, half a month or more
    else if (gap > 0.1) add("turnaround", null, from, to); // short break for harvest and land preparation
  });
  return out;
}

// Why the best choice is weak: names the answers that cause it. Empty list means nothing special.
export function poorReasons(ctx) {
  const out = [];
  if (!ctx.irrigation) {
    out.push({
      en: "No dry-season water: Boro rice and potato need irrigation, so they are ruled out.",
      bn: "শুষ্ক মৌসুমে পানি নেই: বোরো ধান ও আলুতে সেচ লাগে, তাই এগুলো বাদ গেছে।",
    });
  }
  if (ctx.land === "low") {
    out.push({
      en: "Low land: water stays in the monsoon, and most of these rotations need drained land for their winter crops.",
      bn: "নিচু জমি: বর্ষায় পানি জমে থাকে, আর এই ধারাগুলোর শীতকালীন ফসলে নিকাশযুক্ত জমি লাগে।",
    });
  }
  if (ctx.salt) {
    out.push({
      en: "Salt: only the early salt-tolerant Boro suits salty fields, and it needs irrigation water.",
      bn: "লবণ: লবণাক্ত জমিতে শুধু আগাম লবণসহনশীল বোরো মানায়, আর তাতে সেচের পানি লাগে।",
    });
  }
  return out;
}

// Crops of the same rotation that overlap in the field (should always be empty).
export function overlaps(rotation) {
  const items = [...rotation.steps].sort((a, b) => a.plant - b.plant);
  const bad = [];
  items.forEach((s, i) => {
    const next = i === items.length - 1 ? items[0].plant + SLOTS : items[i + 1].plant;
    if (endOf(s) > next + 0.05) bad.push(`${s.crop} -> next`);
  });
  return bad;
}

// The next crop to plant, counted from "now". status "now" means its planting half-month is running.
export function nextStep(rotation, now) {
  let best = null;
  for (const step of rotation.steps) {
    let d = step.plant - now;
    if (d < -0.5) d += SLOTS;
    if (!best || d < best.d) best = { d, step };
  }
  return { step: best.step, status: best.d <= 0.5 ? "now" : "soon" };
}