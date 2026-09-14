"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { B2B_LOCALE_COOKIE, B2B_LOCALES, isAppLocale, type AppLocale } from "@/i18n/locales";

const LANG_KEY: Record<AppLocale, "langLv" | "langEn" | "langDe" | "langRu"> = {
  lv: "langLv",
  en: "langEn",
  de: "langDe",
  ru: "langRu",
};

const FLAG: Record<AppLocale, string> = {
  lv: "🇱🇻",
  en: "🇬🇧",
  de: "🇩🇪",
  ru: "🇷🇺",
};

type Props = {
  dark: boolean;
  compact?: boolean;
};

export function B2bLocaleSwitcher({ dark, compact }: Props) {
  const locale = useLocale();
  const pathname = usePathname() ?? "/partneriem";
  const tHeader = useTranslations("Header");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const current = (isAppLocale(locale) ? locale : "lv") as AppLocale;

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const panelBg = dark
    ? "border-white/12 bg-[#0b1220]/96 text-white"
    : "border-black/10 bg-white text-[#1d1d1f]";
  const idle = dark ? "text-white/80 hover:text-white" : "text-[#1d1d1f]/75 hover:text-[#1d1d1f]";

  return (
    <div ref={rootRef} className="relative z-[52] inline-flex shrink-0">
      <button
        type="button"
        className={`inline-flex items-center justify-center rounded-md border border-transparent text-[1.65rem] leading-none transition ${
          compact ? "min-h-10 min-w-10" : "min-h-11 min-w-11"
        } ${idle}`}
        aria-label={tHeader("langGroupAria")}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span aria-hidden>{FLAG[current]}</span>
      </button>
      {open ? (
        <div
          role="listbox"
          aria-label={tHeader("langGroupAria")}
          className={`absolute right-0 top-full mt-1.5 min-w-[8.5rem] overflow-hidden rounded-lg border py-1 shadow-lg backdrop-blur-sm ${panelBg}`}
        >
          {B2B_LOCALES.map((id) => {
            const active = current === id;
            return (
              <Link
                key={id}
                href={pathname as never}
                locale={id}
                role="option"
                aria-selected={active}
                aria-label={tHeader(LANG_KEY[id])}
                onClick={() => {
                  persistB2bLocaleCookie(id);
                  setOpen(false);
                }}
                className={`flex items-center gap-2.5 px-3 py-2 text-[0.82rem] font-semibold no-underline transition ${
                  active ? "bg-[#2563eb]/16 text-[#93c5fd]" : idle
                }`}
              >
                <span className="text-[1.45rem] leading-none" aria-hidden>
                  {FLAG[id]}
                </span>
                {tHeader(LANG_KEY[id])}
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function persistB2bLocaleCookie(id: AppLocale) {
  const maxAge = 60 * 60 * 24 * 365;
  document.cookie = `${B2B_LOCALE_COOKIE}=${id}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
  document.cookie = `NEXT_LOCALE=${id}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
}
