#!/usr/bin/env node
// EarthEcho market-prices MCP server (stdio, JSON-RPC 2.0, no extra packages).
// Serves nearby crop market prices (UN WFP price database) for a latitude, longitude and country code,
// by calling EarthEcho's own public API. Run: node mcp/earthecho-market-mcp.js  (EARTHECHO_API sets another deployment)
import { createInterface } from "node:readline";

const BASE = (process.env.EARTHECHO_API || "https://earth-echo-nine.vercel.app").replace(/\/$/, "");
const SERVER = { name: "earthecho-market", version: "1.0.0" };
const COUNTRIES = ["BD", "IN", "PK", "NP", "MM", "BT"];

const TOOLS = [
  {
    name: "get_market_prices",
    description: "Latest retail market prices of crops in the markets nearest a point (WFP food prices; Bangladesh, India, Pakistan, Nepal, Myanmar, Bhutan). Prices are retail, so the farm-gate price is usually lower.",
    inputSchema: { type: "object", properties: { lat: { type: "number", minimum: -90, maximum: 90 }, lon: { type: "number", minimum: -180, maximum: 180 }, country: { type: "string", description: "Two-letter code: " + COUNTRIES.join(", ") } }, required: ["lat", "lon", "country"] },
  },
  {
    name: "list_supported_countries",
    description: "Countries that have market price data in EarthEcho.",
    inputSchema: { type: "object", properties: {} },
  },
];

const text = (t, isError = false) => ({ content: [{ type: "text", text: t }], ...(isError ? { isError: true } : {}) });

async function callTool(name, args = {}) {
  if (name === "list_supported_countries") return text(COUNTRIES.join(", "));
  if (name !== "get_market_prices") return null;
  const lat = Number(args.lat), lon = Number(args.lon), country = String(args.country || "").toUpperCase();
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return text("lat and lon must be real coordinates.", true);
  if (!COUNTRIES.includes(country)) return text(`country must be one of: ${COUNTRIES.join(", ")}`, true);
  try {
    const r = await fetch(`${BASE}/api/markets?country=${country}&lat=${lat}&lon=${lon}`, { signal: AbortSignal.timeout(25000) });
    const body = await r.text();
    if (!r.ok) return text(`EarthEcho API answered ${r.status}: ${body.slice(0, 200)}`, true);
    return text(body.length > 6000 ? body.slice(0, 6000) + "\n...(shortened)" : body);
  } catch (e) {
    return text(`Could not reach the EarthEcho API: ${e && e.message}`, true);
  }
}

async function handle(msg) {
  const { id, method, params } = msg;
  const ok = (result) => ({ jsonrpc: "2.0", id, result });
  const fail = (code, message) => ({ jsonrpc: "2.0", id, error: { code, message } });
  if (method === "initialize") return ok({ protocolVersion: params?.protocolVersion || "2024-11-05", capabilities: { tools: {} }, serverInfo: SERVER });
  if (method === "ping") return ok({});
  if (method === "tools/list") return ok({ tools: TOOLS });
  if (method === "tools/call") {
    const out = await callTool(params?.name, params?.arguments);
    return out ? ok(out) : fail(-32602, `Unknown tool: ${params?.name}`);
  }
  if (id === undefined) return null;
  return fail(-32601, `Method not found: ${method}`);
}

createInterface({ input: process.stdin }).on("line", async (line) => {
  if (!line.trim()) return;
  let msg;
  try { msg = JSON.parse(line); } catch { return process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }) + "\n"); }
  const reply = await handle(msg);
  if (reply) process.stdout.write(JSON.stringify(reply) + "\n");
});
