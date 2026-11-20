#!/usr/bin/env node
// EarthEcho live-data MCP server (stdio, JSON-RPC 2.0, no extra packages).
// It gives any MCP client the same live plot data the web app shows, by calling EarthEcho's own public API:
// soil (ISRIC SoilGrids), environment, hazards nearby and dry-spell outlook for a latitude and longitude.
// Run:  node mcp/earthecho-live-mcp.js      (set EARTHECHO_API to use another deployment)
import { createInterface } from "node:readline";

const BASE = (process.env.EARTHECHO_API || "https://earth-echo-nine.vercel.app").replace(/\/$/, "");
const SERVER = { name: "earthecho-live", version: "1.0.0" };
const point = { type: "object", properties: { lat: { type: "number", minimum: -90, maximum: 90 }, lon: { type: "number", minimum: -180, maximum: 180 } }, required: ["lat", "lon"] };

const TOOLS = [
  { name: "get_soil", description: "Topsoil texture class, pH, organic carbon, nitrogen and CEC at a point (ISRIC SoilGrids 250 m). Values are model estimates with prediction intervals.", path: "/api/soil", inputSchema: point },
  { name: "get_environment", description: "Environmental readings for a point (vegetation greenness and land conditions) from EarthEcho's environment API.", path: "/api/environment", inputSchema: point },
  { name: "get_hazards", description: "Natural hazards near a point (earthquakes, floods, cyclones, fires) from USGS, GDACS and EONET via EarthEcho.", path: "/api/disasters", inputSchema: point },
  { name: "get_dry_spell", description: "Dry-spell and rainfall outlook for a point, used by the irrigation advice.", path: "/api/dryspell", inputSchema: point },
].map(({ path, ...t }) => ({ ...t, _path: path }));

const text = (t, isError = false) => ({ content: [{ type: "text", text: t }], ...(isError ? { isError: true } : {}) });

async function callTool(name, args = {}) {
  const tool = TOOLS.find((t) => t.name === name);
  if (!tool) return null;
  const lat = Number(args.lat), lon = Number(args.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return text("lat and lon must be real coordinates (lat -90..90, lon -180..180).", true);
  try {
    const r = await fetch(`${BASE}${tool._path}?lat=${lat}&lon=${lon}`, { signal: AbortSignal.timeout(25000) });
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
  if (method === "tools/list") return ok({ tools: TOOLS.map(({ _path, ...t }) => t) });
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
