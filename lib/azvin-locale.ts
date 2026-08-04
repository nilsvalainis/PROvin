import type { AzvinLocale } from "@/lib/azvin-hero-copy";
import { AZVIN_LOCALES } from "@/lib/azvin-hero-copy";

export const AZVIN_LOCALE_STORAGE_KEY = "azvin-demo-locale";
export const AZVIN_LOCALE_EVENT = "azvin-locale-change";

export const AZVIN_LOCALE_FLAGS: Record<AzvinLocale, string> = {
  az: "🇦🇿",
  en: "🇬🇧",
  ru: "🇷🇺",
  lv: "🇱🇻",
};

export const AZVIN_LOCALE_ARIA: Record<AzvinLocale, string> = {
  az: "Azərbaycan",
  en: "English",
  ru: "Русский",
  lv: "Latviešu",
};

export function isAzvinLocale(value: string | null | undefined): value is AzvinLocale {
  return value === "az" || value === "en" || value === "ru" || value === "lv";
}

export function readAzvinLocale(): AzvinLocale {
  if (typeof window === "undefined") return "az";
  const raw = window.localStorage.getItem(AZVIN_LOCALE_STORAGE_KEY);
  return isAzvinLocale(raw) ? raw : "az";
}

export function writeAzvinLocale(locale: AzvinLocale) {
  window.localStorage.setItem(AZVIN_LOCALE_STORAGE_KEY, locale);
  window.dispatchEvent(
    new CustomEvent(AZVIN_LOCALE_EVENT, { detail: { locale } }),
  );
}

export function subscribeAzvinLocale(onChange: (locale: AzvinLocale) => void) {
  const handler = (event: Event) => {
    const detail = (event as CustomEvent<{ locale?: string }>).detail;
    if (isAzvinLocale(detail?.locale)) onChange(detail.locale);
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key !== AZVIN_LOCALE_STORAGE_KEY) return;
    if (isAzvinLocale(event.newValue)) onChange(event.newValue);
  };
  window.addEventListener(AZVIN_LOCALE_EVENT, handler);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(AZVIN_LOCALE_EVENT, handler);
    window.removeEventListener("storage", onStorage);
  };
}

export { AZVIN_LOCALES };
