import { stripLocalePrefix } from "@/i18n/locales";

/**
 * Vercel Web Analytics / Speed Insights / GA4 — tikai publiskajam PROVIN frontam.
 * Ne admin, ne /{locale}/demo (nākotnes demo.provin.lv multi-tenant), ne B2B admin darbvietas.
 */
export function isPublicSiteAnalyticsPath(pathname: string): boolean {
  const path = (pathname.split("?")[0] ?? pathname).trim() || "/";
  if (path.startsWith("/admin")) return false;
  if (path.startsWith("/api")) return false;
  if (path === "/b2b-demo" || path.startsWith("/b2b-demo/")) return false;

  const rest = stripLocalePrefix(path);
  if (rest === "/demo" || rest.startsWith("/demo/")) return false;

  return true;
}

/** `demo.provin.lv` un līdzīgi — analītika vēl nav multi-tenant demo vidē. */
export function isPublicSiteAnalyticsHost(hostname: string): boolean {
  const host = hostname.trim().toLowerCase();
  if (!host) return true;
  if (host === "demo.provin.lv" || host.startsWith("demo.")) return false;
  return true;
}

export function shouldEnablePublicSiteAnalytics(pathname: string, hostname?: string | null): boolean {
  if (!isPublicSiteAnalyticsPath(pathname)) return false;
  if (hostname == null || hostname === "") return true;
  return isPublicSiteAnalyticsHost(hostname);
}
