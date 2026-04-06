"use client";

import { AdminSourceBlockHeader } from "@/components/admin/AdminSourceBlockHeader";
import type { LtabBlockState, LtabIncidentRow } from "@/lib/admin-source-blocks";
import { emptyLtabRow } from "@/lib/admin-source-blocks";

const inp =
  "min-w-0 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-[var(--color-apple-text)] placeholder:text-slate-400 focus:border-[var(--color-provin-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-provin-accent)]/25";

type Props = {
  value: LtabBlockState;
  readOnly: boolean;
  disabled?: boolean;
  onChange: (next: LtabBlockState) => void;
};

export function AdminLtabSourceBlock({ value, readOnly, disabled, onChange }: Props) {
  const setRow = (index: number, patch: Partial<LtabIncidentRow>) => {
    const rows = value.rows.map((r, i) => (i === index ? { ...r, ...patch } : r));
    onChange({ ...value, rows });
  };

  const addRow = () => {
    onChange({ ...value, rows: [...value.rows, emptyLtabRow()] });
  };

  const removeRow = (index: number) => {
    if (value.rows.length <= 1) return;
    onChange({ ...value, rows: value.rows.filter((_, i) => i !== index) });
  };

  return (
    <div className="flex h-full min-h-0 flex-col rounded-lg border border-slate-200/90 bg-slate-50/40 p-2 shadow-sm">
      <AdminSourceBlockHeader blockKey="ltab" />

      <div className="space-y-2">
        {value.rows.map((row, ri) => (
          <div
            key={ri}
            className="flex flex-wrap items-end gap-x-3 gap-y-2 rounded-md border border-slate-200/60 bg-white/50 px-2 py-2"
          >
            {readOnly ? (
              <div className="flex min-w-0 flex-1 flex-wrap gap-2 text-[11px] text-[var(--color-provin-muted)]">
                <span className="rounded bg-white/90 px-1.5 py-0.5">
                  <span className="text-[10px] text-[var(--color-provin-muted)]">Negadījumu skaits:</span>{" "}
                  {row.incidentNo.trim() || "—"}
                </span>
                <span className="rounded bg-white/90 px-1.5 py-0.5">
                  <span className="text-[10px] text-[var(--color-provin-muted)]">CSNg Datums:</span>{" "}
                  {row.csngDate.trim() || "—"}
                </span>
                <span className="rounded bg-white/90 px-1.5 py-0.5">
                  <span className="text-[10px] text-[var(--color-provin-muted)]">Zaudējumu summa:</span>{" "}
                  {row.lossAmount.trim() || "—"}
                </span>
              </div>
            ) : (
              <>
                <div className="w-[6.5rem] min-w-[5.5rem] shrink-0">
                  <label className="mb-0.5 block text-[10px] font-medium text-[var(--color-provin-muted)]">
                    Negadījumu skaits:
                  </label>
                  <input
                    type="text"
                    className={inp}
                    placeholder="1."
                    value={row.incidentNo}
                    disabled={disabled}
                    onChange={(e) => setRow(ri, { incidentNo: e.target.value })}
                    aria-label={`Negadījumu skaits, rinda ${ri + 1}`}
                  />
                </div>
                <div className="min-w-[9rem] max-w-[11rem] flex-1">
                  <label className="mb-0.5 block text-[10px] font-medium text-[var(--color-provin-muted)]">
                    CSNg Datums:
                  </label>
                  <input
                    type="date"
                    className={inp}
                    value={row.csngDate}
                    disabled={disabled}
                    onChange={(e) => setRow(ri, { csngDate: e.target.value })}
                    aria-label={`CSNg Datums, rinda ${ri + 1}`}
                  />
                </div>
                <div className="min-w-[8rem] flex-1 sm:max-w-[14rem]">
                  <label className="mb-0.5 block text-[10px] font-medium text-[var(--color-provin-muted)]">
                    Zaudējumu summa:
                  </label>
                  <input
                    type="text"
                    className={inp}
                    placeholder="2930.00 €"
                    value={row.lossAmount}
                    disabled={disabled}
                    onChange={(e) => setRow(ri, { lossAmount: e.target.value })}
                    aria-label={`Zaudējumu summa, rinda ${ri + 1}`}
                  />
                </div>
                {value.rows.length > 1 ? (
                  <button
                    type="button"
                    disabled={disabled}
                    className="mb-0.5 shrink-0 self-end rounded-md border border-slate-200 bg-white px-1.5 py-1 text-[10px] text-slate-500 hover:bg-red-50 hover:text-red-700 disabled:opacity-40"
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
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-dashed border-slate-300 bg-white text-base font-semibold text-[var(--color-provin-accent)] hover:border-[var(--color-provin-accent)]/50 hover:bg-slate-50"
            onClick={addRow}
            title="Pievienot negadījumu"
          >
            +
          </button>
        ) : null}
      </div>

      <div className="mt-3 w-full min-w-0">
        <label className="mb-0.5 block text-[10px] font-medium text-[var(--color-provin-muted)]">Komentāri:</label>
        {readOnly ? (
          <div className="min-h-[48px] whitespace-pre-wrap rounded-lg border border-slate-200/90 bg-white px-2 py-1.5 text-[11px] text-[var(--color-provin-muted)]">
            {value.comments.trim() ? value.comments : <span className="text-slate-400">—</span>}
          </div>
        ) : (
          <textarea
            className="w-full min-h-[72px] resize-y rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] leading-snug text-[var(--color-apple-text)] focus:border-[var(--color-provin-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-provin-accent)]/20"
            rows={3}
            placeholder="Papildu komentāri par LTAB / OCTA…"
            value={value.comments}
            disabled={disabled}
            onChange={(e) => onChange({ ...value, comments: e.target.value })}
          />
        )}
      </div>
    </div>
  );
}
