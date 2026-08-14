"use client";

import {
  AdminSourceCommentField,
  type AdminAiSourceCommentSlot,
} from "@/components/admin/AdminSourceCommentField";
import { AdminAiContextRawField } from "@/components/admin/AdminAiContextRawField";
import { AdminAiPolishTextareaShell } from "@/components/admin/AdminAiPolishTextareaShell";
import { CountryFlagWithCode } from "@/components/admin/CountryFlagWithCode";
import { AdminCountryCombobox } from "@/components/admin/AdminCountryCombobox";
import { AdminSourceBlockHeader } from "@/components/admin/AdminSourceBlockHeader";
import { AdminProvinLucide } from "@/components/admin/AdminProvinLucide";
import type {
  AutoRecordsBlockState,
  AutoRecordsServiceRow,
  AutoRecordsServiceWorkRow,
  WorkspaceSourceBlocks,
} from "@/lib/admin-source-blocks";
import type { CopilotSourceKey } from "@/lib/admin-copilot-types";
import { AdminHistoryVendorPdfUpload } from "@/components/admin/AdminHistoryVendorPdfUpload";
import {
  AUTO_RECORDS_SERVICE_WORKS_LOCATION_MAX_LEN,
  AUTO_RECORDS_SERVICE_WORKS_MAX_LEN,
  autoRecordsServiceWorkRowHasData,
  emptyAutoRecordsServiceWorkRow,
  formatServiceWorkOdometer,
  mergeAutoRecordsServiceWorkRow,
  parseDealerNarrativeServiceWorks,
  PROVIN_SERVICE_WORKS_TABLE_DOM_KIND,
  PROVIN_SERVICE_WORKS_TABLE_FIELD,
  PROVIN_SERVICE_WORKS_TABLE_TITLE,
  SERVICE_WORKS_LOCATION_LABEL,
  sortAutoRecordsServiceWorkRows,
} from "@/lib/auto-records-service-works";
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
  looksLikeOfficialDealerServiceNarrative,
  normalizeAutoRecordsOdometer,
  parseAutoRecordsPaste,
  parseOfficialDealerServiceNarrativePaste,
  sortAutoRecordsDescending,
} from "@/lib/auto-records-paste-parse";
import {
  emptyOutvinDealerReport,
  outvinVehicleInfoHasData,
  type OutvinVehicleInfo,
} from "@/lib/outvin-dealer-types";
import { AdminOutvinDealerReportFields } from "@/components/admin/AdminOutvinDealerReportFields";
import { parseOutvinVehicleInfoFromAutoRecordsText } from "@/lib/auto-records-vehicle-info-parse";
import { SUBHEADING_LUCIDE } from "@/lib/admin-lucide-registry";
import type { TrafficFillLevel } from "@/lib/admin-block-traffic-status";
import { AdminPdfIncludeToggle } from "@/components/admin/AdminPdfIncludeToggle";
import { AdminCollapsibleShell } from "@/components/admin/AdminCollapsibleShell";
import { AdminListingAnalysisPhotos } from "@/components/admin/AdminListingAnalysisPhotos";
import {
  AUTO_RECORDS_MAX_PHOTOS,
  emptyAutoRecordsPhotoGroup,
} from "@/lib/auto-records-photo-types";
import { AdminClearOdometerButton } from "@/components/admin/AdminClearOdometerButton";
import {
  clearAutoRecordsOdometerReadings,
  countAutoRecordsOdometerReadings,
} from "@/lib/admin-clear-odometer-readings";

const DEALER_ARIA = "Oficiālā dīlera dati";

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
  /** Copilot dīlera PDF aģentam vajag visus avotu blokus (valstu noteikšanai). */
  getSourceBlocks?: () => WorkspaceSourceBlocks;
  applyPatchedBlocks?: (
    patched: Partial<WorkspaceSourceBlocks>,
    changedKeys: CopilotSourceKey[],
  ) => void;
  pdfInclude: boolean;
  onPdfIncludeChange: (next: boolean) => void;
  aiComment?: AdminAiSourceCommentSlot;
  aiServiceHistory?: AdminAiSourceCommentSlot;
  photosPersistenceEnabled?: boolean;
  onAutoRecordsPhotoGroupsStructuralCommit?: (
    next: AutoRecordsBlockState["photoGroups"],
  ) => void | Promise<void>;
};

export function AdminAutoRecordsSourceBlock({
  value,
  readOnly,
  disabled,
  onChange,
  trafficFillLevel,
  sessionId,
  getSourceBlocks,
  applyPatchedBlocks,
  pdfInclude,
  onPdfIncludeChange,
  aiComment,
  aiServiceHistory,
  photosPersistenceEnabled = false,
  onAutoRecordsPhotoGroupsStructuralCommit,
}: Props) {
  const mergeVehicleInfoFromText = (raw: string, base: AutoRecordsBlockState): AutoRecordsBlockState => {
    const patch = parseOutvinVehicleInfoFromAutoRecordsText(raw);
    if (!Object.values(patch).some((v) => typeof v === "string" && v.trim())) return base;
    const reportBase = base.outvinReport ?? emptyOutvinDealerReport();
    const nextVehicleInfo: OutvinVehicleInfo = { ...reportBase.vehicleInfo };
    for (const [k, v] of Object.entries(patch) as [keyof OutvinVehicleInfo, string][]) {
      if (typeof v === "string" && v.trim()) nextVehicleInfo[k] = v.trim();
    }
    if (!outvinVehicleInfoHasData(nextVehicleInfo)) return base;
    return { ...base, outvinReport: { ...reportBase, vehicleInfo: nextVehicleInfo } };
  };

  const handleRaw = (raw: string) => {
    let next: AutoRecordsBlockState = { ...value, rawUnprocessedData: raw };
    if (/VEHICLE\s+INFORMATION/i.test(raw)) {
      next = mergeVehicleInfoFromText(raw, next);
    }
    if (/ODOMETER\s+CHECK/i.test(raw)) {
      const parsed = parseAutoRecordsPaste(raw);
      next = {
        ...next,
        serviceHistory: parsed.length > 0 ? parsed : [emptyAutoRecordsServiceRow()],
      };
    } else if (looksLikeOfficialDealerServiceNarrative(raw)) {
      const parsed = parseOfficialDealerServiceNarrativePaste(raw);
      if (parsed.length > 0) {
        next = { ...next, serviceHistory: parsed };
      }
      // Nobraukuma tabula neglabā darbu aprakstu — tas iet servisa tabulā.
      const works = parseDealerNarrativeServiceWorks(raw);
      if (works.length > 0) {
        let rows = next.serviceWorks ?? [];
        for (const row of works) rows = mergeAutoRecordsServiceWorkRow(rows, row);
        next = { ...next, serviceWorks: rows };
      }
    }
    onChange(next);
  };

  const outvinReport = value.outvinReport ?? emptyOutvinDealerReport();

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

  const workRows =
    (value.serviceWorks ?? []).length > 0
      ? (value.serviceWorks ?? [])
      : [emptyAutoRecordsServiceWorkRow()];

  const setWorkRow = (index: number, patch: Partial<AutoRecordsServiceWorkRow>) => {
    const rows = [...workRows];
    rows[index] = { ...rows[index]!, ...patch };
    onChange({ ...value, serviceWorks: rows });
  };

  /** Kārtošana tikai pēc ievades beigām, lai rinda nepazūd zem kursora rakstīšanas laikā. */
  const sortWorkRows = () => {
    const rows = sortAutoRecordsServiceWorkRows(workRows.filter(autoRecordsServiceWorkRowHasData));
    onChange({ ...value, serviceWorks: rows.length > 0 ? rows : [emptyAutoRecordsServiceWorkRow()] });
  };

  const addWorkRow = () => {
    onChange({ ...value, serviceWorks: [...workRows, emptyAutoRecordsServiceWorkRow()] });
  };

  const removeWorkRow = (index: number) => {
    const rows = workRows.filter((_, i) => i !== index);
    onChange({ ...value, serviceWorks: rows.length > 0 ? rows : [emptyAutoRecordsServiceWorkRow()] });
  };

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
          {getSourceBlocks && applyPatchedBlocks ? (
            <AdminHistoryVendorPdfUpload
              target="auto_records"
              sessionId={sessionId}
              disabled={disabled}
              readOnly={readOnly}
              getSourceBlocks={getSourceBlocks}
              applyPatchedBlocks={applyPatchedBlocks}
            />
          ) : null}
          <label className="mb-0.5 block text-[10px] font-medium text-[var(--color-provin-muted)]">
            Paste RAW data here
          </label>
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
                aria-label={`${DEALER_ARIA} — neapstrādātie dati`}
              />
            </AdminAiPolishTextareaShell>
          )}

          <AdminOutvinDealerReportFields
            report={outvinReport}
            readOnly={readOnly}
            disabled={disabled}
            onChange={(next) => onChange({ ...value, outvinReport: next })}
          />

          <p className="mb-1.5 mt-3 flex items-center gap-2 text-[10px] font-medium uppercase tracking-wide text-slate-500">
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
                          aria-label={`${DEALER_ARIA} datums ${i + 1}`}
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
                          aria-label={`${DEALER_ARIA} odometrs ${i + 1}`}
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
                          aria-label={`${DEALER_ARIA} valsts ${i + 1}`}
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!readOnly && !disabled ? (
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-[var(--color-provin-muted)] hover:bg-slate-50"
                onClick={addRow}
              >
                + Rinda
              </button>
              <AdminClearOdometerButton
                sourceLabel={DEALER_ARIA}
                count={countAutoRecordsOdometerReadings(value)}
                onClear={() => onChange(clearAutoRecordsOdometerReadings(value))}
              />
            </div>
          ) : null}

          <p className="mb-1.5 mt-3 flex items-center gap-2 text-[10px] font-medium uppercase tracking-wide text-slate-500">
            <AdminProvinLucide icon={SUBHEADING_LUCIDE.serviceWorks} />
            {PROVIN_SERVICE_WORKS_TABLE_TITLE}
          </p>
          <div
            className="overflow-x-auto rounded-lg border border-slate-200/90"
            data-provin-mileage-table={PROVIN_SERVICE_WORKS_TABLE_DOM_KIND}
            data-provin-block="auto_records"
          >
            <table className="w-full min-w-[460px] border-collapse text-[11px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/90 text-left text-[10px] font-medium text-[var(--color-provin-muted)]">
                  <th
                    className={`${mileCell} w-[86px]`}
                    data-provin-field={PROVIN_SERVICE_WORKS_TABLE_FIELD.datums}
                  >
                    Datums
                  </th>
                  <th
                    className={`${mileCell} w-[86px]`}
                    data-provin-field={PROVIN_SERVICE_WORKS_TABLE_FIELD.odometrsKm}
                  >
                    Odometrs (km)
                  </th>
                  <th
                    className={`${mileCell} w-[150px]`}
                    data-provin-field={PROVIN_SERVICE_WORKS_TABLE_FIELD.vieta}
                  >
                    {SERVICE_WORKS_LOCATION_LABEL}
                  </th>
                  <th className={mileCell} data-provin-field={PROVIN_SERVICE_WORKS_TABLE_FIELD.darbi}>
                    Veiktie darbi
                  </th>
                  {!readOnly ? <th className={`${mileCell} w-[28px]`} aria-label="Noņemt" /> : null}
                </tr>
              </thead>
              <tbody>
                {workRows.map((row, i) => (
                  <tr key={i} className="border-b border-slate-100 last:border-b-0">
                    <td className={`${mileCell} align-top`}>
                      {readOnly ? (
                        <span
                          className="text-[var(--color-provin-muted)]"
                          data-provin-field={PROVIN_SERVICE_WORKS_TABLE_FIELD.datums}
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
                          id={`auto_records-${PROVIN_SERVICE_WORKS_TABLE_FIELD.datums}-${i}`}
                          name={`${PROVIN_SERVICE_WORKS_TABLE_FIELD.datums}[${i}]`}
                          data-provin-field={PROVIN_SERVICE_WORKS_TABLE_FIELD.datums}
                          data-provin-block="auto_records"
                          data-row-index={i}
                          placeholder="01.12.2023"
                          onChange={(e) => setWorkRow(i, { date: e.target.value })}
                          onBlur={sortWorkRows}
                          aria-label={`${DEALER_ARIA} servisa datums ${i + 1}`}
                        />
                      )}
                    </td>
                    <td className={`${mileCell} align-top`}>
                      {readOnly ? (
                        <span
                          className="text-[var(--color-provin-muted)]"
                          data-provin-field={PROVIN_SERVICE_WORKS_TABLE_FIELD.odometrsKm}
                          data-provin-block="auto_records"
                          data-row-index={i}
                        >
                          {formatServiceWorkOdometer(row.odometer) || "—"}
                        </span>
                      ) : (
                        <input
                          type="text"
                          inputMode="numeric"
                          className={inp}
                          value={row.odometer}
                          disabled={disabled}
                          id={`auto_records-${PROVIN_SERVICE_WORKS_TABLE_FIELD.odometrsKm}-${i}`}
                          name={`${PROVIN_SERVICE_WORKS_TABLE_FIELD.odometrsKm}[${i}]`}
                          data-provin-field={PROVIN_SERVICE_WORKS_TABLE_FIELD.odometrsKm}
                          data-provin-block="auto_records"
                          data-row-index={i}
                          onChange={(e) =>
                            setWorkRow(i, { odometer: normalizeAutoRecordsOdometer(e.target.value) })
                          }
                          onBlur={sortWorkRows}
                          aria-label={`${DEALER_ARIA} servisa odometrs ${i + 1}`}
                        />
                      )}
                    </td>
                    <td className={`${mileCell} align-top`}>
                      {readOnly ? (
                        <span
                          className="block text-[var(--color-provin-muted)]"
                          data-provin-field={PROVIN_SERVICE_WORKS_TABLE_FIELD.vieta}
                          data-provin-block="auto_records"
                          data-row-index={i}
                        >
                          {row.location.trim() || "—"}
                        </span>
                      ) : (
                        <textarea
                          className={`${inp} min-h-[52px] resize-y leading-snug`}
                          rows={2}
                          value={row.location}
                          disabled={disabled}
                          maxLength={AUTO_RECORDS_SERVICE_WORKS_LOCATION_MAX_LEN}
                          id={`auto_records-${PROVIN_SERVICE_WORKS_TABLE_FIELD.vieta}-${i}`}
                          name={`${PROVIN_SERVICE_WORKS_TABLE_FIELD.vieta}[${i}]`}
                          data-provin-field={PROVIN_SERVICE_WORKS_TABLE_FIELD.vieta}
                          data-provin-block="auto_records"
                          data-row-index={i}
                          placeholder="Niederlassung Bonn BMW AG, Bonn"
                          onChange={(e) => setWorkRow(i, { location: e.target.value })}
                          aria-label={`${DEALER_ARIA} servisa vieta ${i + 1}`}
                        />
                      )}
                    </td>
                    <td className={`${mileCell} align-top`}>
                      {readOnly ? (
                        <span
                          className="block whitespace-pre-wrap text-[var(--color-provin-muted)]"
                          data-provin-field={PROVIN_SERVICE_WORKS_TABLE_FIELD.darbi}
                          data-provin-block="auto_records"
                          data-row-index={i}
                        >
                          {row.works.trim() || "—"}
                        </span>
                      ) : (
                        <textarea
                          className={`${inp} min-h-[52px] resize-y leading-snug`}
                          rows={2}
                          value={row.works}
                          disabled={disabled}
                          maxLength={AUTO_RECORDS_SERVICE_WORKS_MAX_LEN}
                          id={`auto_records-${PROVIN_SERVICE_WORKS_TABLE_FIELD.darbi}-${i}`}
                          name={`${PROVIN_SERVICE_WORKS_TABLE_FIELD.darbi}[${i}]`}
                          data-provin-field={PROVIN_SERVICE_WORKS_TABLE_FIELD.darbi}
                          data-provin-block="auto_records"
                          data-row-index={i}
                          placeholder="Regulārā apkope: eļļas maiņa, salona gaisa filtra maiņa…"
                          onChange={(e) => setWorkRow(i, { works: e.target.value })}
                          aria-label={`${DEALER_ARIA} veiktie darbi ${i + 1}`}
                        />
                      )}
                    </td>
                    {!readOnly ? (
                      <td className={`${mileCell} align-top`}>
                        {!disabled ? (
                          <button
                            type="button"
                            disabled={disabled}
                            className="rounded-md border border-slate-200 bg-white px-1.5 py-1 text-[10px] text-slate-500 hover:bg-red-50 hover:text-red-700 disabled:opacity-40"
                            onClick={() => removeWorkRow(i)}
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
              onClick={addWorkRow}
            >
              + Rinda
            </button>
          ) : null}
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
            label="Servisa vēsture"
            value={value.serviceHistoryNotes ?? ""}
            onChange={(next) => onChange({ ...value, serviceHistoryNotes: next })}
            readOnly={readOnly}
            disabled={disabled}
            compact
            ai={aiServiceHistory}
            readonlyClassName="min-h-[36px] rounded-lg border border-slate-200/90 bg-white px-2 py-1.5 text-[11px] text-[var(--color-provin-muted)]"
            aria-label={`${DEALER_ARIA} — Servisa vēsture`}
          />
          {sessionId && onAutoRecordsPhotoGroupsStructuralCommit ? (
            <AdminListingAnalysisPhotos
              sessionId={sessionId}
              photoGroups={value.photoGroups ?? []}
              disabled={readOnly || !!disabled || !photosPersistenceEnabled}
              onPhotoGroupsStructuralCommit={(next) => onAutoRecordsPhotoGroupsStructuralCommit(next)}
              apiBasePath="/api/admin/auto-records-photo"
              maxPhotos={AUTO_RECORDS_MAX_PHOTOS}
              emptyGroup={emptyAutoRecordsPhotoGroup}
              sectionTitle="Fotogrāfijas (PDF)"
            />
          ) : null}
          <AdminSourceCommentField
            value={value.comments}
            onChange={(next) => onChange({ ...value, comments: next })}
            readOnly={readOnly}
            disabled={disabled}
            compact
            ai={aiComment}
            readonlyClassName="min-h-[36px] rounded-lg border border-slate-200/90 bg-white px-2 py-1.5 text-[11px] text-[var(--color-provin-muted)]"
            aria-label={`${DEALER_ARIA} — komentāri`}
          />
          <AdminAiContextRawField
            value={value.aiContextRaw}
            onChange={(next) => onChange({ ...value, aiContextRaw: next })}
            readOnly={readOnly}
            disabled={disabled}
            ariaLabel={`${DEALER_ARIA} — AI papildu konteksts`}
          />
        </div>
      </div>
    </AdminCollapsibleShell>
  );
}
