"use client";

import { useEffect, useState } from "react";
import type { AzvinLocale } from "@/lib/azvin-hero-copy";
import {
  AZVIN_LOCALES,
  AZVIN_LOCALE_ARIA,
  AZVIN_LOCALE_FLAGS,
  readAzvinLocale,
  writeAzvinLocale,
  subscribeAzvinLocale,
} from "@/lib/azvin-locale";

type Props = {
  dark?: boolean;
};

export function AzvinLocaleSwitcher({ dark = true }: Props) {
  const [locale, setLocale] = useState<AzvinLocale>("az");

  useEffect(() => {
    setLocale(readAzvinLocale());
    return subscribeAzvinLocale(setLocale);
  }, []);

  return (
    <div
      className="relative z-[52] flex shrink-0 items-center gap-1 sm:gap-1.5"
      role="group"
      aria-label="Language"
    >
      {AZVIN_LOCALES.map((code) => {
        const active = code === locale;
        return (
          <button
            key={code}
            type="button"
            aria-label={AZVIN_LOCALE_ARIA[code]}
            aria-pressed={active}
            title={AZVIN_LOCALE_ARIA[code]}
            onClick={() => writeAzvinLocale(code)}
            className={[
              "inline-flex min-h-[2.1rem] min-w-[2.1rem] items-center justify-center rounded-md border bg-transparent p-0 text-[1.35rem] leading-none transition sm:min-h-[2.35rem] sm:min-w-[2.35rem] sm:text-[1.55rem] lg:min-h-[2.5rem] lg:min-w-[2.5rem] lg:text-[1.7rem]",
              active
                ? dark
                  ? "border-white/35 bg-white/10 opacity-100"
                  : "border-black/20 bg-black/[0.04] opacity-100"
                : dark
                  ? "border-transparent opacity-55 hover:border-white/20 hover:opacity-90"
                  : "border-transparent opacity-55 hover:border-black/15 hover:opacity-90",
            ].join(" ")}
          >
            <span aria-hidden>{AZVIN_LOCALE_FLAGS[code]}</span>
          </button>
        );
      })}
    </div>
  );
}
