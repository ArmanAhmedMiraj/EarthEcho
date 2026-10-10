// Crop data, named varieties (jaat) and rotation ranking for EarthEcho Farm.
// The year is split into 24 half-months: 0 = 1-15 Jan, 1 = 16-31 Jan, 2 = 1-15 Feb ... 23 = 16-31 Dec.
// Planting positions, variety facts and the ranking come from the published sources listed in SOURCES.
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
    days: 105, // BRRI dhan48 100 to 105 days (S20)
  },
  mustard: {
    name: { en: "Mustard", bn: "সরিষা" },
    short: { en: "Mustard", bn: "সরিষা" },
    days: 80, // BARI Sarisha-14, 15, 17 mature in 75 to 80 days (S19)
  },
  potato: {
    name: { en: "Potato", bn: "আলু" },
    short: { en: "Potato", bn: "আলু" },
    days: 90, // 85 to 95 days in a Bangladesh variety trial (S22)
  },
  mungbean: {
    name: { en: "Mungbean", bn: "মুগডাল" },
    short: { en: "Mungbean", bn: "মুগডাল" },
    days: 55, // field duration of BARI Mung-6, S9
  },
};

// ---- varieties (jaat) ----
// d = days in the field (a number or [low, high]); dSalt = days in a salty field; y = a yield number used only to rank;
// ySalt = the same in a salty field; pref = order inside one trial; thin = little data in my sources; long = very long duration.
// tags: salt, flood, drought, cold (strong), coldmod (moderate), early, highyield, blast.
// photo: put a file in public/varieties/ and write its path here to show a real photo instead of the drawing.
const V = (id, en, bn, o) => ({ id, name: { en, bn }, tags: [], src: [], photo: null, ...o });

export const VARIETIES = {
  boro: [
    V("b113", "BRRI dhan113", "ব্রি ধান১১৩", {
      d: 143, y: 8.15, tags: ["highyield"],
      yText: { en: "Average 8.15 t/ha, up to 10.1 t/ha in ideal conditions.", bn: "গড়ে হেক্টরে ৮.১৫ টন, আদর্শ অবস্থায় ১০.১ টন পর্যন্ত।" },
      note: { en: "Strong stem, so it does not fall over easily.", bn: "কাণ্ড শক্ত, তাই সহজে হেলে পড়ে না।" },
      src: ["S14"],
    }),
    V("b114", "BRRI dhan114", "ব্রি ধান১১৪", {
      d: 149, y: 7.76, tags: ["highyield", "blast"],
      yText: { en: "Average 7.76 t/ha, up to 10.23 t/ha with good care.", bn: "গড়ে হেক্টরে ৭.৭৬ টন, ভালো যত্নে ১০.২৩ টন পর্যন্ত।" },
      note: { en: "Resists blast disease. Stays longest in the field, so plan the next crop later.", bn: "ব্লাস্ট রোগ প্রতিরোধ করে। মাঠে সবচেয়ে বেশি দিন থাকে, তাই পরের ফসল দেরিতে ধরুন।" },
      src: ["S14"],
    }),
    V("b28", "BRRI dhan28", "ব্রি ধান২৮", {
      d: 140,
      yText: null,
      note: { en: "About 140 days. Hot weather at flowering can cause empty grains.", bn: "প্রায় ১৪০ দিন। ফুল আসার সময় গরমে চিটা হতে পারে।" },
      src: ["S12", "S18"],
    }),
    V("b29", "BRRI dhan29", "ব্রি ধান২৯", {
      d: null, tags: ["highyield", "long"], thin: true,
      yText: null,
      note: { en: "BRRI lists it as a long-duration, highest-yielding variety. The number of days is not in my sources, so check the date with your DAE officer.", bn: "ব্রি একে দীর্ঘমেয়াদি ও সর্বোচ্চ ফলনশীল জাত বলে। কত দিন লাগে তা আমার তথ্যসূত্রে নেই, তাই তারিখ ডিএই কর্মকর্তার সাথে মিলিয়ে নিন।" },
      src: ["S12"],
    }),
    V("b36", "BRRI dhan36", "ব্রি ধান৩৬", {
      d: null, tags: ["cold", "early"], thin: true,
      yText: null,
      note: { en: "Short duration. Seedlings tolerate cold, so it suits cold winters in the north and in haor areas.", bn: "স্বল্পমেয়াদি। চারা ঠান্ডা সহ্য করে, তাই উত্তরাঞ্চল ও হাওরের শীতে মানায়।" },
      src: ["S12", "S18"],
    }),
    V("b67", "BRRI dhan67", "ব্রি ধান৬৭", {
      d: [145, 152], dSalt: [138, 144], y: 6.62, ySalt: 4.47, tags: ["salt", "coldmod"],
      yText: {
        en: "Salty field (4 to 12 dS/m): 3.0 to 6.09 t/ha, average 4.47. Field without salt: average 6.62 t/ha.",
        bn: "লবণাক্ত জমিতে (৪ থেকে ১২ ডিএস/মি): হেক্টরে ৩.০ থেকে ৬.০৯ টন, গড় ৪.৪৭। লবণ ছাড়া জমিতে গড় ৬.৬২ টন।",
      },
      note: { en: "81 of 100 seedlings survive at 12 dS/m salt. Has moderate cold tolerance at flowering.", bn: "১২ ডিএস/মি লবণে ১০০টির ৮১টি চারা বেঁচে থাকে। ফুল আসার সময় মাঝারি ঠান্ডা সহ্য করে।" },
      src: ["S13", "S18"],
    }),
    V("b97", "BRRI dhan97 / 99", "ব্রি ধান৯৭ / ৯৯", {
      d: null, y: 7.1, ySalt: 5.2, tags: ["salt"], thin: true,
      yText: { en: "Salty field: 3.93 to 6.56 t/ha. Field without salt: 7.10 t/ha.", bn: "লবণাক্ত জমিতে হেক্টরে ৩.৯৩ থেকে ৬.৫৬ টন। লবণ ছাড়া জমিতে ৭.১০ টন।" },
      note: { en: "Salt-tolerant Boro. The number of days is not in my sources.", bn: "লবণসহনশীল বোরো। কত দিন লাগে তা আমার তথ্যসূত্রে নেই।" },
      src: ["S18"],
    }),
    V("b47", "BRRI dhan47", "ব্রি ধান৪৭", {
      d: null, tags: ["salt"], thin: true,
      yText: null,
      note: { en: "An older salt-tolerant Boro for the coastal belt. No yield figure in my sources.", bn: "উপকূলীয় এলাকার জন্য পুরোনো লবণসহনশীল বোরো। ফলনের সংখ্যা আমার তথ্যসূত্রে নেই।" },
      src: ["S12", "S18"],
    }),
    V("b55", "BRRI dhan55", "ব্রি ধান৫৫", {
      d: null, tags: ["salt", "drought", "cold"], thin: true,
      yText: null,
      note: { en: "BRRI lists it as tolerant to cold, drought and salt, for Boro and Aus. No figures in my sources.", bn: "ব্রি একে ঠান্ডা, খরা ও লবণসহনশীল বলে, বোরো ও আউশ দুই মৌসুমের জন্য। সংখ্যা আমার তথ্যসূত্রে নেই।" },
      src: ["S12"],
    }),
  ],
  taman: [
    V("t62", "BRRI dhan62", "ব্রি ধান৬২", {
      d: 99, tags: ["early"],
      yText: null,
      note: { en: "Short duration (about 99 days in a trial), so the next crop can go in on time. Has moderate heat tolerance at flowering.", bn: "স্বল্পমেয়াদি (এক পরীক্ষায় প্রায় ৯৯ দিন), তাই পরের ফসল সময়মতো লাগানো যায়। ফুল আসার সময় মাঝারি গরম সহ্য করে।" },
      src: ["S5", "S18"],
    }),
    V("t56", "BRRI dhan56 / 57", "ব্রি ধান৫৬ / ৫৭", {
      d: null, y: 4.25, tags: ["early", "drought"],
      yText: { en: "About 4.0 to 4.5 t/ha in drought-prone regions.", bn: "খরাপ্রবণ এলাকায় হেক্টরে প্রায় ৪.০ থেকে ৪.৫ টন।" },
      note: { en: "Short duration and drought tolerant. The exact days are not in my sources.", bn: "স্বল্পমেয়াদি ও খরাসহনশীল। সঠিক দিন আমার তথ্যসূত্রে নেই।" },
      src: ["S12", "S18"],
    }),
    V("t71", "BRRI dhan71", "ব্রি ধান৭১", {
      d: 115, y: 5.5, tags: ["drought"],
      yText: { en: "5.5 t/ha normally, 4.0 in medium drought, 3.0 to 3.5 in severe drought.", bn: "স্বাভাবিক অবস্থায় হেক্টরে ৫.৫ টন, মাঝারি খরায় ৪.০, তীব্র খরায় ৩.০ থেকে ৩.৫ টন।" },
      note: { en: "Handles a dry spell of up to 28 days at flowering.", bn: "ফুল আসার সময় ২৮ দিন পর্যন্ত খরা সহ্য করে।" },
      src: ["S16"],
    }),
    V("t49", "BRRI dhan49", "ব্রি ধান৪৯", {
      d: null, thin: true,
      yText: null,
      note: { en: "A non-photosensitive T. Aman, so planting date is flexible. No days or yield in my sources.", bn: "আলোকসংবেদনশীল নয় এমন রোপা আমন, তাই রোপণের সময় নমনীয়। দিন ও ফলনের সংখ্যা আমার তথ্যসূত্রে নেই।" },
      src: ["S12"],
    }),
    V("t79", "BRRI dhan79", "ব্রি ধান৭৯", {
      d: 140, y: 5.5, tags: ["flood"],
      yText: { en: "5.5 t/ha with no flood. 4.0 to 4.5 t/ha after 3 weeks fully under water.", bn: "বন্যা না হলে হেক্টরে ৫.৫ টন। ৩ সপ্তাহ পুরো ডুবে থাকলে ৪.০ থেকে ৪.৫ টন।" },
      note: { en: "Survives up to 3 weeks fully under water as a young plant. If it floods that long, it takes about 160 days.", bn: "চারা অবস্থায় ৩ সপ্তাহ পর্যন্ত পুরো ডুবে থাকলেও বাঁচে। এত দিন বন্যা হলে প্রায় ১৬০ দিন লাগে।" },
      src: ["S17"],
    }),
    V("t51", "BRRI dhan51", "ব্রি ধান৫১", {
      d: null, y: 4.25, tags: ["flood"],
      yText: { en: "About 4.0 to 4.5 t/ha.", bn: "হেক্টরে প্রায় ৪.০ থেকে ৪.৫ টন।" },
      note: { en: "Survives 10 to 16 days under water. The exact days in the field are not in my sources.", bn: "১০ থেকে ১৬ দিন পানির নিচে থাকলেও বাঁচে। মাঠে কত দিন লাগে তা আমার তথ্যসূত্রে নেই।" },
      src: ["S15"],
    }),
    V("t52", "BRRI dhan52", "ব্রি ধান৫২", {
      d: null, y: 3.75, tags: ["flood"],
      yText: { en: "About 3.5 to 4.0 t/ha.", bn: "হেক্টরে প্রায় ৩.৫ থেকে ৪.০ টন।" },
      note: { en: "Survives 10 to 14 days under water. The exact days in the field are not in my sources.", bn: "১০ থেকে ১৪ দিন পানির নিচে থাকলেও বাঁচে। মাঠে কত দিন লাগে তা আমার তথ্যসূত্রে নেই।" },
      src: ["S15"],
    }),
    V("t112", "BRRI dhan112", "ব্রি ধান১১২", {
      d: [120, 125], y: 5.13, tags: ["salt"],
      yText: { en: "4.14 to 6.12 t/ha, depending on how salty the field is.", bn: "জমিতে লবণ কতটা তার ওপর নির্ভর করে হেক্টরে ৪.১৪ থেকে ৬.১২ টন।" },
      note: { en: "Seedlings tolerate salt up to 12 dS/m. Strong stem.", bn: "চারা ১২ ডিএস/মি পর্যন্ত লবণ সহ্য করে। কাণ্ড শক্ত।" },
      src: ["S14"],
    }),
    V("t41", "BRRI dhan41", "ব্রি ধান৪১", {
      d: 144, y: 5.0, tags: ["salt"],
      yText: { en: "About 5.0 t/ha.", bn: "হেক্টরে প্রায় ৫.০ টন।" },
      note: { en: "Tolerates salt up to 8 dS/m at flowering. Suited to tidal areas. It stays long, so the next crop goes in later.", bn: "ফুল আসার সময় ৮ ডিএস/মি পর্যন্ত লবণ সহ্য করে। জোয়ার-ভাটার এলাকায় মানায়। মাঠে বেশি দিন থাকে, তাই পরের ফসল দেরিতে হবে।" },
      src: ["S15"],
    }),
  ],
  aus: [
    V("a48", "BRRI dhan48", "ব্রি ধান৪৮", {
      d: [100, 105], y: 6.6, tags: ["highyield"],
      yText: { en: "6.6 t/ha in validation trials (3.5 to 6.5 t/ha in farmers' fields).", bn: "যাচাই পরীক্ষায় হেক্টরে ৬.৬ টন (কৃষকের মাঠে ৩.৫ থেকে ৬.৫ টন)।" },
      note: { en: "In a Barind trial it needed 2 to 3 fewer irrigations and 28 to 36 percent less water than BRRI dhan28.", bn: "বরেন্দ্রের এক পরীক্ষায় ব্রি ধান২৮-এর চেয়ে ২ থেকে ৩টি কম সেচ ও ২৮ থেকে ৩৬ শতাংশ কম পানি লেগেছে।" },
      src: ["S20"],
    }),
    V("a55", "BRRI dhan55", "ব্রি ধান৫৫", {
      d: null, tags: ["drought", "salt", "cold"], thin: true,
      yText: null,
      note: { en: "BRRI lists it as tolerant to cold, drought and salt. No figures in my sources.", bn: "ব্রি একে ঠান্ডা, খরা ও লবণসহনশীল বলে। সংখ্যা আমার তথ্যসূত্রে নেই।" },
      src: ["S12"],
    }),
    V("a42", "BRRI dhan42 / 43", "ব্রি ধান৪২ / ৪৩", {
      d: null, tags: ["drought"], thin: true,
      yText: null,
      note: { en: "Drought-tolerant Aus. No figures in my sources.", bn: "খরাসহনশীল আউশ। সংখ্যা আমার তথ্যসূত্রে নেই।" },
      src: ["S12"],
    }),
  ],
  mustard: [
    V("m17", "BARI Sarisha-17", "বারি সরিষা-১৭", {
      d: [75, 80], pref: 6, tags: ["early", "highyield"],
      yText: { en: "Gave the best seed yield of the short-duration group in a trial after T. Aman.", bn: "আমনের পরের এক পরীক্ষায় স্বল্পমেয়াদি দলের মধ্যে সবচেয়ে বেশি বীজ ফলন দিয়েছে।" },
      note: { en: "Short enough to follow T. Aman rice, which is how the trial grew it.", bn: "রোপা আমনের পর চাষের মতো স্বল্পমেয়াদি, পরীক্ষায় এভাবেই চাষ হয়েছে।" },
      src: ["S19"],
    }),
    V("m15", "BARI Sarisha-15", "বারি সরিষা-১৫", {
      d: [75, 80], pref: 4, tags: ["early"],
      yText: { en: "Second best seed yield in the same trial.", bn: "একই পরীক্ষায় বীজ ফলনে দ্বিতীয়।" },
      note: { en: "Short enough to follow T. Aman rice, which is how the trial grew it.", bn: "রোপা আমনের পর চাষের মতো স্বল্পমেয়াদি, পরীক্ষায় এভাবেই চাষ হয়েছে।" },
      src: ["S19"],
    }),
    V("m14", "BARI Sarisha-14", "বারি সরিষা-১৪", {
      d: [75, 80], pref: 2, tags: ["early"],
      yText: { en: "Third best seed yield in the same trial.", bn: "একই পরীক্ষায় বীজ ফলনে তৃতীয়।" },
      note: { en: "Short enough to follow T. Aman rice, which is how the trial grew it.", bn: "রোপা আমনের পর চাষের মতো স্বল্পমেয়াদি, পরীক্ষায় এভাবেই চাষ হয়েছে।" },
      src: ["S19"],
    }),
    V("mb11", "Binasarisha-11", "বিনা সরিষা-১১", {
      d: [75, 80], pref: 0, tags: ["early"],
      yText: { en: "Lower yield than the three BARI varieties above in the same trial.", bn: "একই পরীক্ষায় উপরের তিনটি বারি জাতের চেয়ে কম ফলন।" },
      note: { en: "Short enough to follow T. Aman rice, which is how the trial grew it.", bn: "রোপা আমনের পর চাষের মতো স্বল্পমেয়াদি, পরীক্ষায় এভাবেই চাষ হয়েছে।" },
      src: ["S19"],
    }),
    V("m16", "BARI Sarisha-16", "বারি সরিষা-১৬", {
      d: null, tags: ["long"], thin: true,
      yText: { en: "Highest seed yield in the trial.", bn: "পরীক্ষায় সবচেয়ে বেশি বীজ ফলন।" },
      note: { en: "Takes a long time, so farmers avoid it after T. Aman because it delays the next crop.", bn: "অনেক দিন লাগে, তাই আমনের পর কৃষকেরা এটি এড়িয়ে চলেন, কারণ পরের ফসল পিছিয়ে যায়।" },
      src: ["S19"],
    }),
  ],
  potato: [
    V("p25", "BARI Alu-25 (Asterix)", "বারি আলু-২৫ (অ্যাস্টেরিক্স)", {
      d: null, pref: 6, tags: ["drought"],
      yText: { en: "Highest tuber yield in a water-stress trial. Lost the least yield under severe water stress (23.68 percent).", bn: "পানির চাপের এক পরীক্ষায় কন্দের ফলন সবচেয়ে বেশি। তীব্র পানির চাপে ফলন সবচেয়ে কম কমেছে (২৩.৬৮ শতাংশ)।" },
      note: { en: "Days not stated for this variety. Potato usually takes 85 to 95 days.", bn: "এই জাতের দিন বলা নেই। আলু সাধারণত ৮৫ থেকে ৯৫ দিন লাগে।" },
      src: ["S21", "S22"],
    }),
    V("p28", "BARI Alu-28 (Lady Rosetta)", "বারি আলু-২৮ (লেডি রোজেটা)", {
      d: null, pref: 4, tags: ["drought"],
      yText: { en: "Lost 25.68 percent yield under severe water stress, the second best in the trial.", bn: "তীব্র পানির চাপে ২৫.৬৮ শতাংশ ফলন কমেছে, পরীক্ষায় দ্বিতীয় সেরা।" },
      note: { en: "Days not stated for this variety. Potato usually takes 85 to 95 days.", bn: "এই জাতের দিন বলা নেই। আলু সাধারণত ৮৫ থেকে ৯৫ দিন লাগে।" },
      src: ["S21", "S22"],
    }),
    V("p7", "BARI Alu-7 (Diamant)", "বারি আলু-৭ (ডায়মন্ট)", {
      d: null, pref: 0, thin: true,
      yText: null,
      note: { en: "Tested in the same trial, but my source does not describe its result.", bn: "একই পরীক্ষায় ছিল, কিন্তু আমার তথ্যসূত্রে এর ফল বলা নেই।" },
      src: ["S21"],
    }),
    V("p8", "BARI Alu-8 (Cardinal)", "বারি আলু-৮ (কার্ডিনাল)", {
      d: null, pref: 0, thin: true,
      yText: null,
      note: { en: "Tested in the same trial, but my source does not describe its result.", bn: "একই পরীক্ষায় ছিল, কিন্তু আমার তথ্যসূত্রে এর ফল বলা নেই।" },
      src: ["S21"],
    }),
  ],
  mungbean: [
    V("mg6", "BARI Mung-6", "বারি মুগ-৬", {
      d: 55, tags: ["early"],
      yText: null,
      note: { en: "Short duration: about 55 days in the field.", bn: "স্বল্পমেয়াদি: মাঠে প্রায় ৫৫ দিন।" },
      src: ["S9"],
    }),
  ],
};

const POOL = { boroSalt: "boro" };

const mean = (d) => (Array.isArray(d) ? (d[0] + d[1]) / 2 : d);

// days in the field for this variety in this field (null when my sources do not say)
export function varietyDays(v, ctx) {
  const d = ctx && ctx.salt && v.dSalt ? v.dSalt : v.d;
  return d == null ? null : d;
}

export function varietyYield(v, ctx) {
  return ctx && ctx.salt && v.ySalt != null ? v.ySalt : v.y;
}

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
  warnHasWater: {
    en: "You have dry-season water, so you can grow a second crop instead of leaving the land empty.",
    bn: "আপনার শুষ্ক মৌসুমে পানি আছে, তাই জমি খালি না রেখে দ্বিতীয় ফসল করতে পারেন।",
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
  oneCrop: {
    en: "Only one crop a year. After harvest the land rests for the dry season unless you find water.",
    bn: "বছরে একটিই ফসল। কাটার পর পানি না পেলে শুষ্ক মৌসুমে জমি খালি থাকে।",
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
  {
    id: "tamanOnly",
    name: { en: "Flood-tolerant T. Aman – Fallow", bn: "বন্যাসহনশীল রোপা আমন – পতিত" },
    steps: [{ crop: "taman", plant: 13.6 }],
    needs: {
      irrigation: "none",
      land: { good: ["low", "medium"], bad: [] },
      soil: { good: ["heavy"], bad: ["light"] },
      salt: "medium",
      rainOnly: true,
    },
    notes: [NOTE.oneCrop],
    trial: {
      en: "Made for rain-fed lowlands that flood in the monsoon: BRRI dhan79 was developed for flash-flood lowlands, and BRRI dhan51 and 52 survive 10 to 16 days under water.",
      bn: "বর্ষায় ডুবে যাওয়া বৃষ্টিনির্ভর নিচু জমির জন্য: ব্রি ধান৭৯ আকস্মিক বন্যার নিচু জমির জন্য তৈরি, আর ব্রি ধান৫১ ও ৫২ ১০ থেকে ১৬ দিন পানির নিচে বাঁচে।",
    },
    sources: ["S15", "S17", "S18"],
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
  { id: "S12", by: "BRRI Rice Knowledge Bank", title: "Salient features of BRRI varieties", url: "https://www.knowledgebank-brri.org/brri-rice-varieties-en.php" },
  { id: "S13", by: "Bangladesh Rice Journal", title: "Advancing salinity-tolerant rice in Bangladesh: the case of BRRI dhan67", url: "https://www.banglajol.info/index.php/BRJ/article/view/90747" },
  { id: "S14", by: "The Business Standard", title: "BRRI introduces high-yielding Boro, salt-tolerant, blast-resistant rice varieties (BRRI dhan112, 113, 114)", url: "https://www.tbsnews.net/agriculture/brri-introduces-high-yielding-boro-salt-tolerant-blast-resistant-rice-varieties-1168316" },
  { id: "S15", by: "UN-CSAM", title: "Bangladesh rice variety table: seasons, days, yield and tolerances", url: "https://un-csam.org/sites/default/files/2021-01/bd_1.pdf" },
  { id: "S16", by: "Int. J. Plant & Soil Science", title: "Early maturing drought-tolerant rice variety BRRI dhan71", url: "https://journalijpss.com/index.php/IJPSS/article/view/1166" },
  { id: "S17", by: "Asian J. Research in Crop Science", title: "Submergence-tolerant rice variety BRRI dhan79 for flash-flood areas", url: "https://journalajrcs.com/index.php/AJRCS/article/view/253" },
  { id: "S18", by: "Bangladesh Rice Journal, 2020", title: "Stress-tolerant rice for unfavourable ecosystems of Bangladesh", url: "https://www.banglajol.info/index.php/BRJ/article/download/53450/38801" },
  { id: "S19", by: "Bangladesh J. Agriculture", title: "Suitability of rapeseed-mustard varieties as a relay with T. Aman rice", url: "https://banglajol.info/index.php/BJAgri/article/view/86131" },
  { id: "S20", by: "Bangladesh Agricultural Research", title: "Aus rice production in a less irrigated situation, northern Bangladesh (BRRI dhan48)", url: "https://www.banglajol.info/index.php/AGRIC/article/view/33434" },
  { id: "S21", by: "Bangladesh J. Agricultural Research", title: "Response of four potato varieties to water deficit stress", url: "https://banglajol.info/index.php/BJAR/article/view/92068" },
  { id: "S22", by: "SAARC J. Agriculture", title: "Stable potato varieties for table and processing in Bangladesh", url: "https://www.banglajol.info/index.php/SJA/article/view/57670" },
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

// The cold north (Rangpur division) and the haor districts, where BRRI lists cold-tolerant Boro (S18). Approximate.
const COLD = [
  "rangpur", "dinajpur", "gaibandha", "kurigram", "lalmonirhat", "nilphamari", "panchagarh", "thakurgaon",
  "sunamganj", "habiganj", "moulvibazar", "maulvibazar", "sylhet", "netrokona", "netrakona", "kishoreganj", "brahmanbaria",
];

export function isColdDistrict(name) {
  const s = String(name || "").toLowerCase().replace(/[^a-z]/g, "");
  return !!s && COLD.some((c) => s.includes(c));
}

// ---- ranking: simple rules, not an AI model ----
// ctx = { land: "high"|"medium"|"low", irrigation: boolean, salt: boolean, soil: "light"|"medium"|"heavy"|"unknown", cold?: boolean }
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

    if (n.rainOnly && ctx.irrigation) {
      score -= 25;
      warns.push(MSG.warnHasWater);
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

// ---- ranking the varieties of one crop for this field ----
// Simple rules: a yield number from the trial, plus points when a tolerance matches your field. Not an AI model.
export function rankVarieties(cropKey, ctx) {
  const c = cropKey === "boroSalt" ? { ...ctx, salt: true } : ctx;
  const pool = VARIETIES[POOL[cropKey] || cropKey] || [];
  const stress = c.salt || c.land === "low" || !c.irrigation;
  const list = pool.map((variety, order) => {
    const tags = variety.tags;
    let score = 50;
    const why = [];
    const y = varietyYield(variety, c);
    if (y != null) score += (y - 5) * 3;
    if (variety.pref) score += variety.pref;
    if (c.salt) {
      if (tags.includes("salt")) {
        score += 40;
        why.push("salt");
      } else if (cropKey === "boro" || cropKey === "boroSalt" || cropKey === "taman") {
        score -= 30;
      }
    }
    if (c.land === "low" && tags.includes("flood")) {
      score += 35;
      why.push("flood");
    }
    if (!c.irrigation && tags.includes("drought") && cropKey !== "boro" && cropKey !== "boroSalt") {
      score += 25;
      why.push("drought");
    }
    if (c.cold && tags.includes("cold")) {
      score += 15;
      why.push("cold");
    } else if (c.cold && tags.includes("coldmod")) {
      score += 8;
      why.push("cold");
    }
    if (tags.includes("early")) {
      score += 6;
      why.push("early");
    }
    if (!stress && tags.includes("highyield")) {
      score += 8;
      why.push("yield");
    }
    if (tags.includes("long")) score -= 15;
    if (variety.thin) score -= 6;
    return { variety, score, why, days: varietyDays(variety, c), order };
  });
  return list.sort((a, b) => b.score - a.score || a.order - b.order);
}

// ---- timeline ----

const typical = (crop) => CROPS[crop].days;
const daysFor = (s, daysMap) => (daysMap && daysMap[s.crop] != null ? daysMap[s.crop] : typical(s.crop));
const endOf = (s, daysMap) => s.plant + daysFor(s, daysMap) / DAYS_PER_SLOT;

// Pieces to draw on a 0..24 line: crop bars, fallow gaps and short turnaround gaps. A bar that crosses 31 Dec is split in two.
// daysMap = { cropKey: days in the field } from the chosen varieties; crops not in it use the typical days.
export function segmentsOf(rotation, daysMap) {
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
    add("crop", s.crop, s.plant, endOf(s, daysMap));
    let from = endOf(s, daysMap);
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

// Crops of the same rotation that overlap in the field (empty means the calendar works).
export function overlaps(rotation, daysMap) {
  const items = [...rotation.steps].sort((a, b) => a.plant - b.plant);
  const bad = [];
  items.forEach((s, i) => {
    const next = i === items.length - 1 ? items[0].plant + SLOTS : items[i + 1].plant;
    if (endOf(s, daysMap) > next + 0.05) bad.push({ crop: s.crop, next: items[(i + 1) % items.length].crop });
  });
  return bad;
}

// Picks one variety for each crop of a rotation. Starts with the best match, or the farmer's own pick (overrides),
// and swaps a crop for a shorter variety when it would clash with the next crop. Returns what is left clashing.
export function chooseVarieties(rotation, ctx, overrides = {}) {
  const lists = {};
  const pick = {};
  rotation.steps.forEach((s) => {
    const list = rankVarieties(s.crop, ctx);
    lists[s.crop] = list;
    const at = list.findIndex((x) => x.variety.id === overrides[s.crop]);
    pick[s.crop] = at >= 0 ? at : 0;
  });
  const daysOf = (crop) => {
    const d = lists[crop][pick[crop]];
    return d && d.days != null ? mean(d.days) : null;
  };
  const build = () => {
    const m = {};
    rotation.steps.forEach((s) => {
      const d = daysOf(s.crop);
      if (d != null) m[s.crop] = d;
    });
    return m;
  };
  for (let guard = 0; guard < 30; guard++) {
    const bad = overlaps(rotation, build());
    let changed = false;
    for (const b of bad) {
      if (overrides[b.crop] && lists[b.crop].some((x) => x.variety.id === overrides[b.crop])) continue;
      const now = daysOf(b.crop) != null ? daysOf(b.crop) : typical(b.crop);
      for (let j = pick[b.crop] + 1; j < lists[b.crop].length; j++) {
        const dj = lists[b.crop][j].days != null ? mean(lists[b.crop][j].days) : typical(b.crop);
        if (dj < now) {
          pick[b.crop] = j;
          changed = true;
          break;
        }
      }
      if (changed) break;
    }
    if (!changed) break;
  }
  const daysMap = build();
  const chosen = {};
  rotation.steps.forEach((s) => {
    chosen[s.crop] = lists[s.crop][pick[s.crop]];
  });
  return { chosen, lists, daysMap, clashes: overlaps(rotation, daysMap) };
}

// The steps in the order the farmer meets them, starting from "now", with the harvest position
// and how long the land rests after it (in half-months).
export function flowOf(rotation, daysMap, now) {
  const steps = rotation.steps
    .map((s) => {
      let d = s.plant - now;
      if (d < -0.5) d += SLOTS;
      return { ...s, harvest: endOf(s, daysMap), d };
    })
    .sort((a, b) => a.d - b.d);
  return steps.map((s, i) => {
    const next = steps[(i + 1) % steps.length];
    let rest = next.plant - s.harvest;
    while (rest < -0.5) rest += SLOTS;
    if (rest < 0) rest = 0;
    return { ...s, rest };
  });
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