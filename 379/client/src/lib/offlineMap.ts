import type { CitySchedule } from "@/lib/prayerTimes";

export const MAP_STYLE_PATH = "/map-tiles/styles/liberty";
const DB_NAME = "al-mosaly-offline-maps";
const DB_VERSION = 1;
const RESOURCE_STORE = "resources";
const CITY_STORE = "cities";
const PROVIDER_ORIGIN = "https://tiles.openfreemap.org";
const MAX_OFFLINE_TILES = 3000;
const MAX_OFFLINE_BYTES = 50 * 1024 * 1024;

type StoredResource = { key: string; data: ArrayBuffer; bytes: number; savedAt: number };
export type OfflineCity = {
  cityKey: string;
  city: string;
  country: string;
  bounds: [number, number, number, number];
  minZoom: number;
  maxZoom: number;
  tileCount: number;
  bytes: number;
  savedAt: number;
};
export type OfflineProgress = { completed: number; total: number; bytes: number; maxZoom: number };
export type OSMPoint = { id: string; name: string; lat: number; lon: number; tags?: Record<string, string> };

type NominatimResult = {
  osm_type?: string;
  osm_id?: number;
  category?: string;
  type?: string;
  class?: string;
  lat?: string;
  lon?: string;
  boundingbox?: [string, string, string, string];
  geojson?: { type: string; coordinates: unknown };
  display_name?: string;
};
type TileJson = { tiles?: string[]; minzoom?: number; maxzoom?: number };
type StyleJson = {
  sources?: Record<string, { url?: string; tiles?: string[] }>;
  sprite?: string;
  glyphs?: string;
  layers?: Array<{ layout?: { "text-font"?: unknown } }>;
};

let databasePromise: Promise<IDBDatabase> | null = null;

function database(): Promise<IDBDatabase> {
  if (!("indexedDB" in window)) return Promise.reject(new Error("هذا المتصفح لا يدعم حفظ الخرائط دون اتصال."));
  if (databasePromise) return databasePromise;
  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(RESOURCE_STORE)) db.createObjectStore(RESOURCE_STORE, { keyPath: "key" });
      if (!db.objectStoreNames.contains(CITY_STORE)) db.createObjectStore(CITY_STORE, { keyPath: "cityKey" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("تعذر فتح مساحة حفظ الخرائط."));
  });
  return databasePromise;
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("تعذر قراءة بيانات الخريطة."));
  });
}

export function offlineCityKey(city: Pick<CitySchedule, "city" | "country">): string {
  return `${city.country.trim().toLocaleLowerCase()}::${city.city.trim().toLocaleLowerCase()}`;
}

export function toProxyPath(url: string): string | null {
  try {
    const parsed = new URL(url, window.location.origin);
    if (parsed.origin === window.location.origin && parsed.pathname.startsWith("/map-tiles/")) {
      return `${parsed.pathname}${parsed.search}`;
    }
    if (parsed.origin === PROVIDER_ORIGIN) {
      return `/map-tiles${parsed.pathname}${parsed.search}`;
    }
  } catch {
    return null;
  }
  return null;
}

export async function getCachedResource(key: string): Promise<ArrayBuffer | undefined> {
  const db = await database();
  const tx = db.transaction(RESOURCE_STORE, "readonly");
  const row = await requestResult(tx.objectStore(RESOURCE_STORE).get(key) as IDBRequest<StoredResource | undefined>);
  return row?.data;
}

export async function storeCachedResource(key: string, data: ArrayBuffer): Promise<void> {
  const db = await database();
  const tx = db.transaction(RESOURCE_STORE, "readwrite");
  tx.objectStore(RESOURCE_STORE).put({ key, data, bytes: data.byteLength, savedAt: Date.now() } satisfies StoredResource);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("تعذر حفظ بلاطات الخريطة."));
    tx.onabort = () => reject(tx.error ?? new Error("أُلغي حفظ بلاطات الخريطة."));
  });
}

export async function getOfflineCity(city: Pick<CitySchedule, "city" | "country">): Promise<OfflineCity | undefined> {
  const db = await database();
  const tx = db.transaction(CITY_STORE, "readonly");
  return requestResult(tx.objectStore(CITY_STORE).get(offlineCityKey(city)) as IDBRequest<OfflineCity | undefined>);
}

async function saveOfflineCity(record: OfflineCity): Promise<void> {
  const db = await database();
  const tx = db.transaction(CITY_STORE, "readwrite");
  tx.objectStore(CITY_STORE).put(record);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("تعذر حفظ معلومات المدينة."));
    tx.onabort = () => reject(tx.error ?? new Error("أُلغي حفظ معلومات المدينة."));
  });
}

function providerProxyUrl(path: string): string {
  return `${window.location.origin}${path}`;
}

async function downloadResource(path: string, signal?: AbortSignal): Promise<ArrayBuffer> {
  const response = await fetch(providerProxyUrl(path), { signal, headers: { Accept: "application/json, application/x-protobuf, image/png, */*" } });
  if (!response.ok) throw new Error(`تعذر تنزيل عنصر من الخريطة (${response.status}).`);
  const data = await response.arrayBuffer();
  await storeCachedResource(path, data);
  return data;
}

function lonToTileX(lon: number, zoom: number): number {
  return Math.max(0, Math.min((2 ** zoom) - 1, Math.floor(((lon + 180) / 360) * (2 ** zoom))));
}
function latToTileY(lat: number, zoom: number): number {
  const limited = Math.max(-85.05112878, Math.min(85.05112878, lat));
  const radians = limited * Math.PI / 180;
  return Math.max(0, Math.min((2 ** zoom) - 1, Math.floor((1 - Math.asinh(Math.tan(radians)) / Math.PI) / 2 * (2 ** zoom))));
}
type TileCoordinate = { z: number; x: number; y: number };
function tilesForBounds(bounds: [number, number, number, number], zoom: number): TileCoordinate[] {
  const [south, west, north, east] = bounds;
  const xMin = lonToTileX(west, zoom);
  const xMax = lonToTileX(east, zoom);
  const yMin = latToTileY(north, zoom);
  const yMax = latToTileY(south, zoom);
  const result: TileCoordinate[] = [];
  for (let x = xMin; x <= xMax; x += 1) {
    for (let y = yMin; y <= yMax; y += 1) result.push({ z: zoom, x, y });
  }
  return result;
}

async function findCityBoundary(city: Pick<CitySchedule, "city" | "country">): Promise<{ result: NominatimResult; bounds: [number, number, number, number] }> {
  const query = new URLSearchParams({ q: `${city.city}, ${city.country}`, format: "jsonv2", polygon_geojson: "1", polygon_threshold: "0.001", addressdetails: "1", limit: "5" });
  const response = await fetch(`https://nominatim.openstreetmap.org/search?${query.toString()}`, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error("تعذر تحديد حدود المدينة من خدمة البحث الجغرافي. أعد المحاولة لاحقًا.");
  const results = await response.json() as NominatimResult[];
  const result = results.find((item) => item.geojson && (item.class === "boundary" || item.type === "administrative"))
    ?? results.find((item) => item.geojson && (item.osm_type === "relation" || item.osm_type === "way"));
  if (!result?.boundingbox || !result.geojson || !result.osm_id || !result.osm_type) {
    throw new Error("لم أجد حدودًا إدارية قابلة للتنزيل لهذه المدينة. تحقق من اسم المدينة في إعدادات الموقع.");
  }
  const [south, north, west, east] = result.boundingbox.map(Number) as [number, number, number, number];
  if (![south, north, west, east].every(Number.isFinite) || north <= south || east <= west) {
    throw new Error("الحدود التي أعادها مصدر الخرائط غير صالحة.");
  }
  return { result, bounds: [south, west, north, east] };
}

function tileCountFor(bounds: [number, number, number, number], maxZoom: number): number {
  let count = 0;
  for (let zoom = 5; zoom <= maxZoom; zoom += 1) count += tilesForBounds(bounds, zoom).length;
  // Liberty uses a shaded raster base up to zoom 6 as well as vector tiles.
  count += tilesForBounds(bounds, 6).length;
  return count;
}

function chooseMaxZoom(bounds: [number, number, number, number]): { maxZoom: number; tileCount: number } {
  for (let maxZoom = 16; maxZoom >= 8; maxZoom -= 1) {
    const tileCount = tileCountFor(bounds, maxZoom);
    if (tileCount <= MAX_OFFLINE_TILES - 8) return { maxZoom, tileCount };
  }
  throw new Error("حدود المدينة واسعة جدًا لحزمة واحدة ضمن حد التنزيل المسموح. جرّب تنزيل مدينة أصغر أو استخدم خريطة عبر الإنترنت.");
}

function tilePath(template: string, tile: TileCoordinate): string {
  const url = template.replaceAll("{z}", String(tile.z)).replaceAll("{x}", String(tile.x)).replaceAll("{y}", String(tile.y));
  const path = toProxyPath(url);
  if (!path) throw new Error("مصدر بلاطات الخريطة غير مدعوم.");
  return path;
}

async function fetchJsonResource(path: string, signal?: AbortSignal): Promise<{ data: ArrayBuffer; json: Record<string, unknown> }> {
  const data = await downloadResource(path, signal);
  return { data, json: JSON.parse(new TextDecoder().decode(data)) as Record<string, unknown> };
}

function uniqueFontStacks(style: StyleJson): string[] {
  const stacks = new Set<string>();
  for (const layer of style.layers ?? []) {
    const font = layer.layout?.["text-font"];
    if (Array.isArray(font) && font.length > 0 && font.every((name) => typeof name === "string")) {
      stacks.add(font.join(","));
    }
  }
  return Array.from(stacks);
}

function enumerateTilePaths(bounds: [number, number, number, number], maxZoom: number, vectorTemplate: string, rasterTemplate?: string): string[] {
  const paths = new Set<string>();
  for (let zoom = 5; zoom <= maxZoom; zoom += 1) {
    for (const tile of tilesForBounds(bounds, zoom)) paths.add(tilePath(vectorTemplate, tile));
  }
  if (rasterTemplate) {
    for (const tile of tilesForBounds(bounds, 6)) paths.add(tilePath(rasterTemplate, tile));
  }
  return Array.from(paths);
}

async function fetchWithConcurrency(paths: string[], concurrency: number, signal: AbortSignal, initialBytes: number, onProgress: (bytes: number) => void): Promise<number> {
  let nextIndex = 0;
  let totalBytes = initialBytes;
  let failure: unknown;
  const workers = Array.from({ length: Math.min(concurrency, paths.length) }, async () => {
    while (!signal.aborted && !failure) {
      const index = nextIndex++;
      if (index >= paths.length) return;
      try {
        const response = await fetch(providerProxyUrl(paths[index]), { signal, headers: { Accept: "application/x-protobuf, image/png, */*" } });
        if (!response.ok) throw new Error(`رفض مزود الخرائط تنزيل بلاطة (${response.status}).`);
        const data = await response.arrayBuffer();
        if (totalBytes + data.byteLength > MAX_OFFLINE_BYTES) {
          failure = new Error("تجاوزت خريطة المدينة حد 50 ميغابايت المسموح به. خفّض التطبيق مستوى التكبير؛ جرّب مدينة أصغر.");
          return;
        }
        totalBytes += data.byteLength;
        await storeCachedResource(paths[index], data);
        onProgress(totalBytes);
      } catch (error) {
        if (!failure) failure = error;
        return;
      }
    }
  });
  await Promise.all(workers);
  if (signal.aborted) throw new DOMException("أُلغي تنزيل الخريطة.", "AbortError");
  if (failure) throw failure;
  return totalBytes;
}

export async function downloadOfflineCityMap(
  city: Pick<CitySchedule, "city" | "country">,
  signal: AbortSignal,
  onProgress: (progress: OfflineProgress) => void,
): Promise<OfflineCity> {
  const { result, bounds } = await findCityBoundary(city);
  const { maxZoom, tileCount } = chooseMaxZoom(bounds);
  const stylePath = MAP_STYLE_PATH;
  const { json: style } = await fetchJsonResource(stylePath, signal) as { data: ArrayBuffer; json: StyleJson };
  const vectorSource = Object.values(style.sources ?? {}).find((source) => source.url && source.url.includes("/planet"));
  const vectorJsonPath = vectorSource?.url ? toProxyPath(vectorSource.url) : null;
  if (!vectorJsonPath) throw new Error("تعذر تحديد مصدر البلاطات المتجهة في نمط الخريطة.");
  const { json: tileJson } = await fetchJsonResource(vectorJsonPath, signal) as { data: ArrayBuffer; json: TileJson };
  const vectorTemplate = tileJson.tiles?.[0];
  if (!vectorTemplate) throw new Error("لم يعثر التطبيق على قالب بلاطات المدينة.");

  let rasterTemplate: string | undefined;
  const rasterSource = Object.values(style.sources ?? {}).find((source) => source.tiles?.some((tile) => tile.endsWith(".png") && tile.includes("natural_earth")));
  if (rasterSource?.tiles?.[0]) rasterTemplate = rasterSource.tiles[0];
  const tilePaths = enumerateTilePaths(bounds, maxZoom, vectorTemplate, rasterTemplate);
  if (tilePaths.length > MAX_OFFLINE_TILES) throw new Error("تجاوزت حدود المدينة الحد الأقصى للبلاطات المسموح به.");

  // Cache the style assets required to render the downloaded vector tiles offline.
  const setupPaths = new Set<string>();
  if (style.sprite) {
    const spriteBase = toProxyPath(style.sprite);
    if (spriteBase) {
      for (const suffix of [".json", ".png", "@2x.json", "@2x.png"]) setupPaths.add(`${spriteBase}${suffix}`);
    }
  }
  if (style.glyphs) {
    const stacks = uniqueFontStacks(style);
    for (const stack of stacks) {
      for (const range of ["0-255", "1536-1791"]) {
        const glyphUrl = style.glyphs.replace("{fontstack}", encodeURIComponent(stack)).replace("{range}", range);
        const glyphPath = toProxyPath(glyphUrl);
        if (glyphPath) setupPaths.add(glyphPath);
      }
    }
  }
  let setupBytes = 0;
  for (const path of Array.from(setupPaths)) {
    if (signal.aborted) throw new DOMException("أُلغي تنزيل الخريطة.", "AbortError");
    const response = await fetch(providerProxyUrl(path), { signal, headers: { Accept: "application/json, application/x-protobuf, image/png, */*" } });
    if (!response.ok) continue;
    const data = await response.arrayBuffer();
    setupBytes += data.byteLength;
    if (setupBytes >= MAX_OFFLINE_BYTES) throw new Error("تجاوزت ملفات الخطوط والأنماط حد حجم التنزيل المسموح به.");
    await storeCachedResource(path, data);
  }

  let completed = 0;
  const downloadedBytes = await fetchWithConcurrency(tilePaths, 4, signal, setupBytes, (bytes) => {
    completed += 1;
    onProgress({ completed, total: tilePaths.length, bytes, maxZoom });
  });
  const record: OfflineCity = {
    cityKey: offlineCityKey(city), city: city.city, country: city.country, bounds,
    minZoom: 5, maxZoom, tileCount: tilePaths.length, bytes: downloadedBytes, savedAt: Date.now(),
  };
  await saveOfflineCity(record);
  try { await navigator.storage?.persist?.(); } catch { /* Persistence permission is optional. */ }
  // Keep boundary information with the city record so the map can frame it when opened offline.
  void result;
  onProgress({ completed: tilePaths.length, total: tilePaths.length, bytes: record.bytes, maxZoom });
  return record;
}

export async function fetchNearbyMosques(lat: number, lon: number, radius = 7000, signal?: AbortSignal): Promise<OSMPoint[]> {
  const query = `[out:json][timeout:25];(nwr["amenity"="place_of_worship"]["religion"="muslim"](around:${radius},${lat},${lon});nwr["building"="mosque"](around:${radius},${lat},${lon}););out center;`;
  const response = await fetch("/map-search/mosques", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8", Accept: "application/json" },
    body: new URLSearchParams({ data: query }), signal,
  });
  if (!response.ok) throw new Error("لم أتمكن من تحميل قائمة المساجد القريبة. تحقق من الاتصال ثم أعد المحاولة.");
  const result = await response.json() as { elements?: Array<{ id: number; type: string; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }> };
  const seen = new Set<string>();
  return (result.elements ?? []).flatMap((element) => {
    const coords = element.center ?? (element.lat !== undefined && element.lon !== undefined ? { lat: element.lat, lon: element.lon } : undefined);
    if (!coords) return [];
    const tags = element.tags ?? {};
    const name = tags.name || tags["name:ar"] || tags["name:en"] || "مسجد قريب";
    const key = `${element.type}/${element.id}`;
    const duplicateKey = `${name.trim().toLocaleLowerCase()}|${coords.lat.toFixed(4)}|${coords.lon.toFixed(4)}`;
    if (seen.has(duplicateKey)) return [];
    seen.add(duplicateKey);
    return [{ id: key, name, lat: coords.lat, lon: coords.lon, tags }];
  });
}

export type WalkingRoute = {
  coordinates: [number, number][];
  distance: number;
  duration: number;
};

type SavedWalkingRoute = { signature: string; route: WalkingRoute; savedAt: number };
const LAST_WALKING_ROUTE_KEY = "al-mosaly-last-walking-route";

function walkingRouteSignature(from: { lat: number; lon: number }, to: { lat: number; lon: number }): string {
  return [from.lat, from.lon, to.lat, to.lon].map((value) => value.toFixed(5)).join(":");
}

function readLastWalkingRoute(signature: string): SavedWalkingRoute | null {
  try {
    const saved = JSON.parse(localStorage.getItem(LAST_WALKING_ROUTE_KEY) ?? "null") as SavedWalkingRoute | null;
    if (!saved || saved.signature !== signature || !Array.isArray(saved.route?.coordinates)) return null;
    return saved;
  } catch { return null; }
}

export async function fetchWalkingRoute(
  from: { lat: number; lon: number },
  to: { lat: number; lon: number },
  signal?: AbortSignal,
): Promise<WalkingRoute> {
  const signature = walkingRouteSignature(from, to);
  const cached = readLastWalkingRoute(signature);
  if (!navigator.onLine) {
    if (cached) return cached.route;
    throw new Error("لا يتوفر مسار مشي محفوظ لهذا المسجد دون اتصال. اتصل بالإنترنت لاحتسابه أولًا.");
  }
  if (cached && Date.now() - cached.savedAt < 12 * 60 * 60 * 1000) return cached.route;

  const response = await fetch("/map-route/walking", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ from, to }),
    signal,
  });
  if (!response.ok) throw new Error("تعذر حساب مسار المشي الآن. حاول مجددًا بعد قليل.");
  const result = await response.json() as {
    code?: string;
    routes?: Array<{ distance?: number; duration?: number; geometry?: { type?: string; coordinates?: unknown } }>;
  };
  const route = result.routes?.[0];
  if (result.code !== "Ok" || !route || !Array.isArray(route.geometry?.coordinates)) {
    throw new Error("لم يُعثر على طريق مشاة يصل إلى هذا المسجد.");
  }
  const coordinates = route.geometry.coordinates.filter((point): point is [number, number] =>
    Array.isArray(point) && point.length >= 2 && Number.isFinite(point[0]) && Number.isFinite(point[1]),
  );
  if (coordinates.length < 2 || !Number.isFinite(route.distance) || !Number.isFinite(route.duration)) {
    throw new Error("لم تصل بيانات صالحة لمسار المشي.");
  }
  const walkingRoute: WalkingRoute = { coordinates, distance: route.distance!, duration: route.duration! };
  try { localStorage.setItem(LAST_WALKING_ROUTE_KEY, JSON.stringify({ signature, route: walkingRoute, savedAt: Date.now() } satisfies SavedWalkingRoute)); } catch { /* Caching the route is optional. */ }
  return walkingRoute;
}

export function straightLineDistanceKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const earthRadiusKm = 6371.0088;
  const toRadians = (value: number) => value * Math.PI / 180;
  const dLat = toRadians(b.lat - a.lat);
  const dLon = toRadians(b.lon - a.lon);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * earthRadiusKm * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function mapTileProxyPath(path: string): string {
  return path.startsWith("/map-tiles/") ? path : `/map-tiles/${path.replace(/^\/+/, "")}`;
}

export const offlineMapLimits = { maxTiles: MAX_OFFLINE_TILES, maxBytes: MAX_OFFLINE_BYTES };
