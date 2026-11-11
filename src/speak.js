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
export const stopSpeaking = () => { try { if (canSpeak()) window.speechSynthesis.cancel(); } catch { /* nothing playing */ } };
