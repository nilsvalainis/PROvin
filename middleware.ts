import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { SITE_THEME_COOKIE_KEY } from "./lib/site-theme";

/* Lokāli: `next dev` / `next start` ar `--hostname 127.0.0.1` un `localhost` hostu atšķirība var radīt
   papildu redirectus; next-intl ar vienu lokalizāciju un `localePrefix: "as-needed"`/`never` deva 307 cilpu uz `/`. */

const intlMiddleware = createMiddleware(routing);

export default function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const themeParam = searchParams.get("theme");
  if (themeParam === "light" || themeParam === "dark") {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.searchParams.delete("theme");
    const res = NextResponse.redirect(redirectUrl);
    res.cookies.set(SITE_THEME_COOKIE_KEY, themeParam, {
      path: "/",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
    });
    return res;
  }

  if (pathname.startsWith("/admin")) {
    if (!pathname.startsWith("/admin/login")) {
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set("x-admin-intended-path", pathname);
      return NextResponse.next({ request: { headers: requestHeaders } });
    }
    return NextResponse.next();
  }
  return intlMiddleware(request);
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
