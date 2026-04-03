"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale } from "next-intl";
import { routing } from "@/i18n/routing";
import { usePathname, useRouter } from "@/i18n/navigation";

const FLAGS: Record<string, string> = {
  lv: "🇱🇻",
  en: "🇬🇧",
  ru: "🇷🇺",
  az: "🇦🇿",
};

const LABELS: Record<string, string> = {
  lv: "Latviešu",
  en: "English",
  ru: "Русский",
  az: "Azərbaycan",
};

export function LanguageSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: MouseEvent | PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-[44px] min-w-[44px] items-center justify-center gap-0.5 rounded-md px-1 text-[15px] leading-none text-[#1d1d1f] transition hover:bg-black/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-provin-accent sm:min-h-0 sm:min-w-0 sm:justify-start sm:px-0.5 sm:py-0.5"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={LABELS[locale]}
        title={LABELS[locale]}
      >
        <span aria-hidden>{FLAGS[locale]}</span>
        <svg
          className={`h-3 w-3 shrink-0 text-[#86868b] transition ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open ? (
        <ul
          className="absolute right-0 top-full z-50 mt-1 max-h-[min(70vh,calc(100dvh-8rem))] min-w-[10rem] list-none overflow-y-auto rounded-lg border border-black/[0.08] bg-white py-1 shadow-[0_8px_24px_rgba(0,0,0,0.12)]"
          role="listbox"
          aria-label="Valoda / Language"
        >
          {routing.locales.map((loc) => {
            const active = locale === loc;
            return (
              <li key={loc} role="none">
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    setOpen(false);
                    if (!active) router.replace(pathname, { locale: loc });
                  }}
                  className={`flex min-h-[44px] w-full items-center gap-2 px-3 py-2 text-left text-[14px] leading-none transition hover:bg-black/[0.04] sm:min-h-0 ${
                    active ? "bg-provin-accent/8 font-medium text-[#1d1d1f]" : "text-[#424245]"
                  }`}
                >
                  <span className="text-[15px]" aria-hidden>
                    {FLAGS[loc]}
                  </span>
                  <span>{LABELS[loc]}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
