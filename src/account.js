// The signed-in side of EarthEcho: who is logged in, and keeping My Farm in step with the account.
// Guests never touch this: their information stays in the browser (localStorage) and nothing is sent anywhere.
import { loadFields, saveFields, loadActiveId, saveActiveId } from "./fields.js";

const USER = "ef-user"; // the signed-in person, kept so the app still knows them offline
const MODE = "ef-mode"; // "guest" once the person chose to continue without an account
const META = "ef-sync-meta"; // when each saved value last changed on this device
const IDS = "ef-sync-ids"; // the fields that were in the account at the last sync
const GONE = "ef-sync-gone"; // fields deleted on this device, not yet told to the account
const FLASH = "ef-flash"; // a message to show once after the page reloads

const read = (k, fallback) => { try { const v = localStorage.getItem(k); return v == null ? fallback : v; } catch { return fallback; } };
const write = (k, v) => { try { localStorage.setItem(k, v); } catch { /* storage blocked */ } };
const drop = (k) => { try { localStorage.removeItem(k); } catch { /* storage blocked */ } };
const readJson = (k, fallback) => { try { return JSON.parse(read(k, "")) ?? fallback; } catch { return fallback; } };

// ---- who is logged in
export const getUser = () => { const u = readJson(USER, null); return u && u.id ? u : null; };
export const isGuestChosen = () => read(MODE, "") === "guest";
export const chooseGuest = () => write(MODE, "guest");
export const setFlash = (kind, data) => write(FLASH, JSON.stringify({ kind, ...data }));
export function takeFlash() { const f = readJson(FLASH, null); drop(FLASH); return f; }

const listeners = new Set();
let status = { state: "idle", at: 0 }; // idle | syncing | ok | offline | error
export const getStatus = () => status;
function setStatus(next) { status = { ...status, ...next }; listeners.forEach((fn) => fn()); }
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }

async function api(action, body) {
  let res;
  try {
    res = await fetch(`/api/account?a=${action}`, {
      method: body === undefined ? "GET" : "POST",
      headers: body === undefined ? {} : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: "same-origin",
    });
  } catch {
    return { ok: false, error: "network" };
  }
  const json = await res.json().catch(() => null);
  if (!json) return { ok: false, error: res.status === 404 ? "unavailable" : "server" };
  return json;
}

// ---- registering, verifying, logging in
export const register = (values) => api("register", values);
export const resendCode = (phone) => api("resend", { phone });
export async function verifyCode(phone, code) {
  const r = await api("verify", { phone, code });
  if (r.ok && r.user) write(USER, JSON.stringify(r.user));
  return r;
}
export async function logIn(phone, password) {
  const r = await api("login", { phone, password });
  if (r.ok && r.user) write(USER, JSON.stringify(r.user));
  return r;
}

// the account must still be valid on the server (a login lasts 30 days); offline, the saved login is trusted
export async function checkSession() {
  if (!getUser()) return;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;
  const r = await api("me");
  if (r.ok && r.user) write(USER, JSON.stringify(r.user));
  else if (r.error === "signed_out") { drop(USER); setFlash("expired"); window.location.reload(); }
}

// ---- keeping the farms in the account
const WANTED = /^ef-(priorities|rotation-[\w-]{1,24}|irrigation-[\w.,:-]{1,60}|water-[\w.,:-]{1,60})$/;
const hashOf = (s) => { let h = 5381; for (let i = 0; i < s.length; i += 1) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return String(h); };

function localKeys() {
  const out = [];
  try { for (let i = 0; i < localStorage.length; i += 1) { const k = localStorage.key(i); if (WANTED.test(k)) out.push(k); } } catch { /* blocked */ }
  return out;
}

// what this device has, with the time each thing last changed
function collect() {
  const now = Date.now();
  const meta = readJson(META, {});
  const next = {};
  const kv = {};
  for (const key of localKeys()) {
    const v = read(key, "");
    const h = hashOf(v);
    const at = meta[key] && meta[key].h === h ? meta[key].at : now;
    next[key] = { h, at };
    kv[key] = { v, at };
  }
  const active = loadActiveId();
  const ah = hashOf(active);
  const activeAt = meta.__active && meta.__active.h === ah ? meta.__active.at : now;
  next.__active = { h: ah, at: activeAt };
  const fields = loadFields();
  // fields that were in the account but are not here any more were deleted on this device
  const gone = readJson(GONE, {});
  const ids = new Set(fields.map((f) => f.id));
  for (const id of readJson(IDS, [])) if (!ids.has(id) && !gone[id]) gone[id] = now;
  write(GONE, JSON.stringify(gone));
  write(META, JSON.stringify(next));
  return { fields, gone, kv, active, activeAt };
}

const signature = (c) => JSON.stringify([c.fields.map((f) => [f.id, f.updatedAt]), c.gone, Object.entries(c.kv).map(([k, x]) => [k, x.at]), c.active]);

let busy = null;
let lastSig = "";

// send this device's data and take back the merged result. Returns { ok, changed, localFields }.
export function syncNow() {
  if (busy) return busy;
  if (!getUser()) return Promise.resolve({ ok: false, error: "signed_out" });
  if (typeof navigator !== "undefined" && navigator.onLine === false) { setStatus({ state: "offline" }); return Promise.resolve({ ok: false, error: "network" }); }
  setStatus({ state: "syncing" });
  const sent = collect();
  const sentSig = signature(sent);
  busy = api("sync", sent).then((r) => {
    busy = null;
    if (!r.ok) {
      if (r.error === "signed_out") { drop(USER); setFlash("expired"); window.location.reload(); }
      setStatus({ state: r.error === "network" ? "offline" : "error", error: r.error });
      return { ok: false, error: r.error };
    }
    const changed = apply(r.data);
    lastSig = signature(collect());
    setStatus({ state: "ok", at: Date.now(), error: "" });
    if (changed) window.dispatchEvent(new Event("ef-synced"));
    return { ok: true, changed, localFields: sent.fields.length, sentSig };
  });
  return busy;
}

// write the merged result onto this device. Returns true when something here changed.
function apply(data) {
  let changed = false;
  const before = JSON.stringify(loadFields().map((f) => [f.id, f.updatedAt]));
  saveFields(data.fields);
  if (JSON.stringify(loadFields().map((f) => [f.id, f.updatedAt])) !== before) changed = true;
  const meta = readJson(META, {});
  for (const [key, item] of Object.entries(data.kv || {})) {
    if (!WANTED.test(key)) continue;
    if (read(key, null) !== item.v) { write(key, item.v); changed = true; }
    meta[key] = { h: hashOf(item.v), at: item.at };
  }
  if (data.active && data.fields.some((f) => f.id === data.active) && loadActiveId() !== data.active && (data.activeAt || 0) >= (meta.__active ? meta.__active.at : 0)) {
    saveActiveId(data.active);
    changed = true;
  }
  const active = loadActiveId();
  meta.__active = { h: hashOf(active), at: data.activeAt || (meta.__active ? meta.__active.at : Date.now()) };
  write(META, JSON.stringify(meta));
  write(IDS, JSON.stringify(data.fields.map((f) => f.id)));
  write(GONE, JSON.stringify({}));
  return changed;
}

// look for changes now and then, and when the phone comes back online or the page comes back to the front
let started = false;
export function startAutoSync() {
  if (started) return;
  started = true;
  let lastPull = 0;
  const tick = () => {
    if (!getUser() || document.visibilityState === "hidden") return;
    const dirty = signature(collect()) !== lastSig;
    if (dirty || Date.now() - lastPull > 90000) { lastPull = Date.now(); syncNow(); }
  };
  setInterval(tick, 8000);
  window.addEventListener("online", () => syncNow());
  window.addEventListener("offline", () => { if (getUser()) setStatus({ state: "offline" }); });
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") tick(); });
  tick();
}

// ---- logging out
export async function logOut({ force = false } = {}) {
  if (!force) {
    if (typeof navigator !== "undefined" && navigator.onLine === false) return { ok: false, error: "network" };
    const s = await syncNow();
    if (!s.ok) return { ok: false, error: s.error === "network" ? "network" : "unsaved" };
  }
  await api("logout", {});
  for (const k of localKeys()) drop(k);
  [USER, MODE, META, IDS, GONE, FLASH, "ef-fields", "ef-active-field", "ef-farms"].forEach(drop);
  return { ok: true };
}

// what a person typed, checked the same way the server checks it (the server has the last word)
export function checkForm(v) {
  const errors = {};
  const name = /^[\p{L}\p{M}][\p{L}\p{M}\s.'’-]{0,59}$/u;
  if (!name.test(String(v.first || "").trim())) errors.first = "acErrFirst";
  if (String(v.middle || "").trim() && !name.test(String(v.middle).trim())) errors.middle = "acErrMiddle";
  if (!name.test(String(v.last || "").trim())) errors.last = "acErrLast";
  const email = String(v.email || "").trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) errors.email = "acErrEmail";
  if (!validPhone(v.phone)) errors.phone = "acErrPhone";
  const pw = String(v.password || "");
  if (pw.length < 8 || pw.length > 128) errors.password = "acErrPassword";
  if (String(v.confirm || "") !== pw) errors.confirm = "acErrConfirm";
  return errors;
}
export function validPhone(input) {
  const s = String(input || "").replace(/[\s\-().]/g, "").replace(/[০-৯]/g, (d) => String("০১২৩৪৫৬৭৮৯".indexOf(d)));
  return /^(\+?88)?01[3-9]\d{8}$/.test(s) || (/^\+[1-9]\d{7,14}$/.test(s) && !s.startsWith("+880"));
}

// the server's reply as a key of the text table
export function errorKey(r) {
  const map = { phone_taken: "acErrTaken", bad_login: "acErrBadLogin", wrong_code: "acErrWrongCode", expired: "acErrExpired", locked: "acErrLocked", wait: "acErrWait", too_many: "acErrMany", sms_failed: "acErrSms", unavailable: "acErrUnavailable", network: "acErrNet", too_big: "acErrTooBig", invalid: "acErrCodeShape" };
  return map[r && r.error] || "acErrServer";
}
