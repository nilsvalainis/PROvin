"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

export type PdfExtraLang = "en" | "ru" | "de";

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

  return (
    <div ref={rootRef} className="relative inline-flex shrink-0">
      <button
        type="button"
        disabled={disabled}
        title={title}
        onClick={onPrimary}
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
          {LANGS.map((item) => (
            <button
              key={item.lang}
              type="button"
              role="menuitem"
              title={item.title}
              className="flex w-full items-center justify-between px-3 py-1.5 text-left text-[12px] font-semibold text-slate-800 hover:bg-slate-50"
              onClick={() => {
                setOpen(false);
                onLang(item.lang);
              }}
            >
              {item.short}
              <span className="ml-3 text-[10px] font-medium text-slate-500">{item.title}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
