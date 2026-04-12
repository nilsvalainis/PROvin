"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  ATTR_COOKIE_NAME,
  CONSENT_STORAGE_KEY,
  PENDING_ATTR_KEY,
  parseConsent,
  type ConsentState,
} from "@/lib/cookie-consent";

const ATTR_MAX_AGE = 180 * 24 * 60 * 60;

type PendingAttr = {
  utm: Record<string, string>;
  path: string;
  t: number;
};

function readPending(): PendingAttr | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(PENDING_ATTR_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PendingAttr;
  } catch {
    return null;
  }
}

function writePendingFromUrl(): void {
  if (typeof window === "undefined" || typeof sessionStorage === "undefined") return;
  if (sessionStorage.getItem("provin_pending_done")) return;
  const params = new URLSearchParams(window.location.search);
  const utm: Record<string, string> = {};
  for (const key of [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
  ]) {
    const v = params.get(key);
    if (v) utm[key] = v;
  }
  const path = `${window.location.pathname}${window.location.search}`;
  sessionStorage.setItem(
    PENDING_ATTR_KEY,
    JSON.stringify({ utm, path, t: Date.now() })
  );
  sessionStorage.setItem("provin_pending_done", "1");
}

function setAttrCookie(state: ConsentState): void {
  const pending = readPending();
  const payload = {
    firstLanding: pending?.path ?? `${window.location.pathname}${window.location.search}`,
    utm: pending?.utm ?? {},
    referrer: typeof document !== "undefined" ? document.referrer || null : null,
    consentAt: state.updatedAt,
  };
  const enc = encodeURIComponent(JSON.stringify(payload));
  document.cookie = `${ATTR_COOKIE_NAME}=${enc}; Max-Age=${ATTR_MAX_AGE}; Path=/; SameSite=Lax${
    window.location.protocol === "https:" ? "; Secure" : ""
  }`;
}

function clearAttrCookie(): void {
  document.cookie = `${ATTR_COOKIE_NAME}=; Max-Age=0; Path=/; SameSite=Lax`;
}

export function CookieConsent() {
  const t = useTranslations("Cookies");
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setMounted(true);
    writePendingFromUrl();
    try {
      const raw = localStorage.getItem(CONSENT_STORAGE_KEY);
      const c = parseConsent(raw);
      if (c === null) {
        setVisible(true);
        return;
      }
      if (!c.analytics) {
        clearAttrCookie();
      }
    } catch {
      setVisible(true);
    }
  }, []);

  function save(consent: ConsentState) {
    localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(consent));
    if (consent.analytics) {
      setAttrCookie(consent);
    } else {
      clearAttrCookie();
    }
    setVisible(false);
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
      className="fixed bottom-[max(0.75rem,env(safe-area-inset-bottom,0px))] left-[max(0.75rem,env(safe-area-inset-left,0px))] z-[100] w-[min(18.5rem,calc(100vw-1.5rem))] rounded-lg border border-white/12 bg-slate-950/88 px-3 py-2.5 shadow-[0_8px_28px_rgba(0,0,0,0.35)] backdrop-blur-md"
      role="dialog"
      aria-labelledby="cookie-consent-title"
    >
      <div className="flex flex-col gap-2">
        <div className="min-w-0">
          <h2 id="cookie-consent-title" className="text-[11px] font-semibold leading-tight tracking-tight text-white/90">
            {t("bannerTitle")}
          </h2>
          <p className="mt-1.5 text-[10px] leading-snug text-white/55 sm:text-[11px]">{t("bannerText")}</p>
          <p className="mt-1.5 text-[10px] leading-none">
            <Link
              href="/privatuma-politika"
              className="font-medium text-sky-400/95 underline decoration-sky-400/30 underline-offset-2 hover:text-sky-300 hover:decoration-sky-300/50"
            >
              {t("privacyLink")}
            </Link>
          </p>
        </div>
        <div className="flex flex-col gap-1.5 border-t border-white/[0.08] pt-2">
          <button
            type="button"
            onClick={onNecessary}
            className="w-full rounded-md border border-white/15 bg-white/[0.06] px-2 py-1.5 text-center text-[10px] font-medium leading-tight text-white/75 transition hover:border-white/25 hover:bg-white/[0.1] sm:text-[11px]"
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
