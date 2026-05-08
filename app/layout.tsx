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
        <Script
          id="smartsupp-live-chat"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `var _smartsupp=_smartsupp||{};_smartsupp.key='99e120aeb67ba5039e3b55f62f41884ed3fe05f4';_smartsupp.color=(document.documentElement.getAttribute('data-site-theme')==='light'?'#0066ff':'#3b82f6');window.smartsupp||(function(d){var s,c,o=smartsupp=function(){o._.push(arguments)};o._=[];var lang=(location.pathname.startsWith('/en/')||location.pathname==='/en')?'en':'lv';o('language',lang);s=d.getElementsByTagName('script')[0];c=d.createElement('script');c.type='text/javascript';c.charset='utf-8';c.async=true;c.src='https://www.smartsuppchat.com/loader.js?';s.parentNode.insertBefore(c,s);})(document);`,
          }}
        />
        <Script
          id="smartsupp-theme-sync"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(){function currentColor(){return document.documentElement.getAttribute('data-site-theme')==='light'?'#0066ff':'#3b82f6';}function currentLang(){return (location.pathname.startsWith('/en/')||location.pathname==='/en')?'en':'lv';}var last=currentColor();window._smartsupp=window._smartsupp||{};window._smartsupp.color=last;if(window.smartsupp){window.smartsupp('language',currentLang());}var obs=new MutationObserver(function(){var next=currentColor();if(next===last)return;last=next;window._smartsupp.color=next;});obs.observe(document.documentElement,{attributes:true,attributeFilter:['data-site-theme']});})();`,
          }}
        />
        <Script
          id="smartsupp-widget-chime"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(){var played=false;function playChime(){if(played)return;played=true;try{if(sessionStorage.getItem("smartsupp_widget_chime_played")==="1")return;sessionStorage.setItem("smartsupp_widget_chime_played","1");var Ctx=window.AudioContext||window.webkitAudioContext;if(!Ctx)return;var ctx=new Ctx();var osc=ctx.createOscillator();var gain=ctx.createGain();osc.type="triangle";osc.frequency.setValueAtTime(1046.5,ctx.currentTime);gain.gain.setValueAtTime(0.0001,ctx.currentTime);gain.gain.exponentialRampToValueAtTime(0.08,ctx.currentTime+0.012);gain.gain.exponentialRampToValueAtTime(0.0001,ctx.currentTime+0.09);osc.connect(gain);gain.connect(ctx.destination);osc.start();osc.stop(ctx.currentTime+0.1);}catch(e){}}function hasWidget(){return !!(document.querySelector('[id*="smartsupp"][id*="button"], [class*="smartsupp"][class*="button"], iframe[src*="smartsuppchat.com"]'));}if(hasWidget()){playChime();return;}var obs=new MutationObserver(function(){if(hasWidget()){playChime();obs.disconnect();}});obs.observe(document.documentElement,{childList:true,subtree:true});setTimeout(function(){obs.disconnect();},20000);})();`,
          }}
        />
        <noscript>
          Powered by{" "}
          <a href="https://www.smartsupp.com" target="_blank" rel="noreferrer">
            Smartsupp
          </a>
        </noscript>
      </body>
    </html>
  );
}
