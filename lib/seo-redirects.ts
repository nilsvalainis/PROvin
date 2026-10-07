import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { DEFAULT_LOCALE, isPartneriemPath, parsePrefixedPath, stripLocalePrefix } from "@/i18n/locales";
import { LEGACY_PATH_ALIASES } from "@/lib/seo-public-paths";

const APEX_HOSTS = new Set(["provin.lv"]);

export function isApexHostname(host: string | null | undefined): boolean {
  const name = (host ?? "").split(":")[0]?.trim().toLowerCase() ?? "";
  return APEX_HOSTS.has(name);
}

export function wwwOrigin(url: URL): URL {
  const next = new URL(url.toString());
  next.protocol = "https:";
  next.hostname = "www.provin.lv";
  next.port = "";
  return next;
}

/** Vecs ceļš (`/faq`, `/lv/about`) → kanoniskais ceļš ar lokales prefiksu. */
export function resolveLegacyAliasRedirect(pathname: string): string | null {
  const { locale } = parsePrefixedPath(pathname);
  const unprefixed = stripLocalePrefix(pathname);
  const target = LEGACY_PATH_ALIASES[unprefixed];
  if (!target) return null;
  const loc = locale ?? DEFAULT_LOCALE;
  return `/${loc}${target}`;
}

export function copyRedirectCookies(from: NextResponse, to: NextResponse): NextResponse {
  for (const cookie of from.cookies.getAll()) {
    to.cookies.set(cookie);
  }
  return to;
}

/**
 * next-intl lokales prefiksa 307/302 → 308 (GET/HEAD).
 * Partneriem IP/sīkdatņu saruna paliek pagaidu, lai Googlebot neiesaldētu svešu lokali.
 */
export function toPermanentGetRedirect(request: NextRequest, response: NextResponse): NextResponse {
  if (request.method !== "GET" && request.method !== "HEAD") return response;
  if (response.status !== 307 && response.status !== 302) return response;
  const location = response.headers.get("location");
  if (!location) return response;

  const dest = new URL(location, request.url);
  const fromPath = request.nextUrl.pathname;
  const fromRest = parsePrefixedPath(fromPath).rest;
  if (isPartneriemPath(fromPath) || isPartneriemPath(fromRest)) {
    return response;
  }

  const permanent = NextResponse.redirect(dest, 308);
  return copyRedirectCookies(response, permanent);
}

export function redirect308(url: URL | string): NextResponse {
  return NextResponse.redirect(typeof url === "string" ? url : url, 308);
}

const SEARCH_CRAWLER_UA =
  /Googlebot|Google-InspectionTool|Storebot-Google|AdsBot-Google|Mediapartners-Google|Bingbot|bingbot|BingPreview|Slurp|DuckDuckBot|Baiduspider|Yandex|facebookexternalhit|LinkedInBot|Twitterbot|Applebot/i;

export function isSearchCrawler(userAgent: string | null | undefined): boolean {
  return SEARCH_CRAWLER_UA.test(userAgent ?? "");
}
