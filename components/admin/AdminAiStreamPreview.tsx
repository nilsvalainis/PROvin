"use client";

/**
 * Dzīvais ✨ teksts, kamēr modelis raksta. Laukā paliek iepriekšējais saturs,
 * līdz pienāk gala (vai nepabeigtais, bet jau apmaksātais) teksts.
 */
export function AdminAiStreamPreview({ text }: { text?: string | null }) {
  const t = text?.trim();
  if (!t) return null;
  return (
    <div
      aria-live="polite"
      className="mb-1.5 max-h-44 overflow-y-auto whitespace-pre-wrap rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-[11px] leading-snug text-[var(--color-apple-text)] dark:border-slate-700 dark:bg-slate-900/40"
    >
      {t}
    </div>
  );
}
