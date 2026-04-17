import type { ReactNode } from "react";
import Script from "next/script";
import { cookies } from "next/headers";
import { Inter } from "next/font/google";
import { ConsentAwareAnalytics } from "@/components/ConsentAwareAnalytics";
import { getGaMeasurementId } from "@/lib/analytics-public";
import { SiteThemeProvider } from "@/components/providers/SiteThemeProvider";
import { SITE_THEME_COOKIE_KEY, SITE_THEME_STORAGE_KEY, type SiteThemeMode } from "@/lib/site-theme";
import "./globals.css";
import "./site-theme-light.css";

const inter = Inter({
  subsets: ["latin", "latin-ext", "cyrillic"],
  variable: "--font-inter",
  display: "swap",
});

export default async function RootLayout({ children }: { children: ReactNode }) {
  const gaMeasurementId = getGaMeasurementId();
  const cookieStore = await cookies();
  const cookieTheme = cookieStore.get(SITE_THEME_COOKIE_KEY)?.value;
  const initialTheme: SiteThemeMode = cookieTheme === "light" ? "light" : "dark";
  return (
    <html data-site-theme={initialTheme} className={`${inter.variable} min-w-0 max-w-full overflow-x-clip`} suppressHydrationWarning>
      <body className="min-h-dvh min-w-0 max-w-full overflow-x-clip font-sans">
        <Script
          id="site-theme-boot"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var k=${JSON.stringify(SITE_THEME_STORAGE_KEY)};var c=${JSON.stringify(SITE_THEME_COOKIE_KEY)};var p=new URLSearchParams(window.location.search);var q=p.get("theme");var forced=(q==="light"||q==="dark")?q:null;if(forced){localStorage.setItem(k,forced);document.cookie=c+'='+forced+'; Path=/; Max-Age='+(60*60*24*365)+'; SameSite=Lax';document.documentElement.setAttribute("data-site-theme",forced);return;}var v=localStorage.getItem(k);if(v==="light"||v==="dark"){document.documentElement.setAttribute("data-site-theme",v);document.cookie=c+'='+v+'; Path=/; Max-Age='+(60*60*24*365)+'; SameSite=Lax';}}catch(e){}})();`,
          }}
        />
        <SiteThemeProvider initialTheme={initialTheme}>
          {children}
          <ConsentAwareAnalytics gaMeasurementId={gaMeasurementId} />
        </SiteThemeProvider>
      </body>
    </html>
  );
}
