/* IRISS admin: cache static assets only. Never cache /api or auth. Pages are network-first. */
import { IRISS_PAGE_CACHE, IRISS_STATIC_CACHE, classifyIrissSwRequest, irissSwResponseCacheable } from "./sw-core.js";

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith("iriss-admin-") && key !== IRISS_STATIC_CACHE && key !== IRISS_PAGE_CACHE)
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

function responseCacheable(response, strategy) {
  if (!response || !response.ok || response.type === "opaqueredirect") return false;
  return irissSwResponseCacheable(response.headers, strategy);
}

async function cacheFirstStatic(request) {
  const cache = await caches.open(IRISS_STATIC_CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (responseCacheable(response, "cache-first-static")) await cache.put(request, response.clone());
  return response;
}

async function networkFirstPage(request) {
  const cache = await caches.open(IRISS_PAGE_CACHE);
  try {
    const response = await fetch(request);
    const finalUrl = new URL(response.url);
    if (finalUrl.pathname.includes("/login") || finalUrl.pathname.startsWith("/api/")) return response;
    if (responseCacheable(response, "network-first-page")) await cache.put(request, response.clone());
    return response;
  } catch (error) {
    const hit = await cache.match(request);
    if (hit) return hit;
    throw error;
  }
}

self.addEventListener("fetch", (event) => {
  const strategy = classifyIrissSwRequest({
    method: event.request.method,
    url: event.request.url,
    mode: event.request.mode,
    destination: event.request.destination,
  });
  if (strategy === "network-only") return;
  if (strategy === "cache-first-static") {
    event.respondWith(cacheFirstStatic(event.request));
    return;
  }
  event.respondWith(networkFirstPage(event.request));
});
