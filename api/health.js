// A tiny check that the API is alive: open /api/health in the browser.
export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({ ok: true, service: "earthecho-api", time: new Date().toISOString() });
}