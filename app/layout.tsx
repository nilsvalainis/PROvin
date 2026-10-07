import type { ReactNode } from "react";
import { headers } from "next/headers";
import Script from "next/script";
import { Inter } from "next/font/google";
import { ConsentAwareAnalytics } from "@/components/ConsentAwareAnalytics";
import { getGaMeasurementId, getTikTokPixelId } from "@/lib/analytics-public";
import { DEFAULT_LOCALE } from "@/i18n/locales";
import { htmlLangForLocale } from "@/lib/seo-public-metadata";
import { SEO_LOCALE_HEADER } from "@/lib/seo-public-paths";
import { SiteThemeProvider } from "@/components/providers/SiteThemeProvider";
import { SITE_THEME_COOKIE_KEY, SITE_THEME_STORAGE_KEY } from "@/lib/site-theme";
import "./globals.css";

const inter = Inter({
  subsets: ["latin", "latin-ext", "cyrillic"],
  variable: "--font-inter",
  display: "swap",
  fallback: ["system-ui", "Segoe UI", "Arial", "sans-serif"],
  adjustFontFallback: true,
});

export default async function RootLayout({ children }: { children: ReactNode }) {
  const gaMeasurementId = getGaMeasurementId();
  const tiktokPixelId = getTikTokPixelId();
  const requestHeaders = await headers();
  const localeHeader =
    requestHeaders.get(SEO_LOCALE_HEADER) || requestHeaders.get("x-next-intl-locale");
  const htmlLang = htmlLangForLocale(localeHeader || DEFAULT_LOCALE);
  return (
    <html
      lang={htmlLang}
      data-site-theme="dark"
      className={`${inter.variable} min-w-0 max-w-full overflow-x-clip`}
      suppressHydrationWarning
    >
      <body className="min-h-dvh min-w-0 max-w-full overflow-x-clip font-sans">
        <Script
          id="site-theme-boot"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var k=${JSON.stringify(SITE_THEME_STORAGE_KEY)};var c=${JSON.stringify(SITE_THEME_COOKIE_KEY)};document.documentElement.setAttribute("data-site-theme","dark");localStorage.setItem(k,"dark");document.cookie=c+"=dark; Path=/; Max-Age="+(60*60*24*365)+"; SameSite=Lax";}catch(e){}})();`,
          }}
        />
        <SiteThemeProvider>
          {children}
          <ConsentAwareAnalytics gaMeasurementId={gaMeasurementId} tiktokPixelId={tiktokPixelId} />
        </SiteThemeProvider>
      </body>
    </html>
  );
}
