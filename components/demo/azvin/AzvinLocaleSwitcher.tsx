"use client";

import { useEffect, useId, useRef, useState } from "react";
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
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const menuId = useId();

  useEffect(() => {
    setLocale(readAzvinLocale());
    return subscribeAzvinLocale(setLocale);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const root = rootRef.current;
      if (!root || !(event.target instanceof Node)) return;
      if (!root.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative z-[52] shrink-0">
      <button
        type="button"
        aria-label="Language"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        title={AZVIN_LOCALE_ARIA[locale]}
        onClick={() => setOpen((prev) => !prev)}
        className={[
          "inline-flex min-h-[2.1rem] min-w-[2.1rem] items-center justify-center rounded-md border bg-transparent p-0 text-[1.35rem] leading-none transition sm:min-h-[2.35rem] sm:min-w-[2.35rem] sm:text-[1.55rem] lg:min-h-[2.5rem] lg:min-w-[2.5rem] lg:text-[1.7rem]",
          dark
            ? open
              ? "border-white/35 bg-white/10 opacity-100"
              : "border-transparent opacity-80 hover:border-white/20 hover:opacity-100"
            : open
              ? "border-black/20 bg-black/[0.04] opacity-100"
              : "border-transparent opacity-80 hover:border-black/15 hover:opacity-100",
        ].join(" ")}
      >
        <span aria-hidden>{AZVIN_LOCALE_FLAGS[locale]}</span>
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label="Language"
          className={[
            "absolute right-0 top-[calc(100%+0.4rem)] min-w-[9.5rem] overflow-hidden rounded-xl border py-1 shadow-[0_18px_40px_-18px_rgba(0,0,0,0.7)]",
            dark
              ? "border-white/12 bg-[#0c0e12]/96 backdrop-blur-md"
              : "border-black/10 bg-white/95 backdrop-blur-md",
          ].join(" ")}
        >
          {AZVIN_LOCALES.map((code) => {
            const active = code === locale;
            return (
              <button
                key={code}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                onClick={() => {
                  writeAzvinLocale(code);
                  setOpen(false);
                }}
                className={[
                  "flex w-full items-center gap-2.5 px-3 py-2 text-left text-[0.82rem] font-semibold tracking-wide transition",
                  active
                    ? dark
                      ? "bg-white/10 text-white"
                      : "bg-black/[0.05] text-[#1d1d1f]"
                    : dark
                      ? "text-white/80 hover:bg-white/[0.06] hover:text-white"
                      : "text-[#1d1d1f]/80 hover:bg-black/[0.04] hover:text-[#1d1d1f]",
                ].join(" ")}
              >
                <span className="text-[1.25rem] leading-none" aria-hidden>
                  {AZVIN_LOCALE_FLAGS[code]}
                </span>
                <span>{AZVIN_LOCALE_ARIA[code]}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
