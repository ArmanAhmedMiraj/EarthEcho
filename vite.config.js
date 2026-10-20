import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// While you work on your own computer, this runs the files in the /api folder
// the same way Vercel runs them online, so the app can call /api/... in both places.
function localApi() {
  return {
    name: "local-api",
    configureServer(server) {
      server.middlewares.use("/api", async (req, res, next) => {
        const url = new URL(req.url, "http://localhost");
        const name = url.pathname.replace(/^\//, "");
        if (!/^[a-z0-9-]+$/.test(name)) return next(); // only plain file names, never paths
        let mod;
        try {
          mod = await server.ssrLoadModule(`/api/${name}.js`);
        } catch {
          res.statusCode = 404;
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ ok: false, error: "No such API" }));
          return;
        }
        // a JSON body, as Vercel gives it to the API
        if (req.method === "POST") {
          const chunks = [];
          for await (const chunk of req) chunks.push(chunk);
          const raw = Buffer.concat(chunks).toString("utf8");
          try { req.body = raw ? JSON.parse(raw) : {}; } catch { req.body = {}; }
        }
        // the small helpers Vercel adds to every request and response
        req.query = Object.fromEntries(url.searchParams);
        res.status = (code) => {
          res.statusCode = code;
          return res;
        };
        res.json = (body) => {
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify(body));
        };
        try {
          await mod.default(req, res);
        } catch (error) {
          res.statusCode = 500;
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ ok: false, error: String(error && error.message) }));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // secret keys for the local API (for example GEMINI_API_KEY) are read from the file .env.local, which is never committed
  const env = loadEnv(mode, process.cwd(), "");
  for (const [k, v] of Object.entries(env)) if (process.env[k] === undefined) process.env[k] = v;
  return { plugins: [react(), localApi()] };
});
