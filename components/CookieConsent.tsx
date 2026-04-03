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
      className="fixed inset-x-0 bottom-0 z-[100] border-t border-slate-200/90 bg-white/95 px-4 py-4 shadow-[0_-8px_32px_rgba(15,23,42,0.12)] backdrop-blur-md sm:px-6"
      role="dialog"
      aria-labelledby="cookie-consent-title"
    >
      <div className="mx-auto flex max-w-4xl flex-col gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
        <div className="min-w-0 flex-1">
          <h2
            id="cookie-consent-title"
            className="text-sm font-semibold text-[var(--color-apple-text)]"
          >
            {t("bannerTitle")}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-[var(--color-provin-muted)]">
            {t("bannerText")}
          </p>
          <p className="mt-2 text-xs text-[var(--color-provin-muted)]">
            <Link
              href="/privatuma-politika"
              className="font-medium text-[var(--color-provin-accent)] underline decoration-[var(--color-provin-accent)]/35 underline-offset-2 hover:decoration-[var(--color-provin-accent)]"
            >
              {t("privacyLink")}
            </Link>
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={onNecessary}
            className="rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-[var(--color-apple-text)] shadow-sm hover:bg-slate-50"
          >
            {t("reject")}
          </button>
          <button
            type="button"
            onClick={onAnalytics}
            className="provin-btn rounded-full px-4 py-2.5 text-sm font-medium"
          >
            {t("acceptAnalytics")}
          </button>
        </div>
      </div>
    </div>
  );
}
