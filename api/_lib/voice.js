// Turns a short text into speech with Google's Gemini text-to-speech, so every phone and computer can hear it,
// even when the device has no voice of its own (many computers have no Bangla voice).
// Example: /api/assistant?speak=1&text=...  (served by assistant.js, so the project stays within the 12 functions Vercel Hobby allows)
// The key is read from the server setting GEMINI_API_KEY (the same one the assistant uses). It is never in the code
// and never sent to the browser. The answer is audio (WAV), and is cached for a long time, so the same text is made only once.
const MODELS = ["gemini-3.8-flash-tts", "gemini-3.8-flash-lite-tts", "gemini-3.1-flash-tts-preview", "gemini-2.5-flash-preview-tts", "gemini-2.5-pro-preview-tts"];
const MAX_CHARS = 600;
const VOICE = () => process.env.GEMINI_TTS_VOICE || "Kore";
let lastGood = null;

// a simple limit per visitor so one person cannot use up the free quota (best effort: a server restart resets it)
const hits = new Map();
function allowed(ip) {
  const now = Date.now(), hour = 3600e3;
  const list = (hits.get(ip) || []).filter((t) => now - t < hour);
  if (list.length >= 30) { hits.set(ip, list); return false; }
  list.push(now); hits.set(ip, list);
  if (hits.size > 5000) hits.clear();
  return true;
}

// Gemini sends either a finished WAV file or raw 16-bit PCM. Make sure we always answer with a WAV file.
export function toWav(bytes, mimeType = "") {
  if (bytes.length > 12 && bytes.toString("ascii", 0, 4) === "RIFF") return bytes;
  const m = /rate=(\d+)/i.exec(mimeType);
  const rate = m ? Number(m[1]) : 24000;
  const header = Buffer.alloc(44);
  header.write("RIFF", 0); header.writeUInt32LE(36 + bytes.length, 4); header.write("WAVE", 8); header.write("fmt ", 12);
  header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22); header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate * 2, 28); header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34); header.write("data", 36); header.writeUInt32LE(bytes.length, 40);
  return Buffer.concat([header, bytes]);
}

const bodyFor = (text, voiceShape) => ({
  contents: [{ role: "user", parts: [{ text }] }],
  generationConfig: {
    responseModalities: ["AUDIO"],
    speechConfig: { voiceConfig: voiceShape === "prebuilt" ? { prebuiltVoiceConfig: { voiceName: VOICE() } } : { voice: VOICE() } },
  },
});

async function synthesize(key, text) {
  const errors = [];
  const models = [...new Set([process.env.GEMINI_TTS_MODEL, lastGood, ...MODELS].filter(Boolean))];
  for (const model of models) {
    for (const shape of ["prebuilt", "plain"]) {
      try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
          method: "POST",
          headers: { "content-type": "application/json", "x-goog-api-key": key },
          body: JSON.stringify(bodyFor(text, shape)),
          signal: AbortSignal.timeout(25000),
        });
        if (response.ok) {
          const data = await response.json();
          const part = data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts.find((p) => p.inlineData && p.inlineData.data);
          if (part) { lastGood = model; return toWav(Buffer.from(part.inlineData.data, "base64"), part.inlineData.mimeType); }
          errors.push(`${model}: no audio`);
          break;
        }
        const msg = (await response.text()).slice(0, 100);
        errors.push(`${model}: HTTP ${response.status}`);
        if (response.status === 400 && shape === "prebuilt") continue; // try the other way to name the voice
        if (response.status === 404 || response.status === 403 || response.status === 429) break; // this model is not available to the key, or is out of quota: next model
        void msg;
        break;
      } catch (error) {
        errors.push(`${model}: ${String(error && error.name)}`);
        break;
      }
    }
  }
  throw new Error(errors.slice(0, 4).join("; "));
}

export default async function speakHandler(req, res) {
  const json = (code, body) => { res.statusCode = code; res.setHeader("content-type", "application/json"); res.end(JSON.stringify(body)); };
  const key = process.env.GEMINI_API_KEY;
  if (!key) return json(503, { ok: false, error: "Voice is not set up on this server." });
  const text = String((req.query && req.query.text) || "").replace(/\s+/g, " ").trim().slice(0, MAX_CHARS);
  if (!text) return json(400, { ok: false, error: "Give some text: ?text=..." });
  const ip = String((req.headers && (req.headers["x-forwarded-for"] || "")) || "").split(",")[0].trim() || "local";
  if (!allowed(ip)) return json(429, { ok: false, error: "Too many voice requests. Please try again later." });
  try {
    const wav = await synthesize(key, text);
    res.statusCode = 200;
    res.setHeader("content-type", "audio/wav");
    res.setHeader("cache-control", "public, s-maxage=2592000, max-age=86400, immutable");
    res.setHeader("content-length", String(wav.length));
    res.end(wav);
  } catch (error) {
    json(502, { ok: false, error: `The voice service did not answer (${String(error.message).slice(0, 160)}).` });
  }
}
