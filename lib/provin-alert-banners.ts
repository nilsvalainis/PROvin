/**
 * Dinamiskie brīdinājuma baneri (PDF + admin) — tikai dzeltenā/sarkanā statusa gadījumos.
 */

import {
  ltabRowHasData,
  type ClientManualLtabBlockPdf,
  type ClientManualVendorBlockPdf,
  type CsddFormFields,
} from "@/lib/admin-source-blocks";
import {
  getNextInspectionDateUiFlag,
  getParticulateMatterUiFlag,
} from "@/lib/csdd-ui-flags";
import {
  computeOdometerAnomalyBySourceOrder,
  collectUnifiedMileageRows,
  hasAnyOdometerAnomaly,
  type UnifiedMileageRow,
  type UnifiedMileageSourcePayload,
} from "@/lib/unified-mileage";
import {
  toPdfLtabManualBlock,
  toPdfManualVendorBlocks,
  type WorkspaceSourceBlocks,
} from "@/lib/admin-source-blocks";

/** Kritiskā zaudējumu summa (EUR, veseli) — saskaņota ar claim-rows-parse „emphasize” slieksni. */
export const CRITICAL_LOSS_AMOUNT_EUR = 5000;

export type ProvinAlertBannerKind = "odometer" | "incidents" | "particulate" | "inspection";

export type ProvinAlertBanner = {
  kind: ProvinAlertBannerKind;
  text: string;
};

export const PROVIN_ALERT_TEXT = {
  odometer:
    "Uzmanību! Transportlīdzekļa vēsturē konstatētas odometra rādījumu neatbilstības (anomālijas).",
  incidents:
    "Brīdinājums: Transportlīdzeklim reģistrēti ceļu satiksmes negadījumi vai fiksēti būtiski zaudējumu atlīdzības prasījumi.",
  particulate:
    "Uzmanību! Pēdējā apskatē fiksēts paaugstināts atgāzu cieto daļiņu līmenis, kas var norādīt uz izplūdes sistēmas defektiem.",
  inspection:
    "Brīdinājums: Transportlīdzeklim nav derīgas tehniskās apskates vai tās termiņš drīzumā beidzas.",
} as const;

function collectIncidentRows(
  ltab: ClientManualLtabBlockPdf | null | undefined,
  vendors: ClientManualVendorBlockPdf[] | undefined,
): { lossAmount: string }[] {
  const out: { lossAmount: string }[] = [];
  for (const r of ltab?.rows ?? []) {
    if (ltabRowHasData(r)) out.push({ lossAmount: r.lossAmount });
  }
  for (const b of vendors ?? []) {
    for (const r of b.incidentRows) {
      if (ltabRowHasData(r)) out.push({ lossAmount: r.lossAmount });
    }
  }
  return out;
}

/** Vismaz viens negadījuma/atlīdzības ieraksts (vai zaudējums ≥ kritiskās robežas — strukturētajos datos tas ir daļa no rindām). */
export function shouldShowIncidentBanner(
  ltab: ClientManualLtabBlockPdf | null | undefined,
  vendors: ClientManualVendorBlockPdf[] | undefined,
): boolean {
  return collectIncidentRows(ltab, vendors).length > 0;
}

export function computeProvinAlertBanners(args: {
  unifiedMileageRows: UnifiedMileageRow[];
  csddForm: CsddFormFields | null | undefined;
  manualLtabBlock: ClientManualLtabBlockPdf | null | undefined;
  manualVendorBlocks: ClientManualVendorBlockPdf[] | undefined;
  referenceDate?: Date;
}): ProvinAlertBanner[] {
  const ref = args.referenceDate ?? new Date();
  const out: ProvinAlertBanner[] = [];

  const anomalyMap = computeOdometerAnomalyBySourceOrder(args.unifiedMileageRows);
  if (hasAnyOdometerAnomaly(anomalyMap)) {
    out.push({ kind: "odometer", text: PROVIN_ALERT_TEXT.odometer });
  }

  if (shouldShowIncidentBanner(args.manualLtabBlock, args.manualVendorBlocks)) {
    out.push({ kind: "incidents", text: PROVIN_ALERT_TEXT.incidents });
  }

  const pm = args.csddForm?.particulateMatter?.trim() ?? "";
  if (pm && getParticulateMatterUiFlag(pm) !== "none") {
    out.push({ kind: "particulate", text: PROVIN_ALERT_TEXT.particulate });
  }

  const next = args.csddForm?.nextInspectionDate?.trim() ?? "";
  if (next && getNextInspectionDateUiFlag(next, ref) !== "none") {
    out.push({ kind: "inspection", text: PROVIN_ALERT_TEXT.inspection });
  }

  return out;
}

/** Payload ar tiem pašiem laukiem kā `ClientReportPayload` nobraukuma daļai. */
export function computeProvinAlertBannersFromPayloadSlice(
  p: UnifiedMileageSourcePayload & {
    csddForm?: CsddFormFields | null;
    manualLtabBlock?: ClientManualLtabBlockPdf | null;
    manualVendorBlocks?: ClientManualVendorBlockPdf[] | null;
  },
  referenceDate?: Date,
): ProvinAlertBanner[] {
  const rows = collectUnifiedMileageRows(p);
  return computeProvinAlertBanners({
    unifiedMileageRows: rows,
    csddForm: p.csddForm,
    manualLtabBlock: p.manualLtabBlock,
    manualVendorBlocks: p.manualVendorBlocks ?? undefined,
    referenceDate,
  });
}

function pdfAlertCircleIconHtml(): string {
  return `<svg class="pdf-alert-banner-ico" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="10" stroke="#dc2626" stroke-width="2"/><path d="M12 8v4M12 16h.01" stroke="#dc2626" stroke-width="2" stroke-linecap="round"/></svg>`;
}

/** PDF HTML: rozā fons, kreisā sarkanā mala, alert ikonas sākumā un beigās. */
export function buildPdfAlertBannersHtml(banners: ProvinAlertBanner[]): string {
  if (banners.length === 0) return "";
  const ico = pdfAlertCircleIconHtml();
  const blocks = banners.map(
    (b) =>
      `<div class="pdf-alert-banner" role="alert" data-provin-alert="${b.kind}">${ico}<p class="pdf-alert-banner-text">${escapeHtmlPdf(b.text)}</p>${ico}</div>`,
  );
  return `<div class="pdf-alert-banners-stack">${blocks.join("\n")}</div>`;
}

function escapeHtmlPdf(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function computeProvinAlertBannersFromWorkspace(
  ws: WorkspaceSourceBlocks,
  referenceDate?: Date,
): ProvinAlertBanner[] {
  return computeProvinAlertBannersFromPayloadSlice(
    {
      csddForm: ws.csdd,
      autoRecordsBlock: ws.auto_records,
      manualVendorBlocks: toPdfManualVendorBlocks(ws),
      manualLtabBlock: toPdfLtabManualBlock(ws.ltab),
    },
    referenceDate,
  );
}
