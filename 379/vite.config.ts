import { jsxLocPlugin } from "@builder.io/vite-plugin-jsx-loc";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";
import { defineConfig, type Plugin, type ViteDevServer } from "vite";
import { vitePluginManusRuntime } from "vite-plugin-manus-runtime";

// =============================================================================
// Manus Debug Collector - Vite Plugin
// Writes browser logs directly to files, trimmed when exceeding size limit
// =============================================================================

const PROJECT_ROOT = import.meta.dirname;
const LOG_DIR = path.join(PROJECT_ROOT, ".manus-logs");
const MAX_LOG_SIZE_BYTES = 1 * 1024 * 1024; // 1MB per log file
const TRIM_TARGET_BYTES = Math.floor(MAX_LOG_SIZE_BYTES * 0.6); // Trim to 60% to avoid constant re-trimming

type LogSource = "browserConsole" | "networkRequests" | "sessionReplay";

function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

function trimLogFile(logPath: string, maxSize: number) {
  try {
    if (!fs.existsSync(logPath) || fs.statSync(logPath).size <= maxSize) {
      return;
    }

    const lines = fs.readFileSync(logPath, "utf-8").split("\n");
    const keptLines: string[] = [];
    let keptBytes = 0;

    // Keep newest lines (from end) that fit within 60% of maxSize
    const targetSize = TRIM_TARGET_BYTES;
    for (let i = lines.length - 1; i >= 0; i--) {
      const lineBytes = Buffer.byteLength(`${lines[i]}\n`, "utf-8");
      if (keptBytes + lineBytes > targetSize) break;
      keptLines.unshift(lines[i]);
      keptBytes += lineBytes;
    }

    fs.writeFileSync(logPath, keptLines.join("\n"), "utf-8");
  } catch {
    /* ignore trim errors */
  }
}

function writeToLogFile(source: LogSource, entries: unknown[]) {
  if (entries.length === 0) return;

  ensureLogDir();
  const logPath = path.join(LOG_DIR, `${source}.log`);

  // Format entries with timestamps
  const lines = entries.map((entry) => {
    const ts = new Date().toISOString();
    return `[${ts}] ${JSON.stringify(entry)}`;
  });

  // Append to log file
  fs.appendFileSync(logPath, `${lines.join("\n")}\n`, "utf-8");

  // Trim if exceeds max size
  trimLogFile(logPath, MAX_LOG_SIZE_BYTES);
}

/**
 * Vite plugin to collect browser debug logs
 * - POST /__manus__/logs: Browser sends logs, written directly to files
 * - Files: browserConsole.log, networkRequests.log, sessionReplay.log
 * - Auto-trimmed when exceeding 1MB (keeps newest entries)
 */
function vitePluginManusDebugCollector(): Plugin {
  return {
    name: "manus-debug-collector",

    transformIndexHtml(html) {
      if (process.env.NODE_ENV === "production") {
        return html;
      }
      return {
        html,
        tags: [
          {
            tag: "script",
            attrs: {
              src: "/__manus__/debug-collector.js",
              defer: true,
            },
            injectTo: "head",
          },
        ],
      };
    },

    configureServer(server: ViteDevServer) {
      // POST /__manus__/logs: Browser sends logs (written directly to files)
      server.middlewares.use("/__manus__/logs", (req, res, next) => {
        if (req.method !== "POST") {
          return next();
        }

        const handlePayload = (payload: any) => {
          // Write logs directly to files
          if (payload.consoleLogs?.length > 0) {
            writeToLogFile("browserConsole", payload.consoleLogs);
          }
          if (payload.networkRequests?.length > 0) {
            writeToLogFile("networkRequests", payload.networkRequests);
          }
          if (payload.sessionEvents?.length > 0) {
            writeToLogFile("sessionReplay", payload.sessionEvents);
          }

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true }));
        };

        const reqBody = (req as { body?: unknown }).body;
        if (reqBody && typeof reqBody === "object") {
          try {
            handlePayload(reqBody);
          } catch (e) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: false, error: String(e) }));
          }
          return;
        }

        let body = "";
        req.on("data", (chunk) => {
          body += chunk.toString();
        });

        req.on("end", () => {
          try {
            const payload = JSON.parse(body);
            handlePayload(payload);
          } catch (e) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: false, error: String(e) }));
          }
        });
      });
    },
  };
}

let nextWalkingRouteRequestAt = 0;
let walkingRouteQueue: Promise<unknown> = Promise.resolve();

function withWalkingRouteRateLimit<T>(request: () => Promise<T>): Promise<T> {
  const task = walkingRouteQueue.then(async () => {
    const delay = Math.max(0, nextWalkingRouteRequestAt - Date.now());
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
    nextWalkingRouteRequestAt = Date.now() + 1100;
    return request();
  });
  walkingRouteQueue = task.then(() => undefined, () => undefined);
  return task;
}

function vitePluginOpenFreeMapProxy(): Plugin {
  return {
    name: "al-mosaly-map-proxy",
    configureServer(server: ViteDevServer) {
      server.middlewares.use("/map-tiles", async (req, res, next) => {
        if (req.method !== "GET") return next();
        try {
          const upstream = new URL((req.url ?? "").replace(/^\/+/, ""), "https://tiles.openfreemap.org/");
          if (upstream.origin !== "https://tiles.openfreemap.org") {
            res.writeHead(400, { "Content-Type": "text/plain" });
            res.end("Invalid map resource");
            return;
          }
          const referer = req.headers.referer;
          const response = await fetch(upstream, {
            headers: {
              "User-Agent": "AlMosalyPrayer/1.0",
              ...(referer ? { Referer: referer } : {}),
              Accept: req.headers.accept ?? "*/*",
            },
          });
          const headers: Record<string, string> = {
            "Content-Type": response.headers.get("content-type") ?? "application/octet-stream",
            "Access-Control-Allow-Origin": "*",
          };
          for (const name of ["cache-control", "expires", "etag", "last-modified"]) {
            const value = response.headers.get(name);
            if (value) headers[name] = value;
          }
          res.writeHead(response.status, headers);
          res.end(Buffer.from(await response.arrayBuffer()));
        } catch {
          res.writeHead(502, { "Content-Type": "text/plain" });
          res.end("Map provider is currently unavailable");
        }
      });
      server.middlewares.use("/map-search/mosques", (req, res, next) => {
        if (req.method !== "POST") return next();
        const chunks: Buffer[] = [];
        req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        req.on("end", async () => {
          try {
            const body = Buffer.concat(chunks);
            let response: Response | undefined;
            for (const endpoint of ["https://maps.mail.ru/osm/tools/overpass/api/interpreter", "https://overpass.private.coffee/api/interpreter", "https://overpass-api.de/api/interpreter"]) {
              try {
                response = await fetch(endpoint, {
                  method: "POST",
                  headers: {
                    "User-Agent": "AlMosalyPrayer/1.0",
                    "Content-Type": req.headers["content-type"] ?? "application/x-www-form-urlencoded;charset=UTF-8",
                    Accept: "application/json",
                  },
                  body,
                });
                if (response.ok || response.status < 500) break;
              } catch { /* Try the next public endpoint. */ }
            }
            if (!response) throw new Error("No Overpass endpoint responded");
            res.writeHead(response.status, { "Content-Type": response.headers.get("content-type") ?? "application/json" });
            res.end(Buffer.from(await response.arrayBuffer()));
          } catch {
            res.writeHead(502, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Overpass is currently unavailable" }));
          }
        });
      });
      server.middlewares.use("/map-route/walking", (req, res, next) => {
        if (req.method !== "POST") return next();
        const chunks: Buffer[] = [];
        let bodySize = 0;
        req.on("data", (chunk) => {
          bodySize += chunk.length;
          if (bodySize > 2048) {
            res.writeHead(413, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Route request too large" }));
            req.destroy();
            return;
          }
          chunks.push(Buffer.from(chunk));
        });
        req.on("end", async () => {
          if (res.writableEnded) return;
          try {
            const payload = JSON.parse(Buffer.concat(chunks).toString("utf8")) as {
              from?: { lat?: unknown; lon?: unknown };
              to?: { lat?: unknown; lon?: unknown };
            };
            const validPoint = (point: typeof payload.from) => Boolean(point)
              && typeof point?.lat === "number" && Number.isFinite(point.lat) && Math.abs(point.lat) <= 90
              && typeof point?.lon === "number" && Number.isFinite(point.lon) && Math.abs(point.lon) <= 180;
            if (!validPoint(payload.from) || !validPoint(payload.to)) {
              res.writeHead(400, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "Invalid route coordinates" }));
              return;
            }
            const { from, to } = payload as { from: { lat: number; lon: number }; to: { lat: number; lon: number } };
            const upstreamUrl = `https://routing.openstreetmap.de/routed-foot/route/v1/driving/${from.lon},${from.lat};${to.lon},${to.lat}?overview=full&geometries=geojson&steps=false`;
            const upstream = await withWalkingRouteRateLimit(() => fetch(upstreamUrl, {
              headers: {
                "User-Agent": "AlMosalyPrayer/1.0",
                ...(req.headers.referer ? { Referer: req.headers.referer } : {}),
                Accept: "application/json",
              },
              signal: AbortSignal.timeout(20000),
            }));
            res.writeHead(upstream.status, { "Content-Type": upstream.headers.get("content-type") ?? "application/json", "Cache-Control": "no-store" });
            res.end(Buffer.from(await upstream.arrayBuffer()));
          } catch {
            if (!res.writableEnded) {
              res.writeHead(502, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "Walking route service is currently unavailable" }));
            }
          }
        });
      });
    },
  };
}

function vitePluginStorageProxy(): Plugin {
  return {
    name: "manus-storage-proxy",
    configureServer(server: ViteDevServer) {
      server.middlewares.use("/manus-storage", async (req, res) => {
        const key = req.url?.replace(/^\//, "");
        if (!key) {
          res.writeHead(400, { "Content-Type": "text/plain" });
          res.end("Missing storage key");
          return;
        }

        const forgeBaseUrl = (process.env.BUILT_IN_FORGE_API_URL || "").replace(/\/+$/, "");
        const forgeKey = process.env.BUILT_IN_FORGE_API_KEY;

        if (!forgeBaseUrl || !forgeKey) {
          res.writeHead(500, { "Content-Type": "text/plain" });
          res.end("Storage proxy not configured");
          return;
        }

        try {
          const forgeUrl = new URL("v1/storage/presign/get", forgeBaseUrl + "/");
          forgeUrl.searchParams.set("path", key);

          const forgeResp = await fetch(forgeUrl, {
            headers: { Authorization: `Bearer ${forgeKey}` },
          });

          if (!forgeResp.ok) {
            res.writeHead(502, { "Content-Type": "text/plain" });
            res.end("Storage backend error");
            return;
          }

          const { url } = (await forgeResp.json()) as { url: string };
          if (!url) {
            res.writeHead(502, { "Content-Type": "text/plain" });
            res.end("Empty signed URL");
            return;
          }

          res.writeHead(307, { Location: url, "Cache-Control": "no-store" });
          res.end();
        } catch {
          res.writeHead(502, { "Content-Type": "text/plain" });
          res.end("Storage proxy error");
        }
      });
    },
  };
}

const plugins = [react(), tailwindcss(), jsxLocPlugin(), vitePluginManusRuntime(), vitePluginManusDebugCollector(), vitePluginStorageProxy(), vitePluginOpenFreeMapProxy()];

export default defineConfig({
  plugins,
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    port: 3000,
    strictPort: false, // Will find next available port if 3000 is busy
    host: true,
    allowedHosts: [
      ".manuspre.computer",
      ".manus.computer",
      ".manus-asia.computer",
      ".manuscomputer.ai",
      ".manusvm.computer",
      "localhost",
      "127.0.0.1",
    ],
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
