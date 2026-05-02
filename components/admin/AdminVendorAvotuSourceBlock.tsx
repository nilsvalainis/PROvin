"use client";

import { LossAmountFieldChrome } from "@/components/admin/LossAmountFieldChrome";
import { CountryFlagWithCode } from "@/components/admin/CountryFlagWithCode";
import { AdminAiPolishRichCommentShell } from "@/components/admin/AdminAiPolishRichCommentShell";
import { AdminRichCommentReadonly } from "@/components/admin/AdminInternalRichCommentEditor";
import { AdminCountryCombobox } from "@/components/admin/AdminCountryCombobox";
import { AdminSourceBlockHeader } from "@/components/admin/AdminSourceBlockHeader";
import { AdminProvinLucide } from "@/components/admin/AdminProvinLucide";
import type { LtabIncidentRow, VendorAvotuBlockState } from "@/lib/admin-source-blocks";
import {
  CSDD_MILEAGE_UNIFIED_TITLE,
  NEGADIJUMU_VESTURE_TITLE,
  PROVIN_MILEAGE_TABLE_DOM_KIND,
  PROVIN_MILEAGE_TABLE_FIELD,
  PROVIN_VENDOR_FIELD,
  emptyAutoRecordsServiceRow,
  emptyLtabRow,
  sourcePdfChecklistHasAny,
} from "@/lib/admin-source-blocks";
import { AdminSourcePdfChecklist } from "@/components/admin/AdminSourcePdfChecklist";
import type { AutoRecordsServiceRow } from "@/lib/auto-records-paste-parse";
import {
  autoRecordsRowHasData,
  formatAutoRecordsDateForOutput,
  normalizeAutoRecordsOdometer,
  sortAutoRecordsDescending,
} from "@/lib/auto-records-paste-parse";
import { parseCarverticalOdometerPaste } from "@/lib/carvertical-odometer-paste-parse";
import { SUBHEADING_LUCIDE } from "@/lib/admin-lucide-registry";
import type { TrafficFillLevel } from "@/lib/admin-block-traffic-status";
import { AdminPdfIncludeToggle } from "@/components/admin/AdminPdfIncludeToggle";
import { AdminCollapsibleShell } from "@/components/admin/AdminCollapsibleShell";

const inp =
  "min-w-0 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-[var(--color-apple-text)] placeholder:text-slate-400 focus:border-[var(--color-provin-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-provin-accent)]/25";

type BlockKey = "autodna" | "carvertical" | "citi_avoti";

const mileCell = "px-1.5 py-0.5";

type Props = {
  blockKey: BlockKey;
  value: VendorAvotuBlockState;
  readOnly: boolean;
  disabled?: boolean;
  onChange: (next: VendorAvotuBlockState) => void;
  trafficFillLevel?: TrafficFillLevel;
  sessionId: string;
  pdfInclude: boolean;
  onPdfIncludeChange: (next: boolean) => void;
};

export function AdminVendorAvotuSourceBlock({
  blockKey,
  value,
  readOnly,
  disabled,
  onChange,
  trafficFillLevel,
  sessionId,
  pdfInclude,
  onPdfIncludeChange,
}: Props) {
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

  const applyCarverticalOdometerPaste = (raw: string) => {
    const parsed = parseCarverticalOdometerPaste(raw);
    if (parsed.length === 0) return;
    onChange({
      ...value,
      mileagePasteRaw: raw.slice(0, 24_000),
      serviceHistory: parsed,
    });
  };

  return (
    <AdminCollapsibleShell
      sessionId={sessionId}
      blockId={`vendor-${blockKey}`}
      header={
        <AdminSourceBlockHeader
          blockKey={blockKey}
          trafficFillLevel={trafficFillLevel}
          className={`shrink-0 ${trafficFillLevel ? "mb-0" : "mb-0"}`}
        />
      }
      headerActions={<AdminPdfIncludeToggle checked={pdfInclude} onChange={onPdfIncludeChange} />}
    >
      <div className={`flex min-h-0 flex-col overflow-hidden ${trafficFillLevel ? "p-0" : "p-2"}`}>
      <div className={`min-h-0 flex-1 overflow-y-auto ${trafficFillLevel ? "px-2 pt-2" : ""}`}>
        <p className="mb-1.5 flex items-center gap-2 text-[10px] font-medium uppercase tracking-wide text-slate-500">
          <AdminProvinLucide icon={SUBHEADING_LUCIDE.mileage} />
          {CSDD_MILEAGE_UNIFIED_TITLE}
        </p>
        {blockKey === "carvertical" ? (
          <div className="mb-2">
            <label
              className="mb-0.5 block text-[10px] font-medium text-[var(--color-provin-muted)]"
              htmlFor={`${idBase}-mileage-paste-raw`}
            >
              CarVertical — odometra žurnāls (iekopēšanai)
            </label>
            {readOnly ? (
              <div
                id={`${idBase}-mileage-paste-raw`}
                className="min-h-[56px] whitespace-pre-wrap rounded-lg border border-slate-200/90 bg-slate-100 px-2 py-1.5 text-[11px] text-[var(--color-provin-muted)]"
              >
                {(value.mileagePasteRaw ?? "").trim() ? (
                  value.mileagePasteRaw
                ) : (
                  <span className="text-slate-400">—</span>
                )}
              </div>
            ) : (
              <>
                <textarea
                  id={`${idBase}-mileage-paste-raw`}
                  className="mb-1 w-full min-h-[72px] resize-y rounded-lg border border-slate-200 bg-slate-100 px-2 py-1.5 text-[11px] leading-snug text-[var(--color-apple-text)] placeholder:text-slate-400 focus:border-[var(--color-provin-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-provin-accent)]/20"
                  rows={4}
                  disabled={disabled}
                  placeholder="Odometra rādījumu ieraksti + rindas (MM.YYYY. … km vai DD.MM.YYYY. … km)…"
                  value={value.mileagePasteRaw ?? ""}
                  onChange={(e) =>
                    onChange({ ...value, mileagePasteRaw: e.target.value.slice(0, 24_000) })
                  }
                  onBlur={(e) => applyCarverticalOdometerPaste(e.currentTarget.value)}
                  aria-label="CarVertical odometra žurnāla iekopēšana"
                />
                {!disabled ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-[var(--color-provin-muted)] hover:bg-slate-50"
                      onClick={() => applyCarverticalOdometerPaste(value.mileagePasteRaw ?? "")}
                    >
                      Ielasīt tabulā
                    </button>
                    <span className="text-[10px] text-slate-400">
                      Kārtošana kā tabulā: jaunākais augšā (pēc datuma, tad km).
                    </span>
                  </div>
                ) : null}
              </>
            )}
          </div>
        ) : null}
        <div
          className="w-full min-w-0 overflow-x-auto rounded-lg border border-slate-200/90"
          data-provin-mileage-table={PROVIN_MILEAGE_TABLE_DOM_KIND}
          data-provin-block={blockKey}
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
                  <td className={`${mileCell} align-top`}>
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
                  <td className={`${mileCell} align-top`}>
                    {readOnly ? (
                      <CountryFlagWithCode
                        countryLabel={row.country.trim() || "—"}
                        data-provin-field={PROVIN_MILEAGE_TABLE_FIELD.valsts}
                        data-provin-block={blockKey}
                        data-row-index={i}
                      />
                    ) : (
                      <AdminCountryCombobox
                        className={inp}
                        value={row.country}
                        disabled={disabled}
                        id={`${idBase}-${PROVIN_VENDOR_FIELD.nobraukumaValsts}-${i}`}
                        name={`${PROVIN_VENDOR_FIELD.nobraukumaValsts}[${i}]`}
                        data-provin-field={PROVIN_VENDOR_FIELD.nobraukumaValsts}
                        data-provin-block={blockKey}
                        data-row-index={i}
                        onChange={(next) => setMileageRow(i, { country: next })}
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
          <p className="mb-2 flex items-center gap-2 text-[10px] font-medium uppercase tracking-wide text-slate-500">
            <AdminProvinLucide icon={SUBHEADING_LUCIDE.incidents} />
            {NEGADIJUMU_VESTURE_TITLE}
          </p>
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
                {value.incidents.map((row, ri) => (
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
                          id={`${idBase}-${PROVIN_VENDOR_FIELD.csngDatums}-${ri}`}
                          name={`${PROVIN_VENDOR_FIELD.csngDatums}[${ri}]`}
                          data-provin-field={PROVIN_VENDOR_FIELD.csngDatums}
                          data-row-index={ri}
                          onChange={(e) => setIncidentRow(ri, { csngDate: e.target.value })}
                          aria-label={`Datums, ${blockKey}, rinda ${ri + 1}`}
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
                    <td className={`${mileCell} align-top`}>
                      {readOnly ? (
                        <CountryFlagWithCode countryLabel={row.incidentNo.trim() || "—"} />
                      ) : (
                        <AdminCountryCombobox
                          className={inp}
                          placeholder="Latvija"
                          value={row.incidentNo}
                          disabled={disabled}
                          id={`${idBase}-${PROVIN_VENDOR_FIELD.negadijumuSkaits}-${ri}`}
                          name={`${PROVIN_VENDOR_FIELD.negadijumuSkaits}[${ri}]`}
                          data-provin-field={PROVIN_VENDOR_FIELD.negadijumuSkaits}
                          data-row-index={ri}
                          onChange={(next) => setIncidentRow(ri, { incidentNo: next })}
                          aria-label={`Valsts, ${blockKey}, rinda ${ri + 1}`}
                        />
                      )}
                    </td>
                    {!readOnly ? (
                      <td className={`${mileCell} align-top`}>
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

      <div className={`mt-auto w-full min-w-0 shrink-0 pt-2 ${trafficFillLevel ? "px-2 pb-2" : ""}`}>
        {blockKey === "autodna" || blockKey === "carvertical" ? (
          <AdminSourcePdfChecklist
            idPrefix={idBase}
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
        ) : null}
        <label className="mb-0.5 block text-[10px] font-medium text-[var(--color-provin-muted)]">Komentāri</label>
        {readOnly ? (
          <AdminRichCommentReadonly
            html={value.comments}
            className="min-h-[40px] rounded-lg border border-slate-200/90 bg-white px-2 py-1.5 text-[11px] text-[var(--color-provin-muted)]"
          />
        ) : (
          <AdminAiPolishRichCommentShell
            value={value.comments}
            onChange={(next) => onChange({ ...value, comments: next })}
            disabled={disabled}
            compact
            aria-label="Avota komentāri"
          />
        )}
      </div>
      </div>
    </AdminCollapsibleShell>
  );
}
