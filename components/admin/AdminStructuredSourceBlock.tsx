"use client";

import type { SourceBlockKey, SourceBlockState, SourceDataRow } from "@/lib/admin-source-blocks";
import { SOURCE_BLOCK_LABELS, emptyDataRow } from "@/lib/admin-source-blocks";

const inp =
  "min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-[var(--color-apple-text)] placeholder:text-slate-400 focus:border-[var(--color-provin-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-provin-accent)]/25";

type Props = {
  blockKey: SourceBlockKey;
  value: SourceBlockState;
  readOnly: boolean;
  disabled?: boolean;
  onChange: (next: SourceBlockState) => void;
};

export function AdminStructuredSourceBlock({ blockKey, value, readOnly, disabled, onChange }: Props) {
  const label = SOURCE_BLOCK_LABELS[blockKey];

  const setRow = (index: number, patch: Partial<SourceDataRow>) => {
    const rows = value.rows.map((r, i) => (i === index ? { ...r, ...patch } : r));
    onChange({ ...value, rows });
  };

  const addRow = () => {
    onChange({ ...value, rows: [...value.rows, emptyDataRow()] });
  };

  const removeRow = (index: number) => {
    if (value.rows.length <= 1) return;
    onChange({ ...value, rows: value.rows.filter((_, i) => i !== index) });
  };

  return (
    <div className="rounded-lg border border-slate-200/90 bg-slate-50/40 p-2 shadow-sm">
      <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-[var(--color-provin-accent)]">
        {label}
      </div>

      <div className="space-y-1">
        {value.rows.map((row, ri) => (
          <div key={ri} className="flex flex-wrap items-center gap-1">
            {readOnly ? (
              <div className="flex min-w-0 flex-1 flex-wrap gap-1 text-[11px] text-[var(--color-provin-muted)]">
                <span className="rounded bg-white/80 px-1.5 py-0.5">{row.date.trim() || "—"}</span>
                <span className="rounded bg-white/80 px-1.5 py-0.5">{row.km.trim() || "—"}</span>
                <span className="rounded bg-white/80 px-1.5 py-0.5">{row.amount.trim() || "—"}</span>
              </div>
            ) : (
              <>
                <input
                  type="text"
                  className={`${inp} max-w-[7.5rem]`}
                  placeholder="Gads / datums"
                  value={row.date}
                  disabled={disabled}
                  onChange={(e) => setRow(ri, { date: e.target.value })}
                  aria-label={`${label} datums ${ri + 1}`}
                />
                <input
                  type="text"
                  className={`${inp} max-w-[6.5rem]`}
                  placeholder="KM"
                  value={row.km}
                  disabled={disabled}
                  onChange={(e) => setRow(ri, { km: e.target.value })}
                  aria-label={`${label} nobraukums ${ri + 1}`}
                />
                <input
                  type="text"
                  className={`${inp} max-w-[7rem]`}
                  placeholder="€ bojājumi"
                  value={row.amount}
                  disabled={disabled}
                  onChange={(e) => setRow(ri, { amount: e.target.value })}
                  aria-label={`${label} summa ${ri + 1}`}
                />
                {value.rows.length > 1 ? (
                  <button
                    type="button"
                    disabled={disabled}
                    className="shrink-0 rounded-md border border-slate-200 bg-white px-1 py-0.5 text-[10px] text-slate-500 hover:bg-red-50 hover:text-red-700 disabled:opacity-40"
                    onClick={() => removeRow(ri)}
                    title="Noņemt rindu"
                  >
                    ×
                  </button>
                ) : null}
              </>
            )}
          </div>
        ))}
        {!readOnly && !disabled ? (
          <button
            type="button"
            className="mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-md border border-dashed border-slate-300 bg-white text-base font-semibold text-[var(--color-provin-accent)] hover:border-[var(--color-provin-accent)]/50 hover:bg-slate-50"
            onClick={addRow}
            title="Jauna datu rinda"
          >
            +
          </button>
        ) : null}
      </div>

      <div className="mt-2">
        <label className="mb-0.5 block text-[10px] font-medium text-[var(--color-provin-muted)]">Komentāri</label>
        {readOnly ? (
          <div className="min-h-[40px] whitespace-pre-wrap rounded-lg border border-slate-200/90 bg-white px-2 py-1.5 text-[11px] text-[var(--color-provin-muted)]">
            {value.comments.trim() ? value.comments : <span className="text-slate-400">—</span>}
          </div>
        ) : (
          <textarea
            className="w-full resize-y rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] leading-snug text-[var(--color-apple-text)] focus:border-[var(--color-provin-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-provin-accent)]/20"
            rows={2}
            placeholder="Papildu piezīmes par šo avotu…"
            value={value.comments}
            disabled={disabled}
            onChange={(e) => onChange({ ...value, comments: e.target.value })}
          />
        )}
      </div>
    </div>
  );
}
