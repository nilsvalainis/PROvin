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
  CONSENT_COOKIE_MAX_AGE,
  CONSENT_COOKIE_NAME,
  CONSENT_STORAGE_KEY,
  PENDING_ATTR_KEY,
  parseConsent,
  PROVIN_CONSENT_UPDATED_EVENT,
  type ConsentState,
} from "@/lib/cookie-consent";
import { applyGtagConsent } from "@/lib/google-consent";
import { applyMetaConsent } from "@/lib/meta-pixel";

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

function writeConsentCookie(granted: boolean): void {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  if (granted) {
    document.cookie = `${CONSENT_COOKIE_NAME}=1; Max-Age=${CONSENT_COOKIE_MAX_AGE}; Path=/; SameSite=Lax${secure}`;
    return;
  }
  document.cookie = `${CONSENT_COOKIE_NAME}=; Max-Age=0; Path=/; SameSite=Lax`;
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
  /** Divas kategorijas (audits P6): noklusējumā izslēgtas, kā prasa ePrivacy. */
  const [analyticsOn, setAnalyticsOn] = useState(false);
  const [adsOn, setAdsOn] = useState(false);
  /** Slēdži aiz «Iestatījumi», lai aizvērtā josla nav augstāka par veco un neaizsedz hero CTA 390 px. */
  const [settingsOpen, setSettingsOpen] = useState(false);

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
      applyGtagConsent(c.analytics, c.ads);
      applyMetaConsent(c.ads);
      writeConsentCookie(c.ads);
      if (!c.ads) {
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
    // Servera karodziņš (Meta CAPI, attribūcija) un `provin_attr` = reklāmas kategorija.
    writeConsentCookie(consent.ads);
    if (consent.ads) {
      try {
        syncConsentedAttribution(consent.updatedAt);
      } catch {
        /* ignore */
      }
    } else {
      clearAttrCookie();
    }
    applyGtagConsent(consent.analytics, consent.ads);
    applyMetaConsent(consent.ads);
    setVisible(false);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(PROVIN_CONSENT_UPDATED_EVENT));
    }
  }

  function onNecessary() {
    save({ analytics: false, ads: false, updatedAt: new Date().toISOString() });
  }

  function onAcceptAll() {
    save({ analytics: true, ads: true, updatedAt: new Date().toISOString() });
  }

  function onSaveChoice() {
    save({ analytics: analyticsOn, ads: adsOn, updatedAt: new Date().toISOString() });
  }

  if (!mounted || !visible) return null;

  return (
    <div
      className="cookie-consent-panel provin-cookie-in fixed bottom-[max(1.25rem,env(safe-area-inset-bottom,0px))] left-[max(1.25rem,env(safe-area-inset-left,0px))] z-[100] w-[min(27.5rem,calc(100vw-1.5rem))] rounded-[18px] border border-white/12 bg-[#14151a]/96 px-[18px] pb-4 pt-[18px] shadow-[0_20px_50px_rgba(0,0,0,0.6)] backdrop-blur-md max-[760px]:left-3 max-[760px]:right-3 max-[760px]:w-auto"
      role="dialog"
      aria-labelledby="cookie-consent-title"
    >
      <div className="flex flex-col gap-2">
        <div className="min-w-0">
          <h2
            id="cookie-consent-title"
            className="cookie-consent-panel__title text-[14px] font-bold leading-tight text-white"
          >
            {t("bannerTitle")}
          </h2>
          <p className="cookie-consent-panel__body mt-1.5 text-[12.5px] leading-[1.55] text-zinc-400">
            {t("bannerText")}
          </p>
          <p className="mt-1.5 text-[12.5px] leading-none">
            <Link
              href="/privatuma-politika"
              className="cookie-consent-panel__link font-medium text-zinc-300 underline decoration-white/30 underline-offset-2 hover:text-white"
            >
              {t("privacyLink")}
            </Link>
            <span className="text-white/30" aria-hidden="true">
              {" "}
              ·{" "}
            </span>
            <button
              type="button"
              onClick={() => setSettingsOpen((open) => !open)}
              aria-expanded={settingsOpen}
              aria-controls="cookie-consent-categories"
              className="cookie-consent-panel__link font-medium text-zinc-300 underline decoration-white/30 underline-offset-2 hover:text-white"
            >
              {t("settings")}
            </button>
          </p>
        </div>
        {settingsOpen ? (
        <fieldset id="cookie-consent-categories" className="flex flex-col gap-1.5 border-t border-white/[0.08] pt-2">
          <legend className="sr-only">{t("categoriesLegend")}</legend>
          {(
            [
              ["cookie-consent-analytics", analyticsOn, setAnalyticsOn, "categoryAnalytics", "categoryAnalyticsDesc"],
              ["cookie-consent-ads", adsOn, setAdsOn, "categoryAds", "categoryAdsDesc"],
            ] as const
          ).map(([id, on, setOn, label, desc]) => (
            <label key={id} htmlFor={id} className="flex cursor-pointer items-start gap-2">
              <input
                id={id}
                type="checkbox"
                role="switch"
                checked={on}
                onChange={(event) => setOn(event.target.checked)}
                className="mt-[2px] h-4 w-4 shrink-0 accent-[var(--color-provin-accent)]"
              />
              <span className="min-w-0 text-[12px] leading-snug text-zinc-400">
                <span className="font-semibold text-white/85">{t(label)}</span> {t(desc)}
              </span>
            </label>
          ))}
        </fieldset>
        ) : null}
        <div className="cookie-consent-panel__actions mt-1 grid grid-cols-2 gap-2">
          <div className={settingsOpen ? "col-span-2 grid grid-cols-2 gap-2" : "contents"}>
          <button
            type="button"
            onClick={onNecessary}
            className="cookie-consent-panel__btn-secondary provin-press flex min-h-[40px] w-full items-center justify-center rounded-full border border-white/20 px-3 py-1.5 text-center text-[12.5px] font-bold leading-tight text-white transition hover:border-white"
          >
            {t("reject")}
          </button>
          {settingsOpen ? (
          <button
            type="button"
            onClick={onSaveChoice}
            className="cookie-consent-panel__btn-secondary provin-press flex min-h-[40px] w-full items-center justify-center rounded-full border border-white/20 px-3 py-1.5 text-center text-[12.5px] font-bold leading-tight text-white transition hover:border-white"
          >
            {t("saveChoice")}
          </button>
          ) : null}
          </div>
          <button
            type="button"
            onClick={onAcceptAll}
            className={`provin-press flex min-h-[40px] w-full items-center justify-center rounded-full bg-white px-3 py-1.5 text-center text-[12.5px] font-bold leading-tight text-[#0a0a0a] transition hover:-translate-y-px ${settingsOpen ? "col-span-2" : ""}`}
          >
            {t("acceptAnalytics")}
          </button>
        </div>
      </div>
    </div>
  );
}
