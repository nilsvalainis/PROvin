"use client";

import { useCallback, useEffect, useState } from "react";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/react";
import {
  CONSENT_STORAGE_KEY,
  parseConsent,
  PROVIN_CONSENT_UPDATED_EVENT,
} from "@/lib/cookie-consent";

/** @temporary TikTok Events Manager verification — restore consent gate after verification. */
const TIKTOK_PIXEL_BYPASS_CONSENT = true;

function readAnalyticsAllowed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem(CONSENT_STORAGE_KEY);
    return parseConsent(raw)?.analytics === true;
  } catch {
    return false;
  }
}

type Props = {
  /** Derīgs `G-…` no servera (`getGaMeasurementId`); `null` — GA neielādē. */
  gaMeasurementId: string | null;
  /** TikTok Pixel SDK ID; `null` — pixel neielādē. */
  tiktokPixelId: string | null;
};

/**
 * Vercel Web Analytics — visiem apmeklējumiem (agregēti, pirmās puses mitināšanas statistika).
 * Google Analytics 4 — tikai pēc sīkdatņu joslas piekrišanas „analītikai”.
 * TikTok Pixel — pagaidu bez piekrišanas, kamēr `TIKTOK_PIXEL_BYPASS_CONSENT` ir `true`.
 */
export function ConsentAwareAnalytics({ gaMeasurementId, tiktokPixelId }: Props) {
  const [gaAllowed, setGaAllowed] = useState(false);

  const sync = useCallback(() => {
    setGaAllowed(readAnalyticsAllowed());
  }, []);

  useEffect(() => {
    sync();
    const onCustom = () => sync();
    const onStorage = (e: StorageEvent) => {
      if (e.key === CONSENT_STORAGE_KEY) sync();
    };
    window.addEventListener(PROVIN_CONSENT_UPDATED_EVENT, onCustom);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(PROVIN_CONSENT_UPDATED_EVENT, onCustom);
      window.removeEventListener("storage", onStorage);
    };
  }, [sync]);

  const id = gaMeasurementId;
  const ttPixel = tiktokPixelId;

  return (
    <>
      <Analytics />
      {gaAllowed && id ? (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`}
            strategy="afterInteractive"
          />
          <Script id="ga4-gtag-config" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}
gtag('consent','default',{analytics_storage:'granted',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});
gtag('js',new Date());
gtag('config','${id}');`}
          </Script>
        </>
      ) : null}
      {(TIKTOK_PIXEL_BYPASS_CONSENT || gaAllowed) && ttPixel ? (
        <Script id="tiktok-pixel" strategy="afterInteractive">
          {`!function (w, d, t) {
  w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(
var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js",o=n&&n.partner;ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=r,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};n=document.createElement("script")
;n.type="text/javascript",n.async=!0,n.src=r+"?sdkid="+e+"&lib="+t;e=document.getElementsByTagName("script")[0];e.parentNode.insertBefore(n,e)};

  ttq.load(${JSON.stringify(ttPixel)});
  ttq.page();
}(window, document, 'ttq');`}
        </Script>
      ) : null}
    </>
  );
}
