#!/usr/bin/env node
// EarthEcho MCP server (Model Context Protocol, stdio transport, JSON-RPC 2.0).
// It lets any MCP client (an IDE, an agent, another app) ask the same farming knowledge base
// that powers the in-app assistant. No extra packages: it reuses api/_lib/knowledge.js, retrieve.js and ecocrop.js.
// Run:  node mcp/earthecho-mcp.js     (it talks over stdin/stdout)
import { createInterface } from "node:readline";
import { DOCS } from "../api/_lib/knowledge.js";
import { buildIndex, search } from "../api/_lib/retrieve.js";
import crops from "../api/_lib/ecocrop.js";

const INDEX = buildIndex(DOCS);
const SERVER = { name: "earthecho-knowledge", version: "1.0.0" };

const TOOLS = [
  {
    name: "search_knowledge",
    description: "Search EarthEcho's farming knowledge base (irrigation method, soil, rotation, hazards, data sources, per-crop ranges) with BM25 keyword ranking. Returns the best matching pieces with their source URL.",
    inputSchema: { type: "object", properties: { query: { type: "string", description: "A farming question or keywords" }, limit: { type: "integer", minimum: 1, maximum: 10, default: 5 } }, required: ["query"] },
  },
  {
    name: "get_crop_ranges",
    description: "Return the FAO EcoCrop temperature, rainfall and soil pH ranges and growing cycle of one crop (by English name or id, for example rice, lentil, mustard).",
    inputSchema: { type: "object", properties: { crop: { type: "string", description: "Crop name or id" } }, required: ["crop"] },
  },
  {
    name: "list_crops",
    description: "List every crop that has EcoCrop ranges in EarthEcho, with its group.",
    inputSchema: { type: "object", properties: {} },
  },
];

const text = (t) => ({ content: [{ type: "text", text: t }] });

function callTool(name, args = {}) {
  if (name === "search_knowledge") {
    const q = String(args.query || "").slice(0, 300);
    if (q.length < 2) return { ...text("Give a question or some keywords."), isError: true };
    const k = Math.min(10, Math.max(1, Number(args.limit) || 5));
    const hits = search(INDEX, q, k);
    if (!hits.length) return text("No matching knowledge. Ask the local agriculture extension officer.");
    return text(hits.map((d, i) => `[${i + 1}] ${d.title}\nSource: ${d.url}\n${d.text}`).join("\n\n"));
  }
  if (name === "get_crop_ranges") {
    const key = String(args.crop || "").trim().toLowerCase();
    const c = crops.find((x) => x.id === key || String(x.en).toLowerCase() === key || String(x.bn || "").includes(key));
    if (!c) return { ...text(`No crop called "${args.crop}". Use list_crops to see the names.`), isError: true };
    const [a, b, d, e] = c.t, [r1, r2, r3, r4] = c.r, [p1, p2, p3, p4] = c.ph;
    return text(`${c.en} (${c.bn}), ${c.sci}, family ${c.family}, group ${c.group}. Growing cycle ${c.gmin} to ${c.gmax} days. Temperature: survives ${a} to ${e} °C, best ${b} to ${d} °C. Rainfall in the cycle: ${r1} to ${r4} mm, best ${r2} to ${r3} mm. Soil pH: ${p1} to ${p4}, best ${p2} to ${p3}. Source: FAO EcoCrop (expert opinion ranges).`);
  }
  if (name === "list_crops") return text(crops.map((c) => `${c.en} (${c.group})`).join(", "));
  return null;
}

function handle(msg) {
  const { id, method, params } = msg;
  const ok = (result) => ({ jsonrpc: "2.0", id, result });
  const fail = (code, message) => ({ jsonrpc: "2.0", id, error: { code, message } });
  if (method === "initialize") return ok({ protocolVersion: params?.protocolVersion || "2024-11-05", capabilities: { tools: {} }, serverInfo: SERVER });
  if (method === "ping") return ok({});
  if (method === "tools/list") return ok({ tools: TOOLS });
  if (method === "tools/call") {
    const out = callTool(params?.name, params?.arguments);
    return out ? ok(out) : fail(-32602, `Unknown tool: ${params?.name}`);
  }
  if (id === undefined) return null; // notifications (for example notifications/initialized) need no reply
  return fail(-32601, `Method not found: ${method}`);
}

createInterface({ input: process.stdin }).on("line", (line) => {
  if (!line.trim()) return;
  let msg;
  try { msg = JSON.parse(line); } catch { return process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }) + "\n"); }
  const reply = handle(msg);
  if (reply) process.stdout.write(JSON.stringify(reply) + "\n");
});
