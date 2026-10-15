/**
 * IRISS admin service worker policy.
 * Static assets may be cached. Admin API, auth, and JSON are never cached.
 * HTML under /admin/iriss is network-first.
 */

export const IRISS_STATIC_CACHE = "iriss-admin-static-v1";
export const IRISS_PAGE_CACHE = "iriss-admin-pages-v1";

export function isIrissStaticAsset(path) {
  if (path.startsWith("/_next/static/")) return true;
  if (path.startsWith("/admin/iriss/icon-")) return true;
  if (path === "/admin/iriss/manifest.webmanifest") return true;
  if (path === "/admin/iriss/apple-touch-icon.png") return true;
  if (path.startsWith("/brand-logos/")) return true;
  return false;
}

export function classifyIrissSwRequest(input) {
  const method = String(input.method || "GET").toUpperCase();
  if (method !== "GET" && method !== "HEAD") return "network-only";
  let url;
  try {
    url = new URL(input.url);
  } catch {
    return "network-only";
  }
  const path = url.pathname;
  if (path === "/api" || path.startsWith("/api/")) return "network-only";
  if (/\/login(?:\/|$)/.test(path) || path.includes("/auth") || path.includes("/logout")) return "network-only";
  if (path.startsWith("/_next/data") || path.startsWith("/_next/image")) return "network-only";
  if (url.searchParams.has("_rsc")) return "network-only";

  const destination = input.destination || "";
  const isDocument = input.mode === "navigate" || destination === "document";
  if (isDocument) {
    if (path === "/admin/iriss" || path.startsWith("/admin/iriss/")) return "network-first-page";
    return "network-only";
  }
  if (isIrissStaticAsset(path)) return "cache-first-static";
  return "network-only";
}

export function irissSwResponseCacheable(headers, strategy) {
  if (strategy === "network-only") return false;
  if (headers.get("set-cookie")) return false;
  const type = (headers.get("content-type") || "").toLowerCase();
  if (type.includes("application/json") || type.includes("text/event-stream")) return false;
  const cacheControl = (headers.get("cache-control") || "").toLowerCase();
  if (strategy === "cache-first-static") {
    if (cacheControl.includes("no-store")) return false;
    return true;
  }
  if (type && !type.includes("text/html")) return false;
  return true;
}
