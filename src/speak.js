// Read the summary aloud with the voices already on the device (the browser's speech feature). Nothing is sent anywhere.
// Many phones have a Bangla voice; some computers do not. When there is none we say so and do not read Bangla with a wrong voice.
export const canSpeak = () => typeof window !== "undefined" && "speechSynthesis" in window && typeof window.SpeechSynthesisUtterance === "function";

export function pickVoice(prefix) {
  return new Promise((resolve) => {
    const find = () => {
      const list = window.speechSynthesis.getVoices() || [];
      const hit = list.find((v) => v.lang && v.lang.toLowerCase().replace("_", "-").startsWith(prefix));
      return hit ? { ok: true, voice: hit, lang: hit.lang } : null;
    };
    const now = find();
    if (now) return resolve(now);
    // voices can load a moment after the page starts
    let done = false;
    const finish = () => { if (done) return; done = true; window.speechSynthesis.removeEventListener("voiceschanged", on); resolve(find() || { ok: false }); };
    const on = () => finish();
    window.speechSynthesis.addEventListener("voiceschanged", on);
    setTimeout(finish, 1500);
  });
}

// one short utterance per part: long ones are cut off by some browsers
export function speakAll(parts, voice, lang, onEnd) {
  const synth = window.speechSynthesis;
  synth.cancel();
  parts.forEach((text, i) => {
    const u = new window.SpeechSynthesisUtterance(text);
    u.voice = voice; u.lang = lang; u.rate = 0.9;
    if (i === parts.length - 1) { u.onend = onEnd; u.onerror = onEnd; }
    synth.speak(u);
  });
}
let current = null;
export const stopSpeaking = () => {
  if (current) { try { current.onended = null; current.onerror = null; current.pause(); } catch { /* already stopped */ } current = null; }
  try { if (canSpeak()) window.speechSynthesis.cancel(); } catch { /* nothing playing */ }
};

// The text that fits in one request (the server takes up to 600 characters): whole parts only
export function joinParts(parts, sep, max = 600) {
  let out = "";
  for (const p of parts) { const next = out ? `${out} ${p}${sep}` : `${p}${sep}`; if (next.length > max) break; out = next; }
  return out.trim();
}

// An AI voice made on our server (works on every device, no voice needed on the device). Resolves { ok } when playback has started,
// or { ok: false } when the server could not make the voice (then the caller can try the device's own voice).
export function playAi(text, onEnd) {
  return new Promise((resolve) => {
    stopSpeaking();
    const audio = new Audio(`/api/assistant?speak=1&text=${encodeURIComponent(text)}`);
    current = audio;
    let settled = false;
    const done = (ok) => { if (settled) return; settled = true; clearTimeout(timer); resolve({ ok }); };
    const timer = setTimeout(() => { if (current === audio) stopSpeaking(); done(false); }, 40000);
    audio.onplaying = () => done(true);
    audio.onended = () => { current = null; onEnd(); };
    audio.onerror = () => { if (!settled) done(false); else { current = null; onEnd(); } };
    const p = audio.play();
    if (p && p.catch) p.catch(() => done(false));
  });
}
