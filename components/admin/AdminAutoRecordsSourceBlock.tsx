"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AdminMileageRangeBar } from "@/components/admin/AdminMileageRangeBar";
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
import { AdminDealerDataJobStrip } from "@/components/admin/AdminDealerDataJobStrip";
import { AdminOneautoIngestBar } from "@/components/admin/AdminOneautoIngestBar";
import { AdminSpeckrCompactBar } from "@/components/admin/AdminSpeckrCompactBar";
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
  DEALER_MILEAGE_TABLE_EMPTY_VISITS_WARNING,
  dealerMileageTableEmptyButVisitsHaveOdometer,
} from "@/lib/unified-mileage";
import {
  CSDD_MILEAGE_UNIFIED_TITLE,
  PROVIN_MILEAGE_TABLE_DOM_KIND,
  PROVIN_MILEAGE_TABLE_FIELD,
  emptyAutoRecordsBlock,
  emptyAutoRecordsServiceRow,
  SOURCE_BLOCK_LABELS,
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
  outvinDealerReportHasContent,
  outvinVehicleInfoHasData,
  type OutvinVehicleInfo,
} from "@/lib/outvin-dealer-types";
import { applyOneautoToAutoRecords, emptyOneautoIngest } from "@/lib/oneauto-to-auto-records";
import {
  appendPhotosToAutoRecordsGroup,
  syncAutoRecordsPhotoGroupsAndFlat,
} from "@/lib/auto-records-photo-types";
import { AdminOutvinDealerReportFields } from "@/components/admin/AdminOutvinDealerReportFields";
import { parseOutvinVehicleInfoFromAutoRecordsText } from "@/lib/auto-records-vehicle-info-parse";
import { SUBHEADING_LUCIDE } from "@/lib/admin-lucide-registry";
import type { TrafficFillLevel } from "@/lib/admin-block-traffic-status";
import { AdminSourceBlockHeaderTools } from "@/components/admin/AdminClearSourceBlockButton";
import { AdminPdfIncludeToggle } from "@/components/admin/AdminPdfIncludeToggle";
import { AdminOilChangeIntervalEditor } from "@/components/admin/AdminOilChangeIntervalEditor";
import { AdminCollapsibleShell } from "@/components/admin/AdminCollapsibleShell";
import { AdminListingAnalysisPhotos } from "@/components/admin/AdminListingAnalysisPhotos";
import {
  AUTO_RECORDS_MAX_PHOTOS,
  emptyAutoRecordsPhotoGroup,
} from "@/lib/auto-records-photo-types";
import { AdminClearOdometerButton } from "@/components/admin/AdminClearOdometerButton";
import { AdminFieldResetButton } from "@/components/admin/AdminFieldResetButton";
import {
  clearAutoRecordsOdometerReadings,
  countAutoRecordsOdometerReadings,
} from "@/lib/admin-clear-odometer-readings";
import { dropOrResetRow } from "@/lib/admin-drop-or-reset-row";
import { clearAutoRecordsEquipment } from "@/lib/outvin-admin-sync";
import { AdminAutoGrowTextarea } from "@/components/admin/AdminAutoGrowTextarea";
import {
  ADMIN_SOURCE_DATA_TABLE_CLASS,
  ADMIN_SOURCE_TABLE_CELL,
  ADMIN_SOURCE_TABLE_WRAP_CLASS,
} from "@/lib/admin-source-data-table";
import { extractDealerFactsFromServiceWorks } from "@/lib/admin-ai-dealer-facts";
import type { TechnicalRiskMap } from "@/lib/admin-ai-technical-risk-map-types";
import {
  collectDealerAdminWarnings,
  countUntranslatedDealerWorkRows,
  dealerFactComponentLabels,
  dealerFactForWorkRow,
  dealerWorkRowNeedsLvTranslation,
  originalDealerWorksForRow,
} from "@/lib/dealer-admin-service-rows";

const DEALER_ARIA = "Oficiālā dīlera dati";

const inp =
  "min-w-0 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-[var(--color-apple-text)] placeholder:text-slate-400 focus:border-[var(--color-provin-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-provin-accent)]/25";

const mileCell = ADMIN_SOURCE_TABLE_CELL;

type Props = {
  value: AutoRecordsBlockState;
  readOnly: boolean;
  disabled?: boolean;
  onChange: (next: AutoRecordsBlockState) => void;
  trafficFillLevel?: TrafficFillLevel;
  sessionId: string;
  orderVin?: string;
  customerEmail?: string | null;
  /** Stripe cs_* sesijām true - manuāliem refund nerāda. */
  canDealerRefund?: boolean;
  walletRefund?: boolean;
  onGenerateDealerPdf?: () => void;
  onGenerateDealerPdfEn?: () => void;
  onGenerateDealerPdfRu?: () => void;
  onGenerateDealerPdfDe?: () => void;
  pdfLangLock?: "lv" | "en" | "ru" | "de" | null;
  onUnlockPdfLang?: () => void;
  b2bClient?: boolean;
  reportLang?: string | null;
  walletProduct?: string | null;
  dealerPdfProgressKey?: string | null;
  dealerPdfProgressPct?: number | null;
  /** Copilot dīlera PDF aģentam vajag visus avotu blokus (valstu noteikšanai). */
  getSourceBlocks?: () => WorkspaceSourceBlocks;
  applyPatchedBlocks?: (
    patched: Partial<WorkspaceSourceBlocks>,
    changedKeys: CopilotSourceKey[],
  ) => void;
  pdfInclude: boolean;
  onPdfIncludeChange: (next: boolean) => void;
  pdfIncludeOil?: boolean;
  onPdfIncludeOilChange?: (next: boolean) => void;
  pdfIncludeEquipment?: boolean;
  onPdfIncludeEquipmentChange?: (next: boolean) => void;
  /** OneAuto servisa laika līnija klienta PDF (`pdfVisibility.oneauto`). */
  pdfIncludeOneauto?: boolean;
  onPdfIncludeOneautoChange?: (next: boolean) => void;
  aiComment?: AdminAiSourceCommentSlot;
  aiServiceHistory?: AdminAiSourceCommentSlot;
  aiOilChangeInterval?: AdminAiSourceCommentSlot;
  photosPersistenceEnabled?: boolean;
  onAutoRecordsPhotoGroupsStructuralCommit?: (
    next: AutoRecordsBlockState["photoGroups"],
  ) => void | Promise<void>;
  /** Tehnisko risku teksts / karte: DF1/DF2/L14/L15. Tukšs, ja audita nav. */
  techRiskText?: string | null;
  techRiskMap?: TechnicalRiskMap | null;
};

export function AdminAutoRecordsSourceBlock({
  value,
  readOnly,
  disabled,
  onChange,
  trafficFillLevel,
  sessionId,
  orderVin = "",
  customerEmail = null,
  canDealerRefund = false,
  walletRefund = false,
  onGenerateDealerPdf,
  onGenerateDealerPdfEn,
  onGenerateDealerPdfRu,
  onGenerateDealerPdfDe,
  pdfLangLock = null,
  onUnlockPdfLang,
  b2bClient = false,
  reportLang = null,
  walletProduct = null,
  dealerPdfProgressKey = null,
  dealerPdfProgressPct = null,
  getSourceBlocks,
  applyPatchedBlocks,
  pdfInclude,
  onPdfIncludeChange,
  pdfIncludeOil = true,
  onPdfIncludeOilChange,
  pdfIncludeEquipment = true,
  pdfIncludeOneauto,
  onPdfIncludeOneautoChange,
  onPdfIncludeEquipmentChange,
  aiComment,
  aiServiceHistory,
  aiOilChangeInterval,
  photosPersistenceEnabled = false,
  onAutoRecordsPhotoGroupsStructuralCommit,
  techRiskText = null,
  techRiskMap = null,
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

  const removeRow = (index: number) => {
    const rows = value.serviceHistory.length > 0 ? value.serviceHistory : [emptyAutoRecordsServiceRow()];
    const next = dropOrResetRow(rows, index, emptyAutoRecordsServiceRow);
    const data = next.filter(autoRecordsRowHasData);
    onChange({ ...value, serviceHistory: data.length > 0 ? next : [emptyAutoRecordsServiceRow()] });
  };

  const [translateBusyIndex, setTranslateBusyIndex] = useState<number | null>(null);
  const [bulkTranslateBusy, setBulkTranslateBusy] = useState(false);
  const [translateError, setTranslateError] = useState<string | null>(null);
  const latestValueRef = useRef(value);
  useEffect(() => {
    latestValueRef.current = value;
  }, [value]);

  const workRows =
    (value.serviceWorks ?? []).length > 0
      ? (value.serviceWorks ?? [])
      : [emptyAutoRecordsServiceWorkRow()];

  const dealerFacts = useMemo(
    () => extractDealerFactsFromServiceWorks(workRows),
    [workRows],
  );
  const untranslatedWorkCount = useMemo(
    () => countUntranslatedDealerWorkRows(workRows),
    [workRows],
  );
  const dealerWarnings = useMemo(
    () =>
      collectDealerAdminWarnings({
        serviceWorks: workRows,
        techRiskText,
        techRiskMap,
      }),
    [workRows, techRiskText, techRiskMap],
  );
  const originalTimeline = value.oneautoIngest?.serviceTimelineOriginal ?? [];

  /** Visas svešvalodas rindas latviski; rezultātu liek tikai tām rindām, kuras operators pa to laiku nav mainījis. */
  const translateAllWorkRows = async (base: AutoRecordsBlockState) => {
    if (readOnly || disabled || bulkTranslateBusy) return;
    const sent = base.serviceWorks ?? [];
    if (countUntranslatedDealerWorkRows(sent) === 0) return;
    setBulkTranslateBusy(true);
    setTranslateError(null);
    try {
      const res = await fetch("/api/admin/ai/oneauto-translate", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          scope: "serviceWorks",
          serviceWorks: sent,
          originalTimeline: base.oneautoIngest?.serviceTimelineOriginal ?? [],
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        serviceWorks?: AutoRecordsServiceWorkRow[];
        translatedCount?: number;
        warning?: string | null;
        error?: string;
      };
      if (!res.ok || !Array.isArray(body.serviceWorks)) {
        setTranslateError(`Tulkojums neizdevās (${body.error ?? `HTTP ${res.status}`}).`);
        return;
      }
      if (body.warning) setTranslateError(body.warning);
      const translated = body.serviceWorks;
      const latest = latestValueRef.current;
      const rows = [...(latest.serviceWorks ?? [])];
      let changed = false;
      sent.forEach((before, i) => {
        const after = translated[i];
        if (!after || after.works === before.works) return;
        const at = rows.findIndex(
          (r) => r.date === before.date && r.odometer === before.odometer && r.works === before.works,
        );
        if (at < 0) return;
        rows[at] = { ...rows[at]!, works: after.works };
        changed = true;
      });
      if (changed) onChange({ ...latest, serviceWorks: rows });
    } catch (e) {
      setTranslateError(`Tulkojums neizdevās (${e instanceof Error ? e.message : "tīkla kļūda"}).`);
    } finally {
      setBulkTranslateBusy(false);
    }
  };

  const translateWorkRow = async (index: number) => {
    if (readOnly || disabled || translateBusyIndex != null) return;
    const row = workRows[index];
    if (!row) return;
    const sourceWorks = originalDealerWorksForRow(row, originalTimeline) || row.works;
    if (!sourceWorks.trim()) return;
    setTranslateBusyIndex(index);
    setTranslateError(null);
    try {
      const res = await fetch("/api/admin/ai/oneauto-translate", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          scope: "works",
          display: {
            equipment: [],
            powertrain: [],
            serviceTimeline: [
              {
                date: row.date,
                odometer: row.odometer,
                place: row.location,
                works: sourceWorks,
              },
            ],
          },
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        display?: { serviceTimeline?: { works?: string }[] };
        error?: string;
      };
      const translated = body.display?.serviceTimeline?.[0]?.works?.trim();
      if (!res.ok || !translated) {
        setTranslateError(`Rindas tulkojums neizdevās (${body.error ?? `HTTP ${res.status}`}).`);
        return;
      }
      setWorkRow(index, { works: translated });
    } catch (e) {
      setTranslateError(`Rindas tulkojums neizdevās (${e instanceof Error ? e.message : "tīkla kļūda"}).`);
    } finally {
      setTranslateBusyIndex(null);
    }
  };

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
      headerActions={
        <AdminSourceBlockHeaderTools
          sourceLabel={SOURCE_BLOCK_LABELS.auto_records}
          readOnly={readOnly}
          disabled={disabled}
          onClear={() => onChange(emptyAutoRecordsBlock())}
        >
          <AdminPdfIncludeToggle checked={pdfInclude} onChange={onPdfIncludeChange} />
        </AdminSourceBlockHeaderTools>
      }
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
          {sessionId ? (
            <AdminDealerDataJobStrip
              sessionId={sessionId}
              orderVin={orderVin}
              editable={!readOnly && !disabled}
              customerEmail={customerEmail}
              canRefund={canDealerRefund}
              walletRefund={walletRefund}
              onGenerateDealerPdf={onGenerateDealerPdf}
              onGenerateDealerPdfEn={onGenerateDealerPdfEn}
              onGenerateDealerPdfRu={onGenerateDealerPdfRu}
              onGenerateDealerPdfDe={onGenerateDealerPdfDe}
              pdfLangLock={pdfLangLock}
              onUnlockPdfLang={onUnlockPdfLang}
              b2bClient={b2bClient}
              reportLang={reportLang}
              walletProduct={walletProduct}
              pdfProgressKey={dealerPdfProgressKey}
              pdfProgressPct={dealerPdfProgressPct}
            />
          ) : null}
          {onPdfIncludeOneautoChange && pdfIncludeOneauto !== undefined ? (
            <div className="flex justify-end px-1">
              <AdminPdfIncludeToggle
                id={`oneauto-pdf-${sessionId}`}
                label="OneAuto PDF"
                checked={pdfIncludeOneauto}
                onChange={onPdfIncludeOneautoChange}
              />
            </div>
          ) : null}
          <AdminOneautoIngestBar
            ingest={value.oneautoIngest ?? emptyOneautoIngest()}
            orderVin={orderVin}
            sessionId={sessionId}
            photosEnabled={photosPersistenceEnabled && Boolean(onAutoRecordsPhotoGroupsStructuralCommit)}
            editable={!readOnly && !disabled}
            hasMappedData={
              (value.serviceWorks ?? []).some(autoRecordsServiceWorkRowHasData) ||
              outvinDealerReportHasContent(value.outvinReport)
            }
            onIngestChange={(next) => onChange({ ...value, oneautoIngest: next })}
            onFetched={(ingest, display) => {
              const applied = applyOneautoToAutoRecords(value, {
                display,
                ingest,
                vehicleOverride: true,
              });
              onChange(applied);
              if (countUntranslatedDealerWorkRows(applied.serviceWorks ?? []) > 0) {
                void translateAllWorkRows(applied);
              }
            }}
            onImagesFetched={
              onAutoRecordsPhotoGroupsStructuralCommit
                ? (photoIds, groupTitle) => {
                    const merged = appendPhotosToAutoRecordsGroup(
                      value.photoGroups ?? [],
                      photoIds,
                      groupTitle,
                    );
                    const synced = syncAutoRecordsPhotoGroupsAndFlat(merged);
                    onAutoRecordsPhotoGroupsStructuralCommit(synced.photoGroups);
                  }
                : undefined
            }
          />
          <AdminSpeckrCompactBar
            orderVin={orderVin}
            snapshot={value.speckrSnapshot}
            editable={!readOnly && !disabled}
            onSnapshotChange={(next) => onChange({ ...value, speckrSnapshot: next })}
          />
          <div className="mb-0.5 flex items-center gap-1">
          <label className="block text-[10px] font-medium text-[var(--color-provin-muted)]">
            Paste RAW data here
          </label>
          {!readOnly ? (
            <AdminFieldResetButton
              disabled={disabled || !value.rawUnprocessedData.trim()}
              title="Nodzēst RAW"
              onClick={() => onChange({ ...value, rawUnprocessedData: "" })}
            />
          ) : null}
          </div>
          {readOnly ? (
            <div className="mb-2 min-h-[72px] whitespace-pre-wrap rounded-lg border border-slate-200/90 bg-slate-100 px-2 py-1.5 text-[11px] text-[var(--color-provin-muted)]">
              {value.rawUnprocessedData.trim() ? value.rawUnprocessedData : <span className="text-slate-400">-</span>}
            </div>
          ) : (
            <AdminAiPolishTextareaShell
              value={value.rawUnprocessedData}
              onPolished={(next) => handleRaw(next)}
              showReset={false}
              disabled={disabled}
            >
              <textarea
                className="mb-2 w-full min-h-[88px] resize-y rounded-lg border border-slate-200 bg-slate-100 px-2 py-1.5 text-[11px] leading-snug text-[var(--color-apple-text)] placeholder:text-slate-400 focus:border-[var(--color-provin-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-provin-accent)]/20"
                rows={4}
                value={value.rawUnprocessedData}
                disabled={disabled}
                placeholder="Ielīmē tekstu, kas sākas ar ODOMETER CHECK…"
                onChange={(e) => handleRaw(e.target.value)}
                aria-label={`${DEALER_ARIA} - neapstrādātie dati`}
              />
            </AdminAiPolishTextareaShell>
          )}

          <AdminOutvinDealerReportFields
            report={outvinReport}
            readOnly={readOnly}
            disabled={disabled}
            onChange={(next) => onChange({ ...value, outvinReport: next })}
            pdfIncludeEquipment={pdfIncludeEquipment}
            onPdfIncludeEquipmentChange={onPdfIncludeEquipmentChange}
            onClearEquipment={() => onChange(clearAutoRecordsEquipment(value))}
          />

          <p className="mb-1.5 mt-3 flex items-center gap-2 text-[10px] font-medium uppercase tracking-wide text-slate-500">
            <AdminProvinLucide icon={SUBHEADING_LUCIDE.mileage} />
            {CSDD_MILEAGE_UNIFIED_TITLE}
          </p>
          {dealerMileageTableEmptyButVisitsHaveOdometer(value) ? (
            <p className="mb-1.5 text-[10px] leading-snug text-amber-800" role="status">
              {DEALER_MILEAGE_TABLE_EMPTY_VISITS_WARNING}
            </p>
          ) : null}
          <AdminMileageRangeBar rows={displayRows} />
          <div
            className={ADMIN_SOURCE_TABLE_WRAP_CLASS}
            data-provin-mileage-table={PROVIN_MILEAGE_TABLE_DOM_KIND}
            data-provin-block="auto_records"
          >
            <table className={`${ADMIN_SOURCE_DATA_TABLE_CLASS} min-w-[280px]`}>
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
                  {!readOnly ? <th className={`w-9 ${mileCell}`} aria-hidden /> : null}
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
                          {formatAutoRecordsDateForOutput(row.date).trim() || "-"}
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
                          {row.odometer.trim() || "-"}
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
                          countryLabel={row.country.trim() || "-"}
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
                    {!readOnly ? (
                      <td className={`${mileCell} align-top`}>
                        <AdminFieldResetButton
                          disabled={disabled}
                          title="Nodzēst odometra rindu"
                          aria-label={`${DEALER_ARIA} nodzēst odometra rindu ${i + 1}`}
                          onClick={() => removeRow(i)}
                        />
                      </td>
                    ) : null}
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

          {dealerWarnings.length > 0 ? (
            <div
              className="mb-1.5 mt-3 rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-[10px] leading-snug text-amber-900"
              role="status"
            >
              <p className="font-medium uppercase tracking-wide">Dīlera / kartes brīdinājumi</p>
              <ul className="mt-1 list-disc pl-4">
                {dealerWarnings.map((w) => (
                  <li key={`${w.id}-${w.message.slice(0, 40)}`}>
                    <span className="font-semibold">{w.id}</span> {w.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <p className="mb-1.5 mt-3 flex flex-wrap items-center gap-2 text-[10px] font-medium uppercase tracking-wide text-slate-500">
            <AdminProvinLucide icon={SUBHEADING_LUCIDE.serviceWorks} />
            {PROVIN_SERVICE_WORKS_TABLE_TITLE}
            {untranslatedWorkCount > 0 ? (
              <span className="rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 font-semibold normal-case tracking-normal text-amber-800">
                {untranslatedWorkCount} nav pārtulkotas
              </span>
            ) : null}
            {untranslatedWorkCount > 0 && !readOnly ? (
              <button
                type="button"
                className="rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[9px] font-medium normal-case tracking-normal text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                disabled={disabled || bulkTranslateBusy || translateBusyIndex != null}
                onClick={() => void translateAllWorkRows(value)}
              >
                {bulkTranslateBusy ? "Tulko…" : "Pārtulkot visas"}
              </button>
            ) : null}
          </p>
          {translateError ? (
            <p className="mb-1.5 text-[11px] text-rose-700" role="alert">
              {translateError}
            </p>
          ) : null}
          <div
            className={ADMIN_SOURCE_TABLE_WRAP_CLASS}
            data-provin-mileage-table={PROVIN_SERVICE_WORKS_TABLE_DOM_KIND}
            data-provin-block="auto_records"
          >
            <table className={`${ADMIN_SOURCE_DATA_TABLE_CLASS} min-w-[620px]`}>
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/90 text-left text-[10px] font-medium text-[var(--color-provin-muted)]">
                  <th
                    className={mileCell}
                    data-provin-field={PROVIN_SERVICE_WORKS_TABLE_FIELD.datums}
                  >
                    Datums
                  </th>
                  <th
                    className={mileCell}
                    data-provin-field={PROVIN_SERVICE_WORKS_TABLE_FIELD.odometrsKm}
                  >
                    Odometrs (km)
                  </th>
                  <th className={mileCell} data-provin-field={PROVIN_SERVICE_WORKS_TABLE_FIELD.vieta}>
                    {SERVICE_WORKS_LOCATION_LABEL}
                  </th>
                  <th className={mileCell}>Oriģināls</th>
                  <th className={mileCell} data-provin-field={PROVIN_SERVICE_WORKS_TABLE_FIELD.darbi}>
                    Veiktie darbi (LV)
                  </th>
                  {!readOnly ? <th className={`${mileCell} w-[28px]`} aria-label="Noņemt" /> : null}
                </tr>
              </thead>
              <tbody>
                {workRows.map((row, i) => {
                  const originalWorks = originalDealerWorksForRow(row, originalTimeline);
                  const needsLv = dealerWorkRowNeedsLvTranslation(row.works);
                  const fact = dealerFactForWorkRow(row, dealerFacts);
                  const tags = dealerFactComponentLabels(fact);
                  return (
                  <tr
                    key={i}
                    className={`border-b border-slate-100 last:border-b-0 ${needsLv ? "bg-amber-50/70" : ""}`}
                  >
                    <td className={`${mileCell} align-top`}>
                      {readOnly ? (
                        <span
                          className="text-[var(--color-provin-muted)]"
                          data-provin-field={PROVIN_SERVICE_WORKS_TABLE_FIELD.datums}
                          data-provin-block="auto_records"
                          data-row-index={i}
                        >
                          {formatAutoRecordsDateForOutput(row.date).trim() || "-"}
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
                          {formatServiceWorkOdometer(row.odometer) || "-"}
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
                          {row.location.trim() || "-"}
                        </span>
                      ) : (
                        <AdminAutoGrowTextarea
                          className={inp}
                          rows={1}
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
                      <span className="block whitespace-pre-wrap text-[10px] text-slate-500">
                        {originalWorks.trim() || "-"}
                      </span>
                    </td>
                    <td className={`${mileCell} align-top`}>
                      {readOnly ? (
                        <span
                          className="block whitespace-pre-wrap text-[var(--color-provin-muted)]"
                          data-provin-field={PROVIN_SERVICE_WORKS_TABLE_FIELD.darbi}
                          data-provin-block="auto_records"
                          data-row-index={i}
                        >
                          {row.works.trim() || "-"}
                        </span>
                      ) : (
                        <AdminAutoGrowTextarea
                          className={inp}
                          rows={1}
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
                      <div className="mt-1 flex flex-wrap items-center gap-1">
                        {fact ? (
                          <span className="rounded border border-slate-200 bg-slate-50 px-1 py-0.5 text-[9px] font-semibold text-slate-600">
                            {fact.id}
                          </span>
                        ) : null}
                        {tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded border border-slate-200 bg-white px-1 py-0.5 text-[9px] text-slate-500"
                          >
                            {tag}
                          </span>
                        ))}
                        {!readOnly && (originalWorks.trim() || needsLv) ? (
                          <button
                            type="button"
                            className="rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[9px] font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                            disabled={disabled || translateBusyIndex != null}
                            onClick={() => void translateWorkRow(i)}
                          >
                            {translateBusyIndex === i ? "Tulko…" : "Pārtulkot šo rindu"}
                          </button>
                        ) : null}
                      </div>
                    </td>
                    {!readOnly ? (
                      <td className={`${mileCell} align-top`}>
                        <AdminFieldResetButton
                          disabled={disabled}
                          title="Nodzēst servisa rindu"
                          aria-label={`${DEALER_ARIA} nodzēst servisa rindu ${i + 1}`}
                          onClick={() => removeWorkRow(i)}
                        />
                      </td>
                    ) : null}
                  </tr>
                  );
                })}
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
            aria-label={`${DEALER_ARIA} - Servisa vēsture`}
          />
          <AdminOilChangeIntervalEditor
            value={value}
            onChange={onChange}
            readOnly={readOnly}
            disabled={disabled}
            pdfIncludeOil={pdfIncludeOil}
            onPdfIncludeOilChange={onPdfIncludeOilChange}
            aiOilChangeInterval={aiOilChangeInterval}
            dealerAria={DEALER_ARIA}
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
              hidePhotoWatermarks={value.hidePhotoWatermarks === true}
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
            aria-label={`${DEALER_ARIA} - komentāri`}
          />
          <AdminAiContextRawField
            value={value.aiContextRaw}
            onChange={(next) => onChange({ ...value, aiContextRaw: next })}
            readOnly={readOnly}
            disabled={disabled}
            ariaLabel={`${DEALER_ARIA} - AI papildu konteksts`}
          />
        </div>
      </div>
    </AdminCollapsibleShell>
  );
}
