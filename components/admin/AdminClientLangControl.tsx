"use client";

import { createContext, useContext, useEffect, useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { ClientReportLang } from "@/lib/client-report-i18n";
import { clientLangDecisionLabel, type ClientLangDecision } from "@/lib/client-lang-detect";

/**
 * Klienta valodas izvēle pasūtījumā (Nils 27.11): čips pie pasūtījuma un dīlera «Sūtīt klientam» logā.
 * `setLang(null)` - atpakaļ uz automātisko (vietne + Latvijas signāli).
 */
export type AdminClientLangControl = {
  decision: ClientLangDecision;
  /** Partnera fiksētā valoda - maiņa nav pieejama. */
  locked: boolean;
  busy: boolean;
  setLang: (lang: ClientReportLang | null) => void;
};

export const AdminClientLangControlContext = createContext<AdminClientLangControl | null>(null);

export function useAdminClientLangControl(): AdminClientLangControl | null {
  return useContext(AdminClientLangControlContext);
}

const LANGS: { lang: ClientReportLang; title: string }[] = [
  { lang: "lv", title: "Latviešu" },
  { lang: "en", title: "English" },
  { lang: "ru", title: "Русский" },
  { lang: "de", title: "Deutsch" },
];

/** Čips «Klienta valoda: LV» ar iemeslu; klikšķis - LV/EN/RU/DE/Auto. */
export function AdminClientLangChip({ className = "" }: { className?: string }) {
  const ctl = useAdminClientLangControl();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  if (!ctl || ctl.locked) return null;
  const { decision } = ctl;
  const label = clientLangDecisionLabel(decision);
  const reason = label.slice(label.indexOf(" - ") + 3);

  return (
    <div ref={rootRef} className={`relative inline-flex ${className}`}>
      <button
        type="button"
        disabled={ctl.busy}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        title={label}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-50"
      >
        Klienta valoda: {decision.lang.toUpperCase()}
        {decision.source === "auto_lv" || decision.source === "manual" ? (
          <span className="font-medium text-slate-500">({reason})</span>
        ) : null}
        <ChevronDown className="h-3 w-3" aria-hidden />
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          className="absolute left-0 top-full z-50 mt-1 min-w-[9rem] overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
        >
          {LANGS.map((item) => (
            <button
              key={item.lang}
              type="button"
              role="menuitemradio"
              aria-checked={decision.lang === item.lang}
              className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-[12px] font-semibold hover:bg-slate-50 ${
                decision.lang === item.lang ? "text-slate-900" : "text-slate-700"
              }`}
              onClick={() => {
                setOpen(false);
                ctl.setLang(item.lang);
              }}
            >
              {item.lang.toUpperCase()}
              <span className="ml-3 text-[10px] font-medium text-slate-500">{item.title}</span>
            </button>
          ))}
          {decision.source === "manual" ? (
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center px-3 py-1.5 text-left text-[12px] font-medium text-slate-600 hover:bg-slate-50"
              onClick={() => {
                setOpen(false);
                ctl.setLang(null);
              }}
            >
              Automātiski
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** Logā: LV / EN / RU / DE segmenti (izvēle saglabājas pasūtījumā). */
export function AdminClientLangSegments({ disabled = false }: { disabled?: boolean }) {
  const ctl = useAdminClientLangControl();
  if (!ctl || ctl.locked) return null;
  const cur = ctl.decision.lang;
  return (
    <div className="flex items-center gap-2" title={clientLangDecisionLabel(ctl.decision)}>
      <span className="text-[11px] font-medium text-slate-600 max-md:text-[13px]">Valoda</span>
      <div className="flex rounded-lg bg-slate-100 p-0.5" role="radiogroup" aria-label="Klienta valoda">
        {LANGS.map((item) => (
          <button
            key={item.lang}
            type="button"
            role="radio"
            aria-checked={cur === item.lang}
            disabled={disabled || ctl.busy}
            title={item.title}
            onClick={() => {
              if (cur !== item.lang) ctl.setLang(item.lang);
            }}
            className={`min-h-8 rounded-md px-2.5 text-[11.5px] font-semibold transition disabled:opacity-50 ${
              cur === item.lang ? "bg-white text-slate-900 shadow-[0_1px_2px_rgba(0,0,0,0.12)]" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {item.lang.toUpperCase()}
          </button>
        ))}
      </div>
    </div>
  );
}
