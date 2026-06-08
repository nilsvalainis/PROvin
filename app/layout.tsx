import type { ReactNode } from "react";
import Script from "next/script";
import { Inter } from "next/font/google";
import { ConsentAwareAnalytics } from "@/components/ConsentAwareAnalytics";
import { getGaMeasurementId, getTikTokPixelId } from "@/lib/analytics-public";
import { SiteThemeProvider } from "@/components/providers/SiteThemeProvider";
import { SITE_THEME_COOKIE_KEY, SITE_THEME_STORAGE_KEY } from "@/lib/site-theme";
import "./globals.css";

const inter = Inter({
  subsets: ["latin", "latin-ext", "cyrillic"],
  variable: "--font-inter",
  display: "swap",
});

export default async function RootLayout({ children }: { children: ReactNode }) {
  const gaMeasurementId = getGaMeasurementId();
  const tiktokPixelId = getTikTokPixelId();
  return (
    <html data-site-theme="dark" className={`${inter.variable} min-w-0 max-w-full overflow-x-clip`} suppressHydrationWarning>
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
