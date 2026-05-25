"use client";

import { useCallback, useState } from "react";
import {
  AdminSourceCommentField,
  type AdminGeminiSourceCommentSlot,
} from "@/components/admin/AdminSourceCommentField";
import { AdminAiPolishTextareaShell } from "@/components/admin/AdminAiPolishTextareaShell";
import { CountryFlagWithCode } from "@/components/admin/CountryFlagWithCode";
import { AdminCountryCombobox } from "@/components/admin/AdminCountryCombobox";
import { AdminSourceBlockHeader } from "@/components/admin/AdminSourceBlockHeader";
import { AdminProvinLucide } from "@/components/admin/AdminProvinLucide";
import type { AutoRecordsBlockState, AutoRecordsServiceRow } from "@/lib/admin-source-blocks";
import {
  CSDD_MILEAGE_UNIFIED_TITLE,
  PROVIN_MILEAGE_TABLE_DOM_KIND,
  PROVIN_MILEAGE_TABLE_FIELD,
  emptyAutoRecordsServiceRow,
  sourcePdfChecklistHasAny,
} from "@/lib/admin-source-blocks";
import { AdminSourcePdfChecklist } from "@/components/admin/AdminSourcePdfChecklist";
import {
  autoRecordsRowHasData,
  formatAutoRecordsDateForOutput,
  normalizeAutoRecordsOdometer,
  parseAutoRecordsPaste,
  sortAutoRecordsDescending,
} from "@/lib/auto-records-paste-parse";
import { normalizeVin, isOutvinApiVin } from "@/lib/order-field-validation";
import { SUBHEADING_LUCIDE } from "@/lib/admin-lucide-registry";
import type { TrafficFillLevel } from "@/lib/admin-block-traffic-status";
import { AdminPdfIncludeToggle } from "@/components/admin/AdminPdfIncludeToggle";
import { AdminCollapsibleShell } from "@/components/admin/AdminCollapsibleShell";
import {
  AdminOutvinDealerReportFields,
  ensureOutvinDealerReport,
} from "@/components/admin/AdminOutvinDealerReportFields";
import { outvinDealerReportHasContent } from "@/lib/outvin-dealer-types";

const inp =
  "min-w-0 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-[var(--color-apple-text)] placeholder:text-slate-400 focus:border-[var(--color-provin-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-provin-accent)]/25";

const mileCell = "px-1.5 py-0.5";

type Props = {
  value: AutoRecordsBlockState;
  readOnly: boolean;
  disabled?: boolean;
  onChange: (next: AutoRecordsBlockState) => void;
  trafficFillLevel?: TrafficFillLevel;
  sessionId: string;
  pdfInclude: boolean;
  onPdfIncludeChange: (next: boolean) => void;
  geminiComment?: AdminGeminiSourceCommentSlot;
  /** Pasūtījuma VIN no galvenes — Outvin „Ielādēt”. */
  orderVin?: string | null;
};

export function AdminAutoRecordsSourceBlock({
  value,
  readOnly,
  disabled,
  onChange,
  trafficFillLevel,
  sessionId,
  pdfInclude,
  onPdfIncludeChange,
  geminiComment,
  orderVin,
}: Props) {
  const [outvinBusy, setOutvinBusy] = useState(false);
  const [outvinErr, setOutvinErr] = useState<string | null>(null);

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

  const loadFromOutvin = useCallback(async () => {
    const vin = normalizeVin(orderVin ?? "");
    if (!isOutvinApiVin(vin)) {
      setOutvinErr("Nepieciešams derīgs 17 simbolu VIN pasūtījuma galvenē");
      return;
    }
    setOutvinBusy(true);
    setOutvinErr(null);
    try {
      const res = await fetch("/api/admin/outvin/history", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vin }),
      });
      const data = (await res.json()) as {
        rows?: AutoRecordsServiceRow[];
        report?: import("@/lib/outvin-dealer-types").OutvinDealerReport;
        error?: string;
        detail?: string;
      };
      if (!res.ok) {
        const detail = typeof data.detail === "string" ? data.detail.trim() : "";
        if (data.error === "missing_outvin_credentials") {
          setOutvinErr("Nav OUTVIN_EMAIL / OUTVIN_PASSWORD (.env.local / Vercel)");
        } else if (data.error === "outvin_unauthorized") {
          setOutvinErr("Outvin: nederīgs e-pasts vai parole");
        } else if (data.error === "outvin_payment_required") {
          setOutvinErr("Outvin: nepieciešams kredīts / apmaksa");
        } else if (data.error === "outvin_not_found" || data.error === "empty_mileage_history" || data.error === "empty_outvin_data") {
          setOutvinErr("Outvin: dati nav atrasti šim VIN");
        } else if (data.error === "invalid_vin") {
          setOutvinErr("Outvin: nederīgs VIN");
        } else {
          setOutvinErr(detail ? `Outvin: ${detail}` : "Outvin: neizdevās ielādēt");
        }
        return;
      }
      const hasRows = Array.isArray(data.rows) && data.rows.length > 0;
      const hasReport = Boolean(data.report && outvinDealerReportHasContent(data.report));
      if (hasRows || hasReport) {
        onChange({
          ...value,
          ...(hasRows ? { serviceHistory: data.rows! } : {}),
          ...(data.report ? { outvinReport: data.report } : {}),
        });
      } else {
        setOutvinErr("Outvin: atgrieza tukšu atbildi");
      }
    } catch {
      setOutvinErr("Outvin: neizdevās savienoties");
    } finally {
      setOutvinBusy(false);
    }
  }, [onChange, orderVin, value]);

  const outvinVinReady = isOutvinApiVin(normalizeVin(orderVin ?? ""));

  return (
    <AdminCollapsibleShell
      sessionId={sessionId}
      blockId="auto-records"
      header={
        <AdminSourceBlockHeader
          blockKey="auto_records"
          trafficFillLevel={trafficFillLevel}
          className={`shrink-0 ${trafficFillLevel ? "mb-0" : "mb-0"}`}
        />
      }
      headerActions={<AdminPdfIncludeToggle checked={pdfInclude} onChange={onPdfIncludeChange} />}
    >
      <div className={`flex h-full min-h-0 flex-col overflow-hidden ${trafficFillLevel ? "p-0" : "p-2"}`}>
          <div className={`min-h-0 flex-1 overflow-y-auto ${trafficFillLevel ? "px-2 pt-2" : ""}`}>
        <div className="mb-0.5 flex flex-wrap items-center justify-between gap-2">
          <label className="block text-[10px] font-medium text-[var(--color-provin-muted)]">
            Paste RAW data here
          </label>
          {!readOnly && !disabled ? (
            <button
              type="button"
              className="rounded-md border border-[var(--color-provin-accent)]/35 bg-white px-2 py-0.5 text-[10px] font-medium text-[var(--color-provin-accent)] hover:bg-[var(--color-provin-accent)]/5 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={outvinBusy || !outvinVinReady}
              title={
                !outvinVinReady
                  ? "Ievadi 17 simbolu VIN pasūtījuma galvenē"
                  : "Ielādēt Outvin dīlera datus un nobraukumu (km netiek dublēts PDF)"
              }
              onClick={() => void loadFromOutvin()}
            >
              {outvinBusy ? "Ielādē…" : "Ielādēt no Outvin"}
            </button>
          ) : null}
        </div>
        {outvinErr ? (
          <p className="mb-1 text-[9px] leading-snug text-amber-800/90" title={outvinErr}>
            {outvinErr}
          </p>
        ) : null}
        {readOnly ? (
          <div className="mb-2 min-h-[72px] whitespace-pre-wrap rounded-lg border border-slate-200/90 bg-slate-100 px-2 py-1.5 text-[11px] text-[var(--color-provin-muted)]">
            {value.rawUnprocessedData.trim() ? value.rawUnprocessedData : <span className="text-slate-400">—</span>}
          </div>
        ) : (
          <AdminAiPolishTextareaShell
            value={value.rawUnprocessedData}
            onPolished={(next) => handleRaw(next)}
            disabled={disabled}
          >
            <textarea
              className="mb-2 w-full min-h-[88px] resize-y rounded-lg border border-slate-200 bg-slate-100 px-2 py-1.5 text-[11px] leading-snug text-[var(--color-apple-text)] placeholder:text-slate-400 focus:border-[var(--color-provin-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-provin-accent)]/20"
              rows={4}
              value={value.rawUnprocessedData}
              disabled={disabled}
              placeholder="Ielīmē tekstu, kas sākas ar ODOMETER CHECK…"
              onChange={(e) => handleRaw(e.target.value)}
              aria-label="AUTO RECORDS neapstrādātie dati"
            />
          </AdminAiPolishTextareaShell>
        )}

        <p className="mb-1.5 flex items-center gap-2 text-[10px] font-medium uppercase tracking-wide text-slate-500">
          <AdminProvinLucide icon={SUBHEADING_LUCIDE.mileage} />
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
                      <AdminCountryCombobox
                        className={inp}
                        value={row.country}
                        disabled={disabled}
                        id={`auto_records-${PROVIN_MILEAGE_TABLE_FIELD.valsts}-${i}`}
                        name={`${PROVIN_MILEAGE_TABLE_FIELD.valsts}[${i}]`}
                        data-provin-field={PROVIN_MILEAGE_TABLE_FIELD.valsts}
                        data-provin-block="auto_records"
                        data-row-index={i}
                        onChange={(next) => setRow(i, { country: next })}
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

        <AdminOutvinDealerReportFields
          report={ensureOutvinDealerReport(value.outvinReport)}
          readOnly={readOnly}
          disabled={disabled}
          onChange={(next) => onChange({ ...value, outvinReport: next })}
        />
          </div>

          <div className={`mt-auto w-full min-w-0 shrink-0 pt-2 ${trafficFillLevel ? "px-2 pb-2" : ""}`}>
        <AdminSourcePdfChecklist
          idPrefix="auto-records"
          value={value.pdfChecklist}
          readOnly={readOnly}
          disabled={disabled}
          onChange={(next) =>
            onChange({
              ...value,
              pdfChecklist: sourcePdfChecklistHasAny(next) ? next : undefined,
            })
          }
        />
        <AdminSourceCommentField
          value={value.comments}
          onChange={(next) => onChange({ ...value, comments: next })}
          readOnly={readOnly}
          disabled={disabled}
          compact
          gemini={geminiComment}
          readonlyClassName="min-h-[36px] rounded-lg border border-slate-200/90 bg-white px-2 py-1.5 text-[11px] text-[var(--color-provin-muted)]"
          aria-label="AUTO RECORDS — komentāri"
        />
          </div>
      </div>
    </AdminCollapsibleShell>
  );
}
