import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import {
  B2B_LOCALE_COOKIE,
  isB2bOnlyLocale,
  isPartneriemPath,
  parsePrefixedPath,
  resolveB2bEntryLocale,
  type AppLocale,
} from "./i18n/locales";
import {
  shouldBlockClosedExperimentPath,
  shouldBlockLegacyStandaloneProductPath,
} from "./lib/legacy-standalone-product-routes";
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

export default function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  if (pathname === "/sitemap.xml" || pathname === "/robots.txt") {
    return NextResponse.next();
  }

  if (
    shouldBlockLegacyStandaloneProductPath(pathname) ||
    shouldBlockClosedExperimentPath(pathname)
  ) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/lv";
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  if (searchParams.has("theme")) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.searchParams.delete("theme");
    const res = NextResponse.redirect(redirectUrl);
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

  if (prefixed.locale && isB2bOnlyLocale(prefixed.locale) && !isPartneriemPath(prefixed.rest)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = `/en${prefixed.rest === "/" ? "" : prefixed.rest}`;
    return NextResponse.redirect(redirectUrl);
  }

  if (isPartneriemPath(pathname) || (prefixed.locale && isPartneriemPath(prefixed.rest))) {
    const urlLocale = prefixed.locale;
    const rest = urlLocale ? prefixed.rest : pathname;
    const nextLocale = resolveB2bEntryLocale({
      urlLocale,
      cookie: b2bCookieValue(request),
      country: requestCountry(request),
    });
    if (!urlLocale || nextLocale !== urlLocale) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = `/${nextLocale}${rest === "/" ? "" : rest}`;
      return withB2bLocaleCookie(NextResponse.redirect(redirectUrl), nextLocale);
    }
    const intlRes = intlMiddleware(request);
    return withB2bLocaleCookie(intlRes, urlLocale);
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: [
    "/((?!api|_next|_vercel|sitemap\\.xml|robots\\.txt|.*\\..*).*)",
  ],
};
