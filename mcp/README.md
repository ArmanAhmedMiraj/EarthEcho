# EarthEcho MCP server

A small Model Context Protocol server (stdio, JSON-RPC 2.0, no extra packages) that exposes EarthEcho's farming knowledge base to any MCP client.

Tools: `search_knowledge` (BM25 search with source URLs), `get_crop_ranges` (FAO EcoCrop ranges of one crop), `list_crops`.

Run it: `node mcp/earthecho-mcp.js`

Client config example:

```json
{ "mcpServers": { "earthecho": { "command": "node", "args": ["mcp/earthecho-mcp.js"] } } }
```

It reuses `api/_lib/knowledge.js`, `retrieve.js` and `ecocrop.js`, the same code the in-app assistant uses.

## Second server: live plot data

`node mcp/earthecho-live-mcp.js` serves live data for a latitude and longitude by calling EarthEcho's own public API (set `EARTHECHO_API` to use another deployment).

Tools: `get_soil`, `get_environment`, `get_hazards`, `get_dry_spell`.

```json
{ "mcpServers": { "earthecho-live": { "command": "node", "args": ["mcp/earthecho-live-mcp.js"] } } }
```

## Third server and a client

`node mcp/earthecho-market-mcp.js` serves nearby market prices (`get_market_prices`, `list_supported_countries`).

`node mcp/client-demo.js` is a small MCP client that starts all three servers over stdio, performs the handshake, lists their tools and calls one tool on each.
