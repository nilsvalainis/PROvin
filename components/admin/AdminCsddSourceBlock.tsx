"use client";

import { AdminSourceBlockHeader } from "@/components/admin/AdminSourceBlockHeader";
import type { CsddFormFields } from "@/lib/admin-source-blocks";
import {
  CSDD_FORM_SHORT_FIELDS,
  CSDD_LABEL_COMMENTS,
  CSDD_LABEL_PREV_RATING,
} from "@/lib/admin-source-blocks";

const inp =
  "min-w-0 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-[var(--color-apple-text)] placeholder:text-slate-400 focus:border-[var(--color-provin-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-provin-accent)]/25";

const dateKeys = new Set<keyof CsddFormFields>(["firstRegDate", "nextInspectionDate", "prevInspectionDate"]);

type Props = {
  value: CsddFormFields;
  readOnly: boolean;
  disabled?: boolean;
  onChange: (next: CsddFormFields) => void;
};

export function AdminCsddSourceBlock({ value, readOnly, disabled, onChange }: Props) {
  const setField = (key: keyof CsddFormFields, v: string) => {
    onChange({ ...value, [key]: v });
  };

  return (
    <div className="rounded-lg border border-slate-200/90 bg-white p-2 shadow-sm">
      <AdminSourceBlockHeader blockKey="csdd" />

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {CSDD_FORM_SHORT_FIELDS.map(({ key, label }) => (
          <div key={key} className="min-w-0">
            <label className="mb-0.5 block text-[10px] font-medium text-[var(--color-provin-muted)]">{label}</label>
            {readOnly ? (
              <div className="min-h-[28px] whitespace-pre-wrap rounded-md border border-slate-200/90 bg-white px-2 py-1 text-[11px] text-[var(--color-provin-muted)]">
                {value[key].trim() ? value[key] : <span className="text-slate-400">—</span>}
              </div>
            ) : dateKeys.has(key) ? (
              <input
                type="date"
                className={inp}
                value={value[key]}
                disabled={disabled}
                onChange={(e) => setField(key, e.target.value)}
                aria-label={label}
              />
            ) : key === "solidParticlesCm3" ? (
              <input
                type="text"
                inputMode="decimal"
                className={inp}
                value={value[key]}
                disabled={disabled}
                onChange={(e) => setField(key, e.target.value)}
                aria-label={label}
              />
            ) : (
              <input
                type="text"
                className={inp}
                value={value[key]}
                disabled={disabled}
                onChange={(e) => setField(key, e.target.value)}
                aria-label={label}
              />
            )}
          </div>
        ))}
      </div>

      <div className="mt-2 space-y-2">
        <div className="min-w-0 w-full">
          <label className="mb-0.5 block text-[10px] font-medium text-[var(--color-provin-muted)]">
            {CSDD_LABEL_PREV_RATING}
          </label>
          {readOnly ? (
            <div className="min-h-[72px] whitespace-pre-wrap rounded-lg border border-slate-200/90 bg-white px-2 py-1.5 text-[11px] text-[var(--color-provin-muted)]">
              {value.prevInspectionRating.trim() ? (
                value.prevInspectionRating
              ) : (
                <span className="text-slate-400">—</span>
              )}
            </div>
          ) : (
            <textarea
              className="w-full min-h-[88px] resize-y rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] leading-snug text-[var(--color-apple-text)] focus:border-[var(--color-provin-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-provin-accent)]/20"
              rows={4}
              value={value.prevInspectionRating}
              disabled={disabled}
              onChange={(e) => setField("prevInspectionRating", e.target.value)}
              aria-label={CSDD_LABEL_PREV_RATING}
            />
          )}
        </div>

        <div className="min-w-0 w-full">
          <label className="mb-0.5 block text-[10px] font-medium text-[var(--color-provin-muted)]">
            {CSDD_LABEL_COMMENTS}
          </label>
          {readOnly ? (
            <div className="min-h-[56px] whitespace-pre-wrap rounded-lg border border-slate-200/90 bg-white px-2 py-1.5 text-[11px] text-[var(--color-provin-muted)]">
              {value.comments.trim() ? value.comments : <span className="text-slate-400">—</span>}
            </div>
          ) : (
            <textarea
              className="w-full min-h-[72px] resize-y rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] leading-snug text-[var(--color-apple-text)] focus:border-[var(--color-provin-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-provin-accent)]/20"
              rows={4}
              value={value.comments}
              disabled={disabled}
              onChange={(e) => setField("comments", e.target.value)}
              aria-label={CSDD_LABEL_COMMENTS}
            />
          )}
        </div>
      </div>
    </div>
  );
}
