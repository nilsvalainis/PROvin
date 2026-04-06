"use client";

import { AdminSourceBlockHeader } from "@/components/admin/AdminSourceBlockHeader";
import type { StandardSourceBlockKey, StandardSourceBlockState, SourceDataRow } from "@/lib/admin-source-blocks";
import { SOURCE_BLOCK_LABELS, emptyDataRow } from "@/lib/admin-source-blocks";

const inp =
  "min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-[var(--color-apple-text)] placeholder:text-slate-400 focus:border-[var(--color-provin-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-provin-accent)]/25";

type Props = {
  blockKey: StandardSourceBlockKey;
  value: StandardSourceBlockState;
  readOnly: boolean;
  disabled?: boolean;
  onChange: (next: StandardSourceBlockState) => void;
};

function vendorLossAmountMode(key: StandardSourceBlockKey): boolean {
  return key === "autodna" || key === "carvertical" || key === "auto_records";
}

export function AdminStructuredSourceBlock({ blockKey, value, readOnly, disabled, onChange }: Props) {
  const label = SOURCE_BLOCK_LABELS[blockKey];
  const lossAmountVendor = vendorLossAmountMode(blockKey);

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
    <div className="flex h-full min-h-0 flex-col rounded-lg border border-slate-200/90 bg-white p-2 shadow-sm">
      <AdminSourceBlockHeader blockKey={blockKey} className="mb-1.5 shrink-0" />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="space-y-1">
        {value.rows.map((row, ri) => (
          <div key={ri} className="flex flex-wrap items-center gap-1">
            {readOnly ? (
              <div className="flex min-w-0 flex-1 flex-wrap items-end gap-2 text-[11px] text-[var(--color-provin-muted)]">
                {lossAmountVendor ? (
                  <>
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-[10px] font-medium text-[var(--color-provin-muted)]">Datums</span>
                      <span className="rounded bg-white/80 px-1.5 py-0.5">{row.date.trim() || "—"}</span>
                    </div>
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-[10px] font-medium text-[var(--color-provin-muted)]">
                        Odometra rādījums
                      </span>
                      <span className="rounded bg-white/80 px-1.5 py-0.5">{row.km.trim() || "—"}</span>
                    </div>
                  </>
                ) : (
                  <>
                    <span className="rounded bg-white/80 px-1.5 py-0.5">{row.date.trim() || "—"}</span>
                    <span className="rounded bg-white/80 px-1.5 py-0.5">{row.km.trim() || "—"}</span>
                  </>
                )}
                <span className="rounded bg-white/80 px-1.5 py-0.5">
                  {lossAmountVendor ? (
                    <span className="text-[10px] text-[var(--color-provin-muted)]">Zaudējumu summa: </span>
                  ) : null}
                  {row.amount.trim() || "—"}
                </span>
              </div>
            ) : (
              <>
                {lossAmountVendor ? (
                  <div className="flex min-w-0 max-w-[7.5rem] flex-col">
                    <span className="mb-0.5 text-[10px] font-medium text-[var(--color-provin-muted)]">Datums</span>
                    <input
                      type="text"
                      className={inp}
                      placeholder="piem., 2024"
                      value={row.date}
                      disabled={disabled}
                      onChange={(e) => setRow(ri, { date: e.target.value })}
                      aria-label={`${label} Datums ${ri + 1}`}
                    />
                  </div>
                ) : (
                  <input
                    type="text"
                    className={`${inp} max-w-[7.5rem]`}
                    placeholder="Gads / Datums"
                    value={row.date}
                    disabled={disabled}
                    onChange={(e) => setRow(ri, { date: e.target.value })}
                    aria-label={`${label} Gads / Datums ${ri + 1}`}
                  />
                )}
                {lossAmountVendor ? (
                  <div className="flex min-w-0 max-w-[6.5rem] flex-col">
                    <span className="mb-0.5 text-[10px] font-medium text-[var(--color-provin-muted)]">
                      Odometra rādījums
                    </span>
                    <input
                      type="text"
                      className={inp}
                      placeholder="piem., 125 000"
                      value={row.km}
                      disabled={disabled}
                      onChange={(e) => setRow(ri, { km: e.target.value })}
                      aria-label={`${label} Odometra rādījums ${ri + 1}`}
                    />
                  </div>
                ) : (
                  <input
                    type="text"
                    className={`${inp} max-w-[6.5rem]`}
                    placeholder="KM"
                    value={row.km}
                    disabled={disabled}
                    onChange={(e) => setRow(ri, { km: e.target.value })}
                    aria-label={`${label} nobraukums ${ri + 1}`}
                  />
                )}
                <div className={`${lossAmountVendor ? "flex min-w-[7rem] max-w-[12rem] flex-col" : ""}`}>
                  {lossAmountVendor ? (
                    <span className="mb-0.5 text-[10px] font-medium text-[var(--color-provin-muted)]">
                      Zaudējumu summa:
                    </span>
                  ) : null}
                  <input
                    type="text"
                    className={`${inp} ${lossAmountVendor ? "max-w-none" : "max-w-[7rem]"}`}
                    placeholder="piem., 2930.00 €"
                    value={row.amount}
                    disabled={disabled}
                    onChange={(e) => setRow(ri, { amount: e.target.value })}
                    aria-label={`${label} ${lossAmountVendor ? "Zaudējumu summa" : "summa"} ${ri + 1}`}
                  />
                </div>
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
      </div>

      <div className="mt-auto w-full min-w-0 shrink-0 pt-2">
        <label className="mb-0.5 block text-[10px] font-medium text-[var(--color-provin-muted)]">Komentāri</label>
        {readOnly ? (
          <div className="min-h-[40px] whitespace-pre-wrap rounded-lg border border-slate-200/90 bg-white px-2 py-1.5 text-[11px] text-[var(--color-provin-muted)]">
            {value.comments.trim() ? value.comments : <span className="text-slate-400">—</span>}
          </div>
        ) : (
          <textarea
            className="w-full resize-y rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] leading-snug text-[var(--color-apple-text)] focus:border-[var(--color-provin-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-provin-accent)]/20"
            rows={2}
            placeholder="Papildu komentāri par šo avotu…"
            value={value.comments}
            disabled={disabled}
            onChange={(e) => onChange({ ...value, comments: e.target.value })}
          />
        )}
      </div>
    </div>
  );
}
