import { defineConfig } from "vite";
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

export default defineConfig({
  plugins: [react(), localApi()],
});