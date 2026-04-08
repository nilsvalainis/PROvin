"use client";

import { CountryFlagWithCode } from "@/components/admin/CountryFlagWithCode";
import { AdminSourceBlockHeader } from "@/components/admin/AdminSourceBlockHeader";
import { AdminProvinLucide } from "@/components/admin/AdminProvinLucide";
import type { CsddFormFields, CsddMileageRow } from "@/lib/admin-source-blocks";
import {
  CSDD_FORM_STRUCTURED_FIELDS,
  CSDD_MILEAGE_COUNTRY_UNKNOWN_LABEL,
  CSDD_MILEAGE_UNIFIED_TITLE,
  emptyCsddMileageRow,
  finalizeMileageHistory,
  PROVIN_MILEAGE_TABLE_DOM_KIND,
  PROVIN_MILEAGE_TABLE_FIELD,
} from "@/lib/admin-source-blocks";
import { applyCsddPasteToForm, parseCsddPaste } from "@/lib/csdd-paste-parse";
import type { TrafficFillLevel } from "@/lib/admin-block-traffic-status";
import { SUBHEADING_LUCIDE } from "@/lib/admin-lucide-registry";
import {
  getNextInspectionDateUiFlag,
  getParticulateMatterUiFlag,
  type CsddFieldUiFlag,
} from "@/lib/csdd-ui-flags";
import { AdminPdfIncludeToggle } from "@/components/admin/AdminPdfIncludeToggle";
import { AdminCollapsibleShell } from "@/components/admin/AdminCollapsibleShell";
import { AlertTriangle } from "lucide-react";

const inp =
  "min-w-0 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-[var(--color-apple-text)] placeholder:text-slate-400 focus:border-[var(--color-provin-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-provin-accent)]/25";

const inpAlertInner =
  "min-w-0 w-full flex-1 rounded border-0 bg-transparent px-0 py-0 text-[11px] text-[var(--color-apple-text)] focus:outline-none focus:ring-0";

/** Maigs fons, neitrāla apmale (kā `inp`); krāsainā kontūra nav — brīdinājumu rāda ikona kreisajā pusē. */
function csddAlertFrameClass(flag: Exclude<CsddFieldUiFlag, "none">): string {
  if (flag === "red") {
    return "rounded-lg border-l-2 border-l-[#FF4D4D] bg-[#FF4D4D]/[0.04] px-3 py-1.5 shadow-[0_2px_16px_rgba(15,23,42,0.06)]";
  }
  return "rounded-lg border-l-2 border-l-[#FFC107] bg-[#FFC107]/[0.04] px-3 py-1.5 shadow-[0_2px_16px_rgba(15,23,42,0.06)]";
}

function FieldAlertTriangleIcon({ flag }: { flag: Exclude<CsddFieldUiFlag, "none"> }) {
  const cls = flag === "red" ? "text-[#FF4D4D]" : "text-[#FFC107]";
  return (
    <span className="inline-flex shrink-0 items-center self-center" aria-hidden>
      <AlertTriangle className={`h-4 w-4 ${cls} [stroke-width:1.5]`} strokeWidth={1.5} />
    </span>
  );
}

const dateKeys = new Set<keyof CsddFormFields>([
  "firstRegistration",
  "nextInspectionDate",
  "prevInspectionDate",
]);

type Props = {
  value: CsddFormFields;
  readOnly: boolean;
  disabled?: boolean;
  onChange: (next: CsddFormFields) => void;
  trafficFillLevel?: TrafficFillLevel;
  pdfIncludeBlock: boolean;
  onPdfIncludeBlockChange: (next: boolean) => void;
  pdfIncludeMileageTable: boolean;
  onPdfIncludeMileageTableChange: (next: boolean) => void;
  sessionId: string;
  /** localStorage atslēgai — noklusējums `csdd`. */
  collapseBlockId?: string;
};

const mileCell = "px-1.5 py-0.5";

export function AdminCsddSourceBlock({
  value,
  readOnly,
  disabled,
  onChange,
  trafficFillLevel,
  pdfIncludeBlock,
  onPdfIncludeBlockChange,
  pdfIncludeMileageTable,
  onPdfIncludeMileageTableChange,
  sessionId,
  collapseBlockId = "csdd",
}: Props) {
  const setField = (key: keyof CsddFormFields, v: string) => {
    onChange({ ...value, [key]: v });
  };

  const handleRawInput = (raw: string) => {
    const parsed = parseCsddPaste(raw);
    onChange(applyCsddPasteToForm(value, raw, parsed));
  };

  const mileageRows =
    value.mileageHistory.length > 0 ? value.mileageHistory : [emptyCsddMileageRow()];

  const setMileage = (index: number, patch: Partial<CsddMileageRow>) => {
    const base = value.mileageHistory.length > 0 ? [...value.mileageHistory] : [emptyCsddMileageRow()];
    const row = base[index] ?? emptyCsddMileageRow();
    base[index] = { ...row, ...patch };
    onChange({ ...value, mileageHistory: finalizeMileageHistory(base) });
  };

  const addMileageRow = () => {
    const base =
      value.mileageHistory.length > 0 ? value.mileageHistory : [emptyCsddMileageRow()];
    onChange({
      ...value,
      mileageHistory: finalizeMileageHistory([...base, emptyCsddMileageRow()]),
    });
  };

  return (
    <AdminCollapsibleShell
      sessionId={sessionId}
      blockId={collapseBlockId}
      header={
        <AdminSourceBlockHeader
          blockKey="csdd"
          trafficFillLevel={trafficFillLevel}
          className={trafficFillLevel ? "mb-0" : "mb-0"}
        />
      }
      headerActions={
        <AdminPdfIncludeToggle checked={pdfIncludeBlock} onChange={onPdfIncludeBlockChange} />
      }
    >
      <div className={trafficFillLevel ? "space-y-2 p-2" : "space-y-2 p-2"}>
      <div className="mb-2 min-w-0">
        <label
          className="mb-0.5 block text-[10px] font-medium text-[var(--color-provin-muted)]"
          htmlFor="csdd_raw_data"
        >
          CSDD Neapstrādātie dati (Paste here)
        </label>
        {readOnly ? (
          <div className="min-h-[72px] whitespace-pre-wrap rounded-lg border border-slate-200/90 bg-slate-100 px-2 py-1.5 text-[11px] text-[var(--color-provin-muted)]">
            {value.rawUnprocessedData.trim() ? (
              value.rawUnprocessedData
            ) : (
              <span className="text-slate-400">—</span>
            )}
          </div>
        ) : (
          <textarea
            id="csdd_raw_data"
            className="w-full min-h-[96px] resize-y rounded-lg border border-slate-200 bg-slate-100 px-2 py-1.5 text-[11px] leading-snug text-[var(--color-apple-text)] placeholder:text-slate-400 focus:border-[var(--color-provin-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-provin-accent)]/20"
            rows={5}
            value={value.rawUnprocessedData}
            disabled={disabled}
            placeholder="Ielīmē šeit visu tekstu no CSDD…"
            onChange={(e) => handleRawInput(e.target.value)}
            aria-label="CSDD neapstrādātie dati"
          />
        )}
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {CSDD_FORM_STRUCTURED_FIELDS.map(({ key, label }) => {
          const strVal = value[key] as string;
          const isFlagField = key === "particulateMatter" || key === "nextInspectionDate";
          let flag: CsddFieldUiFlag = "none";
          let flagTitle = "";
          if (key === "particulateMatter") {
            flag = getParticulateMatterUiFlag(strVal);
            if (flag === "red") flagTitle = "Brīdinājums: vērtība virs 1 000 000.";
            else if (flag === "yellow") flagTitle = "Brīdinājums: vērtība virs 100 000.";
          } else if (key === "nextInspectionDate") {
            flag = getNextInspectionDateUiFlag(strVal);
            if (flag === "red")
              flagTitle =
                "Brīdinājums: apskates datums nokavēts vai līdz tam mazāk par 30 dienām.";
            else if (flag === "yellow") flagTitle = "Brīdinājums: līdz apskatei mazāk par 90 dienām.";
          }
          const showFlag = isFlagField && flag !== "none";

          return (
            <div key={key} className="min-w-0">
              {isFlagField && showFlag ? (
                <div
                  className="flex min-w-0 items-center gap-2"
                  title={flagTitle || undefined}
                  role="group"
                  aria-label={flagTitle || label}
                >
                  <FieldAlertTriangleIcon flag={flag === "red" ? "red" : "yellow"} />
                  <div
                    className={`min-w-0 flex-1 ${csddAlertFrameClass(flag === "red" ? "red" : "yellow")}`}
                  >
                    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="shrink-0 text-[10px] font-normal text-[var(--color-provin-muted)]">{label}</span>
                      <div className="min-w-0 flex-1">
                        {readOnly ? (
                          <div className="min-h-[20px] whitespace-pre-wrap text-[11px] text-[var(--color-apple-text)]">
                            {strVal.trim() ? strVal : <span className="text-slate-400">—</span>}
                          </div>
                        ) : dateKeys.has(key) ? (
                          <input
                            type="date"
                            className={inpAlertInner}
                            value={strVal}
                            disabled={disabled}
                            onChange={(e) => setField(key, e.target.value)}
                            aria-label={label}
                          />
                        ) : (
                          <input
                            type="text"
                            className={inpAlertInner}
                            value={strVal}
                            disabled={disabled}
                            onChange={(e) => setField(key, e.target.value)}
                            aria-label={label}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <label className="mb-0.5 block text-[10px] font-medium text-[var(--color-provin-muted)]">{label}</label>
                  {readOnly ? (
                    <div className="min-h-[28px] whitespace-pre-wrap rounded-md border border-slate-200/90 bg-white px-2 py-1 text-[11px] text-[var(--color-provin-muted)]">
                      {strVal.trim() ? strVal : <span className="text-slate-400">—</span>}
                    </div>
                  ) : dateKeys.has(key) ? (
                    <input
                      type="date"
                      className={inp}
                      value={strVal}
                      disabled={disabled}
                      onChange={(e) => setField(key, e.target.value)}
                      aria-label={label}
                    />
                  ) : (
                    <input
                      type="text"
                      className={inp}
                      value={strVal}
                      disabled={disabled}
                      onChange={(e) => setField(key, e.target.value)}
                      aria-label={label}
                    />
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-3 border-t border-slate-200/80 pt-2">
        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-wide text-slate-500">
            <AdminProvinLucide icon={SUBHEADING_LUCIDE.mileage} />
            {CSDD_MILEAGE_UNIFIED_TITLE}
          </p>
          <AdminPdfIncludeToggle checked={pdfIncludeMileageTable} onChange={onPdfIncludeMileageTableChange} />
        </div>
        <div
          className="overflow-x-auto rounded-lg border border-slate-200/90"
          data-provin-mileage-table={PROVIN_MILEAGE_TABLE_DOM_KIND}
          data-provin-block="csdd"
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
              {mileageRows.map((row, i) => (
                <tr key={i} className="border-b border-slate-100 last:border-b-0">
                  <td className={`${mileCell} align-top`}>
                    {readOnly ? (
                      <span
                        className="text-[var(--color-provin-muted)]"
                        data-provin-field={PROVIN_MILEAGE_TABLE_FIELD.datums}
                        data-provin-block="csdd"
                        data-row-index={i}
                      >
                        {row.date.trim() || "—"}
                      </span>
                    ) : (
                      <input
                        type="text"
                        className={inp}
                        value={row.date}
                        disabled={disabled}
                        id={`csdd-${PROVIN_MILEAGE_TABLE_FIELD.datums}-${i}`}
                        name={`${PROVIN_MILEAGE_TABLE_FIELD.datums}[${i}]`}
                        data-provin-field={PROVIN_MILEAGE_TABLE_FIELD.datums}
                        data-provin-block="csdd"
                        data-row-index={i}
                        onChange={(e) => setMileage(i, { date: e.target.value })}
                        aria-label={`Nobraukuma datums rinda ${i + 1}`}
                      />
                    )}
                  </td>
                  <td className={`${mileCell} align-top`}>
                    {readOnly ? (
                      <span
                        className="text-[var(--color-provin-muted)]"
                        data-provin-field={PROVIN_MILEAGE_TABLE_FIELD.odometrsKm}
                        data-provin-block="csdd"
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
                        id={`csdd-${PROVIN_MILEAGE_TABLE_FIELD.odometrsKm}-${i}`}
                        name={`${PROVIN_MILEAGE_TABLE_FIELD.odometrsKm}[${i}]`}
                        data-provin-field={PROVIN_MILEAGE_TABLE_FIELD.odometrsKm}
                        data-provin-block="csdd"
                        data-row-index={i}
                        onChange={(e) => setMileage(i, { odometer: e.target.value })}
                        aria-label={`Odometrs rinda ${i + 1}`}
                      />
                    )}
                  </td>
                  <td className={`${mileCell} align-top`}>
                    {readOnly ? (
                      <CountryFlagWithCode
                        countryLabel={row.country.trim() || CSDD_MILEAGE_COUNTRY_UNKNOWN_LABEL}
                        data-provin-field={PROVIN_MILEAGE_TABLE_FIELD.valsts}
                        data-provin-block="csdd"
                        data-row-index={i}
                      />
                    ) : (
                      <input
                        type="text"
                        className={inp}
                        value={row.country}
                        disabled={disabled}
                        id={`csdd-${PROVIN_MILEAGE_TABLE_FIELD.valsts}-${i}`}
                        name={`${PROVIN_MILEAGE_TABLE_FIELD.valsts}[${i}]`}
                        data-provin-field={PROVIN_MILEAGE_TABLE_FIELD.valsts}
                        data-provin-block="csdd"
                        data-row-index={i}
                        onChange={(e) => setMileage(i, { country: e.target.value })}
                        aria-label={`Valsts rinda ${i + 1}`}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!readOnly && !disabled && (
          <button
            type="button"
            className="mt-1.5 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-[var(--color-provin-muted)] hover:bg-slate-50"
            onClick={addMileageRow}
          >
            + Rinda
          </button>
        )}
      </div>
      </div>
    </AdminCollapsibleShell>
  );
}
