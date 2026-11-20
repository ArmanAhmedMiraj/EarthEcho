# AGENTS.md

Conventions for any AI coding agent working in this repository.

- Stack: React 19 + Vite front end, MapLibre for maps, Vercel serverless functions in `api/` (Hobby plan: at most 12 functions, so shared code lives in `api/_lib/`).
- Language: every screen exists in English and Bengali (`src/i18n*.js`). Add both when you add text.
- Honesty rule: every number shows its source and whether it was entered, assumed or estimated. Never add a yield or income forecast.
- Assistant (`api/assistant.js`): answers only from FARM DATA and KNOWLEDGE, cites `[S1]` tags, keys stay in server environment variables.
- Knowledge base: `api/_lib/knowledge.js` (topics) and `api/_lib/ecocrop.js` (crop ranges). Search is BM25 in `api/_lib/retrieve.js`.
- MCP server: `mcp/earthecho-mcp.js` exposes the same knowledge base.
- Checks before a commit: `npm run build`, and `python data-tools/test_farm_data.py` for the data tests.
- Small commits, one change each, written by the person committing.
