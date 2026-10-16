import type { ReactNode } from "react";
import Script from "next/script";
import { Inter } from "next/font/google";
import { ConsentAwareAnalytics } from "@/components/ConsentAwareAnalytics";
import { getGaMeasurementId, getTikTokPixelId } from "@/lib/analytics-public";
import { GTAG_CONSENT_DEFAULT_SNIPPET } from "@/lib/google-consent";
import { htmlLangForLocale } from "@/lib/seo-public-metadata";
import { SiteThemeProvider } from "@/components/providers/SiteThemeProvider";
import { SITE_THEME_COOKIE_KEY, SITE_THEME_STORAGE_KEY } from "@/lib/site-theme";
import "@/app/globals.css";

const inter = Inter({
  subsets: ["latin", "latin-ext", "cyrillic"],
  variable: "--font-inter",
  display: "swap",
  fallback: ["system-ui", "Segoe UI", "Arial", "sans-serif"],
  adjustFontFallback: true,
});

/**
 * Kopīgais <html>/<body> apvalks. Agrāk app/layout.tsx lasīja `headers()` (lang + host), kas visas publiskās
 * lapas padarīja dinamiskas (`cache-control: private, no-store`, CDN MISS). Tagad katrs saknes izkārtojums
 * ([locale], admin) padod `lang` pats — publiskās lapas paliek statiskas un CDN kešojamas.
 */
export function RootHtml({
  lang,
  children,
  consentModeDefaults = false,
}: {
  lang: string;
  children: ReactNode;
  /** Publiskais front: Consent Mode v2 default denied (nav /admin). */
  consentModeDefaults?: boolean;
}) {
  const gaMeasurementId = getGaMeasurementId();
  const tiktokPixelId = getTikTokPixelId();
  const htmlLang = htmlLangForLocale(lang);
  return (
    <html
      lang={htmlLang}
      data-site-theme="dark"
      className={`${inter.variable} min-w-0 max-w-full overflow-x-clip`}
      suppressHydrationWarning
    >
      <body className="min-h-dvh min-w-0 max-w-full overflow-x-clip font-sans">
        {consentModeDefaults ? (
          <Script id="gtag-consent-default" strategy="beforeInteractive">
            {GTAG_CONSENT_DEFAULT_SNIPPET}
          </Script>
        ) : null}
        <Script
          id="site-theme-boot"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var k=${JSON.stringify(SITE_THEME_STORAGE_KEY)};var c=${JSON.stringify(SITE_THEME_COOKIE_KEY)};document.documentElement.setAttribute("data-site-theme","dark");localStorage.setItem(k,"dark");document.cookie=c+"=dark; Path=/; Max-Age="+(60*60*24*365)+"; SameSite=Lax";}catch(e){}})();`,
          }}
        />
        <SiteThemeProvider>
          {children}
          <ConsentAwareAnalytics
            gaMeasurementId={gaMeasurementId}
            tiktokPixelId={tiktokPixelId}
          />
        </SiteThemeProvider>
      </body>
    </html>
  );
}
