"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

export type PdfExtraLang = "en" | "ru" | "de";
export type PdfLockLang = "lv" | PdfExtraLang;

const LANGS: { lang: PdfExtraLang; short: string; title: string }[] = [
  { lang: "en", short: "EN", title: "Angļu" },
  { lang: "ru", short: "RU", title: "Krievu" },
  { lang: "de", short: "DE", title: "Vācu" },
];

/**
 * Primārā poga paliek latviešu PDF. EN / RU / DE atveras ar bultiņu.
 */
export function AdminPdfLangSplitButton({
  label,
  title,
  disabled,
  toneClass,
  dividerClass = "border-white/35",
  busyLabel,
  menuSide = "up",
  lockLang = null,
  onUnlockLang,
  onPrimary,
  onLang,
}: {
  label: string;
  title?: string;
  disabled?: boolean;
  /** Krāsa un apmale, bez noapaļojuma un izmēra. */
  toneClass: string;
  dividerClass?: string;
  busyLabel?: string | null;
  /** Kājene ir apakšā, tāpēc izvēlne iet uz augšu. */
  menuSide?: "up" | "down";
  /** Partnera izvēlētā atskaites valoda; pārējās pelēkas, līdz „Mainīt valodu”. */
  lockLang?: PdfLockLang | null;
  onUnlockLang?: () => void;
  onPrimary: () => void;
  onLang: (lang: PdfExtraLang) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const half =
    "inline-flex h-9 shrink-0 items-center justify-center text-[11px] font-semibold tracking-tight transition disabled:cursor-not-allowed disabled:opacity-40";
  const locked = Boolean(lockLang);

  return (
    <div className="inline-flex shrink-0 items-center gap-1.5">
      <div ref={rootRef} className="relative inline-flex shrink-0">
        <button
          type="button"
          disabled={disabled}
          title={locked ? `Pasūtījumā izvēlēta ${lockLang!.toUpperCase()}` : title}
          onClick={() => {
            if (lockLang && lockLang !== "lv") onLang(lockLang);
            else onPrimary();
          }}
          className={`${half} ${toneClass} rounded-l-lg px-3`}
        >
          {busyLabel ?? label}
        </button>
        <button
          type="button"
          disabled={disabled}
          aria-expanded={open}
          aria-controls={menuId}
          aria-label={`${label}: citas valodas`}
          title="EN, RU, DE"
          onClick={() => setOpen((value) => !value)}
          className={`${half} ${toneClass} rounded-r-lg border-l ${dividerClass} px-1.5`}
        >
          <ChevronDown className={`h-3.5 w-3.5 ${open ? "rotate-180" : ""}`} strokeWidth={2.25} aria-hidden />
        </button>
        {open ? (
          <div
            id={menuId}
            role="menu"
            className={`absolute right-0 z-50 min-w-[8.5rem] overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg ${
              menuSide === "down" ? "top-full mt-1.5" : "bottom-full mb-1.5"
            }`}
          >
            {LANGS.map((item) => {
              const itemLocked = Boolean(lockLang) && item.lang !== lockLang;
              return (
                <button
                  key={item.lang}
                  type="button"
                  role="menuitem"
                  title={item.title}
                  disabled={itemLocked}
                  className="flex w-full items-center justify-between px-3 py-1.5 text-left text-[12px] font-semibold text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  onClick={() => {
                    if (itemLocked) return;
                    setOpen(false);
                    onLang(item.lang);
                  }}
                >
                  {item.short}
                  <span className="ml-3 text-[10px] font-medium text-slate-500">{item.title}</span>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
      {lockLang && onUnlockLang ? (
        <button
          type="button"
          className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline"
          onClick={onUnlockLang}
        >
          Mainīt valodu
        </button>
      ) : null}
    </div>
  );
}
