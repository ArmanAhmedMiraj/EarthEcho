// Offline check of the knowledge MCP server: handshake, tool list and two tool calls. Exits with an error if anything is wrong.
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import path from "node:path";

const file = path.join(path.dirname(fileURLToPath(import.meta.url)), "earthecho-mcp.js");
const child = spawn(process.execPath, [file], { stdio: ["pipe", "pipe", "inherit"] });
const waiting = new Map();
let id = 0;
createInterface({ input: child.stdout }).on("line", (l) => { const m = JSON.parse(l); waiting.get(m.id)?.(m); });
const call = (method, params) => new Promise((resolve) => { const n = ++id; waiting.set(n, resolve); child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: n, method, params }) + "\n"); });
const must = (cond, msg) => { if (!cond) { console.error("FAIL:", msg); child.kill(); process.exit(1); } console.log("ok:", msg); };

const init = await call("initialize", { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "smoke-test", version: "1" } });
must(init.result?.serverInfo?.name === "earthecho-knowledge", "initialize returns the server name");
const list = await call("tools/list");
must(list.result.tools.length === 3, "three tools are listed");
const crop = await call("tools/call", { name: "get_crop_ranges", arguments: { crop: "lentil" } });
must(/Lentil/.test(crop.result.content[0].text), "get_crop_ranges finds lentil");
const found = await call("tools/call", { name: "search_knowledge", arguments: { query: "when to spray wind rain" } });
must(/spray/i.test(found.result.content[0].text), "search_knowledge finds the spray rule");
child.kill();
