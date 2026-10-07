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
  redirect308,
  resolveLegacyAliasRedirect,
  toPermanentGetRedirect,
  wwwOrigin,
} from "./lib/seo-redirects";
import { SEO_LOCALE_HEADER } from "./lib/seo-public-paths";
import { SITE_THEME_COOKIE_KEY } from "./lib/site-theme";

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

export default function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

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
        dest.pathname.startsWith("/api") ||
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

  if (
    shouldBlockLegacyStandaloneProductPath(pathname) ||
    shouldBlockClosedExperimentPath(pathname)
  ) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = `/${DEFAULT_LOCALE}`;
    redirectUrl.search = "";
    return redirect308(redirectUrl);
  }

  if (searchParams.has("theme")) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.searchParams.delete("theme");
    const res = redirect308(redirectUrl);
    res.cookies.set(SITE_THEME_COOKIE_KEY, "dark", {
      path: "/",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
    });
    return res;
  }

  if (pathname.startsWith("/admin")) {
    const requestHeaders = new Headers(request.headers);
    if (!pathname.startsWith("/admin/login")) {
      requestHeaders.set("x-admin-intended-path", pathname);
    }
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  const prefixed = parsePrefixedPath(pathname);
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
    "/((?!api|_next|_vercel|sitemap\\.xml|robots\\.txt|.*\\..*).*)",
  ],
};
