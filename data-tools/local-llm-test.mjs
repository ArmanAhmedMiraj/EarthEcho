// Runs the assistant's retrieval and prompt against a LOCAL open-weight model served by Ollama, and prints the answer, the model,
// the time and the sources. Proves the local path works without any cloud key.
// Setup: install Ollama (https://ollama.com), then run:  ollama pull llama3.2:3b
// Run:   node data-tools/local-llm-test.mjs "When should I spray?"   (OLLAMA_URL and OLLAMA_MODEL are optional)
import { DOCS } from "../api/_lib/knowledge.js";
import { buildIndex, search } from "../api/_lib/retrieve.js";

const base = (process.env.OLLAMA_URL || "http://localhost:11434").replace(/\/$/, "");
const model = process.env.OLLAMA_MODEL || "llama3.2:3b";
const question = process.argv.slice(2).join(" ") || "When is a good time to spray my crop?";
const found = search(buildIndex(DOCS), question, 5);
const knowledge = found.map((d, i) => `[S${i + 1}] ${d.title}\n${d.text}`).join("\n\n");
const system = "You are EarthEcho's farming assistant. Answer ONLY from KNOWLEDGE. If it does not contain the answer, say you do not have that information. Cite sources like [S1]. At most 120 words, short plain sentences.";
const t0 = Date.now();
const r = await fetch(`${base}/v1/chat/completions`, {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ model, temperature: 0.3, max_tokens: 400, messages: [{ role: "system", content: system }, { role: "user", content: `KNOWLEDGE:\n${knowledge}\n\nQUESTION:\n${question}` }] }),
}).catch(() => null);
if (!r) { console.error(`Cannot reach Ollama at ${base}. Start it (open the Ollama app) and run: ollama pull ${model}`); process.exit(1); }
if (!r.ok) { console.error(`Ollama answered ${r.status}. Is it running and is the model pulled? (${model})`); process.exit(1); }
const j = await r.json();
console.log(`Model: ${model} (local, via Ollama)\nTime: ${((Date.now() - t0) / 1000).toFixed(1)} s\nSources: ${found.map((d) => d.title).join(" | ")}\n\n${j.choices[0].message.content}`);
