/**
 * Dinamiskie brīdinājuma baneri (PDF + admin) — krāsa atbilst avotu līmenim (dzeltens / sarkans).
 */

import {
  ltabRowHasData,
  type ClientManualLtabBlockPdf,
  type ClientManualVendorBlockPdf,
  type CsddFormFields,
  type TirgusFormFields,
} from "@/lib/admin-source-blocks";
import { shouldShowListedForSaleCriticalBanner } from "@/lib/tirgus-listed-ui";
import {
  getNextInspectionDateUiFlag,
  getParticulateMatterUiFlag,
  type CsddFieldUiFlag,
} from "@/lib/csdd-ui-flags";
import { aggregateLossAmountFlags } from "@/lib/loss-amount-ui";
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

export type ProvinAlertBannerKind =
  | "odometer"
  | "tirgus_high_supply"
  | "incidents"
  | "particulate"
  | "inspection";

/** Banera vizuālais līmenis — sakrīt ar avotu dzelteno/sarkano. */
export type ProvinAlertSeverity = "red" | "yellow";

export type ProvinAlertBanner = {
  kind: ProvinAlertBannerKind;
  text: string;
  severity: ProvinAlertSeverity;
};

export const PROVIN_ALERT_TEXT = {
  odometer:
    "Uzmanību! Transportlīdzekļa vēsturē konstatētas odometra rādījumu neatbilstības (anomālijas).",
  tirgus_high_supply:
    "Uzmanību! Tirgū fiksēts ļoti liels identisku modeļu piedāvājums (virs 200 auto), kas var ietekmēt tālākpārdošanas vērtību un likviditāti.",
  incidents:
    "Brīdinājums: Transportlīdzeklim reģistrēti ceļu satiksmes negadījumi vai fiksēti būtiski zaudējumu atlīdzības prasījumi.",
  particulate:
    "Uzmanību! Pēdējā apskatē fiksēts paaugstināts atgāzu cieto daļiņu līmenis, kas var norādīt uz izplūdes sistēmas defektiem.",
  inspection:
    "Brīdinājums: Transportlīdzeklim nav derīgas tehniskās apskates vai tās termiņš drīzumā beidzas.",
} as const;

function flagToSeverity(f: Exclude<CsddFieldUiFlag, "none">): ProvinAlertSeverity {
  return f === "red" ? "red" : "yellow";
}

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

/**
 * Negadījumu banera severitāte: balstīta uz „Zaudējumu summa” laukiem.
 * Ja rindas ir, bet visas summas tukšas → dzeltens (brīdinājums bez skaitliskās summas).
 */
export function computeIncidentBannerSeverity(
  ltab: ClientManualLtabBlockPdf | null | undefined,
  vendors: ClientManualVendorBlockPdf[] | undefined,
): ProvinAlertSeverity | null {
  const rows = collectIncidentRows(ltab, vendors);
  if (rows.length === 0) return null;
  const agg = aggregateLossAmountFlags(rows.map((r) => r.lossAmount));
  if (agg === "red") return "red";
  if (agg === "yellow") return "yellow";
  return "yellow";
}

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
  tirgusForm?: TirgusFormFields | null;
  referenceDate?: Date;
}): ProvinAlertBanner[] {
  const ref = args.referenceDate ?? new Date();
  const out: ProvinAlertBanner[] = [];

  const anomalyMap = computeOdometerAnomalyBySourceOrder(args.unifiedMileageRows);
  if (hasAnyOdometerAnomaly(anomalyMap)) {
    out.push({ kind: "odometer", text: PROVIN_ALERT_TEXT.odometer, severity: "red" });
  }

  if (args.tirgusForm && shouldShowListedForSaleCriticalBanner(args.tirgusForm.listedForSale)) {
    out.push({
      kind: "tirgus_high_supply",
      text: PROVIN_ALERT_TEXT.tirgus_high_supply,
      severity: "red",
    });
  }

  const incSev = computeIncidentBannerSeverity(args.manualLtabBlock, args.manualVendorBlocks);
  if (incSev !== null) {
    out.push({ kind: "incidents", text: PROVIN_ALERT_TEXT.incidents, severity: incSev });
  }

  const pm = args.csddForm?.particulateMatter?.trim() ?? "";
  if (pm) {
    const f = getParticulateMatterUiFlag(pm);
    if (f !== "none") {
      out.push({ kind: "particulate", text: PROVIN_ALERT_TEXT.particulate, severity: flagToSeverity(f) });
    }
  }

  const next = args.csddForm?.nextInspectionDate?.trim() ?? "";
  if (next) {
    const f = getNextInspectionDateUiFlag(next, ref);
    if (f !== "none") {
      out.push({ kind: "inspection", text: PROVIN_ALERT_TEXT.inspection, severity: flagToSeverity(f) });
    }
  }

  return out;
}

/** Payload ar tiem pašiem laukiem kā `ClientReportPayload` nobraukuma daļai. */
export function computeProvinAlertBannersFromPayloadSlice(
  p: UnifiedMileageSourcePayload & {
    csddForm?: CsddFormFields | null;
    manualLtabBlock?: ClientManualLtabBlockPdf | null;
    manualVendorBlocks?: ClientManualVendorBlockPdf[] | null;
    tirgusForm?: TirgusFormFields | null;
  },
  referenceDate?: Date,
): ProvinAlertBanner[] {
  const rows = collectUnifiedMileageRows(p);
  return computeProvinAlertBanners({
    unifiedMileageRows: rows,
    csddForm: p.csddForm,
    manualLtabBlock: p.manualLtabBlock,
    manualVendorBlocks: p.manualVendorBlocks ?? undefined,
    tirgusForm: p.tirgusForm,
    referenceDate,
  });
}

/** PDF: 16px → ~21px (+30%); sarkans/dzeltens — vienāds trijstūnis ar izsaukumu. */
function pdfAlertBannerTriangleIconHtml(): string {
  return `<svg class="pdf-alert-banner-ico pdf-alert-banner-ico--triangle" width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3 2 20h20L12 3z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M12 9v5M12 17h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
}

function pdfAlertBannerIconsHtml(): string {
  return pdfAlertBannerTriangleIconHtml();
}

/** PDF HTML: 8px atstarpe starp joslām; ikonas — trijstūņi (admin UI atšķirīgs). */
export function buildPdfAlertBannersHtml(banners: ProvinAlertBanner[]): string {
  if (banners.length === 0) return "";
  const blocks = banners.map(
    (b) =>
      `<div class="pdf-alert-banner pdf-alert-banner--${b.severity}" role="alert" data-provin-alert="${b.kind}" data-provin-severity="${b.severity}">${pdfAlertBannerIconsHtml()}<p class="pdf-alert-banner-text">${escapeHtmlPdf(b.text)}</p>${pdfAlertBannerIconsHtml()}</div>`,
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
      tirgusForm: ws.tirgus,
    },
    referenceDate,
  );
}
