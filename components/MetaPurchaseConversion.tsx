"use client";

import { useEffect } from "react";
import { PROVIN_CONSENT_UPDATED_EVENT } from "@/lib/cookie-consent";
import { trackMetaPurchase } from "@/lib/meta-pixel";

type Props = {
  transactionId: string;
  value: number;
};

const FIRED_PREFIX = "provin_meta_purchase_";

/**
 * /paldies: one Purchase with eventID = Stripe checkout session id.
 * Only mounted when Stripe confirms paid. No UI.
 */
export function MetaPurchaseConversion({ transactionId, value }: Props) {
  useEffect(() => {
    if (!transactionId || !Number.isFinite(value) || value <= 0) return;

    const key = `${FIRED_PREFIX}${transactionId}`;
    const tryFire = () => {
      if (typeof sessionStorage === "undefined") return false;
      if (sessionStorage.getItem(key) === "1") return true;
      const ok = trackMetaPurchase({ eventId: transactionId, value });
      if (ok) sessionStorage.setItem(key, "1");
      return ok;
    };

    if (tryFire()) return;

    const onConsent = () => {
      tryFire();
    };
    const interval = window.setInterval(() => {
      if (tryFire()) window.clearInterval(interval);
    }, 400);
    const stop = window.setTimeout(() => window.clearInterval(interval), 12_000);
    window.addEventListener(PROVIN_CONSENT_UPDATED_EVENT, onConsent);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(stop);
      window.removeEventListener(PROVIN_CONSENT_UPDATED_EVENT, onConsent);
    };
  }, [transactionId, value]);

  return null;
}
