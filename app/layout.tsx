import type { ReactNode } from "react";
import Script from "next/script";
import { Inter } from "next/font/google";
import { SiteVercelAnalytics } from "@/components/SiteVercelAnalytics";
import { SiteThemeProvider } from "@/components/providers/SiteThemeProvider";
import { SITE_THEME_STORAGE_KEY } from "@/lib/site-theme";
import "./globals.css";
import "./site-theme-light.css";

const inter = Inter({
  subsets: ["latin", "latin-ext", "cyrillic"],
  variable: "--font-inter",
  display: "swap",
});

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html className={`${inter.variable} min-w-0 max-w-full overflow-x-clip`} suppressHydrationWarning>
      <body className="min-h-dvh min-w-0 max-w-full overflow-x-clip font-sans">
        <Script
          id="site-theme-boot"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var k=${JSON.stringify(SITE_THEME_STORAGE_KEY)};var v=localStorage.getItem(k);if(v==="light"||v==="dark")document.documentElement.setAttribute("data-site-theme",v);}catch(e){}})();`,
          }}
        />
        <SiteThemeProvider>
          {children}
          <SiteVercelAnalytics />
        </SiteThemeProvider>
      </body>
    </html>
  );
}
