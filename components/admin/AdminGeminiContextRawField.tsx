"use client";

import {
  GEMINI_CONTEXT_RAW_FIELD_LABEL,
  GEMINI_CONTEXT_RAW_MAX_LEN,
} from "@/lib/admin-gemini-context-raw";

const inp =
  "min-w-0 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[11px] leading-snug text-[var(--color-apple-text)] placeholder:text-slate-400 focus:border-[var(--color-provin-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-provin-accent)]/25";

type Props = {
  value: string;
  onChange: (next: string) => void;
  readOnly?: boolean;
  disabled?: boolean;
  id?: string;
  ariaLabel?: string;
};

export function AdminGeminiContextRawField({
  value,
  onChange,
  readOnly = false,
  disabled = false,
  id,
  ariaLabel,
}: Props) {
  return (
    <div className="mt-3 border-t border-slate-200/80 pt-3">
      <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-slate-500">
        {GEMINI_CONTEXT_RAW_FIELD_LABEL}
      </p>
      <p className="mb-1.5 text-[10px] leading-snug text-[var(--color-provin-muted)]">
        Tiek nodots tikai Gemini AI ✨ ģenerēšanai; netiek drukāts klienta PDF.
      </p>
      {readOnly ? (
        <div className="whitespace-pre-wrap rounded-md border border-slate-200/90 bg-slate-50/70 px-2 py-1.5 text-[11px] text-[var(--color-apple-text)]">
          {value.trim() ? value : <span className="text-slate-400">—</span>}
        </div>
      ) : (
        <textarea
          id={id}
          className={`${inp} min-h-[72px] resize-y`}
          value={value}
          disabled={disabled}
          maxLength={GEMINI_CONTEXT_RAW_MAX_LEN}
          placeholder="Papildu piezīmes, fragmenti, avotu atšķirības — tikai AI kontekstam…"
          onChange={(e) => onChange(e.target.value.slice(0, GEMINI_CONTEXT_RAW_MAX_LEN))}
          aria-label={ariaLabel ?? GEMINI_CONTEXT_RAW_FIELD_LABEL}
        />
      )}
    </div>
  );
}
