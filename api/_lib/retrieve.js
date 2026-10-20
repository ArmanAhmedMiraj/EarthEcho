// Finds the pieces of knowledge that match a question (BM25 word matching, no AI needed).
const STOP = new Set("the a an and or of to in on for is are be it this that with as at by from what when how do i my can should which will about".split(" "));
const words = (text) =>
  String(text).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").split(" ").filter((w) => w && !STOP.has(w) && w.length > 1)
    .map((w) => (w.length > 4 && w.endsWith("s") ? w.slice(0, -1) : w));

export function buildIndex(docs) {
  const entries = docs.map((d) => {
    const tokens = words(`${d.title} ${d.title} ${d.text}`);
    const tf = new Map();
    for (const w of tokens) tf.set(w, (tf.get(w) || 0) + 1);
    return { doc: d, tf, len: tokens.length };
  });
  const df = new Map();
  for (const e of entries) for (const w of e.tf.keys()) df.set(w, (df.get(w) || 0) + 1);
  const avg = entries.reduce((s, e) => s + e.len, 0) / entries.length;
  return { entries, df, avg, n: entries.length };
}

export function search(index, question, k = 5) {
  const q = [...new Set(words(question))];
  const k1 = 1.4, b = 0.75;
  const scored = index.entries.map((e) => {
    let score = 0;
    for (const w of q) {
      const f = e.tf.get(w);
      if (!f) continue;
      const idf = Math.log(1 + (index.n - index.df.get(w) + 0.5) / (index.df.get(w) + 0.5));
      score += idf * ((f * (k1 + 1)) / (f + k1 * (1 - b + (b * e.len) / index.avg)));
    }
    return { doc: e.doc, score };
  });
  return scored.filter((s) => s.score > 0).sort((a, b2) => b2.score - a.score).slice(0, k).map((s) => s.doc);
}
