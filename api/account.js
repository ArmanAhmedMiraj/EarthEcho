// Accounts for EarthEcho: register with a phone number and a one-time code (OTP), log in, and keep My Farm in a database.
// One function does it all (Vercel's free plan allows only 12 functions). The action is in ?a= :
//   health, register, verify, resend, login, logout, me, sync
import * as store from "./_lib/store.js";
import { sendSms, smsReady, devMode } from "./_lib/sms.js";
import {
  normalizePhone, hashPassword, checkPassword, sha, newToken, newId, newCode, sameCode,
  checkRegistration, readCookie, sessionCookie, clientIp, sameSite,
} from "./_lib/auth.js";

const SESSION_DAYS = 30;
const OTP_SECONDS = 600;
const MAX_TRIES = 5;
const MAX_DOC = 400 * 1024;

const fail = (res, status, error, extra = {}) => res.status(status).json({ ok: false, error, ...extra });
const publicUser = (u) => ({ id: u.id, first: u.first, middle: u.middle || "", last: u.last, email: u.email || "", phone: u.phone });

async function limited(key, max, seconds) {
  return (await store.incr(key, seconds)) > max;
}

// make a new code and text it
async function sendCode(req, res, phone) {
  const ip = clientIp(req);
  if (await limited(`rl:otpip:${ip}`, 20, 3600)) { fail(res, 429, "too_many"); return null; }
  if (await limited(`rl:otp:${phone}`, 5, 3600)) { fail(res, 429, "too_many"); return null; }
  const fresh = await store.set(`otpcd:${phone}`, "1", { ex: 60, nx: true });
  if (!fresh) { fail(res, 429, "wait", { retryAfter: 60 }); return null; }
  const code = newCode();
  await store.setJson(`otp:${phone}`, { hash: sha(`${code}:${phone}`), exp: Date.now() + OTP_SECONDS * 1000, tries: 0 }, { ex: OTP_SECONDS });
  try {
    await sendSms(phone, `EarthEcho: your verification code is ${code}. It works for 10 minutes. Do not share it.`);
  } catch {
    await store.del(`otp:${phone}`);
    await store.del(`otpcd:${phone}`);
    { fail(res, 502, "sms_failed"); return null; }
  }
  return { code };
}

async function startSession(req, res, user) {
  const token = newToken();
  await store.setJson(`s:${sha(token)}`, { uid: user.id }, { ex: SESSION_DAYS * 86400 });
  res.setHeader("Set-Cookie", sessionCookie(req, token, SESSION_DAYS * 86400));
}

async function currentUser(req) {
  const token = readCookie(req);
  if (!token) return null;
  const s = await store.getJson(`s:${sha(token)}`);
  if (!s) return null;
  const u = await store.getJson(`u:${s.uid}`);
  return u && u.verified ? u : null;
}

// ---- saved farms: merge what this device has with what the account has
const KV_KEY = /^ef-(priorities|rotation-[\w-]{1,24}|irrigation-[\w.,:-]{1,60}|water-[\w.,:-]{1,60})$/;
const okField = (f) => f && typeof f.id === "string" && f.id.length <= 40 && Number.isFinite(Number(f.lat)) && Number.isFinite(Number(f.lon)) && Math.abs(f.lat) <= 90 && Math.abs(f.lon) <= 180;
const clamp = (at) => Math.min(Number(at) || 0, Date.now() + 5 * 60 * 1000);

function mergeData(doc, input) {
  const d = doc || { fields: {}, gone: {}, kv: {}, active: "", activeAt: 0 };
  const inFields = Array.isArray(input.fields) ? input.fields.filter(okField).slice(0, 60) : [];
  for (const f of inFields) {
    const at = clamp(f.updatedAt);
    if (d.gone[f.id] && d.gone[f.id] >= at) continue; // it was deleted after this copy was last changed
    if (!d.fields[f.id] || at > d.fields[f.id].at) {
      d.fields[f.id] = { f, at };
      delete d.gone[f.id];
    }
  }
  const gone = input.gone && typeof input.gone === "object" ? input.gone : {};
  for (const [id, atRaw] of Object.entries(gone).slice(0, 200)) {
    const at = clamp(atRaw);
    if (d.fields[id] && d.fields[id].at <= at) delete d.fields[id];
    if (!d.fields[id]) d.gone[id] = Math.max(d.gone[id] || 0, at);
  }
  const kv = input.kv && typeof input.kv === "object" ? input.kv : {};
  for (const [key, item] of Object.entries(kv).slice(0, 80)) {
    if (!KV_KEY.test(key) || !item || typeof item.v !== "string" || item.v.length > 60000) continue;
    const at = clamp(item.at);
    if (!d.kv[key] || at > d.kv[key].at) d.kv[key] = { v: item.v, at };
  }
  if (typeof input.active === "string" && clamp(input.activeAt) > (d.activeAt || 0)) {
    d.active = input.active.slice(0, 40);
    d.activeAt = clamp(input.activeAt);
  }
  // forget old deletions after 90 days
  const cutoff = Date.now() - 90 * 86400 * 1000;
  for (const [id, at] of Object.entries(d.gone)) if (at < cutoff) delete d.gone[id];
  if (!d.fields[d.active]) d.active = Object.keys(d.fields)[0] || "";
  return d;
}

const outData = (d) => ({
  fields: Object.values(d.fields).map((x) => x.f),
  gone: d.gone,
  kv: d.kv,
  active: d.active,
  activeAt: d.activeAt || 0,
});

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const a = String((req.query && req.query.a) || "health");

  if (a === "health") return res.status(200).json({ ok: true, service: "earthecho-api", time: new Date().toISOString() });

  if (!store.storeReady()) return fail(res, 503, "unavailable");
  if (req.method === "POST" && !sameSite(req)) return fail(res, 403, "forbidden");
  const body = req.method === "POST" && req.body && typeof req.body === "object" ? req.body : {};

  try {
    if (a === "me") {
      const u = await currentUser(req);
      return u ? res.status(200).json({ ok: true, user: publicUser(u) }) : fail(res, 401, "signed_out");
    }

    if (req.method !== "POST") return fail(res, 405, "method");

    if (a === "register") {
      if (!smsReady()) return fail(res, 503, "unavailable");
      if (await limited(`rl:reg:${clientIp(req)}`, 10, 3600)) return fail(res, 429, "too_many");
      const v = checkRegistration(body);
      if (!v.ok) return fail(res, 400, "invalid", { fields: v.errors });
      const { first, middle, last, email, phone, password } = v.values;
      let id = await store.get(`p:${phone}`);
      if (id) {
        const old = await store.getJson(`u:${id}`);
        if (old && old.verified) return fail(res, 409, "phone_taken");
      } else {
        id = newId();
        const won = await store.set(`p:${phone}`, id, { nx: true });
        if (!won) return fail(res, 409, "phone_taken");
      }
      await store.setJson(`u:${id}`, { id, first, middle, last, email, phone, pass: hashPassword(password), verified: false, createdAt: Date.now() });
      const sent = await sendCode(req, res, phone);
      if (!sent) return undefined; // the reply was already given
      return res.status(200).json({ ok: true, step: "verify", phone, devCode: devMode() ? sent.code : undefined });
    }

    if (a === "resend") {
      if (!smsReady()) return fail(res, 503, "unavailable");
      const phone = normalizePhone(body.phone);
      const id = phone && (await store.get(`p:${phone}`));
      const u = id && (await store.getJson(`u:${id}`));
      if (!u || u.verified) return fail(res, 400, "nothing_to_verify");
      const sent = await sendCode(req, res, phone);
      if (!sent) return undefined;
      return res.status(200).json({ ok: true, step: "verify", phone, devCode: devMode() ? sent.code : undefined });
    }

    if (a === "verify") {
      const phone = normalizePhone(body.phone);
      const code = String(body.code || "").replace(/\D/g, "");
      if (!phone || code.length !== 6) return fail(res, 400, "invalid");
      if (await limited(`rl:ver:${clientIp(req)}`, 30, 3600)) return fail(res, 429, "too_many");
      const otp = await store.getJson(`otp:${phone}`);
      if (!otp || otp.exp < Date.now()) return fail(res, 400, "expired");
      if (otp.tries >= MAX_TRIES) { await store.del(`otp:${phone}`); return fail(res, 429, "locked"); }
      if (!sameCode(sha(`${code}:${phone}`), otp.hash)) {
        otp.tries += 1;
        await store.setJson(`otp:${phone}`, otp, { ex: Math.max(1, Math.ceil((otp.exp - Date.now()) / 1000)) });
        return fail(res, 400, "wrong_code", { triesLeft: Math.max(0, MAX_TRIES - otp.tries) });
      }
      await store.del(`otp:${phone}`);
      const id = await store.get(`p:${phone}`);
      const u = id && (await store.getJson(`u:${id}`));
      if (!u) return fail(res, 400, "expired");
      u.verified = true;
      await store.setJson(`u:${u.id}`, u);
      await startSession(req, res, u);
      return res.status(200).json({ ok: true, user: publicUser(u) });
    }

    if (a === "login") {
      const phone = normalizePhone(body.phone);
      const password = String(body.password || "");
      if (!phone || !password) return fail(res, 400, "invalid");
      if (await limited(`rl:login:${clientIp(req)}`, 30, 900)) return fail(res, 429, "too_many");
      if (await limited(`rl:loginp:${phone}`, 10, 900)) return fail(res, 429, "too_many");
      const id = await store.get(`p:${phone}`);
      const u = id && (await store.getJson(`u:${id}`));
      const good = checkPassword(password, u ? u.pass : { salt: "00", hash: "00".repeat(32) }); // same work whether or not the number exists
      if (!u || !good) return fail(res, 401, "bad_login");
      if (!u.verified) {
        if (!smsReady()) return fail(res, 503, "unavailable");
        const sent = await sendCode(req, res, phone);
        if (!sent) return undefined;
        return res.status(200).json({ ok: false, error: "unverified", step: "verify", phone, devCode: devMode() ? sent.code : undefined });
      }
      await startSession(req, res, u);
      return res.status(200).json({ ok: true, user: publicUser(u) });
    }

    if (a === "logout") {
      const token = readCookie(req);
      if (token) await store.del(`s:${sha(token)}`);
      res.setHeader("Set-Cookie", sessionCookie(req, "", 0));
      return res.status(200).json({ ok: true });
    }

    if (a === "sync") {
      const u = await currentUser(req);
      if (!u) return fail(res, 401, "signed_out");
      const doc = await store.getJson(`d:${u.id}`);
      const merged = mergeData(doc, body);
      const raw = JSON.stringify(merged);
      if (raw.length > MAX_DOC) return fail(res, 413, "too_big");
      await store.set(`d:${u.id}`, raw);
      return res.status(200).json({ ok: true, data: outData(merged), at: Date.now() });
    }

    return fail(res, 404, "unknown");
  } catch (error) {
    return fail(res, 500, "server", { detail: String((error && error.message) || error).slice(0, 120) });
  }
}
