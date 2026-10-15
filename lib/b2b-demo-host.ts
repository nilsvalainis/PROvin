/**
 * IRISS B2B demo hosts and URL prefixes.
 * Production host: demo.provin.lv. Preview / www: /b2b-demo path (same app, no PROVIN routes).
 */

export const B2B_DEMO_HOST = "demo.provin.lv";
export const B2B_DEMO_APP_PREFIX = "/b2b-demo";
export const B2B_DEMO_API_PREFIX = "/api/b2b-demo";

export function hostnameFromHostHeader(host: string | null | undefined): string {
  return (host ?? "").split(":")[0]?.trim().toLowerCase() ?? "";
}

export function isB2bDemoHostname(host: string | null | undefined): boolean {
  return hostnameFromHostHeader(host) === B2B_DEMO_HOST;
}

export function isB2bDemoAppPath(pathname: string): boolean {
  const path = (pathname.split("?")[0] ?? pathname).trim() || "/";
  return path === B2B_DEMO_APP_PREFIX || path.startsWith(`${B2B_DEMO_APP_PREFIX}/`);
}

export function isB2bDemoApiPath(pathname: string): boolean {
  const path = (pathname.split("?")[0] ?? pathname).trim() || "/";
  return path === B2B_DEMO_API_PREFIX || path.startsWith(`${B2B_DEMO_API_PREFIX}/`);
}

export function isB2bDemoAllowedPath(pathname: string): boolean {
  return isB2bDemoAppPath(pathname) || isB2bDemoApiPath(pathname);
}

export type B2bDemoHostDecision =
  | { action: "next" }
  | { action: "redirect"; pathname: string }
  | { action: "not_found" };

/**
 * On demo.provin.lv only the B2B demo app and its API are reachable.
 * PROVIN marketing, /admin (including ĪRISS) and other APIs are 404.
 */
export function decideB2bDemoHostRequest(
  host: string | null | undefined,
  pathname: string,
): B2bDemoHostDecision {
  if (!isB2bDemoHostname(host)) return { action: "next" };
  const path = (pathname.split("?")[0] ?? pathname).trim() || "/";
  if (isB2bDemoAllowedPath(path)) return { action: "next" };
  if (path === "/") return { action: "redirect", pathname: B2B_DEMO_APP_PREFIX };
  if (path === "/login") return { action: "redirect", pathname: `${B2B_DEMO_APP_PREFIX}/login` };
  return { action: "not_found" };
}
