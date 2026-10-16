"use client";

import { useEffect } from "react";
import {
  GOOGLE_ADS_ID,
  buildGoogleAdsConversionEvent,
  getGoogleAdsPurchaseLabel,
  markGoogleAdsConversionFired,
  shouldFireGoogleAdsConversion,
} from "@/lib/google-ads";

type Props = {
  transactionId: string;
  value: number;
};

/**
 * Stripe Checkout success (`/paldies`): viens Google Ads purchase conversion
 * uz sesijas/pasūtījuma ID. Bez `NEXT_PUBLIC_GADS_PURCHASE_LABEL` - no-op.
 */
export function GoogleAdsPurchaseConversion({ transactionId, value }: Props) {
  useEffect(() => {
    const label = getGoogleAdsPurchaseLabel(process.env.NEXT_PUBLIC_GADS_PURCHASE_LABEL);
    const event = buildGoogleAdsConversionEvent({ label, value, transactionId });
    if (!event) return;

    let storage: Storage | null = null;
    try {
      storage = sessionStorage;
      if (!shouldFireGoogleAdsConversion(storage, event.transaction_id)) return;
    } catch {
      storage = null;
    }

    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 40;

    const trySend = () => {
      if (cancelled) return;
      const gtag = window.gtag;
      if (typeof gtag !== "function") {
        attempts += 1;
        if (attempts < maxAttempts) window.setTimeout(trySend, 100);
        return;
      }
      try {
        if (storage && !shouldFireGoogleAdsConversion(storage, event.transaction_id)) return;
      } catch {
        /* ignore */
      }
      gtag("event", "conversion", {
        send_to: `${GOOGLE_ADS_ID}/${process.env.NEXT_PUBLIC_GADS_PURCHASE_LABEL}`,
        value: event.value,
        currency: "EUR",
        transaction_id: event.transaction_id,
      });
      try {
        if (storage) markGoogleAdsConversionFired(storage, event.transaction_id);
      } catch {
        /* ignore */
      }
    };

    trySend();
    return () => {
      cancelled = true;
    };
  }, [transactionId, value]);

  return null;
}
