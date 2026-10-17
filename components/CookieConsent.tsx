"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  encodeAttrCookieValue,
  mergeAttributionCookie,
  parseAttrCookieValue,
  parsePendingAttr,
  parseVisitFromSearch,
  type AdTouch,
} from "@/lib/ad-attribution";
import { reportConsentedAdVisit } from "@/lib/ad-visit-client";
import {
  ATTR_COOKIE_NAME,
  CONSENT_STORAGE_KEY,
  PENDING_ATTR_KEY,
  parseConsent,
  PROVIN_CONSENT_UPDATED_EVENT,
  type ConsentState,
} from "@/lib/cookie-consent";
import { applyGtagConsent } from "@/lib/google-consent";

const ATTR_MAX_AGE = 180 * 24 * 60 * 60;

function currentVisit(): AdTouch {
  return parseVisitFromSearch({
    pathname: window.location.pathname,
    search: window.location.search,
    referrer: document.referrer || "",
  });
}

function readPending(): AdTouch | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    return parsePendingAttr(sessionStorage.getItem(PENDING_ATTR_KEY));
  } catch {
    return null;
  }
}

function writePending(visit: AdTouch): void {
  if (typeof sessionStorage === "undefined") return;
  if (sessionStorage.getItem("provin_pending_done")) return;
  sessionStorage.setItem(PENDING_ATTR_KEY, JSON.stringify(visit));
  sessionStorage.setItem("provin_pending_done", "1");
}

function readAttrCookie(): ReturnType<typeof parseAttrCookieValue> {
  const match = document.cookie.split(";").map((p) => p.trim());
  for (const part of match) {
    if (part.startsWith(`${ATTR_COOKIE_NAME}=`)) {
      return parseAttrCookieValue(part.slice(ATTR_COOKIE_NAME.length + 1));
    }
  }
  return null;
}

function writeAttrCookie(consentAt: string, visit: AdTouch): ReturnType<typeof parseAttrCookieValue> {
  const merged = mergeAttributionCookie({
    existing: readAttrCookie(),
    pending: readPending(),
    visit,
    consentAt,
  });
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${ATTR_COOKIE_NAME}=${encodeAttrCookieValue(merged)}; Max-Age=${ATTR_MAX_AGE}; Path=/; SameSite=Lax${secure}`;
  return merged;
}

function clearAttrCookie(): void {
  document.cookie = `${ATTR_COOKIE_NAME}=; Max-Age=0; Path=/; SameSite=Lax`;
}

function syncConsentedAttribution(consentAt: string): void {
  const visit = currentVisit();
  writePending(visit);
  const cookie = writeAttrCookie(consentAt, visit);
  reportConsentedAdVisit(cookie?.last ?? visit);
}

export function CookieConsent() {
  const t = useTranslations("Cookies");
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const visit = currentVisit();
      writePending(visit);
      const raw = localStorage.getItem(CONSENT_STORAGE_KEY);
      const c = parseConsent(raw);
      if (c === null) {
        setVisible(true);
        return;
      }
      applyGtagConsent(c.analytics);
      if (!c.analytics) {
        clearAttrCookie();
        return;
      }
      syncConsentedAttribution(c.updatedAt);
    } catch {
      setVisible(true);
    }
  }, [pathname]);

  function save(consent: ConsentState) {
    localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(consent));
    if (consent.analytics) {
      try {
        syncConsentedAttribution(consent.updatedAt);
      } catch {
        /* ignore */
      }
    } else {
      clearAttrCookie();
    }
    applyGtagConsent(consent.analytics);
    setVisible(false);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(PROVIN_CONSENT_UPDATED_EVENT));
    }
  }

  function onNecessary() {
    save({
      analytics: false,
      updatedAt: new Date().toISOString(),
    });
  }

  function onAnalytics() {
    save({
      analytics: true,
      updatedAt: new Date().toISOString(),
    });
  }

  if (!mounted || !visible) return null;

  return (
    <div
      className="cookie-consent-panel fixed bottom-[max(0.75rem,env(safe-area-inset-bottom,0px))] left-[max(0.75rem,env(safe-area-inset-left,0px))] z-[100] w-[min(18.5rem,calc(100vw-1.5rem))] rounded-lg border border-white/12 bg-slate-950/88 px-3 py-2.5 shadow-[0_8px_28px_rgba(0,0,0,0.35)] backdrop-blur-md"
      role="dialog"
      aria-labelledby="cookie-consent-title"
    >
      <div className="flex flex-col gap-2">
        <div className="min-w-0">
          <h2
            id="cookie-consent-title"
            className="cookie-consent-panel__title text-[11px] font-semibold leading-tight tracking-tight text-white/90"
          >
            {t("bannerTitle")}
          </h2>
          <p className="cookie-consent-panel__body mt-1.5 text-[10px] leading-snug text-white/55 sm:text-[11px]">
            {t("bannerText")}
          </p>
          <p className="mt-1.5 text-[10px] leading-none">
            <Link
              href="/privatuma-politika"
              className="cookie-consent-panel__link font-medium text-sky-400/95 underline decoration-sky-400/30 underline-offset-2 hover:text-sky-300 hover:decoration-sky-300/50"
            >
              {t("privacyLink")}
            </Link>
          </p>
        </div>
        <div className="cookie-consent-panel__actions flex flex-col gap-1.5 border-t border-white/[0.08] pt-2">
          <button
            type="button"
            onClick={onNecessary}
            className="cookie-consent-panel__btn-secondary w-full rounded-md border border-white/15 bg-white/[0.06] px-2 py-1.5 text-center text-[10px] font-medium leading-tight text-white/75 transition hover:border-white/25 hover:bg-white/[0.1] sm:text-[11px]"
          >
            {t("reject")}
          </button>
          <button
            type="button"
            onClick={onAnalytics}
            className="w-full rounded-md bg-[var(--color-provin-accent)] px-2 py-1.5 text-center text-[10px] font-semibold leading-tight text-white shadow-sm transition hover:opacity-95 active:opacity-90 sm:text-[11px]"
          >
            {t("acceptAnalytics")}
          </button>
        </div>
      </div>
    </div>
  );
}
