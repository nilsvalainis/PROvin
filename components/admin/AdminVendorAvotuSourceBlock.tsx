"use client";

import { LossAmountFieldChrome } from "@/components/admin/LossAmountFieldChrome";
import { AdminSourceBlockHeader } from "@/components/admin/AdminSourceBlockHeader";
import type { LtabIncidentRow, VendorAvotuBlockState } from "@/lib/admin-source-blocks";
import {
  CSDD_MILEAGE_UNIFIED_TITLE,
  NEGADIJUMU_VESTURE_TITLE,
  PROVIN_MILEAGE_TABLE_DOM_KIND,
  PROVIN_MILEAGE_TABLE_FIELD,
  PROVIN_VENDOR_FIELD,
  emptyAutoRecordsServiceRow,
  emptyLtabRow,
} from "@/lib/admin-source-blocks";
import type { AutoRecordsServiceRow } from "@/lib/auto-records-paste-parse";
import {
  autoRecordsRowHasData,
  formatAutoRecordsDateForOutput,
  normalizeAutoRecordsOdometer,
  sortAutoRecordsDescending,
} from "@/lib/auto-records-paste-parse";
import { getLossAmountUiFlag } from "@/lib/loss-amount-ui";

const inp =
  "min-w-0 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-[var(--color-apple-text)] placeholder:text-slate-400 focus:border-[var(--color-provin-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-provin-accent)]/25";

type BlockKey = "autodna" | "carvertical";

type Props = {
  blockKey: BlockKey;
  value: VendorAvotuBlockState;
  readOnly: boolean;
  disabled?: boolean;
  onChange: (next: VendorAvotuBlockState) => void;
};

export function AdminVendorAvotuSourceBlock({ blockKey, value, readOnly, disabled, onChange }: Props) {
  const displayRows =
    value.serviceHistory.length > 0
      ? sortAutoRecordsDescending([...value.serviceHistory])
      : [emptyAutoRecordsServiceRow()];

  const setMileageRow = (index: number, patch: Partial<AutoRecordsServiceRow>) => {
    const rows = value.serviceHistory.length > 0 ? [...value.serviceHistory] : [emptyAutoRecordsServiceRow()];
    rows[index] = { ...rows[index]!, ...patch };
    const next = sortAutoRecordsDescending(rows);
    const data = next.filter(autoRecordsRowHasData);
    onChange({ ...value, serviceHistory: data.length > 0 ? next : [emptyAutoRecordsServiceRow()] });
  };

  const addMileageRow = () => {
    onChange({
      ...value,
      serviceHistory: sortAutoRecordsDescending([...value.serviceHistory, emptyAutoRecordsServiceRow()]),
    });
  };

  const setIncidentRow = (index: number, patch: Partial<LtabIncidentRow>) => {
    const rows = value.incidents.map((r, i) => (i === index ? { ...r, ...patch } : r));
    onChange({ ...value, incidents: rows });
  };

  const addIncidentRow = () => {
    onChange({ ...value, incidents: [...value.incidents, emptyLtabRow()] });
  };

  const removeIncidentRow = (index: number) => {
    if (value.incidents.length <= 1) return;
    onChange({ ...value, incidents: value.incidents.filter((_, i) => i !== index) });
  };

  const idBase = blockKey;

  return (
    <div className="flex h-full min-h-0 flex-col rounded-lg border border-slate-200/90 bg-white p-2 shadow-sm">
      <AdminSourceBlockHeader blockKey={blockKey} className="mb-1.5 shrink-0" />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-provin-muted)]">
          {CSDD_MILEAGE_UNIFIED_TITLE}
        </p>
        <div
          className="w-full min-w-0 overflow-x-auto rounded-lg border border-slate-200/90"
          data-provin-mileage-table={PROVIN_MILEAGE_TABLE_DOM_KIND}
          data-provin-block={blockKey}
        >
          <table className="w-full min-w-[280px] border-collapse text-[11px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/90 text-left text-[10px] font-medium text-[var(--color-provin-muted)]">
                <th className="px-2 py-1" data-provin-field={PROVIN_MILEAGE_TABLE_FIELD.datums}>
                  Datums
                </th>
                <th className="px-2 py-1" data-provin-field={PROVIN_MILEAGE_TABLE_FIELD.odometrsKm}>
                  Odometrs (km)
                </th>
                <th className="px-2 py-1" data-provin-field={PROVIN_MILEAGE_TABLE_FIELD.valsts}>
                  Valsts
                </th>
              </tr>
            </thead>
            <tbody>
              {displayRows.map((row, i) => (
                <tr key={i} className="border-b border-slate-100 last:border-b-0">
                  <td className="px-2 py-1 align-top">
                    {readOnly ? (
                      <span
                        className="text-[var(--color-provin-muted)]"
                        data-provin-field={PROVIN_MILEAGE_TABLE_FIELD.datums}
                        data-provin-block={blockKey}
                        data-row-index={i}
                      >
                        {formatAutoRecordsDateForOutput(row.date).trim() || "—"}
                      </span>
                    ) : (
                      <input
                        type="text"
                        className={inp}
                        value={row.date}
                        disabled={disabled}
                        id={`${idBase}-${PROVIN_VENDOR_FIELD.nobraukumaDatums}-${i}`}
                        name={`${PROVIN_VENDOR_FIELD.nobraukumaDatums}[${i}]`}
                        data-provin-field={PROVIN_VENDOR_FIELD.nobraukumaDatums}
                        data-provin-block={blockKey}
                        data-row-index={i}
                        onChange={(e) => setMileageRow(i, { date: e.target.value })}
                        aria-label={`${blockKey} ${PROVIN_VENDOR_FIELD.nobraukumaDatums} ${i + 1}`}
                      />
                    )}
                  </td>
                  <td className="px-2 py-1 align-top">
                    {readOnly ? (
                      <span
                        className="text-[var(--color-provin-muted)]"
                        data-provin-field={PROVIN_MILEAGE_TABLE_FIELD.odometrsKm}
                        data-provin-block={blockKey}
                        data-row-index={i}
                      >
                        {row.odometer.trim() || "—"}
                      </span>
                    ) : (
                      <input
                        type="text"
                        inputMode="numeric"
                        className={inp}
                        value={row.odometer}
                        disabled={disabled}
                        id={`${idBase}-${PROVIN_VENDOR_FIELD.nobraukumaOdometrs}-${i}`}
                        name={`${PROVIN_VENDOR_FIELD.nobraukumaOdometrs}[${i}]`}
                        data-provin-field={PROVIN_VENDOR_FIELD.nobraukumaOdometrs}
                        data-provin-block={blockKey}
                        data-row-index={i}
                        onChange={(e) =>
                          setMileageRow(i, { odometer: normalizeAutoRecordsOdometer(e.target.value) })
                        }
                        aria-label={`${blockKey} ${PROVIN_VENDOR_FIELD.nobraukumaOdometrs} ${i + 1}`}
                      />
                    )}
                  </td>
                  <td className="px-2 py-1 align-top">
                    {readOnly ? (
                      <span
                        className="text-[var(--color-provin-muted)]"
                        data-provin-field={PROVIN_MILEAGE_TABLE_FIELD.valsts}
                        data-provin-block={blockKey}
                        data-row-index={i}
                      >
                        {row.country.trim() || "—"}
                      </span>
                    ) : (
                      <input
                        type="text"
                        className={inp}
                        value={row.country}
                        disabled={disabled}
                        id={`${idBase}-${PROVIN_VENDOR_FIELD.nobraukumaValsts}-${i}`}
                        name={`${PROVIN_VENDOR_FIELD.nobraukumaValsts}[${i}]`}
                        data-provin-field={PROVIN_VENDOR_FIELD.nobraukumaValsts}
                        data-provin-block={blockKey}
                        data-row-index={i}
                        onChange={(e) => setMileageRow(i, { country: e.target.value })}
                        aria-label={`${blockKey} ${PROVIN_VENDOR_FIELD.nobraukumaValsts} ${i + 1}`}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!readOnly && !disabled ? (
          <button
            type="button"
            className="mt-1.5 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-[var(--color-provin-muted)] hover:bg-slate-50"
            onClick={addMileageRow}
          >
            + Rinda
          </button>
        ) : null}

        <div className="mt-4 border-t border-slate-200 pt-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-provin-muted)]">
            {NEGADIJUMU_VESTURE_TITLE}
          </p>
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
                {value.incidents.map((row, ri) => (
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
                          id={`${idBase}-${PROVIN_VENDOR_FIELD.csngDatums}-${ri}`}
                          name={`${PROVIN_VENDOR_FIELD.csngDatums}[${ri}]`}
                          data-provin-field={PROVIN_VENDOR_FIELD.csngDatums}
                          data-row-index={ri}
                          onChange={(e) => setIncidentRow(ri, { csngDate: e.target.value })}
                          aria-label={`Datums, ${blockKey}, rinda ${ri + 1}`}
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
                                : getLossAmountUiFlag(row.lossAmount) === "red"
                                  ? "font-semibold text-[#B91C1C]"
                                  : "font-semibold text-amber-900"
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
                            id={`${idBase}-${PROVIN_VENDOR_FIELD.zaudejumuSumma}-${ri}`}
                            name={`${PROVIN_VENDOR_FIELD.zaudejumuSumma}[${ri}]`}
                            data-provin-field={PROVIN_VENDOR_FIELD.zaudejumuSumma}
                            data-row-index={ri}
                            onChange={(e) => setIncidentRow(ri, { lossAmount: e.target.value })}
                            aria-label={`Zaudējumu summa, ${blockKey}, rinda ${ri + 1}`}
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
                          id={`${idBase}-${PROVIN_VENDOR_FIELD.negadijumuSkaits}-${ri}`}
                          name={`${PROVIN_VENDOR_FIELD.negadijumuSkaits}[${ri}]`}
                          data-provin-field={PROVIN_VENDOR_FIELD.negadijumuSkaits}
                          data-row-index={ri}
                          onChange={(e) => setIncidentRow(ri, { incidentNo: e.target.value })}
                          aria-label={`Valsts, ${blockKey}, rinda ${ri + 1}`}
                        />
                      )}
                    </td>
                    {!readOnly ? (
                      <td className="px-2 py-1 align-top">
                        {value.incidents.length > 1 ? (
                          <button
                            type="button"
                            disabled={disabled}
                            className="rounded-md border border-slate-200 bg-white px-1.5 py-1 text-[10px] text-slate-500 hover:bg-red-50 hover:text-red-700 disabled:opacity-40"
                            onClick={() => removeIncidentRow(ri)}
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
              onClick={addIncidentRow}
            >
              + Rinda
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
