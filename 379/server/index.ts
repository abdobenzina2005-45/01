import express from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

async function startServer() {
  const app = express();
  const server = createServer(app);

  // Serve static files from dist/public in production
  const staticPath =
    process.env.NODE_ENV === "production"
      ? path.resolve(__dirname, "public")
      : path.resolve(__dirname, "..", "dist", "public");

  app.get("/map-tiles/*", async (req, res) => {
    try {
      const relativePath = req.originalUrl.replace(/^\/map-tiles\/?/, "");
      const upstream = new URL(relativePath, "https://tiles.openfreemap.org/");
      if (upstream.origin !== "https://tiles.openfreemap.org") {
        res.status(400).type("text/plain").send("Invalid map resource");
        return;
      }
      const referer = req.get("referer");
      const response = await fetch(upstream, {
        headers: {
          "User-Agent": "AlMosalyPrayer/1.0",
          ...(referer ? { Referer: referer } : {}),
          Accept: req.get("accept") ?? "*/*",
        },
      });
      res.status(response.status);
      res.setHeader("Content-Type", response.headers.get("content-type") ?? "application/octet-stream");
      for (const name of ["cache-control", "expires", "etag", "last-modified"]) {
        const value = response.headers.get(name);
        if (value) res.setHeader(name, value);
      }
      res.send(Buffer.from(await response.arrayBuffer()));
    } catch {
      res.status(502).type("text/plain").send("Map provider is currently unavailable");
    }
  });

  app.post("/map-search/mosques", express.raw({ type: "application/x-www-form-urlencoded", limit: "64kb" }), async (req, res) => {
    try {
      const body = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
      let response: Response | undefined;
      for (const endpoint of ["https://maps.mail.ru/osm/tools/overpass/api/interpreter", "https://overpass.private.coffee/api/interpreter", "https://overpass-api.de/api/interpreter"]) {
        try {
          response = await fetch(endpoint, {
            method: "POST",
            headers: {
              "User-Agent": "AlMosalyPrayer/1.0",
              "Content-Type": req.get("content-type") ?? "application/x-www-form-urlencoded;charset=UTF-8",
              Accept: "application/json",
            },
            body,
          });
          if (response.ok || response.status < 500) break;
        } catch { /* Try the next public endpoint. */ }
      }
      if (!response) throw new Error("No Overpass endpoint responded");
      res.status(response.status);
      res.setHeader("Content-Type", response.headers.get("content-type") ?? "application/json");
      res.send(Buffer.from(await response.arrayBuffer()));
    } catch {
      res.status(502).json({ error: "Overpass is currently unavailable" });
    }
  });

  app.post("/map-route/walking", express.json({ limit: "2kb" }), async (req, res) => {
    try {
      const payload = req.body as { from?: { lat?: unknown; lon?: unknown }; to?: { lat?: unknown; lon?: unknown } };
      const validPoint = (point: typeof payload.from) => Boolean(point)
        && typeof point?.lat === "number" && Number.isFinite(point.lat) && Math.abs(point.lat) <= 90
        && typeof point?.lon === "number" && Number.isFinite(point.lon) && Math.abs(point.lon) <= 180;
      if (!validPoint(payload.from) || !validPoint(payload.to)) {
        res.status(400).json({ error: "Invalid route coordinates" });
        return;
      }
      const { from, to } = payload as { from: { lat: number; lon: number }; to: { lat: number; lon: number } };
      const upstreamUrl = `https://routing.openstreetmap.de/routed-foot/route/v1/driving/${from.lon},${from.lat};${to.lon},${to.lat}?overview=full&geometries=geojson&steps=false`;
      const upstream = await withWalkingRouteRateLimit(() => fetch(upstreamUrl, {
        headers: {
          "User-Agent": "AlMosalyPrayer/1.0",
          ...(req.get("referer") ? { Referer: req.get("referer")! } : {}),
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(20000),
      }));
      res.status(upstream.status);
      res.setHeader("Content-Type", upstream.headers.get("content-type") ?? "application/json");
      res.setHeader("Cache-Control", "no-store");
      res.send(Buffer.from(await upstream.arrayBuffer()));
    } catch {
      res.status(502).json({ error: "Walking route service is currently unavailable" });
    }
  });

  app.use(express.static(staticPath));

  // Handle client-side routing - serve index.html for all routes
  app.get("*", (_req, res) => {
    res.sendFile(path.join(staticPath, "index.html"));
  });

  const port = process.env.PORT || 3000;

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
