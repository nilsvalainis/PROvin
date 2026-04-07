"use client";

import { useState } from "react";
import { CountryFlagWithCode } from "@/components/admin/CountryFlagWithCode";
import { AdminSourceBlockHeader } from "@/components/admin/AdminSourceBlockHeader";
import { SectionLineIcon } from "@/components/icons/SectionLineIcon";
import type { AutoRecordsBlockState, AutoRecordsServiceRow } from "@/lib/admin-source-blocks";
import {
  CSDD_MILEAGE_UNIFIED_TITLE,
  PROVIN_MILEAGE_TABLE_DOM_KIND,
  PROVIN_MILEAGE_TABLE_FIELD,
  emptyAutoRecordsServiceRow,
} from "@/lib/admin-source-blocks";
import {
  autoRecordsRowHasData,
  formatAutoRecordsDateForOutput,
  normalizeAutoRecordsOdometer,
  parseAutoRecordsPaste,
  sortAutoRecordsDescending,
} from "@/lib/auto-records-paste-parse";
import { SUBHEADING_ICON } from "@/lib/section-icons";
import type { TrafficFillLevel } from "@/lib/admin-block-traffic-status";

const inp =
  "min-w-0 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-[var(--color-apple-text)] placeholder:text-slate-400 focus:border-[var(--color-provin-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-provin-accent)]/25";

const mileCell = "px-1.5 py-0.5";

type Props = {
  value: AutoRecordsBlockState;
  readOnly: boolean;
  disabled?: boolean;
  onChange: (next: AutoRecordsBlockState) => void;
  trafficFillLevel?: TrafficFillLevel;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
};

export function AdminAutoRecordsSourceBlock({
  value,
  readOnly,
  disabled,
  onChange,
  trafficFillLevel,
  collapsible = false,
  defaultCollapsed = true,
}: Props) {
  const [collapsed, setCollapsed] = useState(collapsible ? defaultCollapsed : false);
  const showBody = !collapsible || !collapsed;
  const handleRaw = (raw: string) => {
    if (/ODOMETER\s+CHECK/i.test(raw)) {
      const parsed = parseAutoRecordsPaste(raw);
      onChange({
        ...value,
        rawUnprocessedData: raw,
        serviceHistory: parsed.length > 0 ? parsed : [emptyAutoRecordsServiceRow()],
      });
    } else {
      onChange({ ...value, rawUnprocessedData: raw });
    }
  };

  const displayRows =
    value.serviceHistory.length > 0
      ? sortAutoRecordsDescending([...value.serviceHistory])
      : [emptyAutoRecordsServiceRow()];

  const setRow = (index: number, patch: Partial<AutoRecordsServiceRow>) => {
    const rows = value.serviceHistory.length > 0 ? [...value.serviceHistory] : [emptyAutoRecordsServiceRow()];
    rows[index] = { ...rows[index]!, ...patch };
    const next = sortAutoRecordsDescending(rows);
    const data = next.filter(autoRecordsRowHasData);
    onChange({ ...value, serviceHistory: data.length > 0 ? next : [emptyAutoRecordsServiceRow()] });
  };

  const addRow = () => {
    onChange({
      ...value,
      serviceHistory: sortAutoRecordsDescending([...value.serviceHistory, emptyAutoRecordsServiceRow()]),
    });
  };

  return (
    <div
      className={`flex h-full min-h-0 flex-col rounded-lg border border-slate-200/90 bg-white shadow-sm overflow-hidden ${trafficFillLevel ? "p-0" : "p-2"}`}
    >
      <AdminSourceBlockHeader
        blockKey="auto_records"
        trafficFillLevel={trafficFillLevel}
        className={`shrink-0 ${trafficFillLevel ? "mb-0" : "mb-1.5"}`}
      />

      {collapsible ? (
        <button
          type="button"
          className="flex w-full shrink-0 items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/60 px-2 py-1 text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--color-provin-muted)] hover:bg-slate-50"
          onClick={() => setCollapsed((c) => !c)}
          aria-expanded={showBody}
        >
          <span>{showBody ? "Slēpt laukus" : "Rādīt laukus"}</span>
          <span className="text-slate-400" aria-hidden>
            {showBody ? "▾" : "▸"}
          </span>
        </button>
      ) : null}

      {showBody ? (
        <>
          <div className={`min-h-0 flex-1 overflow-y-auto ${trafficFillLevel ? "px-2 pt-2" : ""}`}>
        <label className="mb-0.5 block text-[10px] font-medium text-[var(--color-provin-muted)]">
          Paste RAW data here
        </label>
        {readOnly ? (
          <div className="mb-2 min-h-[72px] whitespace-pre-wrap rounded-lg border border-slate-200/90 bg-slate-100 px-2 py-1.5 text-[11px] text-[var(--color-provin-muted)]">
            {value.rawUnprocessedData.trim() ? value.rawUnprocessedData : <span className="text-slate-400">—</span>}
          </div>
        ) : (
          <textarea
            className="mb-2 w-full min-h-[88px] resize-y rounded-lg border border-slate-200 bg-slate-100 px-2 py-1.5 text-[11px] leading-snug text-[var(--color-apple-text)] placeholder:text-slate-400 focus:border-[var(--color-provin-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-provin-accent)]/20"
            rows={4}
            value={value.rawUnprocessedData}
            disabled={disabled}
            placeholder="Ielīmē tekstu, kas sākas ar ODOMETER CHECK…"
            onChange={(e) => handleRaw(e.target.value)}
            aria-label="AUTO RECORDS neapstrādātie dati"
          />
        )}

        <p className="mb-1.5 flex items-center gap-2.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-provin-muted)]">
          <SectionLineIcon id={SUBHEADING_ICON.mileage} />
          {CSDD_MILEAGE_UNIFIED_TITLE}
        </p>
        <div
          className="overflow-x-auto rounded-lg border border-slate-200/90"
          data-provin-mileage-table={PROVIN_MILEAGE_TABLE_DOM_KIND}
          data-provin-block="auto_records"
        >
          <table className="w-full min-w-[280px] border-collapse text-[11px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/90 text-left text-[10px] font-medium text-[var(--color-provin-muted)]">
                <th className={mileCell} data-provin-field={PROVIN_MILEAGE_TABLE_FIELD.datums}>
                  Datums
                </th>
                <th className={mileCell} data-provin-field={PROVIN_MILEAGE_TABLE_FIELD.odometrsKm}>
                  Odometrs (km)
                </th>
                <th className={mileCell} data-provin-field={PROVIN_MILEAGE_TABLE_FIELD.valsts}>
                  Valsts
                </th>
              </tr>
            </thead>
            <tbody>
              {displayRows.map((row, i) => (
                <tr key={i} className="border-b border-slate-100 last:border-b-0">
                  <td className={`${mileCell} align-top`}>
                    {readOnly ? (
                      <span
                        className="text-[var(--color-provin-muted)]"
                        data-provin-field={PROVIN_MILEAGE_TABLE_FIELD.datums}
                        data-provin-block="auto_records"
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
                        id={`auto_records-${PROVIN_MILEAGE_TABLE_FIELD.datums}-${i}`}
                        name={`${PROVIN_MILEAGE_TABLE_FIELD.datums}[${i}]`}
                        data-provin-field={PROVIN_MILEAGE_TABLE_FIELD.datums}
                        data-provin-block="auto_records"
                        data-row-index={i}
                        onChange={(e) => setRow(i, { date: e.target.value })}
                        aria-label={`AUTO RECORDS datums ${i + 1}`}
                      />
                    )}
                  </td>
                  <td className={`${mileCell} align-top`}>
                    {readOnly ? (
                      <span
                        className="text-[var(--color-provin-muted)]"
                        data-provin-field={PROVIN_MILEAGE_TABLE_FIELD.odometrsKm}
                        data-provin-block="auto_records"
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
                        id={`auto_records-${PROVIN_MILEAGE_TABLE_FIELD.odometrsKm}-${i}`}
                        name={`${PROVIN_MILEAGE_TABLE_FIELD.odometrsKm}[${i}]`}
                        data-provin-field={PROVIN_MILEAGE_TABLE_FIELD.odometrsKm}
                        data-provin-block="auto_records"
                        data-row-index={i}
                        onChange={(e) =>
                          setRow(i, { odometer: normalizeAutoRecordsOdometer(e.target.value) })
                        }
                        aria-label={`AUTO RECORDS odometrs ${i + 1}`}
                      />
                    )}
                  </td>
                  <td className={`${mileCell} align-top`}>
                    {readOnly ? (
                      <CountryFlagWithCode
                        countryLabel={row.country.trim() || "—"}
                        data-provin-field={PROVIN_MILEAGE_TABLE_FIELD.valsts}
                        data-provin-block="auto_records"
                        data-row-index={i}
                      />
                    ) : (
                      <input
                        type="text"
                        className={inp}
                        value={row.country}
                        disabled={disabled}
                        id={`auto_records-${PROVIN_MILEAGE_TABLE_FIELD.valsts}-${i}`}
                        name={`${PROVIN_MILEAGE_TABLE_FIELD.valsts}[${i}]`}
                        data-provin-field={PROVIN_MILEAGE_TABLE_FIELD.valsts}
                        data-provin-block="auto_records"
                        data-row-index={i}
                        onChange={(e) => setRow(i, { country: e.target.value })}
                        aria-label={`AUTO RECORDS valsts ${i + 1}`}
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
            onClick={addRow}
          >
            + Rinda
          </button>
        ) : null}
          </div>

          <div className={`mt-auto w-full min-w-0 shrink-0 pt-2 ${trafficFillLevel ? "px-2 pb-2" : ""}`}>
        <label className="mb-0.5 block text-[10px] font-medium text-[var(--color-provin-muted)]">Komentāri</label>
        {readOnly ? (
          <div className="min-h-[36px] whitespace-pre-wrap rounded-lg border border-slate-200/90 bg-white px-2 py-1.5 text-[11px] text-[var(--color-provin-muted)]">
            {value.comments.trim() ? value.comments : <span className="text-slate-400">—</span>}
          </div>
        ) : (
          <textarea
            className="w-full resize-y rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] leading-snug text-[var(--color-apple-text)] focus:border-[var(--color-provin-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-provin-accent)]/20"
            rows={2}
            placeholder="Papildu piezīmes…"
            value={value.comments}
            disabled={disabled}
            onChange={(e) => onChange({ ...value, comments: e.target.value })}
          />
        )}
          </div>
        </>
      ) : null}
    </div>
  );
}
