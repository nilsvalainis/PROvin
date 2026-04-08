"use client";

import { AdminAiPolishTextareaShell } from "@/components/admin/AdminAiPolishTextareaShell";
import { LossAmountFieldChrome } from "@/components/admin/LossAmountFieldChrome";
import { CountryFlagWithCode } from "@/components/admin/CountryFlagWithCode";
import { AdminCountryCombobox } from "@/components/admin/AdminCountryCombobox";
import { AdminSourceBlockHeader } from "@/components/admin/AdminSourceBlockHeader";
import type { LtabBlockState, LtabIncidentRow } from "@/lib/admin-source-blocks";
import { emptyLtabRow } from "@/lib/admin-source-blocks";
import type { TrafficFillLevel } from "@/lib/admin-block-traffic-status";
import { AdminPdfIncludeToggle } from "@/components/admin/AdminPdfIncludeToggle";
import { AdminCollapsibleShell } from "@/components/admin/AdminCollapsibleShell";

const inp =
  "min-w-0 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-[var(--color-apple-text)] placeholder:text-slate-400 focus:border-[var(--color-provin-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-provin-accent)]/25";

const mileCell = "px-1.5 py-0.5";

type Props = {
  value: LtabBlockState;
  readOnly: boolean;
  disabled?: boolean;
  onChange: (next: LtabBlockState) => void;
  trafficFillLevel?: TrafficFillLevel;
  sessionId: string;
  pdfInclude: boolean;
  onPdfIncludeChange: (next: boolean) => void;
};

export function AdminLtabSourceBlock({
  value,
  readOnly,
  disabled,
  onChange,
  trafficFillLevel,
  sessionId,
  pdfInclude,
  onPdfIncludeChange,
}: Props) {
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
    <AdminCollapsibleShell
      sessionId={sessionId}
      blockId="ltab"
      header={
        <AdminSourceBlockHeader
          blockKey="ltab"
          trafficFillLevel={trafficFillLevel}
          className={`shrink-0 ${trafficFillLevel ? "mb-0" : "mb-0"}`}
        />
      }
      headerActions={<AdminPdfIncludeToggle checked={pdfInclude} onChange={onPdfIncludeChange} />}
    >
      <div className={`flex h-full min-h-0 flex-col overflow-hidden ${trafficFillLevel ? "p-0" : "p-2"}`}>
          <div className={`min-h-0 flex-1 overflow-y-auto ${trafficFillLevel ? "px-2 pt-2" : ""}`}>
            <div className="w-full min-w-0 overflow-x-auto rounded-lg border border-slate-200/90">
              <table className="w-full min-w-[280px] border-collapse text-[11px]">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/90 text-left text-[10px] font-medium text-[var(--color-provin-muted)]">
                    <th className={mileCell}>Datums</th>
                    <th className={mileCell}>Zaudējumu summa:</th>
                    <th className={mileCell}>Valsts</th>
                    {!readOnly ? <th className={`w-9 ${mileCell}`} aria-hidden /> : null}
                  </tr>
                </thead>
                <tbody>
                  {value.rows.map((row, ri) => (
                    <tr key={ri} className="border-b border-slate-100 last:border-b-0">
                      <td className={`${mileCell} align-top`}>
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
                      <td className={`${mileCell} align-top`}>
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
                      <td className={`${mileCell} align-top`}>
                        {readOnly ? (
                          <CountryFlagWithCode countryLabel={row.incidentNo.trim() || "—"} />
                        ) : (
                          <AdminCountryCombobox
                            className={inp}
                            placeholder="Latvija"
                            value={row.incidentNo}
                            disabled={disabled}
                            onChange={(next) => setRow(ri, { incidentNo: next })}
                            aria-label={`LTAB Valsts, rinda ${ri + 1}`}
                          />
                        )}
                      </td>
                      {!readOnly ? (
                        <td className={`${mileCell} align-top`}>
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

          <div className={`mt-auto w-full min-w-0 shrink-0 pt-2 ${trafficFillLevel ? "px-2 pb-2" : ""}`}>
            <label className="mb-0.5 block text-[10px] font-medium text-[var(--color-provin-muted)]">Komentāri:</label>
            {readOnly ? (
              <div className="min-h-[48px] whitespace-pre-wrap rounded-lg border border-slate-200/90 bg-white px-2 py-1.5 text-[11px] text-[var(--color-provin-muted)]">
                {value.comments.trim() ? value.comments : <span className="text-slate-400">—</span>}
              </div>
            ) : (
              <AdminAiPolishTextareaShell
                value={value.comments}
                onPolished={(next) => onChange({ ...value, comments: next })}
                disabled={disabled}
              >
                <textarea
                  className="w-full min-h-[72px] resize-y rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] leading-snug text-[var(--color-apple-text)] focus:border-[var(--color-provin-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-provin-accent)]/20"
                  rows={3}
                  placeholder="Papildu komentāri par LTAB / OCTA…"
                  value={value.comments}
                  disabled={disabled}
                  onChange={(e) => onChange({ ...value, comments: e.target.value })}
                />
              </AdminAiPolishTextareaShell>
            )}
          </div>
      </div>
    </AdminCollapsibleShell>
  );
}
