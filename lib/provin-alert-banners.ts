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
  collectUnifiedMileageRows,
  computeOdometerAnomalyBySourceOrder,
  filterDuplicateOdometerKmReadings,
  hasAnyOdometerAnomaly,
  type UnifiedMileageRow,
  type UnifiedMileageSourcePayload,
} from "@/lib/unified-mileage";
import {
  toPdfLtabManualBlock,
  toPdfManualVendorBlocks,
  type WorkspaceSourceBlocks,
} from "@/lib/admin-source-blocks";
import { computeLatviaRegistrationTenure } from "@/lib/latvia-registration-tenure";
import { computeAverageAnnualMileageFromPayloadSlice } from "@/lib/average-annual-mileage";

export type ProvinInfoBannerKind = "lv_registration_tenure" | "avg_annual_mileage";

export type ProvinAlertBannerKind =
  | "odometer"
  | "tirgus_high_supply"
  | "incidents"
  | "particulate"
  | "inspection";

export type ProvinBannerKind = ProvinAlertBannerKind | ProvinInfoBannerKind;

/** Manuāli pievienoti augšējās joslas brīdinājumi (admin). */
export type ProvinManualBannerSeverity = "grey" | "yellow" | "red";

export type ProvinManualBanner = {
  id: string;
  text: string;
  severity: ProvinManualBannerSeverity;
  /** `false` = nerādīt PDF; trūkstošs vai `true` = rādīt. */
  includeInPdf?: boolean;
};

/** `false` = neiekļaut PDF; trūkstošs vai `true` = rādīt (noklusējums). */
export type ProvinBannerPdfInclude = Partial<Record<ProvinBannerKind, boolean>>;

export const PROVIN_ALERT_BANNER_KINDS = [
  "odometer",
  "tirgus_high_supply",
  "incidents",
  "particulate",
  "inspection",
] as const satisfies readonly ProvinAlertBannerKind[];

export const PROVIN_INFO_BANNER_KINDS = [
  "lv_registration_tenure",
  "avg_annual_mileage",
] as const satisfies readonly ProvinInfoBannerKind[];

const MANUAL_BANNER_SEVERITIES = new Set<ProvinManualBannerSeverity>(["grey", "yellow", "red"]);

export function isProvinBannerIncludedInPdf(
  kind: ProvinBannerKind,
  settings?: ProvinBannerPdfInclude | null,
): boolean {
  return settings?.[kind] !== false;
}

export function mergeProvinBannerPdfInclude(raw: unknown): ProvinBannerPdfInclude {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  const out: ProvinBannerPdfInclude = {};
  for (const kind of [...PROVIN_ALERT_BANNER_KINDS, ...PROVIN_INFO_BANNER_KINDS]) {
    if (typeof o[kind] === "boolean") out[kind] = o[kind];
  }
  return out;
}

export function mergeProvinManualBanners(raw: unknown): ProvinManualBanner[] {
  if (!Array.isArray(raw)) return [];
  const out: ProvinManualBanner[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const id = typeof o.id === "string" ? o.id.trim() : "";
    const text = typeof o.text === "string" ? o.text : "";
    const severity = o.severity;
    if (!id) continue;
    if (typeof severity !== "string" || !MANUAL_BANNER_SEVERITIES.has(severity as ProvinManualBannerSeverity)) {
      continue;
    }
    const banner: ProvinManualBanner = {
      id: id.slice(0, 64),
      text: text.slice(0, 2000),
      severity: severity as ProvinManualBannerSeverity,
    };
    if (typeof o.includeInPdf === "boolean") banner.includeInPdf = o.includeInPdf;
    out.push(banner);
  }
  return out.slice(0, 20);
}

export function filterManualBannersForPdf(banners: ProvinManualBanner[]): ProvinManualBanner[] {
  return banners.filter((b) => b.includeInPdf !== false && b.text.trim().length > 0);
}

export function createEmptyManualBanner(severity: ProvinManualBannerSeverity = "grey"): ProvinManualBanner {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `mb-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  return { id, text: "", severity, includeInPdf: true };
}

export function filterAlertBannersForPdf(
  banners: ProvinAlertBanner[],
  settings?: ProvinBannerPdfInclude | null,
): ProvinAlertBanner[] {
  return banners.filter((b) => isProvinBannerIncludedInPdf(b.kind, settings));
}

export function filterInfoBannersForPdf(
  banners: ProvinInfoBanner[],
  settings?: ProvinBannerPdfInclude | null,
): ProvinInfoBanner[] {
  return banners.filter((b) => isProvinBannerIncludedInPdf(b.kind, settings));
}

export type ProvinInfoBanner = {
  kind: ProvinInfoBannerKind;
  text: string;
};

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
    "Brīdinājums: Transportlīdzeklis tirgū atrodas neierasti ilgi (virs 200 dienām), kas var liecināt par zemu likviditāti vai slēptiem defektiem.",
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
  const rows = filterDuplicateOdometerKmReadings(collectUnifiedMileageRows(p));
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
  return `<svg class="pdf-alert-banner-ico pdf-alert-banner-ico--triangle" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3 2 20h20L12 3z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M12 9v5M12 17h.01" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`;
}

function pdfAlertBannerIconsHtml(): string {
  return pdfAlertBannerTriangleIconHtml();
}

/** PDF HTML: 8px atstarpe starp joslām; ikonas — trijstūņi (admin UI atšķirīgs). */
export function buildPdfAlertBannersHtml(banners: ProvinAlertBanner[]): string {
  if (banners.length === 0) return "";
  const blocks = banners.map(
    (b) =>
      `<div class="pdf-alert-banner pdf-alert-banner--${b.severity}" role="alert" data-provin-alert="${b.kind}" data-provin-severity="${b.severity}">${pdfAlertBannerIconsHtml()}<p class="pdf-alert-banner-text">${escapeHtmlPdf(b.text)}</p></div>`,
  );
  return `<div class="pdf-alert-banners-stack">${blocks.join("\n")}</div>`;
}

function pdfInfoBannerIconHtml(): string {
  return `<svg class="pdf-info-banner-ico" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.5"/><path d="M12 10v6M12 7h.01" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`;
}

/** PDF HTML: pelēks informatīvs bloks (reģistrācijas ilgums u.c.). */
export function buildPdfInfoBannersHtml(banners: ProvinInfoBanner[]): string {
  if (banners.length === 0) return "";
  const blocks = banners.map(
    (b) =>
      `<div class="pdf-info-banner pdf-info-banner--grey" role="note" data-provin-info="${b.kind}">${pdfInfoBannerIconHtml()}<p class="pdf-info-banner-text">${escapeHtmlPdf(b.text)}</p></div>`,
  );
  return `<div class="pdf-info-banners-stack">${blocks.join("\n")}</div>`;
}

/** PDF HTML: manuālie baneri — pelēks kā info, dzeltens/sarkans kā brīdinājumi. */
export function buildPdfManualBannersHtml(banners: ProvinManualBanner[]): string {
  const forPdf = filterManualBannersForPdf(banners);
  if (forPdf.length === 0) return "";
  const blocks = forPdf.map((b) => {
    if (b.severity === "grey") {
      return `<div class="pdf-info-banner pdf-info-banner--grey" role="note" data-provin-manual="${escapeHtmlPdf(b.id)}">${pdfInfoBannerIconHtml()}<p class="pdf-info-banner-text">${escapeHtmlPdf(b.text)}</p></div>`;
    }
    return `<div class="pdf-alert-banner pdf-alert-banner--${b.severity}" role="alert" data-provin-manual="${escapeHtmlPdf(b.id)}" data-provin-severity="${b.severity}">${pdfAlertBannerIconsHtml()}<p class="pdf-alert-banner-text">${escapeHtmlPdf(b.text)}</p></div>`;
  });
  return `<div class="pdf-alert-banners-stack pdf-manual-banners-stack">${blocks.join("\n")}</div>`;
}

export function computeProvinInfoBannersFromPayloadSlice(
  p: UnifiedMileageSourcePayload & {
    csddForm?: CsddFormFields | null;
    manualLtabBlock?: ClientManualLtabBlockPdf | null;
    manualVendorBlocks?: ClientManualVendorBlockPdf[] | null;
    autoRecordsBlock?: import("@/lib/admin-source-blocks").AutoRecordsBlockState | null;
    citiAvotiBlock?: import("@/lib/admin-source-blocks").CitiAvotiBlockState | null;
  },
  referenceDate?: Date,
): ProvinInfoBanner[] {
  const out: ProvinInfoBanner[] = [];

  const tenure = computeLatviaRegistrationTenure({
    csddForm: p.csddForm,
    autoRecordsBlock: p.autoRecordsBlock ?? null,
    manualVendorBlocks: p.manualVendorBlocks ?? null,
    manualLtabBlock: p.manualLtabBlock ?? null,
    referenceDate,
  });
  if (tenure) {
    out.push({ kind: "lv_registration_tenure", text: tenure.sentence });
  }

  const avg = computeAverageAnnualMileageFromPayloadSlice(
    {
      csddForm: p.csddForm,
      autoRecordsBlock: p.autoRecordsBlock ?? null,
      manualVendorBlocks: p.manualVendorBlocks ?? null,
      citiAvotiBlock: p.citiAvotiBlock ?? null,
    },
    referenceDate,
  );
  if (avg) {
    out.push({ kind: "avg_annual_mileage", text: avg.sentence });
  }

  return out;
}

export function computeProvinInfoBannersFromWorkspace(
  ws: WorkspaceSourceBlocks,
  referenceDate?: Date,
): ProvinInfoBanner[] {
  return computeProvinInfoBannersFromPayloadSlice(
    {
      csddForm: ws.csdd,
      autoRecordsBlock: ws.auto_records,
      manualVendorBlocks: toPdfManualVendorBlocks(ws),
      manualLtabBlock: toPdfLtabManualBlock(ws.ltab),
      citiAvotiBlock: ws.citi_avoti,
    },
    referenceDate,
  );
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
      citiAvotiBlock: ws.citi_avoti,
      manualLtabBlock: toPdfLtabManualBlock(ws.ltab),
      tirgusForm: ws.tirgus,
    },
    referenceDate,
  );
}
