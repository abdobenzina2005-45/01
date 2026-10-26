const CACHE_NAME = "al-mosaly-shell-v1";
const CORE_FILES = [
  "/", "/index.html",
  "/feature-backgrounds/adhkar.svg", "/feature-backgrounds/calendar.svg",
  "/feature-backgrounds/charity.svg", "/feature-backgrounds/deeds.svg",
  "/feature-backgrounds/dua.svg", "/feature-backgrounds/fortress.svg",
  "/feature-backgrounds/history.svg", "/feature-backgrounds/memorization.svg",
  "/feature-backgrounds/mosques.svg", "/feature-backgrounds/qibla.svg",
  "/feature-backgrounds/questions.svg", "/feature-backgrounds/quran.svg",
  "/feature-backgrounds/settings.svg", "/feature-backgrounds/tasbeeh.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    const responses = await Promise.all(CORE_FILES.map(async (url) => {
      try {
        const response = await fetch(url, { cache: "reload" });
        if (response.ok) await cache.put(url, response.clone());
        if (url === "/") return response;
        return null;
      } catch {
        return null;
      }
    }));
    const htmlResponse = responses[0];
    if (htmlResponse?.ok) {
      const html = await htmlResponse.clone().text();
      const assets = new Set(Array.from(html.matchAll(/(?:src|href)=["']([^"']+\.(?:js|css)(?:\?[^"']*)?)["']/g), (match) => match[1]));
      await Promise.all(Array.from(assets).map(async (asset) => {
        try {
          const response = await fetch(asset, { cache: "reload" });
          if (response.ok) await cache.put(asset, response.clone());
        } catch { /* The main shell remains usable if an optional asset is unavailable. */ }
      }));
    }
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => name.startsWith("al-mosaly-shell-") && name !== CACHE_NAME).map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/map-tiles/") || url.pathname.startsWith("/map-search/")) return;

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put("/index.html", response.clone());
          await cache.put("/", response.clone());
        }
        return response;
      } catch {
        const cache = await caches.open(CACHE_NAME);
        return (await cache.match(request)) ?? (await cache.match("/index.html")) ?? (await cache.match("/"));
      }
    })());
    return;
  }

  const isCodeAsset = request.destination === "script" || request.destination === "style" || request.destination === "worker" || request.destination === "font";
  if (!isCodeAsset) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  })());
});
