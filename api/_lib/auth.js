import crypto from "node:crypto";

// ---- phone numbers: Bangladesh mobile numbers are accepted as 01XXXXXXXXX, 8801XXXXXXXXX or +8801XXXXXXXXX; any other country as +<number>
export function normalizePhone(input) {
  let s = String(input || "").replace(/[\s\-().]/g, "");
  // Bengali digits to English digits
  s = s.replace(/[০-৯]/g, (d) => String("০১২৩৪৫৬৭৮৯".indexOf(d)));
  if (/^01[3-9]\d{8}$/.test(s)) return `+88${s}`;
  if (/^8801[3-9]\d{8}$/.test(s)) return `+${s}`;
  if (/^\+8801[3-9]\d{8}$/.test(s)) return s;
  if (/^\+[1-9]\d{7,14}$/.test(s) && !s.startsWith("+880")) return s;
  return null;
}

// ---- passwords (scrypt, a slow hash made for passwords) and tokens
export function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(password, salt, 32).toString("hex");
  return { salt, hash };
}
export function checkPassword(password, stored) {
  if (!stored) return false;
  const a = Buffer.from(hashPassword(password, stored.salt).hash, "hex");
  const b = Buffer.from(stored.hash, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
export const sha = (s) => crypto.createHash("sha256").update(String(s)).digest("hex");
export const newToken = () => crypto.randomBytes(32).toString("base64url");
export const newId = () => crypto.randomBytes(12).toString("base64url");
export const newCode = () => String(crypto.randomInt(0, 1000000)).padStart(6, "0");
export const sameCode = (a, b) => {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

// ---- checking what the form sent
const NAME = /^[\p{L}\p{M}][\p{L}\p{M}\s.'’-]{0,59}$/u;
export function checkRegistration(b) {
  const first = String(b.first || "").trim();
  const middle = String(b.middle || "").trim();
  const last = String(b.last || "").trim();
  const email = String(b.email || "").trim();
  const phone = normalizePhone(b.phone);
  const password = String(b.password || "");
  const errors = {};
  if (!NAME.test(first)) errors.first = "first";
  if (middle && !NAME.test(middle)) errors.middle = "middle";
  if (!NAME.test(last)) errors.last = "last";
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) errors.email = "email";
  if (email.length > 120) errors.email = "email";
  if (!phone) errors.phone = "phone";
  if (password.length < 8 || password.length > 128) errors.password = "password";
  if (String(b.confirm || "") !== password) errors.confirm = "confirm";
  return { ok: Object.keys(errors).length === 0, errors, values: { first, middle, last, email, phone, password } };
}

// ---- the sign-in cookie
const COOKIE = "ef_session";
export function readCookie(req, name = COOKIE) {
  const raw = String((req.headers && req.headers.cookie) || "");
  for (const part of raw.split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return "";
}
export function sessionCookie(req, token, maxAge) {
  const secure = String(req.headers["x-forwarded-proto"] || "").includes("https") ? "; Secure" : "";
  return `${COOKIE}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secure}`;
}

export function clientIp(req) {
  return String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown").split(",")[0].trim();
}

// a request that changes something must come from our own site
export function sameSite(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try { return new URL(origin).host === req.headers.host; } catch { return false; }
}
