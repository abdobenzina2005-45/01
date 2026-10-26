import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  addProtocol,
  Map as MapLibreMap,
  Marker,
  NavigationControl,
  Popup,
  setWorkerUrl,
  type Map as MapInstance,
  type MapGeoJSONFeature,
} from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  AlertCircle,
  ArrowUpLeft,
  Download,
  LocateFixed,
  MapPin,
  MapPinned,
  Navigation,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import type { CitySchedule } from "@/lib/prayerTimes";
import {
  downloadOfflineCityMap,
  fetchNearbyMosques,
  fetchWalkingRoute,
  getCachedResource,
  getOfflineCity,
  offlineCityKey,
  MAP_STYLE_PATH,
  straightLineDistanceKm,
  storeCachedResource,
  toProxyPath,
  type OSMPoint,
  type OfflineCity,
  type OfflineProgress,
  type WalkingRoute,
} from "@/lib/offlineMap";
import "./mosques-modal.css";

let localProtocolInstalled = false;

function ensureLocalTileProtocol() {
  if (localProtocolInstalled) return;
  addProtocol("almosaly", async (params, abortController) => {
    const requestUrl = new URL(params.url);
    const path = `${requestUrl.pathname}${requestUrl.search}`;
    const cached = await getCachedResource(path);
    const jsonResource = /\/styles\//.test(path) || /\.json(?:$|\?)/.test(path) || /\/planet(?:$|\?)/.test(path);
    const tileJsonResource = /\/planet(?:$|\?)/.test(path);
    const tileResource = /\/(?:planet|natural_earth\/ne2sr)\/\d+\/\d+\/\d+\.(?:pbf|png)$/.test(path);
    if (cached && (!navigator.onLine || !tileJsonResource)) return { data: jsonResource ? JSON.parse(new TextDecoder().decode(cached)) as Record<string, unknown> : cached };
    if (!navigator.onLine) throw new Error("هذه البلاطة غير محفوظة في الخريطة دون اتصال.");
    const response = await fetch(path, { signal: abortController.signal });
    if (!response.ok) throw new Error(`تعذر تحميل بلاطة الخريطة (${response.status}).`);
    const data = await response.arrayBuffer();
    if (!tileResource && !tileJsonResource) {
      try { await storeCachedResource(path, data); } catch { /* Map display remains usable if browser storage is unavailable. */ }
    }
    return { data: jsonResource ? JSON.parse(new TextDecoder().decode(data)) as Record<string, unknown> : data };
  });
  localProtocolInstalled = true;
  setWorkerUrl(workerUrl);
}

function transformMapRequest(url: string) {
  const proxyPath = toProxyPath(url);
  return proxyPath ? { url: `almosaly://app${proxyPath}` } : { url };
}

function makeMarker(className: string, label: string): HTMLElement {
  const element = document.createElement("button");
  element.type = "button";
  element.className = className;
  element.setAttribute("aria-label", label);
  element.title = label;
  return element;
}

function getPointCoordinates(feature: MapGeoJSONFeature): { lat: number; lon: number } | null {
  if (feature.geometry.type !== "Point") return null;
  const [lon, lat] = feature.geometry.coordinates;
  if (typeof lat !== "number" || typeof lon !== "number") return null;
  return { lat, lon };
}

function fitMapToRoute(map: MapInstance, coordinates: [number, number][]) {
  if (coordinates.length < 2) return;
  const longitudes = coordinates.map(([lon]) => lon);
  const latitudes = coordinates.map(([, lat]) => lat);
  map.fitBounds(
    [[Math.min(...longitudes), Math.min(...latitudes)], [Math.max(...longitudes), Math.max(...latitudes)]],
    { padding: { top: 48, right: 72, bottom: 48, left: 72 }, maxZoom: 16, duration: 450 },
  );
}

function isMosqueFeature(feature: MapGeoJSONFeature): boolean {
  const properties = feature.properties ?? {};
  const className = String(properties.class ?? "").toLowerCase();
  const subclass = String(properties.subclass ?? "").toLowerCase();
  const name = [properties.name, properties.name_en, properties["name:nonlatin"]]
    .filter(Boolean).join(" ").toLowerCase();
  return (className === "place_of_worship" && /muslim|mosque|masjid/.test(subclass))
    || className === "mosque"
    || /mosque|masjid|مسجد|جامع/.test(name);
}

function formatDistance(km: number): string {
  if (km < 1) return `${Math.max(10, Math.round(km * 1000 / 10) * 10)} م`;
  return `${km.toFixed(km < 10 ? 1 : 0)} كم`;
}

function readSavedMosques(city: CitySchedule): OSMPoint[] {
  try {
    const raw = localStorage.getItem(`al-mosaly-mosques:${offlineCityKey(city)}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as OSMPoint[];
    return Array.isArray(parsed) ? parsed.filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lon)) : [];
  } catch {
    return [];
  }
}

function saveMosques(city: CitySchedule, points: OSMPoint[]) {
  try { localStorage.setItem(`al-mosaly-mosques:${offlineCityKey(city)}`, JSON.stringify(points)); } catch { /* Optional cache; the live list still works. */ }
}

export default function MosquesModal({ city, onClose }: { city: CitySchedule; onClose: () => void }) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapInstance | null>(null);
  const userMarkerRef = useRef<Marker | null>(null);
  const mosqueMarkersRef = useRef<Marker[]>([]);
  const pickingLocationRef = useRef(false);
  const visibleMosquesCallback = useRef<(points: OSMPoint[]) => void>(() => undefined);
  const abortDownloadRef = useRef<AbortController | null>(null);
  const [online, setOnline] = useState(() => navigator.onLine);
  const [position, setPosition] = useState({ lat: city.lat, lon: city.lon });
  const [positionSource, setPositionSource] = useState<"city" | "gps" | "manual">("city");
  const [mosques, setMosques] = useState<OSMPoint[]>(() => readSavedMosques(city));
  const [selectedMosqueId, setSelectedMosqueId] = useState<string | null>(null);
  const [loadingMosques, setLoadingMosques] = useState(false);
  const [locating, setLocating] = useState(false);
  const [pickingLocation, setPickingLocation] = useState(false);
  const [message, setMessage] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<OfflineProgress | null>(null);
  const [offlineCity, setOfflineCity] = useState<OfflineCity | null>(null);
  const [checkingOfflineMap, setCheckingOfflineMap] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const [walkingRoute, setWalkingRoute] = useState<WalkingRoute | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState("");

  const nearestMosques = useMemo(() => [...mosques]
    .map((mosque) => ({ ...mosque, distance: straightLineDistanceKm(position, mosque) }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 20), [mosques, position]);
  const selectedMosque = nearestMosques.find((mosque) => mosque.id === selectedMosqueId) ?? nearestMosques[0] ?? null;

  const findNearby = useCallback(async (coords: { lat: number; lon: number }) => {
    if (!navigator.onLine) {
      const saved = readSavedMosques(city);
      if (saved.length) setMosques(saved);
      else setMessage("لا يوجد اتصال، ولا توجد قائمة مساجد محفوظة لهذا الموقع بعد. افتح الخريطة عند توفر الإنترنت أولًا.");
      return;
    }
    setLoadingMosques(true);
    setMessage("");
    try {
      const results = await fetchNearbyMosques(coords.lat, coords.lon);
      setMosques(results);
      saveMosques(city, results);
      if (!results.length) setMessage("لم تُسجّل بيانات مساجد قريبة ضمن نطاق البحث. حرّك الخريطة أو حدّد موقعك ثم أعد البحث.");
      setSelectedMosqueId(results[0]?.id ?? null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذر العثور على المساجد القريبة.");
    } finally {
      setLoadingMosques(false);
    }
  }, [city]);

  useEffect(() => {
    const updateNetwork = () => setOnline(navigator.onLine);
    window.addEventListener("online", updateNetwork);
    window.addEventListener("offline", updateNetwork);
    return () => {
      window.removeEventListener("online", updateNetwork);
      window.removeEventListener("offline", updateNetwork);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setCheckingOfflineMap(true);
    void getOfflineCity(city).then((record) => { if (!cancelled) setOfflineCity(record ?? null); })
      .catch(() => { if (!cancelled) setOfflineCity(null); })
      .finally(() => { if (!cancelled) setCheckingOfflineMap(false); });
    return () => { cancelled = true; };
  }, [city]);

  useEffect(() => {
    void findNearby(position);
    // Search once at the selected city center when the window opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    ensureLocalTileProtocol();
    const map = new MapLibreMap({
      container: mapContainerRef.current,
      style: MAP_STYLE_PATH,
      center: [city.lon, city.lat],
      zoom: 12,
      minZoom: 5,
      maxZoom: 19,
      attributionControl: { compact: true },
      transformRequest: transformMapRequest,
      cooperativeGestures: false,
    });
    mapRef.current = map;
    map.addControl(new NavigationControl({ showCompass: false }), "top-left");
    map.on("load", () => setMapReady(true));
    const onMapClick = (event: { lngLat: { lat: number; lng: number } }) => {
      if (!pickingLocationRef.current) return;
      const coords = { lat: event.lngLat.lat, lon: event.lngLat.lng };
      setPosition(coords);
      setPositionSource("manual");
      setPickingLocation(false);
      pickingLocationRef.current = false;
      setMessage("تم تحديد النقطة على الخريطة. جارٍ البحث عن المساجد القريبة.");
      void findNearby(coords);
    };
    const inspectVisibleMosques = () => {
      if (navigator.onLine || !map.isStyleLoaded()) return;
      try {
        const poiLayers = (map.getStyle().layers ?? [])
          .filter((layer) => (layer as unknown as { "source-layer"?: string })["source-layer"] === "poi")
          .map((layer) => layer.id);
        if (!poiLayers.length) return;
        const points = map.queryRenderedFeatures(undefined, { layers: poiLayers })
          .filter(isMosqueFeature)
          .flatMap((feature) => {
            const coords = getPointCoordinates(feature);
            if (!coords) return [];
            const name = String(feature.properties?.name ?? feature.properties?.name_en ?? feature.properties?.["name:nonlatin"] ?? "مسجد قريب");
            return [{ id: `tile/${feature.id ?? `${coords.lat},${coords.lon}`}`, name, ...coords }];
          });
        if (points.length) visibleMosquesCallback.current(points);
      } catch { /* The map may still be loading its first offline tile. */ }
    };
    map.on("click", onMapClick);
    map.on("idle", inspectVisibleMosques);
    map.on("moveend", inspectVisibleMosques);
    return () => {
      abortDownloadRef.current?.abort();
      mosqueMarkersRef.current.forEach((marker) => marker.remove());
      userMarkerRef.current?.remove();
      map.remove();
      mapRef.current = null;
    };
    // The modal is mounted for a single city and its first map instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    visibleMosquesCallback.current = (points) => {
      if (!navigator.onLine && points.length) {
        setMosques(points);
        setSelectedMosqueId((current) => current ?? points[0].id);
      }
    };
  }, []);

  useEffect(() => {
    if (!mapReady || !selectedMosque) {
      setWalkingRoute(null);
      setRouteLoading(false);
      setRouteError("");
      return;
    }
    const controller = new AbortController();
    setWalkingRoute(null);
    setRouteError("");
    setRouteLoading(true);
    const timer = window.setTimeout(() => {
      void fetchWalkingRoute(position, selectedMosque, controller.signal)
        .then((route) => {
          if (controller.signal.aborted) return;
          setWalkingRoute(route);
          fitMapToRoute(mapRef.current!, route.coordinates);
        })
        .catch((error) => {
          if (!controller.signal.aborted) setRouteError(error instanceof Error ? error.message : "تعذر حساب مسار المشي.");
        })
        .finally(() => { if (!controller.signal.aborted) setRouteLoading(false); });
    }, 350);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [mapReady, position.lat, position.lon, selectedMosque?.id, selectedMosque?.lat, selectedMosque?.lon]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !map.isStyleLoaded()) return;
    userMarkerRef.current?.remove();
    const userElement = makeMarker("mosque-user-pin", positionSource === "city" ? "مركز المدينة المختارة" : "موقعي المحدد");
    userMarkerRef.current = new Marker({ element: userElement, anchor: "center" }).setLngLat([position.lon, position.lat]).addTo(map);
    mosqueMarkersRef.current.forEach((marker) => marker.remove());
    mosqueMarkersRef.current = nearestMosques.map((mosque, index) => {
      const element = makeMarker(`mosque-point-pin ${index === 0 ? "mosque-point-pin-nearest" : ""}`, mosque.name);
      element.addEventListener("click", (event) => { event.stopPropagation(); setSelectedMosqueId(mosque.id); });
      const marker = new Marker({ element, anchor: "bottom" }).setLngLat([mosque.lon, mosque.lat]).addTo(map);
      marker.setPopup(new Popup({ offset: 24, closeButton: false }).setText(`${mosque.name} · ${formatDistance(mosque.distance)}`));
      return marker;
    });
    if (!map.getSource("mosque-walking-route")) {
      map.addSource("mosque-walking-route", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
    }
    const firstSymbolLayer = map.getStyle().layers?.find((layer) => layer.type === "symbol")?.id;
    if (!map.getLayer("mosque-walking-route-casing")) {
      map.addLayer({
        id: "mosque-walking-route-casing", type: "line", source: "mosque-walking-route",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#fffaf2", "line-width": 8, "line-opacity": 0.96 },
      }, firstSymbolLayer);
    }
    if (!map.getLayer("mosque-walking-route-line")) {
      map.addLayer({
        id: "mosque-walking-route-line", type: "line", source: "mosque-walking-route",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#b95745", "line-width": 4.5, "line-opacity": 0.98 },
      }, firstSymbolLayer);
    }
    const source = map.getSource("mosque-walking-route") as unknown as { setData: (data: unknown) => void };
    source.setData({
      type: "FeatureCollection",
      features: walkingRoute ? [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: walkingRoute.coordinates } }] : [],
    });
  }, [mapReady, nearestMosques, position, positionSource, selectedMosque, walkingRoute]);

  useEffect(() => {
    if (!mapReady || !offlineCity?.bounds) return;
    mapRef.current?.fitBounds([[offlineCity.bounds[1], offlineCity.bounds[0]], [offlineCity.bounds[3], offlineCity.bounds[2]]], { padding: 46, maxZoom: 13, duration: 350 });
  }, [mapReady, offlineCity]);

  const locateMe = () => {
    if (!navigator.geolocation) {
      setMessage("المتصفح لا يدعم تحديد الموقع. استخدم خيار تحديد نقطة على الخريطة.");
      return;
    }
    setLocating(true);
    setMessage("يرجى السماح بالوصول إلى الموقع في نافذة المتصفح.");
    navigator.geolocation.getCurrentPosition((result) => {
      const coords = { lat: result.coords.latitude, lon: result.coords.longitude };
      setPosition(coords);
      setPositionSource("gps");
      setLocating(false);
      setMessage("تم تحديد موقعك. جارٍ البحث عن أقرب المساجد.");
      mapRef.current?.flyTo({ center: [coords.lon, coords.lat], zoom: 15, duration: 700 });
      void findNearby(coords);
    }, (error) => {
      setLocating(false);
      setMessage(error.code === error.PERMISSION_DENIED
        ? "لم يُسمح بالوصول إلى موقعك. فعّل إذن الموقع أو اختر نقطة على الخريطة."
        : "تعذر تحديد موقعك الحالي. تحقق من إعدادات الموقع وحاول مجددًا.");
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
  };

  const startPickingLocation = () => {
    const next = !pickingLocation;
    setPickingLocation(next);
    pickingLocationRef.current = next;
    setMessage(next ? "اضغط على النقطة التي تمثّل موقعك في الخريطة." : "");
  };

  const downloadMap = async () => {
    if (!online || downloading) return;
    const controller = new AbortController();
    abortDownloadRef.current = controller;
    setDownloading(true);
    setDownloadProgress(null);
    setMessage("جارٍ تحديد حدود المدينة وتقدير حجم الخريطة...");
    try {
      const saved = await downloadOfflineCityMap(city, controller.signal, (progress) => {
        setDownloadProgress(progress);
        setMessage(`جارٍ حفظ خريطة ${city.city} للاستخدام دون إنترنت...`);
      });
      setOfflineCity(saved);
      setMessage(`اكتمل تنزيل خريطة ${city.city} وحُفظت على هذا الجهاز.`);
    } catch (error) {
      if (controller.signal.aborted) setMessage("أُلغي تنزيل الخريطة.");
      else setMessage(error instanceof Error ? error.message : "تعذر تنزيل خريطة المدينة.");
    } finally {
      setDownloading(false);
      abortDownloadRef.current = null;
    }
  };

  const cancelDownload = () => abortDownloadRef.current?.abort();
  const openDirections = () => {
    if (!selectedMosque) return;
    const url = `https://www.openstreetmap.org/directions?engine=fossgis_osrm_foot&route=${position.lat},${position.lon};${selectedMosque.lat},${selectedMosque.lon}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const progressPercent = downloadProgress?.total
    ? Math.min(100, Math.round(downloadProgress.completed / downloadProgress.total * 100))
    : 0;
  const packageSize = offlineCity ? `${Math.max(1, Math.round(offlineCity.bytes / 1024 / 1024))} م.ب` : "";
  const cityLocationLabel = positionSource === "city" ? `مركز ${city.city}` : positionSource === "gps" ? "موقع GPS" : "نقطة محددة يدويًا";

  return (
    <div className="mosques-modal" role="dialog" aria-modal="true" aria-labelledby="mosques-title" dir="rtl">
      <button type="button" className="mosques-backdrop" aria-label="إغلاق نافذة المساجد" onClick={onClose} />
      <section className="mosques-sheet">
        <header className="mosques-header">
          <div className="mosques-heading-mark"><MapPinned size={21} /></div>
          <div className="mosques-heading-copy">
            <h2 id="mosques-title">المساجد القريبة</h2>
            <p>{city.city}، {city.country}</p>
          </div>
          <span className={`mosques-network-badge ${online ? "is-online" : "is-offline"}`} title={online ? "متصل بالإنترنت" : "غير متصل بالإنترنت"}>
            {online ? <Wifi size={14} /> : <WifiOff size={14} />}{online ? "متصل" : "دون اتصال"}
          </span>
          <button type="button" className="mosques-close" aria-label="إغلاق" onClick={onClose}><X size={18} /></button>
        </header>
        <div className="mosques-controls">
          <button type="button" className="mosques-control-primary" onClick={locateMe} disabled={locating}>
            <LocateFixed size={17} />{locating ? "جارٍ تحديد الموقع..." : "تحديد موقعي"}
          </button>
          <button type="button" className={`mosques-control-secondary ${pickingLocation ? "is-active" : ""}`} onClick={startPickingLocation}>
            <MapPin size={16} />{pickingLocation ? "ألغِ اختيار النقطة" : "اختر موقعي على الخريطة"}
          </button>
          <button type="button" className="mosques-control-secondary" onClick={() => void findNearby(position)} disabled={loadingMosques}>
            <Navigation size={16} />{loadingMosques ? "جارٍ البحث..." : "تحديث المساجد القريبة"}
          </button>
        </div>
        <div className="mosques-map-wrap">
          <div ref={mapContainerRef} className="mosques-map-canvas" aria-label={`خريطة ${city.city}`} />
          <div className="mosques-map-caption"><span className="mosques-map-dot" />{cityLocationLabel}</div>
          {offlineCity && <div className="mosques-offline-tag"><WifiOff size={13} /> خريطة محفوظة</div>}
        </div>
        <div className="mosques-bottom-panel">
          {selectedMosque ? (
            <article className="mosque-nearest-card">
              <div className="mosque-nearest-icon"><MapPin size={19} /></div>
              <div className="mosque-nearest-details">
                <span className="mosque-nearest-label">المسجد المحدد</span>
                <strong>{selectedMosque.name}</strong>
                <small>المسافة المباشرة: {formatDistance(selectedMosque.distance)} من {cityLocationLabel}</small>
                <small className={`mosque-route-summary ${routeLoading ? "is-loading" : ""}`} role="status">
                  {routeLoading ? "جارٍ رسم مسار المشي على الخريطة..." : walkingRoute ? `مسار المشي: ${formatDistance(walkingRoute.distance / 1000)} · نحو ${Math.max(1, Math.round(walkingRoute.duration / 60))} دقيقة` : routeError || "اختر مسجدًا لإظهار مسار المشي إليه على الخريطة."}
                </small>
              </div>
              <button type="button" className="mosque-direction-button" onClick={openDirections} title="فتح مسار المشي على OpenStreetMap">
                <ArrowUpLeft size={16} /><span>الاتجاهات</span>
              </button>
            </article>
          ) : (
            <div className="mosques-empty-state">
              <MapPin size={18} />
              <span>{loadingMosques ? "جارٍ البحث عن المساجد القريبة..." : "حدد موقعك أو اضغط تحديث المساجد لبدء البحث."}</span>
            </div>
          )}
          {nearestMosques.length > 0 && <div className="mosques-nearby-list" aria-label="قائمة المساجد الأقرب">
            {nearestMosques.slice(0, 6).map((mosque, index) => (
              <button key={mosque.id} type="button" className={`mosque-nearby-item ${selectedMosque?.id === mosque.id ? "is-selected" : ""}`} onClick={() => {
                setSelectedMosqueId(mosque.id);
                mapRef.current?.flyTo({ center: [mosque.lon, mosque.lat], zoom: 15, duration: 500 });
              }}>
                <span className="mosque-nearby-rank">{index + 1}</span>
                <span className="mosque-nearby-name">{mosque.name}</span>
                <span className="mosque-nearby-distance">{formatDistance(mosque.distance)}</span>
              </button>
            ))}
          </div>}
          {message && <p className={`mosques-message ${message.includes("اكتمل") ? "is-success" : ""}`} role="status">
            {!message.includes("اكتمل") && <AlertCircle size={15} />}{message}
          </p>}
          <section className="mosques-offline-section">
            <div className="mosques-offline-copy">
              <span className="mosques-offline-icon"><Download size={17} /></span>
              <div><strong>خريطة المدينة دون إنترنت</strong><small>{checkingOfflineMap ? "جارٍ التحقق من الخرائط المحفوظة..." : offlineCity ? `محفوظة على هذا الجهاز · ${packageSize} · حتى مستوى ${offlineCity.maxZoom}` : "نزّل شوارع المدينة ومعالمها لتفتح الخريطة عند انقطاع الإنترنت."}</small></div>
            </div>
            <div className="mosques-offline-actions">
              {downloading ? <button type="button" className="mosques-download-button is-cancel" onClick={cancelDownload}>إلغاء التنزيل</button> : (
                <button type="button" className="mosques-download-button" onClick={() => void downloadMap()} disabled={!online || checkingOfflineMap}>
                  <Download size={15} />{offlineCity ? "تحديث الخريطة" : "تنزيل المدينة"}
                </button>
              )}
            </div>
            {downloadProgress && downloading && <div className="mosques-download-progress" aria-label={`اكتمل ${progressPercent}%`}><span style={{ width: `${progressPercent}%` }} /><small>{progressPercent}% · {downloadProgress.completed.toLocaleString("ar")} / {downloadProgress.total.toLocaleString("ar")} بلاطة · حتى مستوى {downloadProgress.maxZoom}</small></div>}
            <p className="mosques-offline-note">بيانات OpenStreetMap عبر OpenFreeMap. حد الحزمة 3,000 بلاطة أو 50 م.ب. قد ينخفض التكبير تلقائيًا. افتح التطبيق مرة بالإنترنت بعد التحديث ليعمل دون اتصال.</p>
          </section>
          {!online && !offlineCity && <div className="mosques-offline-warning"><WifiOff size={16} />لا توجد خريطة محفوظة لهذه المدينة بعد؛ اتصل بالإنترنت لتنزيلها أول مرة.</div>}
        </div>
        <footer className="mosques-footer"><span>المسافة المباشرة لا تتبع الطرق. عند طلب المساجد أو مسار المشي، تُرسل الإحداثيات إلى خدمات OpenStreetMap وقد تُسجّل لدى خادم التوجيه.</span><span>مسارات المشي عبر OSRM · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap</a> · <a href="https://www.openstreetmap.org/fixthemap" target="_blank" rel="noreferrer">إصلاح الخريطة</a></span></footer>
      </section>
    </div>
  );
}
