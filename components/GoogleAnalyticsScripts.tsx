import Script from "next/script";
import { getGaMeasurementId } from "@/lib/analytics-public";

/**
 * Google Analytics 4 (gtag.js) — tikai ja `NEXT_PUBLIC_GA_MEASUREMENT_ID` ir derīgs `G-…`.
 * EEZ: Google iesaka Consent Mode; saskaņot ar `CookieConsent` / privātuma politiku pirms produkcijas.
 */
export function GoogleAnalyticsScripts() {
  const id = getGaMeasurementId();
  if (!id) return null;

  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`} strategy="afterInteractive" />
      <Script id="ga4-gtag-config" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${id}');`}
      </Script>
    </>
  );
}
