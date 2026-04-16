"use client";

import { useCallback, useEffect, useState } from "react";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/react";
import {
  CONSENT_STORAGE_KEY,
  parseConsent,
  PROVIN_CONSENT_UPDATED_EVENT,
} from "@/lib/cookie-consent";

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
};

/**
 * GA4 un Vercel Web Analytics — tikai pēc sīkdatņu joslas piekrišanas „analītikai”.
 * Atjaunojas pēc `PROVIN_CONSENT_UPDATED_EVENT` un `storage` (citas cilnes).
 */
export function ConsentAwareAnalytics({ gaMeasurementId }: Props) {
  const [allow, setAllow] = useState(false);

  const sync = useCallback(() => {
    setAllow(readAnalyticsAllowed());
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

  if (!allow) return null;

  const id = gaMeasurementId;

  return (
    <>
      {id ? (
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
      <Analytics />
    </>
  );
}
