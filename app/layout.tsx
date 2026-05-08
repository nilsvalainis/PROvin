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
            __html: `var _smartsupp=_smartsupp||{};_smartsupp.key='99e120aeb67ba5039e3b55f62f41884ed3fe05f4';function __ssTheme(){return document.documentElement.getAttribute('data-site-theme')==='light'?'light':'dark';}function __ssColor(){return __ssTheme()==='light'?'#0066ff':'#3b82f6';}function __ssLang(){return (location.pathname.startsWith('/en/')||location.pathname==='/en')?'en':'lv';}_smartsupp.color=__ssColor();window.smartsupp||(function(d){var s,c,o=smartsupp=function(){o._.push(arguments)};o._=[];o('language',__ssLang());s=d.getElementsByTagName('script')[0];c=d.createElement('script');c.type='text/javascript';c.charset='utf-8';c.async=true;c.src='https://www.smartsuppchat.com/loader.js?';s.parentNode.insertBefore(c,s);})(document);`,
          }}
        />
        <Script
          id="smartsupp-theme-sync"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(){function currentTheme(){return document.documentElement.getAttribute('data-site-theme')==='light'?'light':'dark';}function currentColor(){return currentTheme()==='light'?'#0066ff':'#3b82f6';}function currentLang(){return (location.pathname.startsWith('/en/')||location.pathname==='/en')?'en':'lv';}function applyWidgetOptions(){window._smartsupp=window._smartsupp||{};window._smartsupp.color=currentColor();if(window.smartsupp){window.smartsupp('language',currentLang());}}function syncLauncherSurface(){var dark=currentTheme()==='dark';var btn=document.querySelector('[id*="smartsupp"][id*="button"], [class*="smartsupp"][class*="button"]');if(!btn)return;btn.style.boxShadow=dark?'0 0 0 1px rgba(255,255,255,0.08),0 10px 28px rgba(0,0,0,0.45)':'0 0 0 1px rgba(0,0,0,0.08),0 10px 26px rgba(0,102,255,0.22)';btn.style.borderRadius='9999px';}var lastTheme=currentTheme();var lastPath=location.pathname;applyWidgetOptions();syncLauncherSurface();var attrObs=new MutationObserver(function(){var nextTheme=currentTheme();if(nextTheme!==lastTheme){lastTheme=nextTheme;applyWidgetOptions();syncLauncherSurface();}});attrObs.observe(document.documentElement,{attributes:true,attributeFilter:['data-site-theme']});var nodeObs=new MutationObserver(function(){syncLauncherSurface();});nodeObs.observe(document.documentElement,{childList:true,subtree:true});var _push=history.pushState;history.pushState=function(){_push.apply(history,arguments);if(location.pathname!==lastPath){lastPath=location.pathname;applyWidgetOptions();}};var _replace=history.replaceState;history.replaceState=function(){_replace.apply(history,arguments);if(location.pathname!==lastPath){lastPath=location.pathname;applyWidgetOptions();}};window.addEventListener('popstate',function(){if(location.pathname!==lastPath){lastPath=location.pathname;applyWidgetOptions();}});})();`,
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
