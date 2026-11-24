"use client";

import { createContext, useContext } from "react";

import type { ContradictionFeedbackEntry, ContradictionOrigin, ContradictionVerdict } from "@/lib/contradiction-feedback";

/** Viena brīdinājuma identitāte lēmuma saglabāšanai. */
export type ContradictionFeedbackTarget = {
  origin: ContradictionOrigin;
  fp: string;
  rule: string;
  pair?: string;
  /** Smagums brīdī, kad operators lēma (statistikai). */
  severity?: string;
};

export type ContradictionFeedbackContextValue = {
  vin: string | null;
  /** Pasūtījuma + šī VIN lēmumi (pasūtījuma lēmumi pirmie). */
  entries: readonly ContradictionFeedbackEntry[];
  /** Automātiski pazemināto noteikumu atslēgas (`rule|pair`). */
  downgraded: readonly string[];
  onVerdict: (target: ContradictionFeedbackTarget, verdict: ContradictionVerdict) => void;
};

export const ContradictionFeedbackContext = createContext<ContradictionFeedbackContextValue | null>(null);

export function useContradictionFeedback(): ContradictionFeedbackContextValue | null {
  return useContext(ContradictionFeedbackContext);
}

/** Divas plakanas pogas: «Nav pretruna» / «Pareizi» (aktīvā - treknrakstā). */
export function ContradictionVerdictButtons({
  verdict,
  onVerdict,
  className = "",
}: {
  verdict?: ContradictionVerdict;
  onVerdict: (v: ContradictionVerdict) => void;
  className?: string;
}) {
  const btn = (active: boolean) =>
    `rounded-md px-1.5 py-0.5 text-[10px] font-medium hover:bg-white/70 ${active ? "bg-white/80 font-semibold" : "text-[var(--color-provin-muted)]"}`;
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 ${className}`} data-contradiction-verdict>
      <button type="button" className={btn(verdict === "dismiss")} onClick={() => onVerdict("dismiss")}>
        Nav pretruna
      </button>
      <button type="button" className={btn(verdict === "confirm")} onClick={() => onVerdict("confirm")}>
        Pareizi
      </button>
    </span>
  );
}
