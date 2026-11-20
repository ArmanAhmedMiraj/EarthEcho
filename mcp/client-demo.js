// A small MCP client: starts each EarthEcho MCP server as a child process over stdio,
// performs the MCP handshake, lists its tools and calls one tool per server.
// Run: node mcp/client-demo.js
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const RUNS = [
  ["earthecho-live-mcp.js", "get_soil", { lat: 24.78, lon: 89.31 }],
  ["earthecho-market-mcp.js", "get_market_prices", { lat: 24.78, lon: 89.31, country: "BD" }],
  ["earthecho-mcp.js", "get_crop_ranges", { crop: "lentil" }],
];

function connect(file) {
  const child = spawn(process.execPath, [path.join(dir, file)], { stdio: ["pipe", "pipe", "inherit"] });
  const waiting = new Map();
  let id = 0;
  createInterface({ input: child.stdout }).on("line", (l) => { const m = JSON.parse(l); waiting.get(m.id)?.(m); });
  const call = (method, params) => new Promise((resolve) => { const n = ++id; waiting.set(n, resolve); child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: n, method, params }) + "\n"); });
  return { call, close: () => child.kill() };
}

for (const [file, tool, args] of RUNS) {
  const c = connect(file);
  const init = await c.call("initialize", { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "earthecho-demo-client", version: "1.0.0" } });
  const list = await c.call("tools/list");
  const out = await c.call("tools/call", { name: tool, arguments: args });
  console.log(`\n== ${init.result.serverInfo.name}: tools = ${list.result.tools.map((t) => t.name).join(", ")}`);
  console.log(`   ${tool} ->`, out.result.content[0].text.slice(0, 160).replace(/\s+/g, " "));
  c.close();
}
