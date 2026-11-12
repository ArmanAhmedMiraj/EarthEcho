// Where accounts and saved farms are kept.
// On Vercel this is an Upstash Redis database (added from the Vercel Marketplace; it sets the two variables below).
// While you work on your own computer, with AUTH_DEV_OTP=1 in .env.local, a simple in-memory store is used instead.

const URL_ = () => process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || "";
const TOKEN = () => process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || "";

export const hasDatabase = () => Boolean(URL_() && TOKEN());
export const memoryAllowed = () => process.env.AUTH_DEV_OTP === "1" || process.env.ALLOW_MEMORY_STORE === "1";
export const storeReady = () => hasDatabase() || memoryAllowed();

async function command(args) {
  const res = await fetch(URL_(), {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN()}`, "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.error) throw new Error(body.error || `database ${res.status}`);
  return body.result;
}

// the in-memory store (only for working on your own computer)
const mem = (globalThis.__efMemStore = globalThis.__efMemStore || new Map());
const alive = (e) => e && (!e.exp || e.exp > Date.now());

export async function get(key) {
  if (hasDatabase()) return command(["GET", key]);
  const e = mem.get(key);
  return alive(e) ? e.v : null;
}

// ex = seconds until it disappears; nx = only if the key is not there yet. Returns true when it was written.
export async function set(key, value, { ex, nx } = {}) {
  if (hasDatabase()) {
    const args = ["SET", key, value];
    if (ex) args.push("EX", String(ex));
    if (nx) args.push("NX");
    return (await command(args)) === "OK";
  }
  if (nx && alive(mem.get(key))) return false;
  mem.set(key, { v: value, exp: ex ? Date.now() + ex * 1000 : 0 });
  return true;
}

export async function del(key) {
  if (hasDatabase()) { await command(["DEL", key]); return; }
  mem.delete(key);
}

// a counter that starts again after ex seconds (for limits on tries)
export async function incr(key, ex) {
  if (hasDatabase()) {
    const n = await command(["INCR", key]);
    if (n === 1 && ex) await command(["EXPIRE", key, String(ex)]);
    return n;
  }
  const e = mem.get(key);
  if (!alive(e)) { mem.set(key, { v: "1", exp: ex ? Date.now() + ex * 1000 : 0 }); return 1; }
  e.v = String(Number(e.v) + 1);
  return Number(e.v);
}

export async function getJson(key) {
  const raw = await get(key);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}
export const setJson = (key, obj, opts) => set(key, JSON.stringify(obj), opts);
