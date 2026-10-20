import { NextRequest, NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import {
  B2B_LOCALE_COOKIE,
  DEFAULT_LOCALE,
  isPartneriemPath,
  parsePrefixedPath,
  resolveB2bEntryLocale,
  type AppLocale,
} from "./i18n/locales";
import {
  shouldBlockClosedExperimentPath,
  shouldBlockLegacyStandaloneProductPath,
} from "./lib/legacy-standalone-product-routes";
import {
  isApexHostname,
  isSearchCrawler,
  redirect307,
  redirect308,
  resolveCaseNormalizedRedirect,
  resolveLegacyAliasRedirect,
  toPermanentGetRedirect,
  wwwOrigin,
} from "./lib/seo-redirects";
import { SEO_LOCALE_HEADER } from "./lib/seo-public-paths";
import { SITE_THEME_COOKIE_KEY } from "./lib/site-theme";
import { isClientLinkPath } from "./lib/client-link";
import { isUnpaidPaymentPath } from "./lib/admin-unpaid-payment-link";
import { isIrissOfferLinkPath } from "./lib/iriss-offer-client-link";
import { decideB2bDemoHostRequest } from "./lib/b2b-demo-host";
import { decideAdminApiGate } from "./lib/admin-api-gate";
import { ADMIN_SESSION_COOKIE_NAME, verifyAdminSessionToken } from "./lib/admin-session-token";

/* Lokāli: `next dev` / `next start` ar `--hostname 127.0.0.1` un `localhost` hostu atšķirība var radīt
   papildu redirectus; next-intl ar vienu lokalizāciju un `localePrefix: "as-needed"`/`never` deva 307 cilpu uz `/`. */

const intlMiddleware = createMiddleware(routing);

const B2B_COOKIE = {
  path: "/",
  sameSite: "lax" as const,
  maxAge: 60 * 60 * 24 * 365,
};

function b2bCookieValue(request: NextRequest): string | undefined {
  return request.cookies.get(B2B_LOCALE_COOKIE)?.value;
}

function requestCountry(request: NextRequest): string | null {
  return request.headers.get("x-vercel-ip-country");
}

function withB2bLocaleCookie(res: NextResponse, locale: AppLocale): NextResponse {
  res.cookies.set(B2B_LOCALE_COOKIE, locale, B2B_COOKIE);
  return res;
}

function requestWithLocaleHeader(request: NextRequest, locale: string): NextRequest {
  const headers = new Headers(request.headers);
  headers.set(SEO_LOCALE_HEADER, locale);
  return new NextRequest(request, { headers });
}

function isAdminLoginPath(pathname: string): boolean {
  return pathname === "/admin/login" || pathname.startsWith("/admin/login/");
}

/** Bez derīgas sesijas lapa netiek renderēta: tukša 307 atbilde, nekādu datu ķermenī. */
function adminLoginRedirect(request: NextRequest): NextResponse {
  const { pathname, search } = request.nextUrl;
  const dest = request.nextUrl.clone();
  dest.pathname = "/admin/login";
  dest.search = `?next=${encodeURIComponent(`${pathname}${search}`)}`;
  const res = redirect307(dest);
  res.headers.set("Cache-Control", "private, no-store");
  res.headers.set("X-Robots-Tag", "noindex, nofollow");
  return res;
}

function adminApiJson(status: number, error: string): NextResponse {
  return NextResponse.json(
    { error },
    { status, headers: { "Cache-Control": "private, no-store" } },
  );
}

async function gateAdminApi(request: NextRequest): Promise<NextResponse> {
  const decision = await decideAdminApiGate(request);
  if (decision.action === "unauthorized") return adminApiJson(401, "unauthorized");
  if (decision.action === "forbidden_origin") return adminApiJson(403, "forbidden origin");
  return NextResponse.next();
}

export default async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const b2bDemo = decideB2bDemoHostRequest(request.headers.get("host"), pathname);
  if (b2bDemo.action === "redirect") {
    const dest = request.nextUrl.clone();
    dest.pathname = b2bDemo.pathname;
    dest.search = pathname === "/" ? "" : dest.search;
    return redirect307(dest);
  }
  if (b2bDemo.action === "not_found") {
    return new NextResponse("Not Found", { status: 404, headers: { "X-Robots-Tag": "noindex, nofollow" } });
  }
  if (pathname.startsWith("/api")) {
    if (pathname.startsWith("/api/admin")) {
      return gateAdminApi(request);
    }
    return NextResponse.next();
  }
  if (pathname === "/b2b-demo" || pathname.startsWith("/b2b-demo/")) {
    const res = NextResponse.next();
    res.headers.set("X-Robots-Tag", "noindex, nofollow");
    return res;
  }

  if (isApexHostname(request.headers.get("host"))) {
    const dest = wwwOrigin(request.nextUrl);
    const legacy = resolveLegacyAliasRedirect(dest.pathname);
    if (legacy) {
      dest.pathname = legacy;
    } else {
      const { locale } = parsePrefixedPath(dest.pathname);
      const skipPrefix =
        dest.pathname === "/sitemap.xml" ||
        dest.pathname === "/robots.txt" ||
        dest.pathname === "/icon" ||
        dest.pathname === "/apple-icon" ||
        dest.pathname === "/favicon.ico" ||
        dest.pathname === "/og.png" ||
        dest.pathname.startsWith("/admin") ||
        dest.pathname.startsWith("/dev") ||
        dest.pathname.startsWith("/api") ||
        isClientLinkPath(dest.pathname) ||
        isUnpaidPaymentPath(dest.pathname) ||
        isIrissOfferLinkPath(dest.pathname) ||
        isPartneriemPath(dest.pathname);
      if (!locale && !skipPrefix) {
        dest.pathname = dest.pathname === "/" ? `/${DEFAULT_LOCALE}` : `/${DEFAULT_LOCALE}${dest.pathname}`;
      }
    }
    return redirect308(dest);
  }

  if (
    pathname === "/sitemap.xml" ||
    pathname === "/robots.txt" ||
    pathname === "/icon" ||
    pathname === "/apple-icon" ||
    pathname === "/favicon.ico" ||
    pathname === "/og.png"
  ) {
    return NextResponse.next();
  }

  const legacy = resolveLegacyAliasRedirect(pathname);
  if (legacy) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = legacy;
    return redirect308(redirectUrl);
  }

  const caseNormalized = resolveCaseNormalizedRedirect(pathname);
  if (caseNormalized) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = caseNormalized;
    return redirect308(redirectUrl);
  }

  if (
    shouldBlockLegacyStandaloneProductPath(pathname) ||
    shouldBlockClosedExperimentPath(pathname)
  ) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = `/${DEFAULT_LOCALE}`;
    redirectUrl.search = "";
    return redirect307(redirectUrl);
  }

  if (searchParams.has("theme")) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.searchParams.delete("theme");
    const res = redirect307(redirectUrl);
    res.cookies.set(SITE_THEME_COOKIE_KEY, "dark", {
      path: "/",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
    });
    return res;
  }

  if (pathname.startsWith("/dev")) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/admin")) {
    const requestHeaders = new Headers(request.headers);
    if (!isAdminLoginPath(pathname)) {
      if (!(await verifyAdminSessionToken(request.cookies.get(ADMIN_SESSION_COOKIE_NAME)?.value))) {
        return adminLoginRedirect(request);
      }
      requestHeaders.set("x-admin-intended-path", pathname);
    }
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  if (isIrissOfferLinkPath(pathname)) {
    const res = NextResponse.next();
    res.headers.set("X-Robots-Tag", "noindex, nofollow");
    res.headers.set("Cache-Control", "private, no-store");
    res.headers.set("Referrer-Policy", "no-referrer");
    return res;
  }

  if (isClientLinkPath(pathname) || isUnpaidPaymentPath(pathname)) {
    const res = NextResponse.next();
    res.headers.set("X-Robots-Tag", "noindex, nofollow");
    res.headers.set("Cache-Control", "private, no-store");
    return res;
  }

  const prefixed = parsePrefixedPath(pathname);
  if (
    prefixed.locale &&
    (prefixed.rest === "/s" ||
      prefixed.rest.startsWith("/s/") ||
      prefixed.rest === "/p" ||
      prefixed.rest.startsWith("/p/") ||
      prefixed.rest === "/apmaksa" ||
      prefixed.rest.startsWith("/apmaksa/"))
  ) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = prefixed.rest;
    return redirect307(redirectUrl);
  }

  const requestLocale = prefixed.locale ?? DEFAULT_LOCALE;
  const localizedRequest = requestWithLocaleHeader(request, requestLocale);
  const crawler = isSearchCrawler(request.headers.get("user-agent"));

  if (isPartneriemPath(pathname) || (prefixed.locale && isPartneriemPath(prefixed.rest))) {
    const urlLocale = prefixed.locale;
    const rest = urlLocale ? prefixed.rest : pathname;
    const nextLocale = resolveB2bEntryLocale({
      urlLocale,
      cookie: crawler ? null : b2bCookieValue(request),
      country: crawler ? "LV" : requestCountry(request),
      preferStoredLocale: !urlLocale && !crawler,
    });
    if (!urlLocale || nextLocale !== urlLocale) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = `/${nextLocale}${rest === "/" ? "" : rest}`;
      if (crawler) return redirect308(redirectUrl);
      return withB2bLocaleCookie(NextResponse.redirect(redirectUrl), nextLocale);
    }
    const intlRes = intlMiddleware(requestWithLocaleHeader(request, urlLocale));
    return crawler ? intlRes : withB2bLocaleCookie(intlRes, urlLocale);
  }

  const intlRes = toPermanentGetRedirect(localizedRequest, intlMiddleware(localizedRequest));
  const isHomePath = pathname === "/" || pathname === "/lv" || pathname === "/en" || pathname === "/de" || pathname === "/ru";
  if (isHomePath && searchParams.has("plan")) {
    intlRes.headers.set("X-Robots-Tag", "noindex, follow");
  }
  return intlRes;
}

export const config = {
  matcher: [
    "/((?!_next|_vercel|sitemap\\.xml|robots\\.txt|.*\\..*).*)",
  ],
};
