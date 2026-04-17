"use client";

import type { SourcePdfChecklist } from "@/lib/admin-source-blocks";
import {
  SOURCE_PDF_CHECKLIST_KEYS,
  SOURCE_PDF_CHECKLIST_META,
  emptySourcePdfChecklist,
  formatSourcePdfChecklistForPdf,
} from "@/lib/admin-source-blocks";

const rowCls =
  "flex items-start gap-2 rounded-md border border-slate-200/80 bg-slate-50/60 px-2 py-1.5 text-[11px] text-[var(--color-apple-text)]";

type Props = {
  idPrefix: string;
  value: SourcePdfChecklist | undefined;
  onChange: (next: SourcePdfChecklist) => void;
  readOnly: boolean;
  disabled?: boolean;
};

export function AdminSourcePdfChecklist({ idPrefix, value, onChange, readOnly, disabled }: Props) {
  const c = value ?? emptySourcePdfChecklist();

  const setKey = (key: keyof SourcePdfChecklist, checked: boolean) => {
    onChange({ ...c, [key]: checked });
  };

  if (readOnly) {
    const lines = formatSourcePdfChecklistForPdf(c);
    return (
      <div className="mb-2 rounded-lg border border-slate-200/80 bg-slate-50/40 px-2 py-1.5">
        <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-slate-500">
          PDF apstiprinājumi
        </p>
        {lines ? (
          <pre className="whitespace-pre-wrap font-sans text-[11px] leading-snug text-[var(--color-provin-muted)]">
            {lines}
          </pre>
        ) : (
          <span className="text-[11px] text-slate-400">—</span>
        )}
      </div>
    );
  }

  return (
    <div className="mb-2 rounded-lg border border-slate-200/80 bg-slate-50/40 px-2 py-2">
      <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
        PDF apstiprinājumi (drukājas zem „Komentāri”)
      </p>
      <ul className="flex flex-col gap-1.5">
        {SOURCE_PDF_CHECKLIST_KEYS.map((key) => {
          const meta = SOURCE_PDF_CHECKLIST_META[key];
          const id = `${idPrefix}-pdf-check-${key}`;
          return (
            <li key={key} className={rowCls}>
              <input
                id={id}
                type="checkbox"
                className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-slate-300 text-[var(--color-provin-accent)] focus:ring-[var(--color-provin-accent)]/30"
                checked={c[key]}
                disabled={disabled}
                onChange={(e) => setKey(key, e.target.checked)}
                aria-describedby={`${id}-hint`}
              />
              <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer leading-snug">
                <span className="font-medium">{meta.label}</span>
                <span id={`${id}-hint`} className="block text-[10px] text-slate-500">
                  PDF: {meta.label} - {meta.pdfSuffix}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
