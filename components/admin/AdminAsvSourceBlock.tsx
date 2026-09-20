"use client";

import { useState } from "react";
import { AdminAiContextRawField } from "@/components/admin/AdminAiContextRawField";
import { AdminAiPolishTextareaShell } from "@/components/admin/AdminAiPolishTextareaShell";
import { AdminClearOdometerButton } from "@/components/admin/AdminClearOdometerButton";
import { AdminFieldResetButton } from "@/components/admin/AdminFieldResetButton";
import { AdminCollapsibleShell } from "@/components/admin/AdminCollapsibleShell";
import { AdminListingAnalysisPhotos } from "@/components/admin/AdminListingAnalysisPhotos";
import { AdminAsvIngestBar } from "@/components/admin/AdminAsvIngestBar";
import { AdminSourceBlockHeaderTools } from "@/components/admin/AdminClearSourceBlockButton";
import { AdminPdfIncludeToggle } from "@/components/admin/AdminPdfIncludeToggle";
import { AdminProvinLucide } from "@/components/admin/AdminProvinLucide";
import { AdminSourceBlockHeader } from "@/components/admin/AdminSourceBlockHeader";
import {
  AdminSourceCommentField,
  type AdminAiSourceCommentSlot,
} from "@/components/admin/AdminSourceCommentField";
import type { TrafficFillLevel } from "@/lib/admin-block-traffic-status";
import { SUBHEADING_LUCIDE } from "@/lib/admin-lucide-registry";
import { dropOrResetRow } from "@/lib/admin-drop-or-reset-row";
import { ASV_DEFAULT_PRODUCT_IDS, type AsvProductId } from "@/lib/asv-catalog";
import { ASV_MAX_PHOTOS, emptyAsvPhotoGroup } from "@/lib/asv-photo-types";
import {
  ASV_ADMIN_LABEL,
  ASV_SUBTITLES,
  emptyAsvBlock,
  emptyAsvCheckRow,
  emptyAsvDamageRow,
  emptyAsvMileageRow,
  emptyAsvRecordRow,
  emptyAsvSaleRow,
  emptyAsvTitleRow,
  type AsvBlockState,
  type AsvCheckRow,
  type AsvDamageRow,
  type AsvRecordRow,
  type AsvSaleRow,
  type AsvTitleRow,
} from "@/lib/asv-report";
import { autoRecordsRowHasData } from "@/lib/auto-records-paste-parse";

const ARIA = "ASV vēsture";

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
  value: AsvBlockState;
  readOnly: boolean;
  disabled?: boolean;
  onChange: (next: AsvBlockState) => void;
  trafficFillLevel?: TrafficFillLevel;
  sessionId: string;
  pdfInclude: boolean;
  onPdfIncludeChange: (next: boolean) => void;
  aiComment?: AdminAiSourceCommentSlot;
  photosPersistenceEnabled?: boolean;
  onPhotoGroupsStructuralCommit?: (next: AsvBlockState["photoGroups"]) => void | Promise<void>;
  onGenerateAsvPdf?: () => void;
  orderVin?: string;
};

export function AdminAsvSourceBlock({
  value,
  readOnly,
  disabled,
  onChange,
  trafficFillLevel,
  sessionId,
  pdfInclude,
  onPdfIncludeChange,
  aiComment,
  photosPersistenceEnabled = false,
  onPhotoGroupsStructuralCommit,
  onGenerateAsvPdf,
  orderVin = "",
}: Props) {
  const editable = !readOnly && !disabled;
  const [selectedProducts, setSelectedProducts] = useState<AsvProductId[]>([...ASV_DEFAULT_PRODUCT_IDS]);

  function rowsOf<T>(rows: T[] | undefined, fallback: () => T): T[] {
    return rows && rows.length > 0 ? rows : [fallback()];
  }

  const setRows = <K extends keyof AsvBlockState>(key: K, rows: AsvBlockState[K]) => {
    onChange({ ...value, [key]: rows });
  };

  const mileageRows = rowsOf(value.mileage, emptyAsvMileageRow);
  const checkRows = rowsOf(value.checks, emptyAsvCheckRow);
  const damageRows = rowsOf(value.damages, emptyAsvDamageRow);
  const brandRows = rowsOf(value.brands, emptyAsvRecordRow);
  const titleRows = rowsOf(value.titles, emptyAsvTitleRow);
  const saleRows = rowsOf(value.sales, emptyAsvSaleRow);
  const lienRows = rowsOf(value.liens, emptyAsvRecordRow);
  const theftRows = rowsOf(value.thefts, emptyAsvRecordRow);

  const patchRow = <T,>(rows: T[], index: number, patch: Partial<T>): T[] => {
    const next = [...rows];
    next[index] = { ...next[index]!, ...patch };
    return next;
  };

  const textCell = (
    index: number,
    fieldLabel: string,
    value_: string,
    onNext: (next: string) => void,
    opts?: { multiline?: boolean },
  ) => (
    <td className={`${cell} align-top`}>
      {readOnly ? (
        <span className="block whitespace-pre-wrap text-[var(--color-provin-muted)]">
          {value_.trim() || "-"}
        </span>
      ) : opts?.multiline ? (
        <textarea
          className={`${inp} min-h-[44px] resize-y leading-snug`}
          rows={2}
          value={value_}
          disabled={disabled}
          onChange={(e) => onNext(e.target.value)}
          aria-label={`${ARIA} - ${fieldLabel} ${index + 1}`}
        />
      ) : (
        <input
          type="text"
          className={inp}
          value={value_}
          disabled={disabled}
          onChange={(e) => onNext(e.target.value)}
          aria-label={`${ARIA} - ${fieldLabel} ${index + 1}`}
        />
      )}
    </td>
  );

  const odometerCount = mileageRows.filter(autoRecordsRowHasData).length;

  return (
    <AdminCollapsibleShell
      sessionId={sessionId}
      blockId="asv"
      header={
        <AdminSourceBlockHeader
          blockKey="asv"
          trafficFillLevel={trafficFillLevel}
          className="mb-0 shrink-0"
        />
      }
      headerActions={
        <AdminSourceBlockHeaderTools
          sourceLabel={ASV_ADMIN_LABEL}
          readOnly={readOnly}
          disabled={disabled}
          onClear={() => onChange(emptyAsvBlock())}
        >
          {onGenerateAsvPdf ? (
            <button
              type="button"
              className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-600 hover:bg-slate-50"
              onClick={onGenerateAsvPdf}
            >
              PDF: tikai ASV
            </button>
          ) : null}
          <AdminPdfIncludeToggle checked={pdfInclude} onChange={onPdfIncludeChange} />
        </AdminSourceBlockHeaderTools>
      }
    >
      <div className={`flex h-full min-h-0 flex-col overflow-hidden ${trafficFillLevel ? "p-0" : "p-2"}`}>
        <div className={`min-h-0 flex-1 overflow-y-auto ${trafficFillLevel ? "px-2 pt-2" : ""}`}>
          <AdminAsvIngestBar
            orderVin={orderVin}
            sessionId={sessionId}
            editable={editable}
            lastFetchedVin={value.lastFetchedVin}
            lastReportId={value.reportId}
            hasMappedData={odometerCount > 0 || (value.checks ?? []).length > 0}
            selectedProducts={selectedProducts}
            onSelectedProductsChange={setSelectedProducts}
            onFetched={(next) =>
              onChange({
                ...value,
                ...next,
                comments: value.comments,
                photoGroups:
                  next.photoGroups && next.photoGroups.length > 0 ? next.photoGroups : value.photoGroups,
                photos: next.photos && next.photos.length > 0 ? next.photos : value.photos,
              })
            }
          />

          <div className="mb-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(
              [
                ["reportDate", "Atskaites datums"],
                ["attentionMarks", "Atzīmes"],
                ["ownersCount", "Īpašnieki"],
                ["productUsed", "Produkts"],
                ["lastCostUsd", "Pēdējā ielāde"],
                ["reportId", "Atskaites ID"],
              ] as const
            ).map(([field, label]) => (
              <label key={field} className="flex min-w-0 flex-col gap-0.5">
                <span className="text-[9px] font-medium uppercase tracking-wide text-[var(--color-provin-muted)]">
                  {label}
                </span>
                <input
                  type="text"
                  className={inp}
                  value={value[field]}
                  disabled={!editable}
                  onChange={(e) => onChange({ ...value, [field]: e.target.value })}
                />
              </label>
            ))}
          </div>

          <p className={subhead}>
            <AdminProvinLucide icon={SUBHEADING_LUCIDE.incidents} />
            {ASV_SUBTITLES.checks}
          </p>
          <div className={tableWrap}>
            <table className="w-full min-w-[360px] border-collapse text-[11px]">
              <thead>
                <tr className={headRow}>
                  <th className={cell}>Reģistrs</th>
                  <th className={cell}>Statuss</th>
                  {!readOnly ? <th className={`${cell} w-[28px]`} aria-label="Noņemt" /> : null}
                </tr>
              </thead>
              <tbody>
                {checkRows.map((row, i) => (
                  <tr key={i} className="border-b border-slate-100 last:border-b-0">
                    {textCell(i, "reģistrs", row.label, (next) =>
                      setRows("checks", patchRow<AsvCheckRow>(checkRows, i, { label: next })),
                    )}
                    {textCell(i, "statuss", row.status, (next) =>
                      setRows("checks", patchRow<AsvCheckRow>(checkRows, i, { status: next })),
                    )}
                    {!readOnly && editable ? (
                      <td className={`${cell} align-top`}>
                        <AdminFieldResetButton
                          onClick={() =>
                            setRows("checks", dropOrResetRow(checkRows, i, emptyAsvCheckRow))
                          }
                        />
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {editable ? (
            <button type="button" className={addBtn} onClick={() => setRows("checks", [...checkRows, emptyAsvCheckRow()])}>
              + Rinda
            </button>
          ) : null}

          <p className={subhead}>
            <AdminProvinLucide icon={SUBHEADING_LUCIDE.mileage} />
            Odometrs (km)
            <AdminClearOdometerButton
              sourceLabel={ASV_ADMIN_LABEL}
              count={odometerCount}
              disabled={!editable}
              onClear={() => onChange({ ...value, mileage: [emptyAsvMileageRow()] })}
            />
          </p>
          <div className={tableWrap}>
            <table className="w-full min-w-[360px] border-collapse text-[11px]">
              <thead>
                <tr className={headRow}>
                  <th className={`${cell} w-[86px]`}>Datums</th>
                  <th className={`${cell} w-[90px]`}>km</th>
                  <th className={cell}>Valsts / štats</th>
                  {!readOnly ? <th className={`${cell} w-[28px]`} aria-label="Noņemt" /> : null}
                </tr>
              </thead>
              <tbody>
                {mileageRows.map((row, i) => (
                  <tr key={i} className="border-b border-slate-100 last:border-b-0">
                    {textCell(i, "odometra datums", row.date, (next) =>
                      setRows("mileage", patchRow(mileageRows, i, { date: next })),
                    )}
                    {textCell(i, "odometrs", row.odometer, (next) =>
                      setRows("mileage", patchRow(mileageRows, i, { odometer: next })),
                    )}
                    {textCell(i, "valsts", row.country, (next) =>
                      setRows("mileage", patchRow(mileageRows, i, { country: next })),
                    )}
                    {!readOnly && editable ? (
                      <td className={`${cell} align-top`}>
                        <AdminFieldResetButton
                          onClick={() =>
                            setRows("mileage", dropOrResetRow(mileageRows, i, emptyAsvMileageRow))
                          }
                        />
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
              onClick={() => setRows("mileage", [...mileageRows, emptyAsvMileageRow()])}
            >
              + Rinda
            </button>
          ) : null}

          <p className={subhead}>
            <AdminProvinLucide icon={SUBHEADING_LUCIDE.incidents} />
            {ASV_SUBTITLES.damages}
          </p>
          <div className={tableWrap}>
            <table className="w-full min-w-[420px] border-collapse text-[11px]">
              <thead>
                <tr className={headRow}>
                  <th className={`${cell} w-[86px]`}>Datums</th>
                  <th className={cell}>Apraksts</th>
                  <th className={`${cell} w-[80px]`}>Summa</th>
                  <th className={`${cell} w-[110px]`}>Vieta</th>
                  {!readOnly ? <th className={`${cell} w-[28px]`} aria-label="Noņemt" /> : null}
                </tr>
              </thead>
              <tbody>
                {damageRows.map((row, i) => (
                  <tr key={i} className="border-b border-slate-100 last:border-b-0">
                    {textCell(i, "bojājuma datums", row.date, (next) =>
                      setRows("damages", patchRow<AsvDamageRow>(damageRows, i, { date: next })),
                    )}
                    {textCell(i, "bojājums", row.description, (next) =>
                      setRows("damages", patchRow<AsvDamageRow>(damageRows, i, { description: next })),
                      { multiline: true },
                    )}
                    {textCell(i, "summa", row.amount, (next) =>
                      setRows("damages", patchRow<AsvDamageRow>(damageRows, i, { amount: next })),
                    )}
                    {textCell(i, "vieta", row.region, (next) =>
                      setRows("damages", patchRow<AsvDamageRow>(damageRows, i, { region: next })),
                    )}
                    {!readOnly && editable ? (
                      <td className={`${cell} align-top`}>
                        <AdminFieldResetButton
                          onClick={() =>
                            setRows("damages", dropOrResetRow(damageRows, i, emptyAsvDamageRow))
                          }
                        />
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
              onClick={() => setRows("damages", [...damageRows, emptyAsvDamageRow()])}
            >
              + Rinda
            </button>
          ) : null}

          {(
            [
              ["brands", ASV_SUBTITLES.brands, brandRows, emptyAsvRecordRow] as const,
              ["liens", ASV_SUBTITLES.liens, lienRows, emptyAsvRecordRow] as const,
              ["thefts", ASV_SUBTITLES.thefts, theftRows, emptyAsvRecordRow] as const,
            ] as const
          ).map(([key, title, rows, empty]) => (
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
                      <th className={`${cell} w-[160px]`}>Ieraksts</th>
                      <th className={cell}>Detaļas</th>
                      {!readOnly ? <th className={`${cell} w-[28px]`} aria-label="Noņemt" /> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => (
                      <tr key={i} className="border-b border-slate-100 last:border-b-0">
                        {textCell(i, `${key} datums`, row.date, (next) =>
                          setRows(key, patchRow<AsvRecordRow>(rows, i, { date: next })),
                        )}
                        {textCell(i, `${key} nosaukums`, row.label, (next) =>
                          setRows(key, patchRow<AsvRecordRow>(rows, i, { label: next })),
                        )}
                        {textCell(i, `${key} detaļas`, row.detail, (next) =>
                          setRows(key, patchRow<AsvRecordRow>(rows, i, { detail: next })),
                          { multiline: true },
                        )}
                        {!readOnly && editable ? (
                          <td className={`${cell} align-top`}>
                            <AdminFieldResetButton
                              onClick={() => setRows(key, dropOrResetRow(rows, i, empty))}
                            />
                          </td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {editable ? (
                <button type="button" className={addBtn} onClick={() => setRows(key, [...rows, empty()])}>
                  + Rinda
                </button>
              ) : null}
            </div>
          ))}

          <p className={subhead}>
            <AdminProvinLucide icon={SUBHEADING_LUCIDE.mileage} />
            {ASV_SUBTITLES.titles}
          </p>
          <div className={tableWrap}>
            <table className="w-full min-w-[420px] border-collapse text-[11px]">
              <thead>
                <tr className={headRow}>
                  <th className={`${cell} w-[86px]`}>Datums</th>
                  <th className={`${cell} w-[90px]`}>Štats</th>
                  <th className={`${cell} w-[80px]`}>km</th>
                  <th className={cell}>Piezīme</th>
                  {!readOnly ? <th className={`${cell} w-[28px]`} aria-label="Noņemt" /> : null}
                </tr>
              </thead>
              <tbody>
                {titleRows.map((row, i) => (
                  <tr key={i} className="border-b border-slate-100 last:border-b-0">
                    {textCell(i, "title datums", row.date, (next) =>
                      setRows("titles", patchRow<AsvTitleRow>(titleRows, i, { date: next })),
                    )}
                    {textCell(i, "title reģions", row.region, (next) =>
                      setRows("titles", patchRow<AsvTitleRow>(titleRows, i, { region: next })),
                    )}
                    {textCell(i, "title odometrs", row.odometer, (next) =>
                      setRows("titles", patchRow<AsvTitleRow>(titleRows, i, { odometer: next })),
                    )}
                    {textCell(i, "title piezīme", row.note, (next) =>
                      setRows("titles", patchRow<AsvTitleRow>(titleRows, i, { note: next })),
                    )}
                    {!readOnly && editable ? (
                      <td className={`${cell} align-top`}>
                        <AdminFieldResetButton
                          onClick={() => setRows("titles", dropOrResetRow(titleRows, i, emptyAsvTitleRow))}
                        />
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {editable ? (
            <button type="button" className={addBtn} onClick={() => setRows("titles", [...titleRows, emptyAsvTitleRow()])}>
              + Rinda
            </button>
          ) : null}

          <p className={subhead}>
            <AdminProvinLucide icon={SUBHEADING_LUCIDE.listingHistory} />
            {ASV_SUBTITLES.sales}
          </p>
          <div className={tableWrap}>
            <table className="w-full min-w-[480px] border-collapse text-[11px]">
              <thead>
                <tr className={headRow}>
                  <th className={`${cell} w-[86px]`}>Datums</th>
                  <th className={cell}>Vieta</th>
                  <th className={`${cell} w-[80px]`}>km</th>
                  <th className={`${cell} w-[80px]`}>Cena</th>
                  <th className={`${cell} w-[90px]`}>Statuss</th>
                  {!readOnly ? <th className={`${cell} w-[28px]`} aria-label="Noņemt" /> : null}
                </tr>
              </thead>
              <tbody>
                {saleRows.map((row, i) => (
                  <tr key={i} className="border-b border-slate-100 last:border-b-0">
                    {textCell(i, "izsoles datums", row.date, (next) =>
                      setRows("sales", patchRow<AsvSaleRow>(saleRows, i, { date: next })),
                    )}
                    {textCell(i, "izsoles vieta", row.venue, (next) =>
                      setRows("sales", patchRow<AsvSaleRow>(saleRows, i, { venue: next })),
                    )}
                    {textCell(i, "izsoles odometrs", row.odometer, (next) =>
                      setRows("sales", patchRow<AsvSaleRow>(saleRows, i, { odometer: next })),
                    )}
                    {textCell(i, "izsoles cena", row.price, (next) =>
                      setRows("sales", patchRow<AsvSaleRow>(saleRows, i, { price: next })),
                    )}
                    {textCell(i, "izsoles statuss", row.status, (next) =>
                      setRows("sales", patchRow<AsvSaleRow>(saleRows, i, { status: next })),
                    )}
                    {!readOnly && editable ? (
                      <td className={`${cell} align-top`}>
                        <AdminFieldResetButton
                          onClick={() => setRows("sales", dropOrResetRow(saleRows, i, emptyAsvSaleRow))}
                        />
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {editable ? (
            <button type="button" className={addBtn} onClick={() => setRows("sales", [...saleRows, emptyAsvSaleRow()])}>
              + Rinda
            </button>
          ) : null}

          <p className="mb-0.5 mt-3 block text-[10px] font-medium text-[var(--color-provin-muted)]">
            Neapstrādātie dati (tikai admin)
          </p>
          {readOnly ? (
            <div className="mb-2 min-h-[48px] whitespace-pre-wrap rounded-lg border border-slate-200/90 bg-slate-100 px-2 py-1.5 text-[11px] text-[var(--color-provin-muted)]">
              {value.rawUnprocessedData.trim() || "-"}
            </div>
          ) : (
            <AdminAiPolishTextareaShell
              value={value.rawUnprocessedData}
              onPolished={(next) => onChange({ ...value, rawUnprocessedData: next })}
              disabled={disabled}
            >
              <textarea
                className={`${inp} mb-2 min-h-[72px] resize-y bg-slate-100`}
                rows={3}
                value={value.rawUnprocessedData}
                disabled={disabled}
                placeholder="Ielīmē atskaites tekstu, ja PDF nav pieejams..."
                onChange={(e) => onChange({ ...value, rawUnprocessedData: e.target.value })}
                aria-label={`${ARIA} - neapstrādātie dati`}
              />
            </AdminAiPolishTextareaShell>
          )}
        </div>

        <div className={`mt-auto w-full min-w-0 shrink-0 pt-2 ${trafficFillLevel ? "px-2 pb-2" : ""}`}>
          {sessionId && onPhotoGroupsStructuralCommit ? (
            <AdminListingAnalysisPhotos
              sessionId={sessionId}
              photoGroups={value.photoGroups ?? []}
              disabled={readOnly || !!disabled || !photosPersistenceEnabled}
              onPhotoGroupsStructuralCommit={(next) => onPhotoGroupsStructuralCommit(next)}
              apiBasePath="/api/admin/asv-photo"
              maxPhotos={ASV_MAX_PHOTOS}
              emptyGroup={emptyAsvPhotoGroup}
              sectionTitle="Negadījumu / izsoļu fotogrāfijas (PDF)"
              hidePhotoWatermarks={value.hidePhotoWatermarks !== false}
              onHidePhotoWatermarksChange={(next) =>
                onChange({ ...value, hidePhotoWatermarks: next })
              }
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
            aria-label={`${ASV_ADMIN_LABEL} - komentāri`}
          />
          <AdminAiContextRawField
            value={value.aiContextRaw}
            onChange={(next) => onChange({ ...value, aiContextRaw: next })}
            readOnly={readOnly}
            disabled={disabled}
            ariaLabel={`${ARIA} - AI papildu konteksts`}
          />
        </div>
      </div>
    </AdminCollapsibleShell>
  );
}
