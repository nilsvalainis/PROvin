"use client";

import { Loader2, Sparkles } from "lucide-react";

type Props = {
  disabled?: boolean;
  busy?: boolean;
  phase?: string | null;
  notice?: string | null;
  error?: string | null;
  onClick: () => void;
};

export function AdminFlashMaxButton({ disabled, busy, phase, notice, error, onClick }: Props) {
  return (
    <div className="min-w-0">
      <button
        type="button"
        disabled={disabled || busy}
        onClick={onClick}
        className="inline-flex h-7 shrink-0 items-center gap-1 rounded-lg border border-teal-700/40 bg-teal-600 px-2 text-[10px] font-semibold text-white shadow-sm transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-45"
        title="Ģenerē CSDD, AutoDNA, CarVertical, dīlera vēsturi un visus kopsavilkuma laukus (Gemini Flash). Esošais teksts paliek kontekstā."
      >
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
        ) : (
          <Sparkles className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
        )}
        FLASH MAX
      </button>
      {phase ? (
        <p className="mt-1 max-w-[18rem] text-[10px] leading-snug text-teal-800" role="status">
          {phase}
        </p>
      ) : null}
      {notice ? (
        <p className="mt-1 max-w-[22rem] text-[10px] leading-snug text-emerald-800/90" role="status">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p className="mt-1 max-w-[22rem] text-[10px] leading-snug text-amber-800/90" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
