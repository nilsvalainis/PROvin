"use client";

/**
 * Starptautiskās vēstures avots (admin: „CC.VIN”).
 *
 * Struktūra un noformējums seko pārējiem avotu blokiem: PDF augšupielāde → tabulas → fotogrāfijas →
 * komentārs → AI konteksts. Specifikācijas šeit netiek dublētas — akcents ir uz sarkanajiem karogiem.
 */

import { AdminAiContextRawField } from "@/components/admin/AdminAiContextRawField";
import { AdminAiPolishTextareaShell } from "@/components/admin/AdminAiPolishTextareaShell";
import { AdminClearOdometerButton } from "@/components/admin/AdminClearOdometerButton";
import { AdminFieldResetButton } from "@/components/admin/AdminFieldResetButton";
import { AdminCollapsibleShell } from "@/components/admin/AdminCollapsibleShell";
import { AdminCountryCombobox } from "@/components/admin/AdminCountryCombobox";
import { AdminHistoryVendorPdfUpload } from "@/components/admin/AdminHistoryVendorPdfUpload";
import { AdminListingAnalysisPhotos } from "@/components/admin/AdminListingAnalysisPhotos";
import { AdminPdfIncludeToggle } from "@/components/admin/AdminPdfIncludeToggle";
import { AdminProvinLucide } from "@/components/admin/AdminProvinLucide";
import { AdminSourceBlockHeader } from "@/components/admin/AdminSourceBlockHeader";
import {
  AdminSourceCommentField,
  type AdminAiSourceCommentSlot,
} from "@/components/admin/AdminSourceCommentField";
import { CountryFlagWithCode } from "@/components/admin/CountryFlagWithCode";
import type { CopilotSourceKey } from "@/lib/admin-copilot-types";
import type { TrafficFillLevel } from "@/lib/admin-block-traffic-status";
import { SUBHEADING_LUCIDE } from "@/lib/admin-lucide-registry";
import {
  CSDD_MILEAGE_UNIFIED_TITLE,
  PROVIN_MILEAGE_TABLE_DOM_KIND,
  PROVIN_MILEAGE_TABLE_FIELD,
  type WorkspaceSourceBlocks,
} from "@/lib/admin-source-blocks";
import {
  autoRecordsRowHasData,
  formatAutoRecordsDateForOutput,
  normalizeAutoRecordsOdometer,
  type AutoRecordsServiceRow,
} from "@/lib/auto-records-paste-parse";
import {
  CC_VIN_MAX_PHOTOS,
  emptyCcVinPhotoGroup,
} from "@/lib/cc-vin-photo-types";
import {
  CC_VIN_ADMIN_LABEL,
  CC_VIN_SUBTITLES,
  emptyCcVinCheckRow,
  emptyCcVinDamageRow,
  emptyCcVinMileageRow,
  emptyCcVinRecordRow,
  emptyCcVinSaleRow,
  emptyCcVinTitleRow,
  type CcVinBlockState,
  type CcVinCheckRow,
  type CcVinDamageRow,
  type CcVinRecordRow,
  type CcVinSaleRow,
  type CcVinTitleRow,
} from "@/lib/cc-vin-report";

const ARIA = "Starptautiskā vēsture";

const inp =
  "min-w-0 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-[var(--color-apple-text)] placeholder:text-slate-400 focus:border-[var(--color-provin-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-provin-accent)]/25";

const cell = "px-1.5 py-0.5";

const subhead =
  "mb-1.5 mt-3 flex items-center gap-2 text-[10px] font-medium uppercase tracking-wide text-slate-500";

const tableWrap = "overflow-x-auto rounded-lg border border-slate-200/90";

const headRow =
  "border-b border-slate-200 bg-slate-50/90 text-left text-[10px] font-medium text-[var(--color-provin-muted)]";

const addBtn =
  "mt-1.5 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-[var(--color-provin-muted)] hover:bg-slate-50";

type Props = {
  value: CcVinBlockState;
  readOnly: boolean;
  disabled?: boolean;
  onChange: (next: CcVinBlockState) => void;
  trafficFillLevel?: TrafficFillLevel;
  sessionId: string;
  getSourceBlocks?: () => WorkspaceSourceBlocks;
  applyPatchedBlocks?: (
    patched: Partial<WorkspaceSourceBlocks>,
    changedKeys: CopilotSourceKey[],
  ) => void;
  pdfInclude: boolean;
  onPdfIncludeChange: (next: boolean) => void;
  aiComment?: AdminAiSourceCommentSlot;
  photosPersistenceEnabled?: boolean;
  onPhotoGroupsStructuralCommit?: (
    next: CcVinBlockState["photoGroups"],
  ) => void | Promise<void>;
};

export function AdminCcVinSourceBlock({
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
  photosPersistenceEnabled = false,
  onPhotoGroupsStructuralCommit,
}: Props) {
  const editable = !readOnly && !disabled;

  /** Katrai tabulai tāda pati rediģēšanas plūsma: rindas ar vismaz vienu tukšu rindu redzamībai. */
  function rowsOf<T>(rows: T[] | undefined, fallback: () => T): T[] {
    return rows && rows.length > 0 ? rows : [fallback()];
  }

  const setRows = <K extends keyof CcVinBlockState>(
    key: K,
    rows: CcVinBlockState[K],
  ) => {
    onChange({ ...value, [key]: rows });
  };

  const mileageRows = rowsOf(value.mileage, emptyCcVinMileageRow);
  const checkRows = rowsOf(value.checks, emptyCcVinCheckRow);
  const damageRows = rowsOf(value.damages, emptyCcVinDamageRow);
  const brandRows = rowsOf(value.brands, emptyCcVinRecordRow);
  const insuranceRows = rowsOf(value.insurance, emptyCcVinRecordRow);
  const titleRows = rowsOf(value.titles, emptyCcVinTitleRow);
  const saleRows = rowsOf(value.sales, emptyCcVinSaleRow);

  const patchRow = <T,>(rows: T[], index: number, patch: Partial<T>): T[] => {
    const next = [...rows];
    next[index] = { ...next[index]!, ...patch };
    return next;
  };

  const dropRow = <T,>(rows: T[], index: number, fallback: () => T): T[] => {
    const next = rows.filter((_, i) => i !== index);
    return next.length > 0 ? next : [fallback()];
  };

  const odometerCount = mileageRows.filter(autoRecordsRowHasData).length;

  const clearOdometer = () => {
    onChange({ ...value, mileage: [emptyCcVinMileageRow()] });
  };

  const headerField = (
    label: string,
    field: "reportDate" | "attentionMarks" | "ownersCount",
    placeholder: string,
  ) => (
    <label className="flex min-w-0 flex-1 flex-col gap-0.5">
      <span className="text-[9px] font-medium uppercase tracking-wide text-[var(--color-provin-muted)]">
        {label}
      </span>
      {readOnly ? (
        <span className="min-h-[24px] text-[11px] text-[var(--color-provin-muted)]">
          {value[field].trim() || "—"}
        </span>
      ) : (
        <input
          type="text"
          className={inp}
          value={value[field]}
          disabled={disabled}
          placeholder={placeholder}
          onChange={(e) => onChange({ ...value, [field]: e.target.value })}
          aria-label={`${ARIA} — ${label}`}
        />
      )}
    </label>
  );

  const textCell = (
    index: number,
    fieldLabel: string,
    value_: string,
    onNext: (next: string) => void,
    opts?: { placeholder?: string; multiline?: boolean; numeric?: boolean },
  ) => (
    <td className={`${cell} align-top`}>
      {readOnly ? (
        <span className="block whitespace-pre-wrap text-[var(--color-provin-muted)]">
          {value_.trim() || "—"}
        </span>
      ) : opts?.multiline ? (
        <textarea
          className={`${inp} min-h-[44px] resize-y leading-snug`}
          rows={2}
          value={value_}
          disabled={disabled}
          placeholder={opts?.placeholder}
          onChange={(e) => onNext(e.target.value)}
          aria-label={`${ARIA} — ${fieldLabel} ${index + 1}`}
        />
      ) : (
        <input
          type="text"
          inputMode={opts?.numeric ? "numeric" : undefined}
          className={inp}
          value={value_}
          disabled={disabled}
          placeholder={opts?.placeholder}
          onChange={(e) => onNext(e.target.value)}
          aria-label={`${ARIA} — ${fieldLabel} ${index + 1}`}
        />
      )}
    </td>
  );

  return (
    <AdminCollapsibleShell
      sessionId={sessionId}
      blockId="cc-vin"
      header={
        <AdminSourceBlockHeader
          blockKey="cc_vin"
          trafficFillLevel={trafficFillLevel}
          className="mb-0 shrink-0"
        />
      }
      headerActions={
        <AdminPdfIncludeToggle
          checked={pdfInclude}
          onChange={onPdfIncludeChange}
        />
      }
    >
      <div
        className={`flex h-full min-h-0 flex-col overflow-hidden ${trafficFillLevel ? "p-0" : "p-2"}`}
      >
        <div
          className={`min-h-0 flex-1 overflow-y-auto ${trafficFillLevel ? "px-2 pt-2" : ""}`}
        >
          {getSourceBlocks && applyPatchedBlocks ? (
            <AdminHistoryVendorPdfUpload
              target="cc_vin"
              sessionId={sessionId}
              disabled={disabled}
              readOnly={readOnly}
              getSourceBlocks={getSourceBlocks}
              applyPatchedBlocks={applyPatchedBlocks}
            />
          ) : null}

          <div className="mb-1 flex flex-wrap items-end gap-2">
            {headerField("Atskaites datums", "reportDate", "13.07.2026")}
            {headerField("Atzīmes reģistros", "attentionMarks", "8/12")}
            {headerField("Īpašnieku skaits", "ownersCount", "4")}
          </div>

          <p className={subhead}>
            <AdminProvinLucide icon={SUBHEADING_LUCIDE.incidents} />
            {CC_VIN_SUBTITLES.checks}
          </p>
          <div className={tableWrap}>
            <table className="w-full min-w-[320px] border-collapse text-[11px]">
              <thead>
                <tr className={headRow}>
                  <th className={cell}>Reģistrs</th>
                  <th className={`${cell} w-[130px]`}>Rezultāts</th>
                  <th className={`${cell} w-[92px]`}>Karogs</th>
                  {!readOnly ? (
                    <th className={`${cell} w-[28px]`} aria-label="Noņemt" />
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {checkRows.map((row, i) => (
                  <tr
                    key={i}
                    className="border-b border-slate-100 last:border-b-0"
                  >
                    {textCell(i, "reģistrs", row.label, (next) =>
                      setRows(
                        "checks",
                        patchRow<CcVinCheckRow>(checkRows, i, { label: next }),
                      ),
                    )}
                    {textCell(i, "rezultāts", row.status, (next) =>
                      setRows(
                        "checks",
                        patchRow<CcVinCheckRow>(checkRows, i, { status: next }),
                      ),
                    )}
                    <td className={`${cell} align-top`}>
                      {readOnly ? (
                        <span
                          className={`text-[11px] font-medium ${
                            row.severity === "alert"
                              ? "text-red-700"
                              : "text-emerald-700"
                          }`}
                        >
                          {row.severity === "alert" ? "Sarkans" : "Tīrs"}
                        </span>
                      ) : (
                        <select
                          className={inp}
                          value={row.severity}
                          disabled={disabled}
                          onChange={(e) =>
                            setRows(
                              "checks",
                              patchRow<CcVinCheckRow>(checkRows, i, {
                                severity:
                                  e.target.value === "alert" ? "alert" : "ok",
                              }),
                            )
                          }
                          aria-label={`${ARIA} — karogs ${i + 1}`}
                        >
                          <option value="ok">Tīrs</option>
                          <option value="alert">Sarkans</option>
                        </select>
                      )}
                    </td>
                    {!readOnly ? (
                      <td className={`${cell} align-top`}>
                        {editable ? (
                          <AdminFieldResetButton
                            title="Nodzēst rindu"
                            aria-label={`${ARIA} — nodzēst pārbaudi ${i + 1}`}
                            onClick={() =>
                              setRows(
                                "checks",
                                dropRow(checkRows, i, emptyCcVinCheckRow),
                              )
                            }
                          />
                        ) : null}
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {editable ? (
            <button
              type="button"
              className={addBtn}
              onClick={() =>
                setRows("checks", [...checkRows, emptyCcVinCheckRow()])
              }
            >
              + Rinda
            </button>
          ) : null}

          <p className={subhead}>
            <AdminProvinLucide icon={SUBHEADING_LUCIDE.mileage} />
            {CSDD_MILEAGE_UNIFIED_TITLE}
          </p>
          <div
            className={tableWrap}
            data-provin-mileage-table={PROVIN_MILEAGE_TABLE_DOM_KIND}
            data-provin-block="cc_vin"
          >
            <table className="w-full min-w-[280px] border-collapse text-[11px]">
              <thead>
                <tr className={headRow}>
                  <th
                    className={cell}
                    data-provin-field={PROVIN_MILEAGE_TABLE_FIELD.datums}
                  >
                    Datums
                  </th>
                  <th
                    className={cell}
                    data-provin-field={PROVIN_MILEAGE_TABLE_FIELD.odometrsKm}
                  >
                    Odometrs (km)
                  </th>
                  <th
                    className={cell}
                    data-provin-field={PROVIN_MILEAGE_TABLE_FIELD.valsts}
                  >
                    Valsts
                  </th>
                  {!readOnly ? (
                    <th className={`${cell} w-[28px]`} aria-label="Noņemt" />
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {mileageRows.map((row, i) => (
                  <tr
                    key={i}
                    className="border-b border-slate-100 last:border-b-0"
                  >
                    <td className={`${cell} align-top`}>
                      {readOnly ? (
                        <span
                          className="text-[var(--color-provin-muted)]"
                          data-provin-field={PROVIN_MILEAGE_TABLE_FIELD.datums}
                          data-provin-block="cc_vin"
                          data-row-index={i}
                        >
                          {formatAutoRecordsDateForOutput(row.date).trim() ||
                            "—"}
                        </span>
                      ) : (
                        <input
                          type="text"
                          className={inp}
                          value={row.date}
                          disabled={disabled}
                          id={`cc_vin-${PROVIN_MILEAGE_TABLE_FIELD.datums}-${i}`}
                          name={`${PROVIN_MILEAGE_TABLE_FIELD.datums}[${i}]`}
                          data-provin-field={PROVIN_MILEAGE_TABLE_FIELD.datums}
                          data-provin-block="cc_vin"
                          data-row-index={i}
                          onChange={(e) =>
                            setRows(
                              "mileage",
                              patchRow<AutoRecordsServiceRow>(mileageRows, i, {
                                date: e.target.value,
                              }),
                            )
                          }
                          aria-label={`${ARIA} datums ${i + 1}`}
                        />
                      )}
                    </td>
                    <td className={`${cell} align-top`}>
                      {readOnly ? (
                        <span
                          className="text-[var(--color-provin-muted)]"
                          data-provin-field={
                            PROVIN_MILEAGE_TABLE_FIELD.odometrsKm
                          }
                          data-provin-block="cc_vin"
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
                          id={`cc_vin-${PROVIN_MILEAGE_TABLE_FIELD.odometrsKm}-${i}`}
                          name={`${PROVIN_MILEAGE_TABLE_FIELD.odometrsKm}[${i}]`}
                          data-provin-field={
                            PROVIN_MILEAGE_TABLE_FIELD.odometrsKm
                          }
                          data-provin-block="cc_vin"
                          data-row-index={i}
                          onChange={(e) =>
                            setRows(
                              "mileage",
                              patchRow<AutoRecordsServiceRow>(mileageRows, i, {
                                odometer: normalizeAutoRecordsOdometer(
                                  e.target.value,
                                ),
                              }),
                            )
                          }
                          aria-label={`${ARIA} odometrs ${i + 1}`}
                        />
                      )}
                    </td>
                    <td className={`${cell} align-top`}>
                      {readOnly ? (
                        <CountryFlagWithCode
                          countryLabel={row.country.trim() || "—"}
                          data-provin-field={PROVIN_MILEAGE_TABLE_FIELD.valsts}
                          data-provin-block="cc_vin"
                          data-row-index={i}
                        />
                      ) : (
                        <AdminCountryCombobox
                          className={inp}
                          value={row.country}
                          disabled={disabled}
                          id={`cc_vin-${PROVIN_MILEAGE_TABLE_FIELD.valsts}-${i}`}
                          name={`${PROVIN_MILEAGE_TABLE_FIELD.valsts}[${i}]`}
                          data-provin-field={PROVIN_MILEAGE_TABLE_FIELD.valsts}
                          data-provin-block="cc_vin"
                          data-row-index={i}
                          onChange={(next) =>
                            setRows(
                              "mileage",
                              patchRow<AutoRecordsServiceRow>(mileageRows, i, {
                                country: next,
                              }),
                            )
                          }
                          aria-label={`${ARIA} valsts ${i + 1}`}
                        />
                      )}
                    </td>
                    {!readOnly ? (
                      <td className={`${cell} align-top`}>
                        {editable ? (
                          <AdminFieldResetButton
                            title="Nodzēst odometra rindu"
                            aria-label={`${ARIA} — nodzēst odometra rindu ${i + 1}`}
                            onClick={() =>
                              setRows(
                                "mileage",
                                dropRow(mileageRows, i, emptyCcVinMileageRow),
                              )
                            }
                          />
                        ) : null}
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {editable ? (
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-[var(--color-provin-muted)] hover:bg-slate-50"
                onClick={() =>
                  setRows("mileage", [...mileageRows, emptyCcVinMileageRow()])
                }
              >
                + Rinda
              </button>
              <AdminClearOdometerButton
                sourceLabel={ARIA}
                count={odometerCount}
                onClear={clearOdometer}
              />
            </div>
          ) : null}

          <p className={subhead}>
            <AdminProvinLucide icon={SUBHEADING_LUCIDE.incidents} />
            {CC_VIN_SUBTITLES.damages}
          </p>
          <div className={tableWrap}>
            <table className="w-full min-w-[420px] border-collapse text-[11px]">
              <thead>
                <tr className={headRow}>
                  <th className={`${cell} w-[86px]`}>Datums</th>
                  <th className={`${cell} w-[110px]`}>Vieta / reģions</th>
                  <th className={`${cell} w-[92px]`}>Summa</th>
                  <th className={cell}>Bojājums</th>
                  {!readOnly ? (
                    <th className={`${cell} w-[28px]`} aria-label="Noņemt" />
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {damageRows.map((row, i) => (
                  <tr
                    key={i}
                    className="border-b border-slate-100 last:border-b-0"
                  >
                    {textCell(
                      i,
                      "bojājuma datums",
                      row.date,
                      (next) =>
                        setRows(
                          "damages",
                          patchRow<CcVinDamageRow>(damageRows, i, {
                            date: next,
                          }),
                        ),
                      { placeholder: "06.08.2020" },
                    )}
                    {textCell(i, "bojājuma vieta", row.region, (next) =>
                      setRows(
                        "damages",
                        patchRow<CcVinDamageRow>(damageRows, i, {
                          region: next,
                        }),
                      ),
                    )}
                    {textCell(
                      i,
                      "bojājuma summa",
                      row.amount,
                      (next) =>
                        setRows(
                          "damages",
                          patchRow<CcVinDamageRow>(damageRows, i, {
                            amount: next,
                          }),
                        ),
                      { placeholder: "12 400 USD" },
                    )}
                    {textCell(
                      i,
                      "bojājuma apraksts",
                      row.description,
                      (next) =>
                        setRows(
                          "damages",
                          patchRow<CcVinDamageRow>(damageRows, i, {
                            description: next,
                          }),
                        ),
                      { multiline: true, placeholder: "Priekšpuses bojājums" },
                    )}
                    {!readOnly ? (
                      <td className={`${cell} align-top`}>
                        {editable ? (
                          <AdminFieldResetButton
                            title="Nodzēst rindu"
                            aria-label={`${ARIA} — nodzēst bojājumu ${i + 1}`}
                            onClick={() =>
                              setRows(
                                "damages",
                                dropRow(damageRows, i, emptyCcVinDamageRow),
                              )
                            }
                          />
                        ) : null}
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {editable ? (
            <button
              type="button"
              className={addBtn}
              onClick={() =>
                setRows("damages", [...damageRows, emptyCcVinDamageRow()])
              }
            >
              + Rinda
            </button>
          ) : null}

          {(
            [
              [
                "brands",
                CC_VIN_SUBTITLES.brands,
                brandRows,
                "Atzīme (total loss, salvage…)",
              ],
              [
                "insurance",
                CC_VIN_SUBTITLES.insurance,
                insuranceRows,
                "Uzņēmums / reģistrs",
              ],
            ] as const
          ).map(([key, title, rows, labelHead]) => (
            <div key={key}>
              <p className={subhead}>
                <AdminProvinLucide icon={SUBHEADING_LUCIDE.incidents} />
                {title}
              </p>
              <div className={tableWrap}>
                <table className="w-full min-w-[380px] border-collapse text-[11px]">
                  <thead>
                    <tr className={headRow}>
                      <th className={`${cell} w-[86px]`}>Datums</th>
                      <th className={`${cell} w-[170px]`}>{labelHead}</th>
                      <th className={cell}>Detaļas</th>
                      {!readOnly ? (
                        <th
                          className={`${cell} w-[28px]`}
                          aria-label="Noņemt"
                        />
                      ) : null}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => (
                      <tr
                        key={i}
                        className="border-b border-slate-100 last:border-b-0"
                      >
                        {textCell(i, `${key} datums`, row.date, (next) =>
                          setRows(
                            key,
                            patchRow<CcVinRecordRow>(rows, i, { date: next }),
                          ),
                        )}
                        {textCell(i, `${key} nosaukums`, row.label, (next) =>
                          setRows(
                            key,
                            patchRow<CcVinRecordRow>(rows, i, { label: next }),
                          ),
                        )}
                        {textCell(
                          i,
                          `${key} detaļas`,
                          row.detail,
                          (next) =>
                            setRows(
                              key,
                              patchRow<CcVinRecordRow>(rows, i, {
                                detail: next,
                              }),
                            ),
                          { multiline: true },
                        )}
                        {!readOnly ? (
                          <td className={`${cell} align-top`}>
                            {editable ? (
                              <AdminFieldResetButton
                                title="Nodzēst rindu"
                                aria-label={`${ARIA} — nodzēst ierakstu ${i + 1}`}
                                onClick={() =>
                                  setRows(
                                    key,
                                    dropRow(rows, i, emptyCcVinRecordRow),
                                  )
                                }
                              />
                            ) : null}
                          </td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {editable ? (
                <button
                  type="button"
                  className={addBtn}
                  onClick={() => setRows(key, [...rows, emptyCcVinRecordRow()])}
                >
                  + Rinda
                </button>
              ) : null}
            </div>
          ))}

          <p className={subhead}>
            <AdminProvinLucide icon={SUBHEADING_LUCIDE.incidents} />
            {CC_VIN_SUBTITLES.titles}
          </p>
          <div className={tableWrap}>
            <table className="w-full min-w-[380px] border-collapse text-[11px]">
              <thead>
                <tr className={headRow}>
                  <th className={`${cell} w-[86px]`}>Datums</th>
                  <th className={`${cell} w-[150px]`}>Reģions</th>
                  <th className={`${cell} w-[92px]`}>Odometrs (km)</th>
                  <th className={cell}>Piezīme</th>
                  {!readOnly ? (
                    <th className={`${cell} w-[28px]`} aria-label="Noņemt" />
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {titleRows.map((row, i) => (
                  <tr
                    key={i}
                    className="border-b border-slate-100 last:border-b-0"
                  >
                    {textCell(i, "title datums", row.date, (next) =>
                      setRows(
                        "titles",
                        patchRow<CcVinTitleRow>(titleRows, i, { date: next }),
                      ),
                    )}
                    {textCell(i, "title reģions", row.region, (next) =>
                      setRows(
                        "titles",
                        patchRow<CcVinTitleRow>(titleRows, i, { region: next }),
                      ),
                    )}
                    {textCell(
                      i,
                      "title odometrs",
                      row.odometer,
                      (next) =>
                        setRows(
                          "titles",
                          patchRow<CcVinTitleRow>(titleRows, i, {
                            odometer: normalizeAutoRecordsOdometer(next),
                          }),
                        ),
                      { numeric: true },
                    )}
                    {textCell(
                      i,
                      "title piezīme",
                      row.note,
                      (next) =>
                        setRows(
                          "titles",
                          patchRow<CcVinTitleRow>(titleRows, i, { note: next }),
                        ),
                      { multiline: true },
                    )}
                    {!readOnly ? (
                      <td className={`${cell} align-top`}>
                        {editable ? (
                          <AdminFieldResetButton
                            title="Nodzēst rindu"
                            aria-label={`${ARIA} — nodzēst īpašumtiesības ${i + 1}`}
                            onClick={() =>
                              setRows(
                                "titles",
                                dropRow(titleRows, i, emptyCcVinTitleRow),
                              )
                            }
                          />
                        ) : null}
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {editable ? (
            <button
              type="button"
              className={addBtn}
              onClick={() =>
                setRows("titles", [...titleRows, emptyCcVinTitleRow()])
              }
            >
              + Rinda
            </button>
          ) : null}

          <p className={subhead}>
            <AdminProvinLucide icon={SUBHEADING_LUCIDE.incidents} />
            {CC_VIN_SUBTITLES.sales}
          </p>
          <div className={tableWrap}>
            <table className="w-full min-w-[460px] border-collapse text-[11px]">
              <thead>
                <tr className={headRow}>
                  <th className={`${cell} w-[86px]`}>Datums</th>
                  <th className={cell}>Vieta / izsole</th>
                  <th className={`${cell} w-[92px]`}>Odometrs (km)</th>
                  <th className={`${cell} w-[96px]`}>Cena</th>
                  <th className={`${cell} w-[96px]`}>Statuss</th>
                  {!readOnly ? (
                    <th className={`${cell} w-[28px]`} aria-label="Noņemt" />
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {saleRows.map((row, i) => (
                  <tr
                    key={i}
                    className="border-b border-slate-100 last:border-b-0"
                  >
                    {textCell(i, "pārdošanas datums", row.date, (next) =>
                      setRows(
                        "sales",
                        patchRow<CcVinSaleRow>(saleRows, i, { date: next }),
                      ),
                    )}
                    {textCell(i, "pārdošanas vieta", row.venue, (next) =>
                      setRows(
                        "sales",
                        patchRow<CcVinSaleRow>(saleRows, i, { venue: next }),
                      ),
                    )}
                    {textCell(
                      i,
                      "pārdošanas odometrs",
                      row.odometer,
                      (next) =>
                        setRows(
                          "sales",
                          patchRow<CcVinSaleRow>(saleRows, i, {
                            odometer: next,
                          }),
                        ),
                      { numeric: true },
                    )}
                    {textCell(
                      i,
                      "pārdošanas cena",
                      row.price,
                      (next) =>
                        setRows(
                          "sales",
                          patchRow<CcVinSaleRow>(saleRows, i, { price: next }),
                        ),
                      { placeholder: "7 662 EUR" },
                    )}
                    {textCell(
                      i,
                      "pārdošanas statuss",
                      row.status,
                      (next) =>
                        setRows(
                          "sales",
                          patchRow<CcVinSaleRow>(saleRows, i, { status: next }),
                        ),
                      { placeholder: "Pārdots" },
                    )}
                    {!readOnly ? (
                      <td className={`${cell} align-top`}>
                        {editable ? (
                          <AdminFieldResetButton
                            title="Nodzēst rindu"
                            aria-label={`${ARIA} — nodzēst pārdošanu ${i + 1}`}
                            onClick={() =>
                              setRows(
                                "sales",
                                dropRow(saleRows, i, emptyCcVinSaleRow),
                              )
                            }
                          />
                        ) : null}
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {editable ? (
            <button
              type="button"
              className={addBtn}
              onClick={() =>
                setRows("sales", [...saleRows, emptyCcVinSaleRow()])
              }
            >
              + Rinda
            </button>
          ) : null}

          <p className="mb-0.5 mt-3 block text-[10px] font-medium text-[var(--color-provin-muted)]">
            Neapstrādātie dati (tikai admin)
          </p>
          {readOnly ? (
            <div className="mb-2 min-h-[48px] whitespace-pre-wrap rounded-lg border border-slate-200/90 bg-slate-100 px-2 py-1.5 text-[11px] text-[var(--color-provin-muted)]">
              {value.rawUnprocessedData.trim() || "—"}
            </div>
          ) : (
            <AdminAiPolishTextareaShell
              value={value.rawUnprocessedData}
              onPolished={(next) =>
                onChange({ ...value, rawUnprocessedData: next })
              }
              disabled={disabled}
            >
              <textarea
                className="mb-2 w-full min-h-[72px] resize-y rounded-lg border border-slate-200 bg-slate-100 px-2 py-1.5 text-[11px] leading-snug text-[var(--color-apple-text)] placeholder:text-slate-400 focus:border-[var(--color-provin-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-provin-accent)]/20"
                rows={3}
                value={value.rawUnprocessedData}
                disabled={disabled}
                placeholder="Ielīmē atskaites tekstu, ja PDF nav pieejams…"
                onChange={(e) =>
                  onChange({ ...value, rawUnprocessedData: e.target.value })
                }
                aria-label={`${ARIA} — neapstrādātie dati`}
              />
            </AdminAiPolishTextareaShell>
          )}
        </div>

        <div
          className={`mt-auto w-full min-w-0 shrink-0 pt-2 ${trafficFillLevel ? "px-2 pb-2" : ""}`}
        >
          {sessionId && onPhotoGroupsStructuralCommit ? (
            <AdminListingAnalysisPhotos
              sessionId={sessionId}
              photoGroups={value.photoGroups ?? []}
              disabled={readOnly || !!disabled || !photosPersistenceEnabled}
              onPhotoGroupsStructuralCommit={(next) =>
                onPhotoGroupsStructuralCommit(next)
              }
              apiBasePath="/api/admin/cc-vin-photo"
              maxPhotos={CC_VIN_MAX_PHOTOS}
              emptyGroup={emptyCcVinPhotoGroup}
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
            aria-label={`${CC_VIN_ADMIN_LABEL} — komentāri`}
          />
          <AdminAiContextRawField
            value={value.aiContextRaw}
            onChange={(next) => onChange({ ...value, aiContextRaw: next })}
            readOnly={readOnly}
            disabled={disabled}
            ariaLabel={`${ARIA} — AI papildu konteksts`}
          />
        </div>
      </div>
    </AdminCollapsibleShell>
  );
}
