"use client";

import { AdminSourceBlockHeader } from "@/components/admin/AdminSourceBlockHeader";
import type { CitiAvotiBlockState } from "@/lib/admin-source-blocks";

const ta =
  "min-h-[72px] w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[11px] leading-snug text-[var(--color-apple-text)] placeholder:text-slate-400 focus:border-[var(--color-provin-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-provin-accent)]/25";

const LABEL_KOMENTARI = "Komentāri";

type Props = {
  value: CitiAvotiBlockState;
  readOnly: boolean;
  disabled?: boolean;
  onChange: (next: CitiAvotiBlockState) => void;
};

export function AdminCitiAvotiSourceBlock({ value, readOnly, disabled, onChange }: Props) {
  return (
    <div className="flex h-full min-h-0 flex-col rounded-lg border border-slate-200/90 bg-slate-50/40 p-2 shadow-sm">
      <AdminSourceBlockHeader blockKey="citi_avoti" />

      <div className="mt-1 w-full min-w-0">
        <label className="mb-0.5 block text-[10px] font-medium text-[var(--color-provin-muted)]">{LABEL_KOMENTARI}</label>
        {readOnly ? (
          <div className="min-h-[56px] whitespace-pre-wrap rounded-lg border border-slate-200/90 bg-white px-2 py-1.5 text-[11px] text-[var(--color-provin-muted)]">
            {value.comments.trim() ? value.comments : <span className="text-slate-400">—</span>}
          </div>
        ) : (
          <textarea
            className={ta}
            rows={5}
            placeholder="Papildu komentāri par citiem avotiem…"
            value={value.comments}
            disabled={disabled}
            onChange={(e) => onChange({ ...value, comments: e.target.value })}
            aria-label={LABEL_KOMENTARI}
          />
        )}
      </div>
    </div>
  );
}
