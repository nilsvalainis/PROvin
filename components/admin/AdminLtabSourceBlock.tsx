"use client";

import { LossAmountFieldChrome } from "@/components/admin/LossAmountFieldChrome";
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
    <div className="flex h-full min-h-0 flex-col rounded-lg border border-slate-200/90 bg-white p-2 shadow-sm">
      <AdminSourceBlockHeader blockKey="ltab" className="mb-2 shrink-0" />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="w-full min-w-0 overflow-x-auto rounded-lg border border-slate-200/90">
          <table className="w-full min-w-[280px] border-collapse text-[11px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/90 text-left text-[10px] font-medium text-[var(--color-provin-muted)]">
                <th className="px-2 py-1">Datums</th>
                <th className="px-2 py-1">Zaudējumu summa:</th>
                <th className="px-2 py-1">Valsts</th>
                {!readOnly ? <th className="w-9 px-2 py-1" aria-hidden /> : null}
              </tr>
            </thead>
            <tbody>
              {value.rows.map((row, ri) => (
                <tr key={ri} className="border-b border-slate-100 last:border-b-0">
                  <td className="px-2 py-1 align-top">
                    {readOnly ? (
                      <span className="text-[var(--color-provin-muted)]">{row.csngDate.trim() || "—"}</span>
                    ) : (
                      <input
                        type="text"
                        className={inp}
                        placeholder="piem., 2024"
                        value={row.csngDate}
                        disabled={disabled}
                        onChange={(e) => setRow(ri, { csngDate: e.target.value })}
                        aria-label={`LTAB Datums, rinda ${ri + 1}`}
                      />
                    )}
                  </td>
                  <td className="px-2 py-1 align-top">
                    <LossAmountFieldChrome value={row.lossAmount}>
                      {readOnly ? (
                        <span
                          className={
                            !row.lossAmount.trim()
                              ? "text-[var(--color-provin-muted)]"
                              : "font-semibold"
                          }
                        >
                          {row.lossAmount.trim() || "—"}
                        </span>
                      ) : (
                        <input
                          type="text"
                          className={`${inp} max-w-full border-0 bg-transparent shadow-none ring-0 focus:ring-0`}
                          placeholder="2930.00 €"
                          value={row.lossAmount}
                          disabled={disabled}
                          onChange={(e) => setRow(ri, { lossAmount: e.target.value })}
                          aria-label={`LTAB Zaudējumu summa, rinda ${ri + 1}`}
                        />
                      )}
                    </LossAmountFieldChrome>
                  </td>
                  <td className="px-2 py-1 align-top">
                    {readOnly ? (
                      <span className="text-[var(--color-provin-muted)]">{row.incidentNo.trim() || "—"}</span>
                    ) : (
                      <input
                        type="text"
                        className={inp}
                        placeholder="Latvija"
                        value={row.incidentNo}
                        disabled={disabled}
                        onChange={(e) => setRow(ri, { incidentNo: e.target.value })}
                        aria-label={`LTAB Valsts, rinda ${ri + 1}`}
                      />
                    )}
                  </td>
                  {!readOnly ? (
                    <td className="px-2 py-1 align-top">
                      {value.rows.length > 1 ? (
                        <button
                          type="button"
                          disabled={disabled}
                          className="rounded-md border border-slate-200 bg-white px-1.5 py-1 text-[10px] text-slate-500 hover:bg-red-50 hover:text-red-700 disabled:opacity-40"
                          onClick={() => removeRow(ri)}
                          title="Noņemt rindu"
                        >
                          ×
                        </button>
                      ) : null}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!readOnly && !disabled ? (
          <button
            type="button"
            className="mt-1.5 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-[var(--color-provin-muted)] hover:bg-slate-50"
            onClick={addRow}
          >
            + Rinda
          </button>
        ) : null}
      </div>

      <div className="mt-auto w-full min-w-0 shrink-0 pt-2">
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
