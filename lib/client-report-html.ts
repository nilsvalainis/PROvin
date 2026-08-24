/**
 * Klienta PDF atskaite — tikai admin paneļa ievadīto datu spogulis.
 * Nobraukuma sadaļā: divi līknes grafiki (maksas vs bezmaksas/publiski avoti) un tabula.
 */

import type { PdfPortfolioFileInsight } from "@/lib/admin-portfolio-pdf-analysis";
import {
  autoRecordsBlockHasContent,
  CSDD_FORM_STRUCTURED_FIELDS,
  CSDD_PREVIOUS_INSPECTION_TITLE,
  CSDD_TECHNICAL_INSPECTION_HISTORY_TITLE,
  citiAvotiHasContent,
  csddFormHasContent,
  LISTING_ANALYSIS_SUBSECTIONS,
  SOURCE_BLOCK_LABELS,
  listingAnalysisHasContent,
  LISTING_ANALYSIS_COMMENT_LABEL,
  LISTING_HISTORY_SUBSECTION_TITLE,
  ltabRowHasData,
  filterCsddInspectionWarnings,
  mergePdfChecklistAndComments,
  NEGADIJUMU_VESTURE_TITLE,
  sourcePdfChecklistHasAny,
  TIRGUS_LABEL_CREATED,
  TIRGUS_LABEL_LISTED,
  TIRGUS_LABEL_LISTING_ODOMETER,
  TIRGUS_LABEL_PRICE_DROP,
  tirgusFormHasContent,
  tirgusPriceHistoryHasRows,
  type AutoRecordsBlockState,
  type CitiAvotiBlockState,
  type ClientManualLtabBlockPdf,
  type ClientManualVendorBlockPdf,
  type CsddFormFields,
  type ListingAnalysisBlockState,
  type TirgusFormFields,
} from "@/lib/admin-source-blocks";
import { autoRecordsRowHasData } from "@/lib/auto-records-paste-parse";
import {
  buildPdfReportSummaryTiles,
  buildPdfSummaryBannerTiles,
  PDF_REPORT_SUMMARY_TITLE,
  type PdfSummaryTile,
} from "@/lib/pdf-report-summary";
import {
  buildVehicleLifecycleEvents,
  lifecycleDetailDuplicatesCountry,
  PDF_LIFECYCLE_TITLE,
  type LifecycleEvent,
} from "@/lib/vehicle-lifecycle-timeline";
import {
  formatLtabCentsAsEur,
  formatLtabCertificateAmountEur,
  formatLtabClaimWhen,
  LTAB_CERTIFICATE_FOOTER_DEFAULT,
  LTAB_CERTIFICATE_TITLE,
  ltabCertificateClaimHasData,
  ltabCertificateHasContent,
  sumLtabCertificateAmountCents,
} from "@/lib/ltab-report-extract";
import {
  formatAdifyDeltaLabel,
  formatAdifyMileageLabel,
  formatAdifyPriceLabel,
  formatAdifySignedEur,
} from "@/lib/adify-listing-history";
import { parseListedForSaleDays } from "@/lib/tirgus-listed-ui";
import {
  autoRecordsServiceWorkRowIsPrintable,
  formatServiceWorkOdometer,
  normalizeAutoRecordsServiceWorkRow,
  SERVICE_WORKS_LOCATION_LABEL,
  sortAutoRecordsServiceWorkRows,
  type AutoRecordsServiceWorkRow,
} from "@/lib/auto-records-service-works";
import { normalizeListingAnalysisPhotoGroups } from "@/lib/listing-analysis-photo-types";
import { normalizeAutoRecordsPhotoGroups } from "@/lib/auto-records-photo-types";
import { normalizeCcVinPhotoGroups } from "@/lib/cc-vin-photo-types";
import { buildCcVinPdfInnerHtml, CC_VIN_PDF_CSS } from "@/lib/cc-vin-pdf-html";
import {
  CC_VIN_PDF_SOURCE_LABEL,
  CC_VIN_PDF_TITLE,
  ccVinBlockHasContent,
  countCcVinRecords,
  type CcVinBlockState,
} from "@/lib/cc-vin-report";
import {
  buildPdfAboutReportBlock,
  pdfLayoutDraftExtraCss,
  pdfProvinWordmarkHtml,
  PDF_BRAND_BLUE_HEX,
  provincLogoSvg,
} from "@/lib/client-report-pdf-layout-draft";
import { pdfCountryCodeLetters, pdfCountryFlagEmoji } from "@/lib/pdf-country-flags";
import {
  computeProvinAlertBannersFromPayloadSlice,
  computeProvinInfoBannersFromPayloadSlice,
  filterAlertBannersForPdf,
  filterInfoBannersForPdf,
  mergeProvinManualBanners,
} from "@/lib/provin-alert-banners";
import { PDF_HERO_BRAND_LOGO_DATA_URI } from "@/lib/pdf-hero-brand-logos";
import {
  pdfBrandLogoImgHtml,
  pdfDealerLogoDataUri,
  pdfListingPortalLogoDataUri,
  PDF_SOURCE_LOGO_DATA_URI,
} from "@/lib/pdf-source-brand-logos";
import {
  sectionIconPdfHtml,
  sectionIconPdfHtmlSized,
  vendorPdfTitleToIconId,
  type SectionIconId,
} from "@/lib/section-icons";
import { serviceWorkIconId } from "@/lib/service-work-icon";
import { buildPdfDocFooterHtml, pdfDocFooterCss } from "@/lib/client-report-pdf-footer";
import { buildSourceMileageSparkHtml, buildUnifiedMileageChartWrapHtml } from "@/lib/unified-mileage-chart";
import { buildDamageZoneSilhouetteSvg } from "@/lib/damage-zones";
import {
  aggregateUnifiedIncidents,
  collectUnifiedIncidentDamageDetails,
  collectUnifiedIncidentRows,
  formatUnifiedIncidentCountLabel,
  type UnifiedIncidentAggregation,
  type UnifiedIncidentCluster,
  type UnifiedIncidentDamage,
} from "@/lib/unified-incidents";
import { normalizeLossAmountEurDisplay } from "@/lib/loss-amount-format";
import {
  MILEAGE_PDF_SOURCE_COLOR,
  MILEAGE_PDF_SOURCE_LEGEND,
  MILEAGE_PDF_SOURCE_LEGEND_ORDER,
  collectMileagePdfSourceKeysFromLabels,
  mileagePdfLegendKeysInOrder,
  mileageSourceLabelToPdfKey,
  type MileagePdfSourceKey,
} from "@/lib/pdf-mileage-source";
import {
  collectUnifiedMileageRows,
  analyzeUnifiedMileageAnomalies,
  prepareUnifiedMileageDisplayRows,
  type CollectUnifiedMileageOptions,
  type UnifiedMileageDisplayRow,
  type UnifiedMileageRow,
  type UnifiedMileageSourcePayload,
} from "@/lib/unified-mileage";
import {
  getNextInspectionDateUiFlag,
  getParticulateMatterUiFlag,
  type CsddFieldUiFlag,
} from "@/lib/csdd-ui-flags";
import { getLossAmountUiFlag } from "@/lib/loss-amount-ui";
import { shouldShowListedForSaleCriticalBanner } from "@/lib/tirgus-listed-ui";
import { mergePdfVisibility, type PdfVisibilitySettings } from "@/lib/pdf-visibility";
import { adminRichHtmlToPdfSafeHtml } from "@/lib/admin-rich-comment-html";
import {
  ADMIN_INCIDENTS_SUMMARY_LABEL,
  PDF_IRISS_SECTION_INSPECTION,
  PDF_IRISS_SECTION_SUMMARY,
  PDF_IRISS_SECTION_TECHNICAL_RISKS,
  PDF_MILEAGE_HISTORY_COMMENT_LABEL,
} from "@/lib/admin-workspace-field-labels";
import { buildOwnerRegistrationTimelineHtml } from "@/lib/csdd-history-charts";
import {
  buildPreviousInspectionBlockHtml,
  buildTechnicalInspectionHistoryTableHtml,
} from "@/lib/csdd-inspection-history-html";
import { emptyCsddPreviousInspectionBlock, isoDateToLvDisplay, previousInspectionBlockHasData } from "@/lib/csdd-extended-parse";
import { buildOutvinBundlePdfInnerHtml } from "@/lib/outvin-bundle-pdf-html";
import { buildOutvinDealerReportPdfInnerHtml } from "@/lib/outvin-dealer-pdf-html";
import { getAutoRecordsOutvinBundle } from "@/lib/outvin-admin-sync";
import { outvinBundleHasStructuredContent } from "@/lib/outvin-data-bundle";

/** PDF dokumenta virsraksti (UPPERCASE, saskaņoti ar produkta terminoloģiju). */
const PDF_MAIN_TITLE = "TRANSPORTLĪDZEKĻA AUDITS";
const PDF_APPROVED_BY_IRISS = "APPROVED BY IRISS";
const PDF_INCIDENT_INTERNAL_COMMENT_LABEL = "Komentārs";
/** Vienots komentāru bloka virsraksts visā PDF atskaitē (kā NEGADĪJUMU VĒSTURE). */
const PDF_REPORT_COMMENT_LABEL = PDF_INCIDENT_INTERNAL_COMMENT_LABEL;
const PDF_SUB_CSDD = "CSDD";
const PDF_SECTION_LISTING_ANALYSIS = "SLUDINĀJUMA ANALĪZE";
/** Klientam saprotamāks nosaukums par admin bloka „OFICIĀLĀ DĪLERA DATI”. */
const PDF_SOURCE_DEALER_TITLE = "DĪLERA DATI";

function vendorTitlesOmittedForPdf(vis: PdfVisibilitySettings): Set<string> {
  const L = SOURCE_BLOCK_LABELS;
  const s = new Set<string>();
  if (!vis.autodna) s.add(L.autodna);
  if (!vis.carvertical) s.add(L.carvertical);
  if (!vis.tjekbil) s.add(L.tjekbil);
  if (!vis.mnt_ee) s.add(L.mnt_ee);
  if (!vis.lkf_ee) s.add(L.lkf_ee);
  if (!vis.carinfo) s.add(L.carinfo);
  if (!vis.citi_avoti) s.add(L.citi_avoti);
  return s;
}

function collectPdfMileageSparkContext(
  p: ClientReportPayload,
  vis: PdfVisibilitySettings,
): { rows: UnifiedMileageDisplayRow[]; chartExclude: Set<number> } {
  const collected = collectUnifiedMileageRows(
    {
      csddForm: p.csddForm,
      autoRecordsBlock: p.autoRecordsBlock,
      ccVinBlock: p.ccVinBlock ?? null,
      manualVendorBlocks: p.manualVendorBlocks,
      citiAvotiBlock: p.citiAvoti ?? null,
      tirgusForm: p.tirgusForm ?? null,
      listingUrl: p.listingUrl ?? null,
    },
    {
      omitCsddMileage: !vis.csdd || !vis.csddMileageTable,
      omitAutoRecords: !vis.auto_records,
      omitCcVin: !vis.cc_vin,
      omitVendorBlockTitles: vendorTitlesOmittedForPdf(vis),
      omitListingMileage: !vis.sludinajums,
    },
  );
  const rows = prepareUnifiedMileageDisplayRows(collected);
  const { chartExcludeSourceOrders } = analyzeUnifiedMileageAnomalies(rows);
  return { rows, chartExclude: chartExcludeSourceOrders };
}

function sourceMileageSparkHtml(
  ctx: { rows: UnifiedMileageDisplayRow[]; chartExclude: Set<number> },
  key: MileagePdfSourceKey,
): string {
  if (ctx.rows.length === 0) return "";
  return buildSourceMileageSparkHtml(ctx.rows, key, { chartExcludeSourceOrders: ctx.chartExclude });
}

/** Mājaslapas primārais zils — grafiks, akcenti (`PDF_BRAND_BLUE_HEX`). */
const PDF_MILEAGE_CHART_LINE = PDF_BRAND_BLUE_HEX;
const PDF_MILEAGE_CHART_GRID = "#e8eaed";
const PDF_MILEAGE_CHART_AXIS = "#9ca3af";

export type ClientReportPayload = {
  sessionId: string;
  isDemo: boolean;
  vin: string | null;
  created: number;
  amountTotal: number | null;
  currency: string | null;
  paymentStatus: string;
  listingUrl: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  customerName: string | null;
  contactMethod: string | null;
  notes: string | null;
  csdd: string;
  csddForm?: CsddFormFields | null;
  ltab: string;
  tirgus: string;
  tirgusForm?: TirgusFormFields | null;
  citi: string;
  iriss: string;
  apskatesPlāns: string;
  tehniskoRiskuAnalize: string;
  cenasAtbilstiba: string;
  listingMarket?: import("@/lib/listing-scrape").ListingMarketSnapshot | null;
  manualVendorBlocks?: ClientManualVendorBlockPdf[];
  /** AUTO RECORDS — servisa vēsture (PDF: tabula; raw netiek drukāts). */
  autoRecordsBlock?: AutoRecordsBlockState | null;
  /** Starptautiskā vēsture — sarkanie karogi, bojājumi, īpašumtiesības (bez specifikācijām). */
  ccVinBlock?: CcVinBlockState | null;
  manualLtabBlock?: ClientManualLtabBlockPdf | null;
  citiAvoti?: CitiAvotiBlockState | null;
  listingAnalysis?: ListingAnalysisBlockState | null;
  /** Ja nav — PDF iekļauj visu (admin noklusējums). */
  pdfVisibility?: PdfVisibilitySettings | null;
  /** Atsevišķi brīdinājumu / info baneri PDF (noklusējums — visi ieslēgti). */
  pdfBannerInclude?: import("@/lib/provin-alert-banners").ProvinBannerPdfInclude | null;
  /** Manuāli pievienoti augšējās joslas brīdinājumi. */
  manualBanners?: import("@/lib/provin-alert-banners").ProvinManualBanner[] | null;
  /** Iekšējās piezīmes (var saturēt vienkāršu HTML no admin redaktora) — PDF zem apvienotās negadījumu tabulas. */
  internalComment?: string | null;
  /** NOBRAUKUMA VĒSTURES KOMENTĀRS — PDF zem nobraukuma grafika. */
  mileageComment?: string | null;
};

export type ClientReportPortfolioRow = { name: string; size: number };

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const PDF_PROVIN_SOURCES_TITLE_SUFFIX = " atskaites ģenerēšanā izmantotie avoti";
const PDF_PROVIN_SOURCES_L1 = "Maksas vēstures atskaites";
const PDF_PROVIN_SOURCES_L2 = "Publiskas Eiropas datubāzes";
const PDF_PROVIN_SOURCES_L3 = "Citi avoti";
const PDF_PROVIN_SOURCES_L_TOTAL = "Kopā";
const PDF_SOURCES_CHECKED_TITLE = "Kas tika pārbaudīts";
const PDF_VEHICLE_SPEC_TITLE = "TRANSPORTLĪDZEKĻA DATI";

function capSourceCount(n: number): number {
  return Math.min(Math.max(0, n), 9);
}

function vendorPdfBlockHasData(b: ClientManualVendorBlockPdf | undefined): boolean {
  if (!b) return false;
  return (
    b.mileageRows.length > 0 ||
    b.incidentRows.length > 0 ||
    b.comments.trim().length > 0 ||
    Boolean(b.ownersSummary?.trim()) ||
    Boolean(b.statusRecords?.trim()) ||
    Boolean(b.autoNotes?.trim()) ||
    sourcePdfChecklistHasAny(b.pdfChecklist)
  );
}

function getVendorPdfBlock(p: ClientReportPayload, title: string): ClientManualVendorBlockPdf | undefined {
  return (p.manualVendorBlocks ?? []).find((x) => x.title === title);
}

function payloadCsddHasData(p: ClientReportPayload, vis: PdfVisibilitySettings): boolean {
  if (!vis.csdd) return false;
  if (p.csddForm && csddFormHasContent(p.csddForm)) return true;
  return p.csdd.trim().length > 0;
}

function payloadAutoRecordsHasData(p: ClientReportPayload, vis: PdfVisibilitySettings): boolean {
  if (!vis.auto_records) return false;
  return Boolean(p.autoRecordsBlock && autoRecordsBlockHasContent(p.autoRecordsBlock));
}

function payloadCcVinHasData(p: ClientReportPayload, vis: PdfVisibilitySettings): boolean {
  if (!vis.cc_vin) return false;
  return Boolean(p.ccVinBlock && ccVinBlockHasContent(p.ccVinBlock));
}

function payloadLtabHasData(p: ClientReportPayload, vis: PdfVisibilitySettings): boolean {
  if (!vis.ltab) return false;
  const b = p.manualLtabBlock;
  if (!b) return false;
  return b.rows.length > 0 || b.comments.trim().length > 0 || ltabCertificateHasContent(b.certificate);
}

function payloadSludinajumsHasData(p: ClientReportPayload, vis: PdfVisibilitySettings): boolean {
  if (!vis.sludinajums) return false;
  const hasTirgus = tirgusFormHasContent(p.tirgusForm) || (p.tirgus?.trim().length ?? 0) > 0;
  const la = p.listingAnalysis;
  const hasListing = la != null && listingAnalysisHasContent(la);
  return hasTirgus || hasListing;
}

function countCitiAvotiFilledParts(b: CitiAvotiBlockState): number {
  let c = 0;
  for (const section of b.sections) {
    if (section.serviceHistory.some(autoRecordsRowHasData)) c++;
    if (section.incidents.some(ltabRowHasData)) c++;
    if (section.comments.trim()) c++;
    if (section.rawUnprocessedData?.trim()) c++;
  }
  return capSourceCount(c);
}

/** Tikai payload datu apkopošana PDF drukai — bez AI izsaukumiem un bez DB tiešās piekļuves. */
function computeProvinPdfSourcesUsedCounts(
  p: ClientReportPayload,
  vis: PdfVisibilitySettings,
): { n1: number; n2: number; n3: number } {
  const L = SOURCE_BLOCK_LABELS;
  let n1 = 0;
  if (payloadCsddHasData(p, vis)) n1++;
  if (vis.autodna && vendorPdfBlockHasData(getVendorPdfBlock(p, L.autodna))) n1++;
  if (vis.carvertical && vendorPdfBlockHasData(getVendorPdfBlock(p, L.carvertical))) n1++;
  if (payloadAutoRecordsHasData(p, vis)) n1++;
  if (payloadCcVinHasData(p, vis)) n1++;
  if (vis.tjekbil && vendorPdfBlockHasData(getVendorPdfBlock(p, L.tjekbil))) n1++;
  if (vis.mnt_ee && vendorPdfBlockHasData(getVendorPdfBlock(p, L.mnt_ee))) n1++;
  if (vis.lkf_ee && vendorPdfBlockHasData(getVendorPdfBlock(p, L.lkf_ee))) n1++;
  if (vis.carinfo && vendorPdfBlockHasData(getVendorPdfBlock(p, L.carinfo))) n1++;
  n1 = capSourceCount(n1);

  let n2 = 0;
  if (payloadCsddHasData(p, vis)) n2++;
  if (payloadLtabHasData(p, vis)) n2++;
  if (payloadSludinajumsHasData(p, vis)) n2++;
  n2 = capSourceCount(n2);

  let n3 = 0;
  if (vis.citi_avoti && p.citiAvoti && citiAvotiHasContent(p.citiAvoti)) {
    n3 = countCitiAvotiFilledParts(p.citiAvoti);
  }
  n3 = capSourceCount(n3);

  return { n1, n2, n3 };
}

/** Katrs pārbaudītais avots atsevišķi — nosaukums, avota krāsa un ierakstu skaits. */
function collectPdfCheckedSources(
  p: ClientReportPayload,
  vis: PdfVisibilitySettings,
): { label: string; count: number }[] {
  const L = SOURCE_BLOCK_LABELS;
  const out: { label: string; count: number }[] = [];
  if (payloadCsddHasData(p, vis)) {
    const f = p.csddForm;
    out.push({
      label: L.csdd,
      count:
        (f?.technicalInspectionHistory ?? []).filter((r) => r.date.trim()).length +
        (f?.ownerRegistrationEvents ?? []).filter((e) => e.date.trim()).length +
        (f?.mileageHistory ?? []).filter((r) => r.date.trim() && r.odometer.trim()).length,
    });
  }
  for (const title of [L.autodna, L.carvertical, L.tjekbil, L.mnt_ee, L.lkf_ee, L.carinfo] as const) {
    const b = getVendorPdfBlock(p, title);
    if (!b || !vendorPdfBlockHasData(b)) continue;
    if (vendorTitlesOmittedForPdf(vis).has(title)) continue;
    out.push({ label: title, count: b.mileageRows.length + b.incidentRows.length });
  }
  if (payloadAutoRecordsHasData(p, vis)) {
    const ar = p.autoRecordsBlock;
    out.push({
      label: PDF_SOURCE_DEALER_TITLE,
      count:
        (ar?.serviceHistory ?? []).filter(autoRecordsRowHasData).length +
        (ar?.serviceWorks ?? []).filter(autoRecordsServiceWorkRowIsPrintable).length,
    });
  }
  if (payloadCcVinHasData(p, vis)) {
    out.push({ label: CC_VIN_PDF_SOURCE_LABEL, count: countCcVinRecords(p.ccVinBlock) });
  }
  if (payloadLtabHasData(p, vis)) {
    out.push({ label: L.ltab, count: (p.manualLtabBlock?.rows ?? []).filter(ltabRowHasData).length });
  }
  if (vis.citi_avoti && p.citiAvoti && citiAvotiHasContent(p.citiAvoti)) {
    out.push({ label: L.citi_avoti, count: countCitiAvotiFilledParts(p.citiAvoti) });
  }
  return out;
}

function buildProvinPdfSourcesUsedStripHtml(p: ClientReportPayload, vis: PdfVisibilitySettings): string {
  const { n1, n2, n3 } = computeProvinPdfSourcesUsedCounts(p, vis);
  const nTotal = capSourceCount(n1 + n2 + n3);
  if (nTotal === 0) return "";

  const cards = [
    { n: n1, label: PDF_PROVIN_SOURCES_L1 },
    { n: n2, label: PDF_PROVIN_SOURCES_L2 },
    { n: n3, label: PDF_PROVIN_SOURCES_L3 },
  ].filter((c) => c.n > 0);

  const head = `<div class="pdf-sec-head pdf-sec-head--brand"><span class="pdf-sec-ico-wrap" aria-hidden="true">${sectionIconPdfHtml("database")}</span><h2 id="pdf-provin-sources-h" class="pdf-sec pdf-sec--nobar pdf-sec--provin-sources">${pdfProvinWordmarkHtml()}${escapeHtml(PDF_PROVIN_SOURCES_TITLE_SUFFIX)}</h2></div>`;
  const categoryRows = cards
    .map((c) => `<tr><td>${escapeHtml(c.label)}</td><td>${escapeHtml(String(c.n))}</td></tr>`)
    .join("");
  const totalRow = `<tr class="pdf-provin-sources-total"><td><strong>${escapeHtml(PDF_PROVIN_SOURCES_L_TOTAL)}</strong></td><td><strong>${escapeHtml(String(nTotal))}</strong></td></tr>`;
  const body = `${categoryRows}${totalRow}`;

  const checked = collectPdfCheckedSources(p, vis);
  const grid =
    checked.length === 0
      ? ""
      : `<p class="pdf-subhead pdf-sources-checked-label">${escapeHtml(PDF_SOURCES_CHECKED_TITLE)}</p><ul class="pdf-sources-checked-grid">${checked
          .map((s) => {
            const count = s.count > 0 ? formatSourceRecordCountLv(s.count) : "pārbaudīts";
            return `<li class="pdf-sources-checked-item">${pdfSourceDotHtml(s.label)}<span class="pdf-sources-checked-name">${escapeHtml(s.label)}</span><span class="pdf-sources-checked-count">${escapeHtml(count)}</span></li>`;
          })
          .join("")}</ul>`;

  return `<section class="pdf-provin-sources-wrap pdf-v1-panel pdf-v1-panel--clean pdf-surface-card" role="region" aria-labelledby="pdf-provin-sources-h">${head}<table class="pdf-v1-kv"><tbody>${body}</tbody></table>${grid}</section>`;
}

const LIFECYCLE_ICON_BY_KIND: Record<LifecycleEvent["kind"], SectionIconId> = {
  first_registration: "carFront",
  registration: "user",
  import: "route",
  inspection: "listChecks",
  odometer: "route",
  incident: "shield",
  service: "wrench",
  listed: "priceTag",
  gap: "clock",
  anomaly: "search",
};

function buildPdfLifeDateHtml(e: LifecycleEvent): string {
  return `<time class="pdf-life-date">${escapeHtml(e.date)}</time>`;
}

function buildPdfLifeRailHtml(): string {
  return `<span class="pdf-life-rail" aria-hidden="true"><span class="pdf-life-dot"></span></span>`;
}

function buildPdfLifeMetaHtml(e: LifecycleEvent): string {
  const flag = e.country
    ? `<span class="pdf-country-flag" aria-hidden="true">${pdfCountryFlagEmoji(e.country)}</span><span>${escapeHtml(e.country)}</span>`
    : "";
  const dots = e.sources.map((s) => pdfSourceDotHtml(s)).join("");
  const srcsWrap = e.sources.length > 4 ? " pdf-life-srcs--wrap" : "";
  const srcHtml = dots ? `<span class="pdf-life-srcs${srcsWrap}">${dots}</span>` : "";
  if (!flag && !srcHtml) return "";
  return `<p class="pdf-life-meta">${flag}${srcHtml}</p>`;
}

function buildPdfLifeKmHtml(e: LifecycleEvent): string {
  if (e.kind === "incident") {
    const raw = e.incident?.displayAmount.trim() ?? "";
    if (!raw || raw === "—") return "";
    return `<span class="pdf-life-km pdf-life-km--loss">${formatLossAmountEurCell(raw, { approx: Boolean(e.incident?.averaged) })}</span>`;
  }
  const odo = formatServiceWorkOdometer(e.odometer);
  if (!odo) return "";
  const inner =
    e.kind === "anomaly"
      ? `<span class="pdf-data-alert-wrap pdf-num-warn pdf-num-warn--red"><span class="tabular pdf-num-warn-digits">${escapeHtml(odo)}</span></span>`
      : escapeHtml(odo);
  return `<span class="pdf-life-km">${inner}</span>`;
}

function buildPdfLifeFactHtml(e: LifecycleEvent): string {
  const detail = e.detail.trim();
  const hideCountryDup = lifecycleDetailDuplicatesCountry(detail, e.country);
  const detailHtml =
    !detail || hideCountryDup
      ? ""
      : e.kind === "inspection"
        ? `<p class="pdf-life-ta ${e.tone === "warn" ? "pdf-life-ta--warn" : "pdf-life-ta--ok"}">${escapeHtml(detail)}</p>`
        : `<p class="pdf-life-card__sub">${escapeHtml(detail)}</p>`;
  return `<div class="pdf-life-card__fact">${detailHtml}${buildPdfLifeMetaHtml(e)}</div>`;
}

function buildPdfLifeImportHtml(e: LifecycleEvent): string {
  const fromLabel = e.fromCountry?.trim() || e.detail.split(" → ")[0]?.trim() || "";
  const toLabel = e.country.trim() || e.detail.split(" → ")[1]?.trim() || "";
  const aria = escapeHtml([fromLabel, toLabel].filter(Boolean).join(" → "));
  return `<li class="pdf-life-item pdf-life-item--import">
    ${buildPdfLifeDateHtml(e)}
    ${buildPdfLifeRailHtml()}
    <article class="pdf-life-card pdf-life-card--import">
      <p class="pdf-life-imp" role="img" aria-label="${aria}">
        <span class="pdf-life-imp__side"><span class="pdf-country-flag" aria-hidden="true">${pdfCountryFlagEmoji(fromLabel)}</span><span>${escapeHtml(fromLabel)}</span></span>
        <span class="pdf-life-imp__arrow" aria-hidden="true">→</span>
        <span class="pdf-life-imp__side"><span class="pdf-country-flag" aria-hidden="true">${pdfCountryFlagEmoji(toLabel)}</span><span>${escapeHtml(toLabel)}</span></span>
      </p>
    </article>
  </li>`;
}

function buildPdfLifeCardItemHtml(e: LifecycleEvent, dealerMakeHint = ""): string {
  const isAnomaly = e.kind === "anomaly";
  const isIncident = e.kind === "incident";
  const dealerLogo = e.kind === "service" && dealerMakeHint ? pdfDealerLogoDataUri(dealerMakeHint) : null;
  const titleIco =
    isAnomaly || isIncident
      ? `<span class="pdf-data-alert-ico" aria-hidden="true">${pdfLossAmountAlertIconHtml("red")}</span>`
      : dealerLogo
        ? `<span class="pdf-life-ico pdf-life-ico--brand" aria-hidden="true">${pdfBrandLogoImgHtml(dealerLogo)}</span>`
        : `<span class="pdf-life-ico" aria-hidden="true">${sectionIconPdfHtml(LIFECYCLE_ICON_BY_KIND[e.kind])}</span>`;
  const itemTone = isIncident ? "incident" : e.tone;
  return `<li class="pdf-life-item pdf-life-item--${itemTone}"${isAnomaly ? ' role="alert"' : ""}>
    ${buildPdfLifeDateHtml(e)}
    ${buildPdfLifeRailHtml()}
    <article class="pdf-life-card${isAnomaly ? " pdf-life-card--alert" : ""}">
      ${isAnomaly ? '<span class="pdf-life-alert-edge" aria-hidden="true"></span>' : ""}
      <div class="pdf-life-card__grid">
        <p class="pdf-life-card__kind">${titleIco}<span>${escapeHtml(e.title)}</span></p>
        ${buildPdfLifeFactHtml(e)}
        ${buildPdfLifeKmHtml(e)}
      </div>
    </article>
  </li>`;
}

/** Vēstures kopsavilkums — gada joslas un kartītes pie hronoloģiskās sliedes. */
function buildPdfLifecycleTimelineHtml(p: ClientReportPayload, vis: PdfVisibilitySettings): string {
  if (!vis.unifiedMileage && !vis.unifiedIncidents) return "";
  const events = buildVehicleLifecycleEvents({
    csddForm: p.csddForm ?? null,
    autoRecordsBlock: p.autoRecordsBlock ?? null,
    ccVinBlock: p.ccVinBlock ?? null,
    manualVendorBlocks: p.manualVendorBlocks ?? null,
    manualLtabBlock: p.manualLtabBlock ?? null,
    citiAvoti: p.citiAvoti ?? null,
    tirgusForm: p.tirgusForm ?? null,
    listingUrl: p.listingUrl ?? null,
  });
  if (events.length === 0) return "";

  const dealerMakeHint = reportVehicleMakeHint(p);
  const items: string[] = [];
  let lastYear = "";
  for (const e of events) {
    if (e.kind === "gap") {
      items.push(buildPdfLifeBreakHtml(e));
      continue;
    }
    if (e.year !== lastYear) {
      items.push(`<li class="pdf-life-year"><span class="pdf-life-year__num">${escapeHtml(e.year)}</span></li>`);
      lastYear = e.year;
    }
    if (e.kind === "import") {
      items.push(buildPdfLifeImportHtml(e));
      continue;
    }
    items.push(buildPdfLifeCardItemHtml(e, dealerMakeHint));
  }

  const legend = buildPdfSourceLegendHtml(events.flatMap((e) => e.sources));
  const head = sectionHeadBrand(
    sectionIconPdfHtml("history"),
    PDF_LIFECYCLE_TITLE,
    sourceRecordCountBadgeHtml(events.filter((e) => e.kind !== "gap" && e.kind !== "import").length),
  );
  return `<div class="pdf-page-flow-chunk pdf-unified-mileage-zone pdf-surface-card pdf-lifecycle-zone" role="region">${head}<ol class="pdf-life-list">${items.join("")}</ol>${legend}</div>`;
}

/** Atskaites kopsavilkums — bāzes plāksnītes un brīdinājumu / manuālās kartītes vienā režģī. */
function buildPdfReportSummaryHtml(p: ClientReportPayload, extraTiles: PdfSummaryTile[] = []): string {
  const tiles = [
    ...buildPdfReportSummaryTiles({
      csddForm: p.csddForm ?? null,
      autoRecordsBlock: p.autoRecordsBlock ?? null,
      ccVinBlock: p.ccVinBlock ?? null,
      manualVendorBlocks: p.manualVendorBlocks ?? null,
      manualLtabBlock: p.manualLtabBlock ?? null,
      citiAvoti: p.citiAvoti ?? null,
      tirgusForm: p.tirgusForm ?? null,
      listingUrl: p.listingUrl ?? null,
    }),
    ...extraTiles,
  ];
  const items = tiles
    .map((t) => {
      const cls = [
        "pdf-summary-tile",
        `pdf-summary-tile--${t.tone}`,
        t.wide ? "pdf-summary-tile--wide" : "",
      ]
        .filter(Boolean)
        .join(" ");
      const noteHtml =
        t.noteSegments && t.noteSegments.length > 0
          ? `<p class="pdf-summary-tile__note">${t.noteSegments
              .map((part, i) =>
                i === 0
                  ? escapeHtml(part)
                  : `<span class="pdf-summary-tile__sep" aria-hidden="true"></span>${escapeHtml(part)}`,
              )
              .join("")}</p>`
          : t.note
            ? `<p class="pdf-summary-tile__note">${escapeHtml(t.note)}</p>`
            : "";
      return `<li class="${cls}">
      <p class="pdf-summary-tile__label">${escapeHtml(t.label)}</p>
      ${t.value ? `<p class="pdf-summary-tile__value">${escapeHtml(t.value)}</p>` : ""}
      ${noteHtml}
    </li>`;
    })
    .join("");
  const head = sectionHeadBrand(sectionIconPdfHtml("listChecks"), PDF_REPORT_SUMMARY_TITLE);
  return `<section class="pdf-report-summary pdf-surface-card pdf-page-flow-chunk--avoid" role="region">${head}<ul class="pdf-summary-tiles">${items}</ul></section>`;
}

function buildPdfCountryFlagCellHtml(countryLabel: string, extraWrapClass = ""): string {
  const flag = pdfCountryFlagEmoji(countryLabel);
  const code = pdfCountryCodeLetters(countryLabel);
  const ariaLabel = escapeHtml(countryLabel.trim() || "—");
  const codeEsc = escapeHtml(code);
  const wrapCls = extraWrapClass ? ` pdf-country-flag-wrap ${extraWrapClass}` : " pdf-country-flag-wrap";
  return `<span class="${wrapCls.trim()}" role="img" aria-label="${ariaLabel}"><span class="pdf-country-flag" aria-hidden="true">${flag}</span><span class="pdf-country-code">${codeEsc}</span></span>`;
}

/** Robs starp ierakstiem — centrēts čips, kas pārtrauc sliedi. */
function buildPdfLifeBreakHtml(e: LifecycleEvent): string {
  return `<li class="pdf-life-break pdf-life-break--gap">
    <span class="pdf-life-rail pdf-life-rail--dash" aria-hidden="true"></span>
    <div class="pdf-life-break__chip">
      <span class="pdf-life-break__lead">
        <span class="pdf-data-alert-ico" aria-hidden="true">${pdfLossAmountAlertIconHtml("yellow", "lg")}</span>
        <span class="pdf-life-break__title">${escapeHtml(e.title)}</span>
      </span>
    </div>
  </li>`;
}

function sectionHeadBrand(icon: string, title: string, badgeHtml = ""): string {
  const brandWrap = icon.includes("pdf-ico--brand-logo") ? " pdf-sec-ico-wrap--brand-logo" : "";
  return `<div class="pdf-sec-head pdf-sec-head--brand"><span class="pdf-sec-ico-wrap${brandWrap}" aria-hidden="true">${icon}</span><h2 class="pdf-sec pdf-sec--nobar">${escapeHtml(title)}</h2>${badgeHtml}</div>`;
}

/** Avota sadaļas ārējā klase — augšmalas akcents avota krāsā (tā pati krāsa kā nobraukuma svītriņai). */
function sourceZoneClass(sourceLabel: string): string {
  return `pdf-src-zone pdf-src-zone--${mileageSourceLabelToPdfKey(sourceLabel)}`;
}

/** „1 ieraksts” / „12 ieraksti” — latviešu skaitļa forma. */
function formatSourceRecordCountLv(count: number): string {
  const one = count % 10 === 1 && count % 100 !== 11;
  return `${count} ${one ? "ieraksts" : "ieraksti"}`;
}

/** Ierakstu skaita plāksnīte pie avota virsraksta (kā konkurentu „Ierakstu skaits”). */
function sourceRecordCountBadgeHtml(count: number): string {
  if (count <= 0) return "";
  return `<span class="pdf-src-count-badge pdf-src-count-badge--ok">${escapeHtml(formatSourceRecordCountLv(count))}</span>`;
}

/** AutoDNA / CarVertical / CAR INFO — zīmolu logotipi, 16×16 kā pārējās PDF sadaļu ikonas. */
function vendorSectionIconHtml(title: string): string {
  const L = SOURCE_BLOCK_LABELS;
  if (title === L.autodna) {
    return pdfBrandLogoImgHtml(PDF_HERO_BRAND_LOGO_DATA_URI.autodna);
  }
  if (title === L.carvertical) {
    return pdfBrandLogoImgHtml(PDF_HERO_BRAND_LOGO_DATA_URI.carvertical);
  }
  if (title === L.carinfo) {
    return pdfBrandLogoImgHtml(PDF_SOURCE_LOGO_DATA_URI.carinfo);
  }
  return sectionIconPdfHtml(vendorPdfTitleToIconId(title));
}

function csddSectionIconHtml(): string {
  return pdfBrandLogoImgHtml(PDF_SOURCE_LOGO_DATA_URI.csdd);
}

function ltabSectionIconHtml(): string {
  return pdfBrandLogoImgHtml(PDF_SOURCE_LOGO_DATA_URI.ltab);
}

function dealerSectionIconHtml(makeModel: string): string {
  const uri = pdfDealerLogoDataUri(makeModel);
  return uri ? pdfBrandLogoImgHtml(uri) : sectionIconPdfHtml("shieldCheck");
}

function listingAnalysisSectionIconHtml(listingUrl: string | null | undefined): string {
  const uri = pdfListingPortalLogoDataUri(listingUrl);
  return uri ? pdfBrandLogoImgHtml(uri) : sectionIconPdfHtml("search");
}

function reportVehicleMakeHint(p: ClientReportPayload): string {
  return (
    p.csddForm?.makeModel?.trim() ||
    extractVehicleMakeModel(p.csddForm?.rawUnprocessedData ?? "") ||
    extractVehicleMakeModel(p.csdd) ||
    p.manualLtabBlock?.certificate?.makeModel?.trim() ||
    ""
  );
}

function pdfFieldLabelWithIcon(iconHtml: string, label: string): string {
  return `<p class="pdf-subhead pdf-subhead--ico"><span class="pdf-subhead__ico" aria-hidden="true">${iconHtml}</span><span>${escapeHtml(label)}</span></p>`;
}

function pdfListingAnalysisFieldIconHtml(title: string): string {
  const L = LISTING_ANALYSIS_SUBSECTIONS;
  if (title === L.sellerPortrait) return sectionIconPdfHtml("award");
  if (title === L.photoAnalysis) return sectionIconPdfHtml("scanSearch");
  return sectionIconPdfHtml("fileText");
}

function formatCsddNextInspectionCell(v: string): string {
  return escapeHtml(v);
}

function escapeCsddPdfFieldValue(key: keyof CsddFormFields, v: string): string {
  const isDateKey =
    key === "nextInspectionDate" || key === "prevInspectionDate" || key === "firstRegistration";
  return isDateKey ? formatCsddNextInspectionCell(v) : escapeHtml(v);
}

function buildCsddPdfAlertRowHtml(
  labelEscaped: string,
  valueEscaped: string,
  flag: Exclude<CsddFieldUiFlag, "none">,
): string {
  const tier = flag === "red" ? "red" : "yellow";
  const ico = pdfLossAmountAlertIconHtml(tier);
  return `<tr><td colspan="2" class="pdf-csdd-alert-td"><div class="pdf-csdd-alert-wrap"><span class="pdf-data-alert-ico" aria-hidden="true">${ico}</span><div class="pdf-csdd-alert pdf-csdd-alert--${tier}"><span class="pdf-csdd-alert-label">${labelEscaped}</span><span class="pdf-csdd-alert-val">${valueEscaped}</span></div></div></td></tr>`;
}

function pdfLossAmountAlertIconHtml(tier: "yellow" | "red", size: "sm" | "lg" = "sm"): string {
  const stroke = tier === "red" ? "#FF4D4D" : "#FFC107";
  const px = size === "lg" ? 17 : 13;
  const cls =
    size === "lg" ? "pdf-loss-amt-ico pdf-warn-tri-ico pdf-warn-tri-ico--lg" : "pdf-loss-amt-ico pdf-warn-tri-ico";
  return `<svg class="${cls}" width="${px}" height="${px}" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3 2 20h20L12 3z" stroke="${stroke}" stroke-width="2" stroke-linejoin="round"/><path d="M12 9v5M12 17h.01" stroke="${stroke}" stroke-width="2" stroke-linecap="round"/></svg>`;
}

/** Sarkana bultiņa uz leju — krāsa kā pdf-warn (sarkanajam), izmērs +30% pret 13px trijstūri (~17px). */
function pdfPriceDropDownArrowHtml(): string {
  return `<svg class="pdf-price-drop-arrow" width="17" height="17" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M12 5v14" stroke="#FF4D4D" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="m19 12-7 7-7-7" stroke="#FF4D4D" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

function formatTirgusPriceDropCellHtml(raw: string): string {
  const t = raw.trim();
  if (!t) return escapeHtml(t);
  return `<span class="pdf-price-drop-wrap"><span class="pdf-price-drop-ico" aria-hidden="true">${pdfPriceDropDownArrowHtml()}</span><span class="tabular pdf-price-drop-val">${escapeHtml(t)}</span></span>`;
}

function formatLossAmountEurCell(raw: string, opts?: { approx?: boolean }): string {
  const display = normalizeLossAmountEurDisplay(raw);
  const t = display || raw.trim();
  const shown = opts?.approx && t ? `~${t}` : t;
  const esc = escapeHtml(shown);
  if (!t) return esc;
  const flag = getLossAmountUiFlag(display || raw);
  if (flag === "none") return esc;
  const tier = flag === "red" ? "red" : "yellow";
  const ico = pdfLossAmountAlertIconHtml(tier);
  return `<span class="pdf-data-alert-wrap pdf-num-warn pdf-num-warn--${tier}"><span class="pdf-data-alert-ico" aria-hidden="true">${ico}</span><span class="tabular pdf-num-warn-digits">${esc}</span></span>`;
}

function formatListedForSaleDaysCellHtml(raw: string): string {
  const t = raw.trim();
  const esc = escapeHtml(t);
  if (!t || !shouldShowListedForSaleCriticalBanner(raw)) return esc;
  const ico = pdfLossAmountAlertIconHtml("red", "lg");
  return `<span class="pdf-data-alert-wrap pdf-num-warn pdf-num-warn--red"><span class="pdf-data-alert-ico" aria-hidden="true">${ico}</span><span class="tabular pdf-num-warn-digits">${esc}</span></span>`;
}

function extractVehicleMakeModel(csdd: string): string | null {
  const t = csdd.replace(/\r/g, "");
  let m = t.match(
    /(?:marka|modelis)\s*[,&]?\s*(?:modelis|marka)?\s*[:\-]\s*([^\n]{2,72})/i,
  );
  if (m) {
    const s = m[1].trim().split(/\n/)[0]?.trim() ?? "";
    if (s.length >= 2) return s.replace(/\s{2,}/g, " ");
  }
  m = t.match(
    /\b(BMW|Audi|Mercedes-Benz|Mercedes|VW|Volkswagen|Toyota|Volvo|Opel|Ford|Peugeot|Renault|Hyundai|Kia|Škoda|Skoda|Nissan|Mazda|Honda|Citro[ëe]n|Tesla)\s+[A-Za-z0-9][A-Za-z0-9\s\-]{1,32}/i,
  );
  return m ? m[0].trim().replace(/\s{2,}/g, " ") : null;
}

/** Komentāru bloks — vienots stils visā atskaitē; „Komentārs” virsraksts netiek rādīts. */
function pdfReportCommentBox(text: string, label = ""): string {
  const body = adminRichHtmlToPdfSafeHtml(text).trim();
  if (!body) return "";
  const shownLabel = label.trim().toLowerCase() === PDF_REPORT_COMMENT_LABEL.toLowerCase() ? "" : label.trim();
  const head = shownLabel ? `<p class="pdf-subhead pdf-subhead--flush">${escapeHtml(shownLabel)}</p>` : "";
  return `<div class="pdf-report-comment-note" role="note">${head}<div class="pdf-report-comment-note-body">${body}</div></div>`;
}

/** Komentāru bloks zem avota (PDF). */
function pdfAvotuCommentIsland(text: string): string {
  return pdfReportCommentBox(text);
}

/** Avota punkts — viens vizuālais kods visā atskaitē (tabulas, laikposms, negadījumi, leģendas). */
function pdfSourceDotHtml(sourceLabel: string): string {
  const key = mileageSourceLabelToPdfKey(sourceLabel);
  const aria = `Avots: ${MILEAGE_PDF_SOURCE_LEGEND[key].full}`;
  return `<span class="pdf-src-dot pdf-src-dot--${key}" role="img" aria-label="${escapeHtml(aria)}"></span>`;
}

/** Punkts + avota nosaukums (+ neobligāta vērtība, piem. summa). */
function pdfSourceTagHtml(sourceLabel: string, value = ""): string {
  const name = sourceLabel.trim() || MILEAGE_PDF_SOURCE_LEGEND.cits.full;
  const valueHtml = value.trim() ? `<span class="pdf-src-tag__val">${escapeHtml(value.trim())}</span>` : "";
  return `<span class="pdf-src-tag">${pdfSourceDotHtml(name)}<span class="pdf-src-tag__name">${escapeHtml(name)}</span>${valueHtml}</span>`;
}

function uniqueSourceLabels(sourceLabels: string[]): string[] {
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const raw of sourceLabels) {
    const t = raw.trim();
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(t);
  }
  if (unique.length === 0) unique.push(MILEAGE_PDF_SOURCE_LEGEND.cits.full);
  return unique;
}

/** Avotu saraksts kā punkti + nosaukumi (nobraukuma leģenda zem grafika un tabulām). */
function buildPdfSourceLegendHtml(sourceLabels: string[]): string {
  const keySet = collectMileagePdfSourceKeysFromLabels(sourceLabels);
  const ordered = mileagePdfLegendKeysInOrder(keySet);
  if (ordered.length === 0) return "";
  const parts = ordered.map(
    (k) => `<li class="pdf-src-legend__item">${pdfSourceTagHtml(MILEAGE_PDF_SOURCE_LEGEND[k].full)}</li>`,
  );
  return `<ul class="pdf-src-legend">${parts.join("")}</ul>`;
}

/** Tabulas „Avots” kolonna — punkti bez teksta (nosaukumi ir leģendā zem tabulas). */
function buildPdfMileageSourceDotsHtml(sourceLabels: string[]): string {
  const inner = uniqueSourceLabels(sourceLabels).map((lbl) => pdfSourceDotHtml(lbl)).join("");
  return `<span class="pdf-src-dots" role="presentation">${inner}</span>`;
}

function buildPdfMileageSourceLegendHtml(mileageRows: UnifiedMileageDisplayRow[]): string {
  const labels = mileageRows.flatMap((r) => (r.sourceLabels.length > 0 ? r.sourceLabels : [r.sourceLabel]));
  return buildPdfSourceLegendHtml(labels);
}

/** Skaidrojums zem tabulas, ja kāds rādījums nāk no vēlāk datēta dokumenta. */
const PDF_MILEAGE_STALE_DOCUMENT_NOTE =
  "Ieraksts atspoguļo dokumenta grāmatošanas brīdi vai cilvēka kļūdu datu ievadē, radot mākslīgu nobraukuma kritumu. Tas nav nobraukuma viltojums, tāpēc grafikā netiek attēlots.";

function buildUnifiedMileageTableRowHtml(
  r: UnifiedMileageDisplayRow,
  anomalyBySourceOrder: Map<number, boolean>,
  staleDocumentSourceOrders: Set<number>,
): string {
  const flagCell = buildPdfCountryFlagCellHtml(r.country);
  const odoEscaped = escapeHtml(r.odometer);
  const labels = r.sourceLabels.length > 0 ? r.sourceLabels : [r.sourceLabel];
  const stripeSpan = buildPdfMileageSourceDotsHtml(labels);
  const anom = anomalyBySourceOrder.get(r.sourceOrder) === true;
  const staleDoc = staleDocumentSourceOrders.has(r.sourceOrder);
  const rowClass = anom
    ? "pdf-mileage-history-row pdf-mileage-history-row--anomaly"
    : staleDoc
      ? "pdf-mileage-history-row pdf-mileage-history-row--doc-date"
      : "pdf-mileage-history-row";
  const odoTd = anom
    ? `<td class="tabular pdf-mileage-cell-odo"><span class="pdf-data-alert-wrap pdf-num-warn pdf-num-warn--red"><span class="pdf-data-alert-ico" aria-hidden="true">${pdfLossAmountAlertIconHtml("red")}</span><span class="tabular pdf-num-warn-digits">${odoEscaped}</span></span></td>`
    : staleDoc
      ? `<td class="tabular pdf-mileage-cell-odo"><span class="pdf-data-alert-wrap pdf-num-warn pdf-num-warn--yellow"><span class="pdf-data-alert-ico" aria-hidden="true">${pdfLossAmountAlertIconHtml("yellow")}</span><span class="tabular pdf-num-warn-digits">${odoEscaped}</span></span></td>`
      : `<td class="tabular pdf-mileage-cell-odo"><span class="pdf-mileage-odo-value">${odoEscaped}</span></td>`;
  const srcTd = `<td class="pdf-mileage-cell-src"><span class="pdf-mileage-cell-src-inner">${stripeSpan}</span></td>`;
  return `<tr class="${rowClass}"><td class="pdf-mileage-cell-date">${escapeHtml(r.date)}</td>${odoTd}${srcTd}<td class="pdf-mileage-cell-flag">${flagCell}</td></tr>`;
}

function buildMileageHistoryTableHtml(
  rows: UnifiedMileageDisplayRow[],
  anomalyBySourceOrder: Map<number, boolean>,
  staleDocumentSourceOrders: Set<number>,
): string {
  if (rows.length === 0) return "";
  const colgroup = `<colgroup><col class="pdf-mileage-col-date" /><col class="pdf-mileage-col-odo" /><col class="pdf-mileage-col-src" /><col class="pdf-mileage-col-flag" /></colgroup>`;
  const head = `<tr><th class="pdf-mileage-th-date" scope="col">Datums</th><th class="pdf-mileage-th-odo" scope="col">Odometrs (km)</th><th class="pdf-mileage-th-src" scope="col">Avots</th><th class="pdf-mileage-th-flag" scope="col">Valsts</th></tr>`;
  const body = rows
    .map((r) => buildUnifiedMileageTableRowHtml(r, anomalyBySourceOrder, staleDocumentSourceOrders))
    .join("\n");
  return `<div class="pdf-mileage-history-table-wrap"><table class="pdf-mileage-history-table pdf-mileage-history-table--mileage-rows" role="table">${colgroup}<thead>${head}</thead><tbody>${body}</tbody></table></div>`;
}

export function buildUnifiedMileageTableHtml(
  p: UnifiedMileageSourcePayload & { mileageComment?: string | null },
  mileageOpts?: CollectUnifiedMileageOptions,
): string {
  const collected = collectUnifiedMileageRows(
    {
      csddForm: p.csddForm,
      autoRecordsBlock: p.autoRecordsBlock,
      ccVinBlock: p.ccVinBlock ?? null,
      manualVendorBlocks: p.manualVendorBlocks,
      citiAvotiBlock: "citiAvoti" in p ? (p as ClientReportPayload).citiAvoti ?? null : p.citiAvotiBlock ?? null,
      tirgusForm: p.tirgusForm ?? ("tirgusForm" in p ? (p as ClientReportPayload).tirgusForm ?? null : null),
      listingUrl: "listingUrl" in p ? (p as ClientReportPayload).listingUrl ?? null : p.listingUrl ?? null,
    },
    mileageOpts,
  );
  if (collected.length === 0) {
    const commentBlock = pdfReportCommentBox(p.mileageComment ?? "", PDF_MILEAGE_HISTORY_COMMENT_LABEL);
    if (!commentBlock) return "";
    const headOnly = sectionHeadBrand(sectionIconPdfHtml("route"), "NOBRAUKUMA VĒSTURE");
    return `<div class="pdf-page-flow-chunk pdf-unified-mileage-zone pdf-surface-card" role="region">${headOnly}${commentBlock}</div>`;
  }

  const mileageRows = prepareUnifiedMileageDisplayRows(collected);
  if (mileageRows.length === 0) return "";

  const { anomalyBySourceOrder, chartExcludeSourceOrders, staleDocumentSourceOrders } =
    analyzeUnifiedMileageAnomalies(mileageRows);

  const rows = [...mileageRows].sort((a, b) => {
    if (a.sortableTime !== b.sortableTime) return b.sortableTime - a.sortableTime;
    return a.sourceOrder - b.sourceOrder;
  });

  const display = rows;
  const chartHtml = buildUnifiedMileageChartWrapHtml(mileageRows, anomalyBySourceOrder, {
    compact: true,
    chartExcludeSourceOrders,
  });

  const mid = Math.ceil(display.length / 2) || 0;
  const leftRows = display.slice(0, mid);
  const rightRows = display.slice(mid);
  const dualTables =
    display.length === 0
      ? ""
      : display.length <= 4
        ? buildMileageHistoryTableHtml(display, anomalyBySourceOrder, staleDocumentSourceOrders)
        : `<div class="pdf-mileage-dual"><div class="pdf-mileage-dual__cell">${buildMileageHistoryTableHtml(leftRows, anomalyBySourceOrder, staleDocumentSourceOrders)}</div><div class="pdf-mileage-dual__cell">${buildMileageHistoryTableHtml(rightRows, anomalyBySourceOrder, staleDocumentSourceOrders)}</div></div>`;

  const sourceCount = new Set(mileageRows.flatMap((r) => r.sourceLabels)).size;
  const legend = buildPdfMileageSourceLegendHtml(mileageRows);
  const sourceCountHtml = `<div class="pdf-source-count-note pdf-source-count-note--mileage"><span class="pdf-mileage-source-count-title">Grafika ģenerēšanā izmantotais avotu skaits: ${sourceCount}</span>${legend}</div>`;
  const staleNoteHtml =
    staleDocumentSourceOrders.size > 0
      ? `<p class="pdf-mileage-smart-note"><span class="pdf-mileage-smart-note__ico" aria-hidden="true">${pdfLossAmountAlertIconHtml("yellow")}</span>${escapeHtml(PDF_MILEAGE_STALE_DOCUMENT_NOTE)}</p>`
      : "";

  const head = sectionHeadBrand(sectionIconPdfHtml("route"), "NOBRAUKUMA VĒSTURE");
  const commentHtml = pdfReportCommentBox(p.mileageComment ?? "", PDF_MILEAGE_HISTORY_COMMENT_LABEL);

  const body = `${chartHtml}${dualTables}${sourceCountHtml}${staleNoteHtml}${commentHtml}`;
  return `<div class="pdf-page-flow-chunk pdf-unified-mileage-zone pdf-surface-card" role="region">${head}<div class="pdf-unified-mileage-zone__body">${body}</div></div>`;
}

/** Avotu vērtējumi zem summas — punkts + avots + summa (tas pats kods kā „Kas tika pārbaudīts”). */
function buildIncidentSourceTagsHtml(c: UnifiedIncidentCluster): string {
  if (c.sourceValuations.length === 0) return "";
  // Viens avots — summa jau ir virsrakstā, tāpēc tikai punkts + nosaukums.
  const withValues = c.sourceValuations.length > 1;
  const items = c.sourceValuations
    .map(
      (s) =>
        `<li class="pdf-src-tags__item">${pdfSourceTagHtml(s.sourceLabel, withValues ? s.displayAmount : "")}</li>`,
    )
    .join("");
  return `<ul class="pdf-src-tags pdf-incident-card__srcs">${items}</ul>`;
}

function incidentCountBadgeHtml(n: number): string {
  if (n <= 0) return "";
  return `<span class="pdf-incident-count">${escapeHtml(formatUnifiedIncidentCountLabel(n))}</span>`;
}

function buildIncidentDamageChipsHtml(dmg: UnifiedIncidentDamage | null): string {
  if (!dmg) return "";
  const labels = [...dmg.zoneLabels, ...dmg.groupLabels];
  if (labels.length === 0) return "";
  return `<ul class="pdf-incident-chips">${labels.map((l) => `<li>${escapeHtml(l)}</li>`).join("")}</ul>`;
}

function buildIncidentClusterCardHtml(c: UnifiedIncidentCluster, index: number | string): string {
  const lossCell = formatLossAmountEurCell(c.displayAmount, { approx: c.averaged });
  const sourceTags = buildIncidentSourceTagsHtml(c);
  const countryLabel = c.country.trim() || "—";
  const flag = pdfCountryFlagEmoji(countryLabel);
  const dmg = c.damage;
  const withDmg = Boolean(dmg && (dmg.zoneIds.length > 0 || dmg.zoneLabels.length > 0 || dmg.groupLabels.length > 0));
  const svg = buildDamageZoneSilhouetteSvg(dmg?.zoneIds ?? [], `c${index}`, undefined, dmg?.zoneLabels ?? []);
  const chips = buildIncidentDamageChipsHtml(dmg);
  const carFacts = `<div class="pdf-incident-card__car">${svg}</div>
      <div class="pdf-incident-card__facts">
        <div class="pdf-incident-card__amount">${lossCell}</div>
        ${chips}
      </div>`;
  return `<article class="pdf-incident-card${withDmg ? " pdf-incident-card--with-dmg" : ""}">
    <div class="pdf-incident-card__main">
      <div class="pdf-incident-card__datecol">
        <time class="pdf-incident-card__date">${escapeHtml(c.date || "—")}</time>
        <span class="pdf-incident-card__country"><span class="pdf-country-flag" aria-hidden="true">${flag}</span><span>${escapeHtml(countryLabel)}</span></span>
      </div>
      ${carFacts}
    </div>
    ${sourceTags}
  </article>`;
}

function buildIncidentClustersCardHtml(agg: UnifiedIncidentAggregation): string {
  if (agg.clusters.length === 0) return "";
  const body = agg.clusters.map((c, i) => buildIncidentClusterCardHtml(c, i)).join("\n");
  return `<div class="pdf-listing-price-history pdf-incident-history-card">${body}</div>`;
}

/** Apvienota negadījumu vēsture — viena kartīte: loģiskie negadījumi + avotu vērtējumi + skaits. */
export function buildUnifiedIncidentsTableHtml(p: ClientReportPayload, vis: PdfVisibilitySettings): string {
  if (!vis.unifiedIncidents) return "";
  const collected = collectUnifiedIncidentRows({
    manualVendorBlocks: p.manualVendorBlocks ?? null,
    manualLtabBlock: p.manualLtabBlock ?? null,
    ccVinBlock: vis.cc_vin ? p.ccVinBlock ?? null : null,
  });
  const adminNoteHtml = pdfReportCommentBox(p.internalComment ?? "", ADMIN_INCIDENTS_SUMMARY_LABEL);
  if (collected.length === 0 && !adminNoteHtml) return "";
  const damageDetails = collectUnifiedIncidentDamageDetails(p.manualVendorBlocks ?? null);
  const agg = aggregateUnifiedIncidents(collected, damageDetails);
  const card = buildIncidentClustersCardHtml(agg);
  const head = sectionHeadBrand(
    sectionIconPdfHtml("shield"),
    NEGADIJUMU_VESTURE_TITLE,
    incidentCountBadgeHtml(agg.uniqueCount),
  );
  const body = `${card}${adminNoteHtml}`;
  return `<div class="pdf-page-flow-chunk pdf-unified-incidents-zone pdf-surface-card" role="region">${head}<div class="pdf-unified-incidents-zone__body">${body}</div></div>`;
}

/** Tehniskā specifikācija — patstāvīga sadaļa augšā; CSDD zonā paliek reģistrācijas dati. */
const PDF_VEHICLE_SPEC_FIELD_KEYS: (keyof CsddFormFields)[] = [
  "makeModel",
  "firstRegistration",
  "engineDisplacementCm3",
  "enginePowerKw",
  "fuelType",
  "emissionStandard",
  "grossMassKg",
  "curbMassKg",
  "opacityCoefficient",
  "particulateMatter",
];

function csddFieldIsVehicleSpec(key: keyof CsddFormFields): boolean {
  return PDF_VEHICLE_SPEC_FIELD_KEYS.includes(key);
}

/** TRANSPORTLĪDZEKĻA DATI — kas šis auto ir, pirms sākam runāt par avotiem. */
function buildPdfVehicleSpecSectionHtml(
  form: CsddFormFields | null | undefined,
  vin: string | null,
  vis: PdfVisibilitySettings,
): string {
  if (!vis.csdd && !vis.vehicle) return "";
  const rows: string[] = [];
  const vinTrim = vin?.trim();
  if (vinTrim) {
    rows.push(`<tr><td>VIN</td><td><span class="pdf-vin">${escapeHtml(vinTrim)}</span></td></tr>`);
  }
  for (const { key, label } of CSDD_FORM_STRUCTURED_FIELDS) {
    if (!csddFieldIsVehicleSpec(key)) continue;
    const v = (form?.[key] as string | undefined)?.trim() ?? "";
    if (!v) continue;
    const valueHtml = escapeCsddPdfFieldValue(key, v);
    if (key === "particulateMatter") {
      const flag = getParticulateMatterUiFlag(v);
      if (flag !== "none") {
        rows.push(buildCsddPdfAlertRowHtml(escapeHtml(label), valueHtml, flag));
        continue;
      }
    }
    rows.push(`<tr><td>${escapeHtml(label)}</td><td>${valueHtml}</td></tr>`);
  }
  if (rows.length <= 1) return "";
  const head = sectionHeadBrand(sectionIconPdfHtml("carFront"), PDF_VEHICLE_SPEC_TITLE);
  const body = `<table class="mirror-table mirror-table--csdd"><tbody>${rows.join("")}</tbody></table>`;
  return `<section class="pdf-unified-mileage-zone pdf-surface-card pdf-vehicle-spec pdf-page-flow-chunk--avoid" role="region">${head}${body}</section>`;
}

/** CSDD — strukturētie lauki + komentāri (viena PDF zona, kā audita atskaitē). */
export function buildCsddAvotuZoneHtml(form: CsddFormFields, sparkHtml = ""): string {
  if (!csddFormHasContent(form) && !sparkHtml) return "";

  const csddRecords =
    (form.technicalInspectionHistory ?? []).filter((r) => r.date.trim()).length +
    (form.ownerRegistrationEvents ?? []).filter((e) => e.date.trim()).length;
  const head = sectionHeadBrand(
    csddSectionIconHtml(),
    PDF_SUB_CSDD,
    sourceRecordCountBadgeHtml(csddRecords),
  );
  const commentTrim = mergePdfChecklistAndComments(form.pdfChecklist, form.comments ?? "").trim();
  const hasComments = commentTrim.length > 0;
  const regRows: string[] = [];
  for (const { key, label } of CSDD_FORM_STRUCTURED_FIELDS) {
    // Tehniskie dati ir atsevišķā TRANSPORTLĪDZEKĻA DATI sadaļā; īpašnieku skaits — laika joslā.
    if (csddFieldIsVehicleSpec(key) || key === "ownerCountLatvia") continue;
    const v = (form[key] as string).trim();
    if (!v) continue;
    let flag: CsddFieldUiFlag = "none";
    if (key === "particulateMatter") flag = getParticulateMatterUiFlag(v);
    else if (key === "nextInspectionDate") flag = getNextInspectionDateUiFlag(v);
    const valueHtml = escapeCsddPdfFieldValue(key, v);
    if (flag !== "none" && (key === "particulateMatter" || key === "nextInspectionDate")) {
      regRows.push(buildCsddPdfAlertRowHtml(escapeHtml(label), valueHtml, flag));
    } else {
      regRows.push(`<tr><td>${escapeHtml(label)}</td><td>${valueHtml}</td></tr>`);
    }
  }
  const tableHtml =
    regRows.length > 0
      ? `<table class="mirror-table mirror-table--csdd"><tbody>${regRows.join("\n")}</tbody></table>`
      : "";

  const ownerTimelineHtml =
    form.ownerCountLatvia.trim() || (form.ownerRegistrationEvents ?? []).some((e) => e.date.trim())
      ? buildOwnerRegistrationTimelineHtml(form.ownerCountLatvia, form.ownerRegistrationEvents ?? [], {
          compact: true,
        })
      : "";

  const prevBlock = form.prevInspectionBlock;
  const prevInspectionDateDisplay = form.prevInspectionDate.trim()
    ? isoDateToLvDisplay(form.prevInspectionDate)
    : "";
  const prevWarnings = filterCsddInspectionWarnings(form.prevInspectionWarnings);
  const hasPrevBlock = prevBlock && previousInspectionBlockHasData(prevBlock);
  const prevInspectionHtml =
    hasPrevBlock || prevWarnings.length > 0
      ? `<div class="pdf-csdd-ta-section"><p class="pdf-subhead">${escapeHtml(CSDD_PREVIOUS_INSPECTION_TITLE)}</p>${buildPreviousInspectionBlockHtml(prevBlock ?? emptyCsddPreviousInspectionBlock(), prevInspectionDateDisplay, prevWarnings)}</div>`
      : "";

  const taRows = (form.technicalInspectionHistory ?? []).filter((r) => r.date.trim());
  const taWarnings = filterCsddInspectionWarnings(form.technicalInspectionWarnings);
  const taTableHtml =
    taRows.length > 0 || taWarnings.length > 0
      ? `<div class="pdf-csdd-ta-section"><p class="pdf-subhead">${escapeHtml(CSDD_TECHNICAL_INSPECTION_HISTORY_TITLE)}</p>${buildTechnicalInspectionHistoryTableHtml(taRows, taWarnings)}</div>`
      : "";

  const commentHtml = hasComments ? pdfAvotuCommentIsland(commentTrim) : "";
  if (!tableHtml && !ownerTimelineHtml && !prevInspectionHtml && !taTableHtml && !commentHtml && !sparkHtml) {
    return "";
  }
  const bodyInner = `${sparkHtml}${tableHtml}${ownerTimelineHtml}${prevInspectionHtml}${taTableHtml}${commentHtml}`;
  return `<div class="pdf-unified-mileage-zone pdf-surface-card ${sourceZoneClass(PDF_SUB_CSDD)}" role="region">${head}<div class="pdf-source-section-body">${bodyInner}</div></div>`;
}

function csddAvotuRawZoneHtml(raw: string, sparkHtml = ""): string {
  const head = sectionHeadBrand(csddSectionIconHtml(), PDF_SUB_CSDD);
  return `<div class="pdf-unified-mileage-zone pdf-surface-card ${sourceZoneClass(PDF_SUB_CSDD)}" role="region">${head}<div class="pdf-source-section-body">${sparkHtml}<pre class="mirror-pre">${escapeHtml(raw.trim())}</pre></div></div>`;
}

/** CSDD — apskates datumi + strukturētie lauki (viena galvenā līmeņa zona, kā NOBRAUKUMA VĒSTURE). */
function buildCsddAvotuSubsection(p: ClientReportPayload, vis: PdfVisibilitySettings, sparkHtml = ""): string {
  if (!vis.csdd) return "";
  const form = p.csddForm;
  const hasStruct = Boolean(form && csddFormHasContent(form));
  const hasRaw = p.csdd.trim().length > 0;
  if (!hasStruct && !hasRaw && !sparkHtml) return "";

  if (hasStruct && form) {
    const zone = buildCsddAvotuZoneHtml(form, sparkHtml);
    if (zone) return zone;
    if (hasRaw) return csddAvotuRawZoneHtml(p.csdd, sparkHtml);
    if (sparkHtml) return buildCsddAvotuZoneHtml(form, sparkHtml);
    return "";
  }

  if (hasRaw) return csddAvotuRawZoneHtml(p.csdd, sparkHtml);
  if (sparkHtml) {
    const head = sectionHeadBrand(csddSectionIconHtml(), PDF_SUB_CSDD);
    return `<div class="pdf-unified-mileage-zone pdf-surface-card ${sourceZoneClass(PDF_SUB_CSDD)}" role="region">${head}<div class="pdf-source-section-body">${sparkHtml}</div></div>`;
  }
  return "";
}

/** Tirgus dati — HTML ķermenis „Sludinājuma vēsture” apakšsadaļai (bez ārējās kartes). */
function buildTirgusPriceHistoryTableHtml(f: TirgusFormFields): string {
  const rows = f.priceHistory ?? [];
  if (!tirgusPriceHistoryHasRows(rows)) return "";
  const priceChange = rows[0]!.price - rows[rows.length - 1]!.price;
  const days = parseListedForSaleDays(f.listedForSale);
  const body = rows
    .map((row) => {
      const delta = formatAdifyDeltaLabel(row.delta);
      const deltaHtml = delta
        ? `<span class="pdf-listing-price-delta ${row.delta < 0 ? "pdf-listing-price-delta--down" : "pdf-listing-price-delta--up"}">${escapeHtml(delta)}</span>`
        : "";
      return `<tr>
        <td class="pdf-listing-price">${escapeHtml(formatAdifyPriceLabel(row.price))}${deltaHtml}</td>
        <td>${escapeHtml(formatAdifyMileageLabel(row.mileage))}</td>
        <td>${escapeHtml(row.date)}</td>
      </tr>`;
    })
    .join("\n");
  const duration = days != null ? `${days} diena(s)` : "—";
  const priceChangeTone =
    priceChange < 0 ? "pdf-stat-tone--down" : priceChange > 0 ? "pdf-stat-tone--up" : "";
  return `<div class="pdf-listing-price-history pdf-listing-price-history--tirgus">
    <p class="pdf-subhead pdf-subhead--boxed">Cenas izmaiņas šajā sludinājumā</p>
    <table class="pdf-listing-price-history-table" role="table">${body}</table>
    <div class="pdf-listing-price-history-foot">
      <span>Cenas izmaiņa: <strong class="${priceChangeTone}">${escapeHtml(formatAdifySignedEur(priceChange))}</strong></span>
      <span>Ilgums tirgū: <strong>${escapeHtml(duration)}</strong></span>
    </div>
  </div>`;
}

function buildTirgusListingHistoryBodyHtml(p: ClientReportPayload): string {
  const hasForm = tirgusFormHasContent(p.tirgusForm);
  const hasText = p.tirgus.trim().length > 0;
  if (!hasForm && !hasText) return "";

  const parts: string[] = [];
  if (hasForm && p.tirgusForm) {
    const f = p.tirgusForm;
    const hasHistoryRows = tirgusPriceHistoryHasRows(f.priceHistory);
    const historyHtml = hasHistoryRows ? buildTirgusPriceHistoryTableHtml(f) : "";
    if (historyHtml) parts.push(historyHtml);
    const rows: string[] = [];
    // „Ilgums” jau parādās vēstures kartītes apakšā — rindu atkārto tikai, ja iedegas
    // kritiskais brīdinājums (>200 dienas), jo tad tas nes jaunu informāciju.
    const showListedRow =
      f.listedForSale.trim() &&
      (!hasHistoryRows || shouldShowListedForSaleCriticalBanner(f.listedForSale));
    if (showListedRow) {
      rows.push(
        `<tr><td>${escapeHtml(TIRGUS_LABEL_LISTED)}</td><td>${formatListedForSaleDaysCellHtml(f.listedForSale)}</td></tr>`,
      );
    }
    if (f.listingCreated.trim()) {
      rows.push(
        `<tr><td>${escapeHtml(TIRGUS_LABEL_CREATED)}</td><td>${escapeHtml(f.listingCreated.trim())}</td></tr>`,
      );
    }
    if (f.listingMileageOdometer.trim()) {
      const odoBits = [f.listingMileageOdometer.trim(), f.listingMileageCountry.trim() || (f.listingCreated.trim() ? "Latvija" : "")]
        .filter(Boolean)
        .join(" · ");
      rows.push(
        `<tr><td>${escapeHtml(TIRGUS_LABEL_LISTING_ODOMETER)}</td><td>${escapeHtml(odoBits)}</td></tr>`,
      );
    }
    // „Cenas izmaiņa” jau parādās vēstures kartītes apakšā, aprēķināta no tām pašām rindām.
    if (f.priceDrop.trim() && !hasHistoryRows) {
      rows.push(
        `<tr><td>${escapeHtml(TIRGUS_LABEL_PRICE_DROP)}</td><td>${formatTirgusPriceDropCellHtml(f.priceDrop)}</td></tr>`,
      );
    }
    const table =
      rows.length > 0
        ? `<table class="mirror-table"><tbody>${rows.join("\n")}</tbody></table>`
        : "";
    if (table) parts.push(table);
    const tirgusCommentBox = pdfReportCommentBox(f.comments ?? "");
    if (tirgusCommentBox) parts.push(tirgusCommentBox);
  } else {
    const legacyBox = pdfReportCommentBox(p.tirgus);
    if (legacyBox) parts.push(legacyBox);
  }
  return parts.join("\n");
}

const PDF_AUTO_RECORDS_SERVICE_HISTORY_LABEL = "Servisa vēsture";
const PDF_AUTO_RECORDS_OIL_INTERVAL_LABEL = "Eļļas maiņas intervāli";
const PDF_AUTO_RECORDS_SERVICE_WORKS_LABEL = "Servisa un remontu vēsture";

/** „Regulārā apkope: eļļas maiņa, salona filtrs” → kategorijas prefikss atsevišķi no darbiem. */
const SERVICE_WORKS_CATEGORY_PREFIX_RE = /^([^:]{2,40}):\s*(.+)$/;

/**
 * Viena „Veiktie darbi” rinda → kompaktas ikonu shēmas ar mazu ikonu pazīstamām kategorijām
 * (eļļa, bremzes, riepas, akumulators, filtri, dzesēšana, spuldzes). Nezināms darbs paliek bez
 * ikonas — nekas netiek uzminēts.
 */
function serviceWorksLineHtml(line: string): string {
  const text = line.trim();
  if (!text) return "";
  const catMatch = text.match(SERVICE_WORKS_CATEGORY_PREFIX_RE);
  const category = catMatch ? catMatch[1]!.trim() : "";
  const rest = catMatch ? catMatch[2]!.trim() : text;
  const items = rest
    .split(/,\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (items.length === 0) return escapeHtml(text);
  const prefix = category
    ? `<span class="pdf-service-chip-cat">${escapeHtml(category)}:</span> `
    : "";
  const chips = items
    .map((item) => {
      const icon = serviceWorkIconId(item);
      const iconHtml = icon
        ? `<span class="pdf-service-chip-ico" aria-hidden="true">${sectionIconPdfHtmlSized(icon, 11)}</span>`
        : "";
      return `<span class="pdf-service-chip">${iconHtml}${escapeHtml(item)}</span>`;
    })
    .join("");
  return `${prefix}${chips}`;
}

function serviceWorksCellHtml(raw: string): string {
  const lines = raw.replace(/\r\n?/g, "\n").split("\n").map(serviceWorksLineHtml).filter(Boolean);
  return lines.length > 0 ? lines.join("<br/>") : "—";
}

/** OFICIĀLĀ DĪLERA DATI — apkopju tabula: datums, odometrs, veiktie darbi. */
function buildAutoRecordsServiceWorksTableHtml(rows: AutoRecordsServiceWorkRow[]): string {
  const printable = sortAutoRecordsServiceWorkRows(
    (rows ?? []).map(normalizeAutoRecordsServiceWorkRow).filter(autoRecordsServiceWorkRowIsPrintable),
  );
  if (printable.length === 0) return "";
  const colgroup =
    '<colgroup><col class="pdf-service-col-date" /><col class="pdf-service-col-odo" /><col class="pdf-service-col-place" /><col class="pdf-service-col-works" /></colgroup>';
  const head =
    `<tr><th class="pdf-mileage-th-date" scope="col">Datums</th><th class="pdf-mileage-th-odo" scope="col">Odometrs (km)</th><th class="pdf-service-th-place" scope="col">${escapeHtml(SERVICE_WORKS_LOCATION_LABEL)}</th><th class="pdf-service-th-works" scope="col">Veiktie darbi</th></tr>`;
  const body = printable
    .map((r) => {
      const odo = formatServiceWorkOdometer(r.odometer);
      const place = r.location.trim() ? escapeHtml(r.location.trim()) : "—";
      const works = r.works.trim() ? serviceWorksCellHtml(r.works) : "—";
      return `<tr class="pdf-mileage-history-row"><td class="pdf-mileage-cell-date">${escapeHtml(r.date)}</td><td class="tabular pdf-mileage-cell-odo">${odo ? escapeHtml(odo) : "—"}</td><td class="pdf-service-cell-place">${place}</td><td class="pdf-service-cell-works">${works}</td></tr>`;
    })
    .join("\n");
  const subheadHtml = pdfFieldLabelWithIcon(sectionIconPdfHtml("wrench"), PDF_AUTO_RECORDS_SERVICE_WORKS_LABEL);
  return `<section class="pdf-service-works-zone">${subheadHtml}<div class="pdf-mileage-history-table-wrap"><table class="pdf-mileage-history-table pdf-mileage-history-table--service" role="table">${colgroup}<thead>${head}</thead><tbody>${body}</tbody></table></div></section>`;
}

function buildSourcePhotoGroupsPdfHtml(
  photoGroups: { title: string; photos: { id: string }[] }[] | null | undefined,
  legacyPhotos: { id: string }[] | null | undefined,
  dataUrls: Map<string, string> | undefined,
  normalizeGroups: (
    groups: unknown,
    legacy: unknown,
  ) => { title: string; photos: { id: string }[] }[],
  layout: "grid" | "stack" = "grid",
): string {
  if (!dataUrls?.size) return "";

  const groups = normalizeGroups(photoGroups, legacyPhotos);
  if (groups.length === 0) return "";
  const gridCls =
    layout === "stack" ? "pdf-listing-photo-grid pdf-listing-photo-grid--full" : "pdf-listing-photo-grid";

  const sections: string[] = [];
  for (const group of groups) {
    const cells: string[] = [];
    for (const ph of group.photos) {
      const src = dataUrls.get(ph.id);
      if (!src) continue;
      cells.push(
        `<figure class="pdf-listing-photo-cell"><img class="pdf-listing-photo-img" src="${src}" alt=""/></figure>`,
      );
    }
    if (cells.length === 0) continue;
    const titleHtml = group.title.trim()
      ? `<p class="pdf-subhead pdf-subhead--photo">${escapeHtml(group.title.trim())}</p>`
      : "";
    sections.push(
      `<section class="pdf-listing-photo-group">${titleHtml}<div class="${gridCls}">${cells.join("")}</div></section>`,
    );
  }
  return sections.join("");
}

/** AUTO RECORDS — Outvin dīlera dati PDF; nobraukums tikai vienotajā tabulā; servisa vēsture + komentāri atsevišķi. */
function buildAutoRecordsAvotuSubsection(
  b: AutoRecordsBlockState | null | undefined,
  vis: PdfVisibilitySettings,
  autoRecordsPhotoDataUrls?: Map<string, string>,
  makeModel = "",
  sparkHtml = "",
): string {
  if (!vis.auto_records) return "";
  if ((!b || !autoRecordsBlockHasContent(b)) && !sparkHtml) return "";
  if (!b) {
    const head = sectionHeadBrand(dealerSectionIconHtml(makeModel), PDF_SOURCE_DEALER_TITLE);
    return `<div class="pdf-unified-mileage-zone pdf-surface-card ${sourceZoneClass(SOURCE_BLOCK_LABELS.auto_records)}" role="region">${head}<div class="pdf-source-section-body">${sparkHtml}</div></div>`;
  }

  const bundle = getAutoRecordsOutvinBundle(b);
  const bundleInner = outvinBundleHasStructuredContent(bundle)
    ? buildOutvinBundlePdfInnerHtml(bundle)
    : "";
  const legacyInner = buildOutvinDealerReportPdfInnerHtml(b.outvinReport);
  const outvinInner = bundleInner.trim() || legacyInner.trim();
  const serviceWorksTable = buildAutoRecordsServiceWorksTableHtml(b.serviceWorks ?? []);
  const serviceHistoryNotes = (b.serviceHistoryNotes ?? "").trim();
  const serviceHistoryBox = serviceHistoryNotes
    ? pdfReportCommentBox(serviceHistoryNotes, PDF_AUTO_RECORDS_SERVICE_HISTORY_LABEL)
    : "";
  const oilChangeIntervalNotes = (b.oilChangeIntervalNotes ?? "").trim();
  const oilIntervalBox = oilChangeIntervalNotes
    ? pdfReportCommentBox(oilChangeIntervalNotes, PDF_AUTO_RECORDS_OIL_INTERVAL_LABEL)
    : "";
  const commentBlock = mergePdfChecklistAndComments(b.pdfChecklist, b.comments);
  const hasComments = commentBlock.trim().length > 0;
  const hasOutvin = outvinInner.length > 0;
  const hasServiceHistory = serviceHistoryBox.length > 0;
  const hasOilInterval = oilIntervalBox.length > 0;
  const photosHtml = buildSourcePhotoGroupsPdfHtml(
    b.photoGroups,
    b.photos,
    autoRecordsPhotoDataUrls,
    normalizeAutoRecordsPhotoGroups,
    "stack",
  );
  const hasPhotos = photosHtml.length > 0;
  const hasServiceWorks = serviceWorksTable.length > 0;

  if (
    !hasOutvin &&
    !hasServiceWorks &&
    !hasServiceHistory &&
    !hasOilInterval &&
    !hasComments &&
    !hasPhotos &&
    !sparkHtml
  ) {
    return "";
  }

  const recordCount =
    (b.serviceHistory ?? []).filter(autoRecordsRowHasData).length +
    (b.serviceWorks ?? []).filter(autoRecordsServiceWorkRowIsPrintable).length;
  const head = sectionHeadBrand(
    dealerSectionIconHtml(makeModel),
    PDF_SOURCE_DEALER_TITLE,
    sourceRecordCountBadgeHtml(recordCount),
  );
  const bodyParts: string[] = [];
  if (sparkHtml) bodyParts.push(sparkHtml);
  if (hasOutvin) bodyParts.push(`<div class="pdf-outvin-dealer-stack">${outvinInner}</div>`);
  if (hasServiceWorks) bodyParts.push(serviceWorksTable);
  if (hasServiceHistory) bodyParts.push(serviceHistoryBox);
  if (hasOilInterval) bodyParts.push(oilIntervalBox);
  if (hasPhotos) bodyParts.push(photosHtml);
  if (hasComments) bodyParts.push(pdfAvotuCommentIsland(commentBlock));
  return `<div class="pdf-unified-mileage-zone pdf-surface-card ${sourceZoneClass(SOURCE_BLOCK_LABELS.auto_records)}" role="region">${head}<div class="pdf-source-section-body">${bodyParts.join("\n")}</div></div>`;
}

/** Starptautiskā vēsture — sarkanie karogi un vēsture; specifikācijas netiek dublētas. */
function buildCcVinAvotuSubsection(
  b: CcVinBlockState | null | undefined,
  vis: PdfVisibilitySettings,
  photoDataUrls?: Map<string, string>,
  sparkHtml = "",
): string {
  if (!vis.cc_vin) return "";
  if ((!b || !ccVinBlockHasContent(b)) && !sparkHtml) return "";
  const inner = b && ccVinBlockHasContent(b) ? buildCcVinPdfInnerHtml(b) : "";
  const photosHtml = b
    ? buildSourcePhotoGroupsPdfHtml(b.photoGroups, b.photos, photoDataUrls, normalizeCcVinPhotoGroups)
    : "";
  const comments = (b?.comments ?? "").trim();
  if (!inner && !photosHtml && !comments && !sparkHtml) return "";
  const head = sectionHeadBrand(
    sectionIconPdfHtml("globe"),
    CC_VIN_PDF_TITLE,
    sourceRecordCountBadgeHtml(b ? countCcVinRecords(b) : 0),
  );
  const bodyParts = [sparkHtml, inner, photosHtml, comments ? pdfAvotuCommentIsland(comments) : ""].filter(
    Boolean,
  );
  return `<div class="pdf-unified-mileage-zone pdf-surface-card ${sourceZoneClass(CC_VIN_PDF_SOURCE_LABEL)}" role="region">${head}<div class="pdf-source-section-body">${bodyParts.join("\n")}</div></div>`;
}

/** Trešās puses avots — komentāri + reģistru īsie fakti (īpašnieki, statuss, piezīmes). */
function buildVendorAvotuSubsection(
  b: ClientManualVendorBlockPdf,
  vis: PdfVisibilitySettings,
  sparkHtml = "",
): string {
  const L = SOURCE_BLOCK_LABELS;
  if (b.title === L.autodna && !vis.autodna) return "";
  if (b.title === L.carvertical && !vis.carvertical) return "";
  if (b.title === L.tjekbil && !vis.tjekbil) return "";
  if (b.title === L.mnt_ee && !vis.mnt_ee) return "";
  if (b.title === L.lkf_ee && !vis.lkf_ee) return "";
  if (b.title === L.carinfo && !vis.carinfo) return "";
  const commentBlock = mergePdfChecklistAndComments(b.pdfChecklist, b.comments);
  const omitOwners = b.title === L.carinfo;
  const owners = omitOwners ? "" : (b.ownersSummary ?? "").trim();
  const status = (b.statusRecords ?? "").trim();
  const notes = (b.autoNotes ?? "").trim();
  const hasComments = commentBlock.trim().length > 0;
  if (!hasComments && !owners && !status && !notes && !sparkHtml) return "";
  const head = sectionHeadBrand(
    vendorSectionIconHtml(b.title),
    b.title,
    sourceRecordCountBadgeHtml(b.mileageRows.length + b.incidentRows.length),
  );
  const bodyParts: string[] = [];
  if (sparkHtml) bodyParts.push(sparkHtml);
  if (owners) bodyParts.push(pdfReportCommentBox(owners, "Īpašnieku skaits"));
  if (status) bodyParts.push(pdfReportCommentBox(status, "Statuss"));
  if (notes) bodyParts.push(pdfReportCommentBox(notes, "Piezīmes"));
  if (hasComments) bodyParts.push(pdfAvotuCommentIsland(commentBlock));
  const body = `<div class="pdf-source-section-body">${bodyParts.join("\n")}</div>`;
  return `<div class="pdf-unified-mileage-zone pdf-surface-card ${sourceZoneClass(b.title)}" role="region">${head}${body}</div>`;
}

function buildLtabCertificateHtml(cert: NonNullable<ClientManualLtabBlockPdf["certificate"]>): string {
  const title = cert.issuedAt.trim()
    ? `${LTAB_CERTIFICATE_TITLE} uz ${cert.issuedAt.trim()}`
    : LTAB_CERTIFICATE_TITLE;
  const facts: string[] = [];
  if (cert.vehicleLine.trim()) {
    facts.push(`<p class="pdf-ltab-izzi-line">${escapeHtml(cert.vehicleLine.trim())}</p>`);
  }
  if (cert.accidentCount.trim()) {
    facts.push(
      `<p class="pdf-ltab-izzi-line">Negadījumu skaits: <strong>${escapeHtml(cert.accidentCount.trim())}</strong></p>`,
    );
  }
  if (cert.insuredFrom.trim() || cert.insuredTo.trim() || cert.insuredDays.trim()) {
    const days = cert.insuredDays.trim()
      ? ` apdrošināts ${escapeHtml(cert.insuredDays.trim())} dienas.`
      : ".";
    facts.push(
      `<p class="pdf-ltab-izzi-line">Laikā no ${escapeHtml(cert.insuredFrom.trim() || "—")} līdz ${escapeHtml(cert.insuredTo.trim() || "—")}${days}</p>`,
    );
  }
  const claims = (cert.claims ?? []).filter(ltabCertificateClaimHasData);
  let table = "";
  if (claims.length > 0) {
    const body = claims
      .map((row) => {
        const when = formatLtabClaimWhen(row) || "—";
        const amt = formatLtabCertificateAmountEur(row.amount) || row.amount.trim() || "—";
        return `<tr>
        <td class="pdf-listing-price">${escapeHtml(amt)}</td>
        <td>${escapeHtml(row.status.trim() || "—")}</td>
        <td>${escapeHtml(when)}</td>
      </tr>`;
      })
      .join("");
    const totalCents = sumLtabCertificateAmountCents(claims);
    const totalLabel = totalCents > 0 ? formatLtabCentsAsEur(totalCents) : "—";
    table = `<div class="pdf-listing-price-history pdf-ltab-loss-history">
    <p class="pdf-subhead pdf-subhead--boxed">Zaudējumu dati</p>
    <table class="pdf-listing-price-history-table" role="table">${body}</table>
    <div class="pdf-listing-price-history-foot">
      <span>Kopā: <strong class="pdf-stat-tone--alert">${escapeHtml(totalLabel)}</strong></span>
      <span>Negadījumi: <strong class="pdf-stat-tone--alert">${claims.length}</strong></span>
    </div>
  </div>`;
  }
  const footer = `<p class="pdf-ltab-izzi-footer">${escapeHtml(cert.footerNote.trim() || LTAB_CERTIFICATE_FOOTER_DEFAULT)}</p>`;
  return `<div class="pdf-ltab-izzi"><p class="pdf-subhead pdf-subhead--flush">${escapeHtml(title)}</p>${facts.join("")}${table}${footer}</div>`;
}

function buildLtabAvotuSubsection(
  b: ClientManualLtabBlockPdf | null | undefined,
  vis: PdfVisibilitySettings,
  sparkHtml = "",
): string {
  if (!vis.ltab) return "";
  if (!b && !sparkHtml) return "";
  const hasComments = Boolean(b?.comments.trim());
  const certHtml =
    b && ltabCertificateHasContent(b.certificate) ? buildLtabCertificateHtml(b.certificate!) : "";
  if (!hasComments && !certHtml && !sparkHtml) return "";
  const head = sectionHeadBrand(
    ltabSectionIconHtml(),
    SOURCE_BLOCK_LABELS.ltab,
    sourceRecordCountBadgeHtml(b ? b.rows.filter(ltabRowHasData).length : 0),
  );
  const inner = [sparkHtml, certHtml, hasComments && b ? pdfAvotuCommentIsland(b.comments) : ""]
    .filter(Boolean)
    .join("");
  const body = `<div class="pdf-source-section-body">${inner}</div>`;
  return `<div class="pdf-unified-mileage-zone pdf-surface-card ${sourceZoneClass(SOURCE_BLOCK_LABELS.ltab)}" role="region">${head}${body}</div>`;
}

/**
 * Sludinājuma analīze — patstāvīgs bloks: vispirms „Sludinājuma vēsture” (tirgus dati), tad pārējās apakšsadaļas.
 */
function buildListingAnalysisPhotosPdfHtml(
  photoGroups: { title: string; photos: { id: string }[] }[] | null | undefined,
  legacyPhotos: { id: string }[] | null | undefined,
  dataUrls: Map<string, string> | undefined,
): string {
  return buildSourcePhotoGroupsPdfHtml(
    photoGroups,
    legacyPhotos,
    dataUrls,
    normalizeListingAnalysisPhotoGroups,
  );
}

function buildListingAnalysisPriorityHtml(
  p: ClientReportPayload,
  vis: PdfVisibilitySettings,
  listingAnalysisPhotoDataUrls?: Map<string, string>,
): string {
  if (!vis.sludinajums) return "";
  const tirgusBody = buildTirgusListingHistoryBodyHtml(p);
  const b = p.listingAnalysis;
  const hasListingFields = Boolean(b && listingAnalysisHasContent(b));

  const inner: string[] = [];
  if (tirgusBody) {
    inner.push(pdfFieldLabelWithIcon(sectionIconPdfHtml("history"), LISTING_HISTORY_SUBSECTION_TITLE));
    inner.push(`<div class="pdf-listing-analysis-chunk pdf-listing-history-frame">${tirgusBody}</div>`);
  }
  if (b && hasListingFields) {
    const L = LISTING_ANALYSIS_SUBSECTIONS;
    const cat = (title: string, text: string) => {
      const box = pdfReportCommentBox(text);
      if (!box) return;
      inner.push(pdfFieldLabelWithIcon(pdfListingAnalysisFieldIconHtml(title), title));
      inner.push(box);
    };
    cat(L.sellerPortrait, b.sellerPortrait);
    const photosHtml = buildListingAnalysisPhotosPdfHtml(b.photoGroups, b.photos, listingAnalysisPhotoDataUrls);
    const photoCommentBox = pdfReportCommentBox(b.photoAnalysis);
    if (photoCommentBox || photosHtml) {
      inner.push(pdfFieldLabelWithIcon(pdfListingAnalysisFieldIconHtml(L.photoAnalysis), L.photoAnalysis));
      if (photoCommentBox) inner.push(photoCommentBox);
      if (photosHtml) inner.push(photosHtml);
    }
  }
  if (inner.length === 0) return "";
  const parts: string[] = [];
  parts.push(`<div class="pdf-unified-mileage-zone pdf-surface-card pdf-listing-analysis-root" role="region">`);
  parts.push(sectionHeadBrand(listingAnalysisSectionIconHtml(p.listingUrl), PDF_SECTION_LISTING_ANALYSIS));
  parts.push(`<div class="pdf-source-section-body pdf-listing-analysis-stack">${inner.join("\n")}</div>`);
  parts.push(`</div>`);
  return parts.join("\n");
}

/** Citi avoti — tīri komentāri (nobraukums un negadījumi ir vienotajās tabulās augšā). */
function buildCitiAvotiAvotuSubsection(
  p: ClientReportPayload,
  vis: PdfVisibilitySettings,
  sparkHtml = "",
): string {
  if (!vis.citi_avoti) return "";
  const b = p.citiAvoti;
  if (!b?.sections?.length && !sparkHtml) return "";
  const islands: string[] = [];
  const total = b?.sections?.length ?? 0;
  for (const [i, section] of (b?.sections ?? []).entries()) {
    const comments = section.comments.trim();
    if (!comments) continue;
    const subheadLabel = section.label?.trim() || (total > 1 ? `Avots ${i + 1}` : "");
    islands.push(
      subheadLabel ?
        `<p class="pdf-subhead">${escapeHtml(subheadLabel)}</p>${pdfAvotuCommentIsland(comments)}`
      : pdfAvotuCommentIsland(comments),
    );
  }
  if (islands.length === 0 && !sparkHtml) return "";
  const citiRecords = (b?.sections ?? []).reduce(
    (sum, s) =>
      sum +
      (s.serviceHistory ?? []).filter(autoRecordsRowHasData).length +
      (s.incidents ?? []).filter(ltabRowHasData).length,
    0,
  );
  const head = sectionHeadBrand(
    sectionIconPdfHtml("layers"),
    SOURCE_BLOCK_LABELS.citi_avoti,
    sourceRecordCountBadgeHtml(citiRecords),
  );
  const body = `<div class="pdf-source-section-body">${sparkHtml}${islands.join("\n")}</div>`;
  return `<div class="pdf-unified-mileage-zone pdf-surface-card pdf-citi-avoti-plain ${sourceZoneClass(SOURCE_BLOCK_LABELS.citi_avoti)}" role="region">${head}${body}</div>`;
}

/**
 * Avotu apakšsadaļas (PDF): katra patstāvīga pilna platuma zona — CSDD, AutoDNA, CarVertical, utt.
 * Nav kopējā „Avotu bloki“ mātes sadaļas.
 */
function buildAvotuDatiSectionHtml(
  p: ClientReportPayload,
  vis: PdfVisibilitySettings,
  autoRecordsPhotoDataUrls?: Map<string, string>,
  ccVinPhotoDataUrls?: Map<string, string>,
): string {
  const sparkCtx = collectPdfMileageSparkContext(p, vis);
  const spark = (key: MileagePdfSourceKey) => sourceMileageSparkHtml(sparkCtx, key);

  const csdd = buildCsddAvotuSubsection(p, vis, spark("csdd"));
  const ltab = buildLtabAvotuSubsection(p.manualLtabBlock, vis, spark("ltab"));
  const citiAvoti = buildCitiAvotiAvotuSubsection(p, vis, spark("cits"));

  const vendors = p.manualVendorBlocks ?? [];
  const byTitle = new Map(vendors.map((b) => [b.title, b]));
  const vendorHtml = (title: string) => {
    const b = byTitle.get(title);
    return b ? buildVendorAvotuSubsection(b, vis, spark(mileageSourceLabelToPdfKey(title))) : "";
  };
  const autodna = vendorHtml(SOURCE_BLOCK_LABELS.autodna);
  const carvertical = vendorHtml(SOURCE_BLOCK_LABELS.carvertical);
  const autoRecords = buildAutoRecordsAvotuSubsection(
    p.autoRecordsBlock ?? null,
    vis,
    autoRecordsPhotoDataUrls,
    reportVehicleMakeHint(p),
    spark("dealer"),
  );
  const ccVin = buildCcVinAvotuSubsection(p.ccVinBlock ?? null, vis, ccVinPhotoDataUrls, spark("intl"));
  const tjekbil = vendorHtml(SOURCE_BLOCK_LABELS.tjekbil);
  const mntEe = vendorHtml(SOURCE_BLOCK_LABELS.mnt_ee);
  const lkfEe = vendorHtml(SOURCE_BLOCK_LABELS.lkf_ee);
  const carinfo = vendorHtml(SOURCE_BLOCK_LABELS.carinfo);

  const stack = [
    csdd,
    autodna,
    carvertical,
    autoRecords,
    ccVin,
    tjekbil,
    mntEe,
    lkfEe,
    carinfo,
    ltab,
    citiAvoti,
  ].filter(Boolean);
  if (stack.length === 0) return "";
  return stack.join("\n");
}

/** Galvenais eksperta kopsavilkums — pilnā platumā, pēdējais lielais bloks pirms juridiskās piezīmes. */
function buildApprovedByIrissHtml(p: ClientReportPayload, vis: PdfVisibilitySettings): string {
  if (!vis.iriss) return "";
  const techHtml = (p.tehniskoRiskuAnalize ?? "").trim();
  const irissHtml = (p.iriss ?? "").trim();
  const planHtml = (p.apskatesPlāns ?? "").trim();
  if (!irissHtml && !planHtml && !techHtml) return "";
  const inner: string[] = [];
  if (techHtml) {
    inner.push(pdfFieldLabelWithIcon(sectionIconPdfHtml("wrench"), PDF_IRISS_SECTION_TECHNICAL_RISKS));
    inner.push(pdfReportCommentBox(techHtml));
  }
  if (planHtml) {
    inner.push(pdfFieldLabelWithIcon(sectionIconPdfHtml("car"), PDF_IRISS_SECTION_INSPECTION));
    inner.push(pdfReportCommentBox(planHtml));
  }
  if (irissHtml) {
    inner.push(pdfFieldLabelWithIcon(sectionIconPdfHtml("fileSearch"), PDF_IRISS_SECTION_SUMMARY));
    inner.push(pdfReportCommentBox(irissHtml));
  }
  if (inner.length === 0) return "";
  const parts: string[] = [];
  parts.push(`<div class="pdf-page-flow-chunk pdf-unified-mileage-zone pdf-surface-card pdf-listing-analysis-root pdf-iriss-approved" role="region">`);
  parts.push(sectionHeadBrand(sectionIconPdfHtml("shieldCheck"), PDF_APPROVED_BY_IRISS));
  parts.push(`<div class="pdf-source-section-body pdf-listing-analysis-stack">${inner.join("\n")}</div>`);
  parts.push(`</div>`);
  return parts.join("\n");
}

function reportFontGuardScript(): string {
  return `<script>
(function(){
  function fail(){
    var m=document.createElement("div");
    m.className="mirror-font-error";
    m.innerHTML="<p><strong>Inter</strong> fonts nav ielādējušies. Pārbaudiet tīklu un mēģiniet vēlreiz. PDF netiks drukāts ar pareizu noformējumu.</p>";
    if(document.body){document.body.innerHTML="";document.body.appendChild(m);}
  }
  if(!document.fonts||!document.fonts.check){return;}
  document.fonts.ready.then(function(){
    if(!document.fonts.check("12px Inter")){fail();}
  }).catch(fail);
})();
</script>`;
}

/** Admin iframe priekšskatam — pilns PDF drukas CSS (izolēts iframe). */
export function getClientReportPrintCss(): string {
  return clientReportPrintCss();
}

/** Avotu krāsas vienā vietā: punkti + sadaļu augšmalas akcents. */
function sourceDotColorCss(): string {
  return MILEAGE_PDF_SOURCE_LEGEND_ORDER.map((k) => {
    const hex = MILEAGE_PDF_SOURCE_COLOR[k];
    return `      .pdf-src-dot--${k}{background:${hex};}\n      .provin-report-doc .pdf-src-zone--${k}{border-top-color:${hex};}`;
  }).join("\n");
}

function clientReportPrintCss(): string {
  return `
      @page{margin:0;size:auto;}
      :root{
        --pdf-radius-outer:12px;
        --pdf-radius-inner:8px;
        --pdf-line:#E9EDF3;
        --pdf-line-soft:#F1F5F9;
        --pdf-shadow:0 1px 3px rgba(15,23,42,.06);
        --pdf-pad-outer:16px 18px;
        --pdf-pad-inner:12px 14px;
        --pdf-gap-section:24px;
        --pdf-gap-block:12px;
        --pdf-fs-sec:13px;
        --pdf-fs-base:11.5px;
        --pdf-fs-table:10.5px;
        --pdf-fs-label:9.5px;
        --pdf-fs-fine:8.5px;
      }
      *{box-sizing:border-box;}
      html,body,.provin-report-doc{font-family:Inter,sans-serif!important;}
      .provin-report-doc .pdf-vin,.provin-report-doc code,.provin-report-doc kbd,.provin-report-doc samp,.provin-report-doc tt{
        font-family:Inter,sans-serif!important;font-variant-numeric:normal!important;
      }
      .provin-report-doc .pdf-vin{background:transparent!important;padding:0!important;}
      body{
        font-size:12px;
        line-height:1.62;
        max-width:190mm;
        margin:0 auto;
        padding:10mm 12mm;
        color:#0f172a;
        background:#fff!important;
        -webkit-font-smoothing:antialiased;
      }
      .provin-report-doc .pdf-v1-panel--clean,
      .provin-report-doc .pdf-summary-tile,
      .provin-report-doc .pdf-doc-footer{
        break-inside:avoid;
        page-break-inside:avoid;
        -webkit-column-break-inside:avoid;
      }
      .provin-report-doc .pdf-page-flow-chunk{
        break-inside:auto;
        page-break-inside:auto;
        -webkit-column-break-inside:auto;
      }
      .provin-report-doc .pdf-unified-mileage-zone__body,
      .provin-report-doc .pdf-unified-incidents-zone__body{
        display:block;
        width:100%;
      }
      .provin-report-doc .pdf-unified-mileage-zone__body > * + *,
      .provin-report-doc .pdf-unified-incidents-zone__body > * + *{
        margin-top:10px;
      }
      .provin-report-doc .pdf-source-count-note--mileage + .pdf-report-comment-note{
        margin-top:6px;
      }
      .provin-report-doc .pdf-report-comment-note{margin-top:10px;}
      .sheet{background:#fff;padding:0;}
      .pdf-sec-head{display:flex;align-items:center;gap:10px;margin:0 0 12px;}
      .pdf-sec-head--nobar{margin-top:0;}
      .pdf-sec-head .pdf-ico{color:${PDF_BRAND_BLUE_HEX};width:16px;height:16px;flex-shrink:0;}
      h2.pdf-sec{
        font-size:var(--pdf-fs-sec);font-weight:700;margin:0;flex:1;color:#0f172a;letter-spacing:0.08em;line-height:1.3;
        padding:0;border:0;text-transform:uppercase;
      }
      h2.pdf-sec--nobar{border-left:none;padding-left:0;}
      h3.pdf-sub{font-size:0.75rem;font-weight:700;margin:0.6rem 0 0.35rem;color:#000;text-transform:uppercase;letter-spacing:0.05em;}
      h3.pdf-sub:first-child{margin-top:0;}
      .pdf-subhead{display:flex;align-items:center;gap:8px;margin:0 0 0.4rem;}
      .pdf-subhead-ico{display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;}
      .pdf-subhead-ico .pdf-ico{width:14px;height:14px;}
      h3.pdf-sub.pdf-sub--with-ico{margin:0;border-left:none;padding:0;}
      .pdf-sec-head--brand{
        align-items:center;gap:10px;margin:0 0 14px;padding-bottom:10px;
        border-bottom:1px solid var(--pdf-line);
      }
      .pdf-life-list{margin:0;padding:0;list-style:none;}
      .pdf-life-year{
        display:block;margin:10px 0 8px;padding:7px 12px;border-radius:8px;background:#E8F1FC;
        -webkit-print-color-adjust:exact;print-color-adjust:exact;
      }
      .pdf-life-list > li:first-child.pdf-life-year{margin-top:0;}
      .pdf-life-year__num{
        display:block;font-size:13px;font-weight:700;color:${PDF_BRAND_BLUE_HEX};letter-spacing:0.04em;line-height:1.3;
        font-variant-numeric:tabular-nums;
      }
      .pdf-life-item,
      .pdf-life-break{
        display:grid;grid-template-columns:78px 18px minmax(0,1fr);gap:0 12px;
        align-items:stretch;margin:0;
      }
      .pdf-life-rail{
        position:relative;display:block;align-self:stretch;justify-self:center;width:2px;
        background:#D7E4F5;
        -webkit-print-color-adjust:exact;print-color-adjust:exact;
      }
      .pdf-life-item{break-inside:avoid;page-break-inside:avoid;}
      .pdf-life-dot{
        position:absolute;left:50%;top:18px;width:9px;height:9px;margin-left:-4.5px;
        border-radius:999px;background:#fff;border:2px solid #93C5FD;
        -webkit-print-color-adjust:exact;print-color-adjust:exact;
      }
      .pdf-life-item--warn .pdf-life-dot{border-color:#FFC107;}
      .pdf-life-item--alert .pdf-life-dot,
      .pdf-life-item--incident .pdf-life-dot{
        background:#FF4D4D;border-color:#FF4D4D;
      }
      .pdf-life-card--alert{
        position:relative;
        background:#FFF1F2;
        -webkit-print-color-adjust:exact;print-color-adjust:exact;
      }
      .pdf-life-alert-edge{
        position:absolute;top:8px;bottom:8px;left:0;width:3px;border-radius:2px;
        background:#FF4D4D;pointer-events:none;z-index:1;
        -webkit-print-color-adjust:exact;print-color-adjust:exact;
      }
      .pdf-life-item--alert .pdf-life-date,
      .pdf-life-item--incident .pdf-life-date,
      .pdf-life-item--incident .pdf-life-card__kind,
      .pdf-life-card--alert .pdf-life-card__kind{
        color:#B91C1C;
      }
      .pdf-life-item--alert .pdf-num-warn-digits{color:#B91C1C!important;font-weight:700;}
      .pdf-life-date{
        padding:14px 0;font-size:var(--pdf-fs-base);font-weight:600;color:#0f172a;white-space:nowrap;
        font-variant-numeric:tabular-nums;line-height:1.3;text-align:right;
      }
      .pdf-life-card{
        margin:8px 0;padding:12px 14px;border:1px solid #E9EDF3;border-radius:10px;background:#fff;
        min-width:0;
        -webkit-print-color-adjust:exact;print-color-adjust:exact;
      }
      .pdf-life-card__grid{
        display:grid;grid-template-columns:minmax(7.5rem,0.9fr) minmax(0,1.2fr) auto;
        gap:6px 16px;align-items:center;
      }
      .pdf-life-card__kind{
        margin:0;display:flex;align-items:center;gap:8px;font-size:var(--pdf-fs-base);font-weight:700;color:#0f172a;line-height:1.3;
      }
      .pdf-life-ico{display:inline-flex;color:#64748b;flex-shrink:0;}
      .pdf-life-ico .pdf-ico{width:14px;height:14px;}
      .pdf-life-ico--brand .pdf-ico--brand-logo{width:16px;height:16px;object-fit:contain;display:block;}
      .pdf-life-card__fact{min-width:0;}
      .pdf-life-card__sub{margin:0;font-size:var(--pdf-fs-table);color:#475569;line-height:1.4;}
      .pdf-life-ta{margin:0;font-size:var(--pdf-fs-table);font-weight:650;line-height:1.4;}
      .pdf-life-ta--ok{color:#047857;}
      .pdf-life-ta--warn{color:#B45309;}
      .pdf-life-meta{
        margin:4px 0 0;display:flex;align-items:center;flex-wrap:wrap;gap:8px;
        font-size:11px;color:#64748b;line-height:1.3;
      }
      .pdf-life-meta .pdf-country-flag{font-size:13px;line-height:1;}
      .pdf-life-km{
        flex:none;padding:3px 8px;border-radius:6px;background:#F1F5F9;
        font-size:11px;font-weight:700;font-variant-numeric:tabular-nums;color:#0f172a;white-space:nowrap;
        -webkit-print-color-adjust:exact;print-color-adjust:exact;
      }
      .pdf-life-km--loss,
      .pdf-life-km--loss .pdf-num-warn-digits{color:#B91C1C;}
      .pdf-life-srcs{
        display:inline-flex;align-items:center;align-content:center;
        gap:4px;flex-wrap:wrap;line-height:1;
      }
      .pdf-life-card--import{display:flex;align-items:center;justify-content:center;padding:14px 16px;}
      .pdf-life-imp{
        margin:0;display:flex;align-items:center;justify-content:center;gap:12px;
        font-size:var(--pdf-fs-base);font-weight:650;color:#0f172a;line-height:1.3;
      }
      .pdf-life-imp__side{display:inline-flex;align-items:center;gap:8px;}
      .pdf-life-imp__side .pdf-country-flag{font-size:22px;line-height:1;}
      .pdf-life-imp__arrow{font-size:16px;font-weight:700;color:#94a3b8;line-height:1;}
      .pdf-life-break{
        padding:10px 0 12px;
        break-inside:avoid;page-break-inside:avoid;
      }
      .pdf-life-break .pdf-life-rail{grid-column:2;}
      .pdf-life-rail--dash{
        background:repeating-linear-gradient(to bottom,#D7E4F5 0,#D7E4F5 3px,transparent 3px,transparent 7px)!important;
        -webkit-print-color-adjust:exact;print-color-adjust:exact;
      }
      .pdf-life-break__chip{
        grid-column:3;justify-self:center;
        display:flex;flex-direction:column;align-items:center;gap:5px;
        max-width:100%;padding:2px 0;
      }
      .pdf-life-break--gap .pdf-life-break__chip{color:#B45309;}
      .pdf-life-break__lead{
        display:flex;align-items:center;justify-content:center;gap:8px;
      }
      .pdf-life-break__title{
        font-size:var(--pdf-fs-base);font-weight:700;line-height:1.3;text-align:center;
        white-space:nowrap;
      }
      .pdf-lifecycle-zone .pdf-src-legend{
        margin-top:14px;padding-top:12px;border-top:1px solid var(--pdf-line);
      }
      .pdf-summary-tiles{
        display:grid;grid-template-columns:1fr 1fr;gap:10px 12px;margin:0;padding:0;list-style:none;
      }
      .pdf-summary-tile{
        padding:12px 14px;border:0;border-radius:var(--pdf-radius-inner);background:#F7F9FC;min-width:0;
        -webkit-print-color-adjust:exact;print-color-adjust:exact;
      }
      .pdf-summary-tile__label{
        display:flex;align-items:center;gap:7px;margin:0;font-size:var(--pdf-fs-label);font-weight:600;
        color:#86868b;letter-spacing:0.06em;text-transform:uppercase;line-height:1.3;
      }
      .pdf-summary-tile__label::before{
        content:"";width:7px;height:7px;border-radius:999px;background:#cbd5e1;flex-shrink:0;
        -webkit-print-color-adjust:exact;print-color-adjust:exact;
      }
      .pdf-summary-tile--ok .pdf-summary-tile__label::before{background:#16a34a;}
      .pdf-summary-tile--warn .pdf-summary-tile__label::before{background:#FFC107;}
      .pdf-summary-tile--alert .pdf-summary-tile__label::before{background:#FF4D4D;}
      .pdf-summary-tile--ok{background:#F5FBF7;}
      .pdf-summary-tile--warn{background:#FFFCF3;}
      .pdf-summary-tile--alert{background:#FFF7F7;}
      .pdf-summary-tile__value{
        margin:6px 0 0;font-size:18px;font-weight:700;color:#0f172a;line-height:1.2;letter-spacing:-0.01em;
      }
      .pdf-summary-tile__note{margin:4px 0 0;font-size:var(--pdf-fs-table);color:#64748b;line-height:1.4;}
      .pdf-summary-tile__sep{
        display:inline-block;width:1px;height:0.75em;margin:0 0.7em;background:#94a3b8;vertical-align:0.14em;
        -webkit-print-color-adjust:exact;print-color-adjust:exact;
      }
      /* Gara teksta kartīte (manuālie ieraksti) — abas kolonnas, teksts vērtības vietā. */
      .pdf-summary-tile--wide{grid-column:1 / -1;}
      .pdf-summary-tile--wide .pdf-summary-tile__note{
        margin-top:6px;font-size:var(--pdf-fs-base);color:#3f4750;
      }
      .pdf-sources-checked-label{margin:14px 0 6px;}
      .pdf-sources-checked-grid{margin:0;padding:0;list-style:none;}
      .pdf-sources-checked-item{
        display:flex;align-items:center;gap:9px;padding:5px 0;border-bottom:1px solid var(--pdf-line-soft);
        font-size:var(--pdf-fs-base);line-height:1.35;
      }
      .pdf-sources-checked-item:last-child{border-bottom:none;}
      .pdf-sources-checked-name{flex:1;color:#0f172a;font-weight:500;}
      .pdf-sources-checked-count{color:#86868b;white-space:nowrap;font-size:var(--pdf-fs-table);}
      .pdf-src-count-badge{
        flex-shrink:0;padding:3px 9px;border-radius:999px;background:#F1F5F9;color:#475569;
        font-size:var(--pdf-fs-label);font-weight:600;letter-spacing:0.01em;line-height:1.3;white-space:nowrap;
        -webkit-print-color-adjust:exact;print-color-adjust:exact;
      }
      .pdf-src-count-badge--ok{background:#F5FBF7;color:#16a34a;}
      .provin-report-doc .pdf-src-zone{border-top:2px solid #94a3b8;}
      .pdf-sec-ico-wrap,
      .pdf-v1-panel-ico-wrap{
        display:inline-flex;align-items:center;justify-content:center;color:${PDF_BRAND_BLUE_HEX};flex-shrink:0;
        width:26px;height:26px;border-radius:999px;background:rgba(0,97,210,0.1);
        -webkit-print-color-adjust:exact;print-color-adjust:exact;
      }
      .pdf-sec-ico-wrap .pdf-ico{width:16px;height:16px;}
      .pdf-sec-ico-wrap--brand-logo{background:#fff;}
      .pdf-sec-ico-wrap .pdf-ico--brand-logo{width:16px;height:16px;object-fit:contain;display:block;}
      .pdf-source-section-body{width:100%;margin:0;padding:0;}
      .pdf-ltab-izzi{
        margin:0;padding:16px 14px 14px;border:1px solid var(--pdf-line);
        border-radius:var(--pdf-radius-inner);background:#FCFDFF;
        -webkit-print-color-adjust:exact;print-color-adjust:exact;
      }
      .pdf-ltab-izzi .pdf-ltab-loss-history{margin:12px 0 0;}
      .pdf-ltab-izzi-line{margin:0 0 4px;font-size:var(--pdf-fs-base);line-height:1.5;color:#0f172a;}
      .pdf-ltab-izzi-footer{margin:10px 0 0;font-size:9px;line-height:1.4;color:#94a3b8;}
      /* Viens apakšvirsrakstu stils visās sadaļās (CSDD, dīleris, LTAB, sludinājums, foto). */
      .pdf-subhead{
        display:flex;align-items:center;gap:7px;margin:16px 0 7px;
        font-size:var(--pdf-fs-label);font-weight:600;color:#86868b;
        letter-spacing:0.07em;text-transform:uppercase;line-height:1.3;
      }
      .pdf-subhead:first-child:not(.pdf-subhead--boxed){margin-top:0;}
      .pdf-subhead--flush{margin-top:0;}
      .pdf-subhead__ico{flex-shrink:0;line-height:0;color:#94a3b8;}
      .pdf-subhead__ico .pdf-ico{width:13px;height:13px;}
      .pdf-listing-analysis-stack{width:100%;}
      .pdf-listing-analysis-chunk{
        margin:0 0 8px;padding:8px 0;background:#fff;border-bottom:1px solid #f1f5f9;
      }
      .pdf-listing-analysis-stack > .pdf-report-comment-note{margin:0 0 10px;}
      .pdf-listing-analysis-stack > .pdf-subhead + .pdf-report-comment-note{margin-top:0;}
      .pdf-listing-photo-grid{
        display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:0 0 8px;
      }
      .pdf-listing-photo-grid--full{grid-template-columns:1fr;gap:12px;}
      .pdf-listing-photo-group{margin:0 0 14px;}
      .pdf-listing-photo-group:last-child{margin-bottom:0;}
      .pdf-subhead--photo{margin:0 0 6px;}
      .pdf-listing-photo-cell{margin:0;break-inside:avoid;}
      .pdf-listing-photo-img{
        width:100%;height:auto;max-height:220px;object-fit:contain;
        border-radius:6px;border:1px solid #e2e8f0;display:block;background:#f8fafc;
      }
      .pdf-listing-photo-grid--full .pdf-listing-photo-img{
        max-height:none;width:100%;height:auto;object-fit:contain;
      }
      .pdf-listing-history-frame{
        border:1px solid var(--pdf-line);
        border-radius:var(--pdf-radius-inner);
        background:#fff;
        padding:var(--pdf-pad-inner);
      }
      .pdf-listing-analysis-chunk:last-child{margin-bottom:0;border-bottom:none;}
      .pdf-listing-analysis-chunk-pre{margin:0;}
      .pdf-unified-mileage-zone{margin:0 0 var(--pdf-gap-section);padding:var(--pdf-pad-outer);background:#fff!important;border:1px solid var(--pdf-line);border-radius:var(--pdf-radius-outer);box-shadow:var(--pdf-shadow);}
      .pdf-unified-mileage-zone .pdf-sec-head{margin-top:0;}
      .pdf-provin-sources-wrap{margin:0 0 var(--pdf-gap-section);}
      h2.pdf-sec--provin-sources{text-transform:uppercase;letter-spacing:0.06em;}
      .pdf-provin-sources-wrap .pdf-v1-kv td:last-child{text-align:right;font-weight:600;}
      .pdf-v1-panel-title--provin-sources{
        text-transform:none;
        letter-spacing:0.02em;
        color:#0f172a;
        font-size:0.9rem;
        font-weight:700;
        line-height:1.3;
      }
      .pdf-provin-sources-wrap .pdf-provin-sources-total td{
        padding-top:8px;
        color:#0f172a;
        font-weight:700;
        border-bottom:none;
      }
      .pdf-provin-sources-wrap .pdf-provin-sources-total td:first-child{
        color:#0f172a;
        font-weight:700;
      }
      .pdf-listing-analysis-root.pdf-surface-card{
        border:1px solid var(--pdf-line);border-radius:var(--pdf-radius-outer);
        box-shadow:var(--pdf-shadow);
        -webkit-print-color-adjust:exact;print-color-adjust:exact;
      }
      .pdf-unified-incidents-zone{margin:0 0 var(--pdf-gap-section);padding:var(--pdf-pad-outer);background:#fff!important;border:1px solid var(--pdf-line);border-radius:var(--pdf-radius-outer);box-shadow:var(--pdf-shadow);}
      .pdf-unified-incidents-zone .pdf-sec-head{margin-top:0;}
      .pdf-unified-incidents-zone__body > .pdf-report-comment-note:last-child,
      .pdf-unified-mileage-zone__body > .pdf-report-comment-note:last-child{
        margin-bottom:0;
      }
      .pdf-mileage-history-table--incidents tbody tr.pdf-mileage-history-row:nth-child(4n+1),
      .pdf-mileage-history-table--incidents tbody tr.pdf-mileage-history-row:nth-child(4n+2){
        background:#fafbfc;
      }
      .pdf-source-section-body > .pdf-report-comment-note:first-child{margin-top:0;}
      .pdf-report-comment-note,
      .pdf-incident-internal-note,
      .pdf-mileage-comment-note{
        margin:12px 0 0;padding:var(--pdf-pad-inner);border:1px solid #E4EDFA;
        border-left:3px solid #C6DAF6;border-radius:var(--pdf-radius-inner);background:#F6FAFF;
        -webkit-print-color-adjust:exact;print-color-adjust:exact;
      }
      .pdf-report-comment-note .pdf-subhead{margin:0 0 5px;}
      .pdf-report-comment-note-body,
      .pdf-incident-internal-note-body,
      .pdf-mileage-comment-note-body{margin:0;font-size:11px;line-height:1.55;color:#0f172a;font-family:Inter,sans-serif!important;}
      .pdf-report-comment-note-body strong, .pdf-report-comment-note-body b,
      .pdf-incident-internal-note-body strong, .pdf-incident-internal-note-body b,
      .pdf-mileage-comment-note-body strong, .pdf-mileage-comment-note-body b{font-weight:700;}
      .pdf-report-comment-note-body em, .pdf-report-comment-note-body i,
      .pdf-incident-internal-note-body em, .pdf-incident-internal-note-body i,
      .pdf-mileage-comment-note-body em, .pdf-mileage-comment-note-body i{font-style:italic;}
      .pdf-report-comment-note-body u,
      .pdf-incident-internal-note-body u,
      .pdf-mileage-comment-note-body u{text-decoration:underline;}
      .pdf-report-comment-note-body s, .pdf-report-comment-note-body del,
      .pdf-incident-internal-note-body s, .pdf-incident-internal-note-body del,
      .pdf-mileage-comment-note-body s, .pdf-mileage-comment-note-body del{text-decoration:line-through;}
      /* Krāsas un marķiera izcēlums drukā pazūd bez print-color-adjust. */
      .pdf-report-comment-note-body span, .pdf-report-comment-note-body mark,
      .pdf-incident-internal-note-body span, .pdf-incident-internal-note-body mark,
      .pdf-mileage-comment-note-body span, .pdf-mileage-comment-note-body mark{
        -webkit-print-color-adjust:exact;print-color-adjust:exact;
      }
      .pdf-report-comment-note-body mark,
      .pdf-incident-internal-note-body mark,
      .pdf-mileage-comment-note-body mark{background:#fde68a;color:inherit;}
      .pdf-report-comment-note-body span[style*="background"],
      .pdf-incident-internal-note-body span[style*="background"],
      .pdf-mileage-comment-note-body span[style*="background"]{
        padding:0 2px;border-radius:2px;box-decoration-break:clone;-webkit-box-decoration-break:clone;
      }
      .pdf-mileage-dual{
        display:grid;grid-template-columns:1fr 1fr;gap:10px 12px;align-items:start;margin:8px 0 0;
      }
      .pdf-mileage-dual__cell{min-width:0;}
      .pdf-mileage-smart-note{
        margin:8px 0 0;font-size:0.62rem;color:#64748b;line-height:1.45;font-style:italic;
      }
      .pdf-mileage-smart-note__ico{
        display:inline-block;vertical-align:-2px;margin-right:5px;
      }
      .pdf-mileage-smart-note__ico svg{width:10px;height:10px;}
      .pdf-mileage-history-table-wrap{
        width:100%;margin:6px 0 0;border-radius:6px;overflow:hidden;border:1px solid #f1f5f9;
        -webkit-print-color-adjust:exact;print-color-adjust:exact;
      }
      .pdf-mileage-history-table{
        width:100%;border-collapse:collapse;table-layout:fixed;
        font-family:Inter,sans-serif!important;font-size:11px;line-height:1.35;
        -webkit-font-feature-settings:"tnum" 1;font-feature-settings:"tnum" 1;
      }
      .pdf-mileage-history-table col.pdf-mileage-col-date{width:33.333%;}
      .pdf-mileage-history-table col.pdf-mileage-col-odo{width:33.334%;}
      .pdf-mileage-history-table col.pdf-mileage-col-flag{width:33.333%;}
      .pdf-mileage-history-table--mileage-rows col.pdf-mileage-col-date{width:24%!important;}
      .pdf-mileage-history-table--mileage-rows col.pdf-mileage-col-odo{width:36%!important;}
      .pdf-mileage-history-table--mileage-rows col.pdf-mileage-col-src{width:10%!important;}
      .pdf-mileage-history-table--mileage-rows col.pdf-mileage-col-flag{width:30%!important;}
      .pdf-mileage-history-table thead th{
        font-weight:700!important;color:#64748b!important;
        letter-spacing:0.04em!important;text-transform:none;
        padding:8px 10px 6px 10px!important;border-bottom:1px solid #E0E0E0!important;
        font-family:Inter,sans-serif!important;font-size:11px!important;
        vertical-align:bottom!important;
      }
      .pdf-mileage-history-table.pdf-mileage-history-table--mileage-rows thead th{
        vertical-align:middle!important;
      }
      .pdf-mileage-history-table tbody td{
        padding:7px 10px!important;border-bottom:1px solid #E0E0E0!important;
        border-left:none!important;border-right:none!important;border-top:none!important;
        font-family:Inter,sans-serif!important;font-size:11px!important;
        vertical-align:middle!important;
      }
      .pdf-mileage-history-table tbody tr:nth-child(even):not(.pdf-mileage-history-row--anomaly){
        background:#f9fafb!important;
        -webkit-print-color-adjust:exact;print-color-adjust:exact;
      }
      .pdf-mileage-history-row--anomaly td{
        background:#FFF1F2!important;
        -webkit-print-color-adjust:exact;print-color-adjust:exact;
      }
      .pdf-mileage-history-row--anomaly td.pdf-mileage-cell-date{
        box-shadow:inset 3px 0 0 #FF4D4D;
      }
      .pdf-mileage-history-table th.pdf-mileage-th-date{text-align:left!important;}
      .pdf-mileage-history-table th.pdf-mileage-th-odo{text-align:center!important;}
      .pdf-mileage-history-table th.pdf-mileage-th-src{text-align:center!important;}
      .pdf-mileage-history-table th.pdf-mileage-th-flag{text-align:right!important;}
      .pdf-mileage-history-table.pdf-mileage-history-table--mileage-rows th.pdf-mileage-th-src{
        text-align:center!important;vertical-align:middle!important;
        padding-left:4px!important;padding-right:4px!important;
      }
      .pdf-mileage-history-table td.pdf-mileage-cell-date{
        color:#374151!important;font-weight:500!important;white-space:nowrap;text-align:left!important;
      }
      .pdf-mileage-history-table td.pdf-mileage-cell-odo{text-align:center!important;}
      .pdf-mileage-history-table td.pdf-mileage-cell-src{
        text-align:center!important;vertical-align:middle!important;
        padding:7px 4px!important;
      }
      .pdf-mileage-history-table.pdf-mileage-history-table--mileage-rows td.pdf-mileage-cell-src{
        text-align:center!important;vertical-align:middle!important;
        padding:7px 4px!important;
      }
      .pdf-mileage-history-table.pdf-mileage-history-table--mileage-rows .pdf-mileage-cell-src-inner{
        display:flex!important;justify-content:center!important;align-items:center!important;
        width:100%!important;margin:0 auto!important;box-sizing:border-box!important;
      }
      .pdf-src-dot{
        display:inline-block;width:8px;height:8px;border-radius:999px;flex-shrink:0;background:#64748B;
        vertical-align:middle;
        -webkit-print-color-adjust:exact;print-color-adjust:exact;
      }
${sourceDotColorCss()}
      .pdf-src-dots{
        display:inline-flex;align-items:center;justify-content:center;vertical-align:middle;
        flex-wrap:nowrap;flex-shrink:0;gap:4px;
      }
      .pdf-src-tag{display:inline-flex;align-items:center;gap:6px;line-height:1.3;}
      .pdf-src-tag__name{font-weight:600;color:#475569;}
      .pdf-src-tag__val{color:#0f172a;font-weight:600;}
      .pdf-src-tags{display:flex;flex-wrap:wrap;gap:3px 14px;margin:0;padding:0;list-style:none;}
      .pdf-src-tags__item{font-size:var(--pdf-fs-table);}
      .pdf-src-legend{
        display:flex;flex-wrap:wrap;gap:4px 16px;margin:8px 0 0;padding:0;list-style:none;
        font-size:var(--pdf-fs-table);
      }
      .pdf-mileage-history-table td.pdf-mileage-cell-loss{
        text-align:center!important;
      }
      .pdf-mileage-history-table td.pdf-mileage-cell-loss .pdf-data-alert-wrap{
        display:inline-flex!important;
        align-items:center!important;
        justify-content:center!important;
        flex-wrap:wrap!important;
        gap:8px!important;
        max-width:100%!important;
        text-align:center!important;
        vertical-align:middle!important;
      }
      .pdf-mileage-history-table td.pdf-mileage-cell-flag{
        text-align:right!important;vertical-align:middle!important;
      }
      .pdf-service-works-zone{margin:12px 0 0;}
      .pdf-mileage-history-table--service col.pdf-service-col-date{width:14%!important;}
      .pdf-mileage-history-table--service col.pdf-service-col-odo{width:16%!important;}
      .pdf-mileage-history-table--service col.pdf-service-col-place{width:24%!important;}
      .pdf-mileage-history-table--service col.pdf-service-col-works{width:46%!important;}
      .pdf-mileage-history-table--service thead th{vertical-align:middle!important;}
      .pdf-mileage-history-table--service th.pdf-service-th-place,
      .pdf-mileage-history-table--service th.pdf-service-th-works{text-align:left!important;}
      .pdf-mileage-history-table--service td.pdf-service-cell-place{
        text-align:left!important;color:#1d1d1f!important;
      }
      .pdf-mileage-history-table--service tbody td{vertical-align:top!important;}
      .pdf-mileage-history-table--service td.pdf-mileage-cell-odo{
        text-align:left!important;color:#1d1d1f!important;white-space:nowrap;
      }
      .pdf-mileage-history-table--service th.pdf-mileage-th-odo{text-align:left!important;}
      .pdf-mileage-history-table--service td.pdf-service-cell-works{
        text-align:left!important;white-space:normal!important;color:#0f172a!important;
        line-height:1.5!important;overflow-wrap:break-word;word-break:break-word;
      }
      .pdf-mileage-history-table--service tbody tr{page-break-inside:avoid;break-inside:avoid;}
      .pdf-service-chip-cat{color:#64748B!important;font-weight:500;}
      .pdf-service-chip{
        display:inline-flex!important;align-items:center;gap:3px;
        margin:0 6px 2px 0;white-space:nowrap;
      }
      .pdf-service-chip:not(:last-child)::after{content:",";margin-left:-3px;color:#0f172a;}
      .pdf-service-chip-ico{
        display:inline-flex!important;align-items:center;justify-content:center;
        color:#0061D2!important;flex:none;
      }
      .pdf-service-chip-ico svg{display:block;}
      .pdf-mileage-odo-value{color:#1d1d1f;font-weight:500;}
      .pdf-country-flag-wrap{
        display:inline-flex;align-items:center;justify-content:flex-end;gap:8px;
        font-family:Inter,sans-serif!important;font-size:11px!important;
        font-weight:500!important;color:#374151!important;line-height:1.2;
      }
      .pdf-country-flag{
        font-style:normal;font-variant:normal;letter-spacing:0;
        font-size:1.2075em;line-height:1;display:inline-flex;align-items:center;justify-content:center;
        flex-shrink:0;
        font-family:"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",Inter,sans-serif;
        -webkit-print-color-adjust:exact;print-color-adjust:exact;
      }
      .pdf-country-code{
        letter-spacing:0.04em;font-variant-numeric:tabular-nums;text-transform:uppercase;
        font-family:Inter,sans-serif!important;font-size:11px!important;font-weight:500!important;
        color:#374151!important;
      }
      .pdf-mileage-chart-wrap{
        margin:0 0 10px;padding:8px 10px 4px;border-radius:8px;border:1px solid #f1f5f9;background:#fff;
        box-shadow:0 1px 3px rgba(15,23,42,.04);
        -webkit-print-color-adjust:exact;print-color-adjust:exact;
      }
      .pdf-mileage-chart-wrap--compact .pdf-mileage-chart-svg{max-height:120px;}
      .pdf-mileage-chart-svg{display:block;width:100%;max-width:480px;height:auto;margin:0 auto;}
      .pdf-mileage-chart-grid{stroke:${PDF_MILEAGE_CHART_GRID};stroke-width:1;fill:none;}
      .pdf-mileage-chart-path{
        stroke:${PDF_MILEAGE_CHART_LINE};stroke-width:2.5;fill:none;stroke-linecap:round;stroke-linejoin:round;
      }
      .pdf-mileage-chart-year-band{
        fill:rgba(239,68,68,0.12);stroke:none;
        -webkit-print-color-adjust:exact;print-color-adjust:exact;
      }
      .pdf-mileage-chart-dot{
        fill:#fff;stroke:${PDF_MILEAGE_CHART_LINE};stroke-width:1.75;
        -webkit-print-color-adjust:exact;print-color-adjust:exact;
      }
      .pdf-mileage-chart-year{
        fill:${PDF_MILEAGE_CHART_AXIS};font-family:Inter,sans-serif;font-size:8px;font-weight:500;
      }
      .pdf-mileage-chart-wrap--compact .pdf-mileage-chart-year{font-size:7.5px;}
      .pdf-mileage-chart-legend{
        display:flex;align-items:center;gap:6px;padding:0 10px 8px 12px;
        font-size:var(--pdf-fs-table);color:#64748b;
      }
      .pdf-mileage-chart-legend-line{
        display:inline-block;width:14px;height:3px;border-radius:2px;background:${PDF_MILEAGE_CHART_LINE};
        flex-shrink:0;
        -webkit-print-color-adjust:exact;print-color-adjust:exact;
      }
      .pdf-mileage-chart-legend-text{font-weight:600;color:#475569;}
      .pdf-source-count-note{
        margin:8px 0 0;
        font-size:0.62rem;
        color:#64748b;
        line-height:1.4;
      }
      .pdf-source-count-note--mileage{
        font-size:9.5px!important;
        line-height:1.35!important;
        letter-spacing:0!important;
        color:#64748b!important;
      }
      .pdf-mileage-source-count-title{
        display:block!important;
        margin:0!important;
        font-weight:500!important;
      }
      .pdf-mileage-chart-rollback{
        stroke:#ef4444!important;stroke-width:3!important;stroke-linecap:round;fill:none;opacity:0.95;
        -webkit-print-color-adjust:exact;print-color-adjust:exact;
      }
      .pdf-mileage-chart-wrap--has-anomaly .pdf-mileage-chart-path{stroke-width:2.6;}
      .pdf-mileage-chart-legend-anomaly{
        display:inline-flex;align-items:center;gap:5px;margin-left:14px;
      }
      .pdf-mileage-chart-legend-rollback{
        display:inline-block;width:14px;height:3px;border-radius:2px;background:#ef4444;
        flex-shrink:0;
        -webkit-print-color-adjust:exact;print-color-adjust:exact;
      }
      .pdf-src-mileage-spark{
        margin:0 0 10px;padding:2px 0 0;
        -webkit-print-color-adjust:exact;print-color-adjust:exact;
      }
      .pdf-src-mileage-spark-svg{display:block;width:100%;max-width:480px;height:auto;margin:0 auto;}
      .pdf-src-mileage-spark-grid{stroke:#e8eaed;stroke-width:1;fill:none;opacity:0.7;}
      .pdf-src-mileage-spark-ghost{
        stroke:#94A3B8;stroke-width:1.8;opacity:0.38;fill:none;stroke-linecap:round;stroke-linejoin:round;
      }
      .pdf-src-mileage-spark-path{
        stroke-width:2.5;fill:none;stroke-linecap:round;stroke-linejoin:round;
      }
      .pdf-src-mileage-spark-date{
        font-family:Inter,sans-serif;font-size:8px;font-weight:600;
      }
      .pdf-data-alert-wrap{
        display:inline-flex;align-items:center;gap:8px;max-width:100%;vertical-align:middle;
      }
      .pdf-data-alert-ico{flex-shrink:0;display:block;line-height:0;}
      .pdf-csdd-alert-wrap{
        display:flex;align-items:center;gap:8px;width:100%;
      }
      .pdf-num-warn{font-size:var(--pdf-fs-table)!important;line-height:1.2;font-family:Inter,sans-serif!important;vertical-align:middle;}
      .pdf-num-warn--yellow .pdf-num-warn-digits{
        color:#000!important;font-weight:600!important;
      }
      .pdf-num-warn--red .pdf-num-warn-digits{
        color:#B91C1C!important;font-weight:700!important;
      }
      .pdf-loss-amt-ico,.pdf-warn-tri-ico{flex-shrink:0;display:block;width:13px;height:13px;}
      .pdf-warn-tri-ico--lg{width:17px!important;height:17px!important;}
      .pdf-price-drop-wrap{display:inline-flex;align-items:center;gap:6px;vertical-align:middle;}
      .pdf-price-drop-val{color:#000!important;font-weight:600!important;}
      .pdf-price-drop-ico{display:inline-flex;align-items:center;justify-content:center;line-height:0;}
      .pdf-price-drop-arrow{flex-shrink:0;display:block;width:17px;height:17px;}
      .pdf-listing-price-history,.pdf-ltab-loss-history{margin:0 0 10px;border:1px solid var(--pdf-line);border-radius:var(--pdf-radius-inner);overflow:hidden;background:#fff;}
      /* Sludinājuma cenu vēsture — smalks zaļgans tonis (ss.lv iedvesmots), bez pilna fona akcenta. */
      .pdf-listing-price-history--tirgus{
        border-color:#DCEFE1;background:#FBFEFC;
        -webkit-print-color-adjust:exact;print-color-adjust:exact;
      }
      .pdf-listing-price-history--tirgus .pdf-subhead--boxed{color:#15803D;}
      /* LTAB zaudējumu tabula — smalks sarkans tonis, jo rinda parādās tikai ar fiksētu negadījumu. */
      .pdf-ltab-loss-history{
        border-color:#F6D9D9;background:#FFFBFB;
        -webkit-print-color-adjust:exact;print-color-adjust:exact;
      }
      .pdf-ltab-loss-history .pdf-subhead--boxed{color:#B91C1C;}
      /* Specifiskāks par .pdf-subhead:first-child — citādi virsraksts pielīp pie kartītes malas. */
      .pdf-subhead.pdf-subhead--boxed{margin:14px 12px 6px;}
      .pdf-listing-price-history-table{width:100%;border-collapse:collapse;font-size:var(--pdf-fs-table);font-weight:600;color:#0f172a;}
      .pdf-listing-price-history-table td{padding:7px 12px;border-bottom:1px solid var(--pdf-line-soft);width:33.33%;font-variant-numeric:tabular-nums;}
      .pdf-listing-price-history-table tr:last-child td{border-bottom:none;}
      .pdf-listing-price-history-table td:nth-child(2){text-align:center;}
      .pdf-listing-price-history-table td:last-child{text-align:right;color:#64748b;font-weight:500;}
      .pdf-listing-price-delta{margin-left:4px;font-size:0.62rem;font-weight:600;}
      .pdf-listing-price-delta--down{color:#059669;}
      .pdf-listing-price-delta--up{color:#dc2626;}
      .pdf-listing-price-delta--note{color:#64748b;font-weight:500;}
      .pdf-incident-source-vals{display:block;margin-top:3px;font-size:0.62rem;font-weight:500;color:#64748b;line-height:1.35;}
      .pdf-incident-count{
        display:inline-flex;align-items:center;justify-content:center;height:28px;padding:0 12px;
        border-radius:999px;background:#fff;color:#DC2626;border:1.5px solid #DC2626;
        font-size:13px;font-weight:700;line-height:1;letter-spacing:0;white-space:nowrap;
        -webkit-print-color-adjust:exact;print-color-adjust:exact;
      }
      .pdf-incident-history-card{padding:0;}
      .pdf-incident-card{padding:22px 16px 6px;border-bottom:1px solid var(--pdf-line-soft);break-inside:avoid;page-break-inside:avoid;}
      .pdf-incident-card:last-of-type{border-bottom:none;}
      .pdf-incident-card__main{
        display:grid;grid-template-columns:84px 96px minmax(0,1fr);gap:12px 22px;align-items:center;
      }
      .pdf-incident-card__datecol{display:flex;flex-direction:column;gap:4px;min-width:0;}
      .pdf-incident-card__date{
        font-size:var(--pdf-fs-base);font-weight:700;color:#0f172a;white-space:nowrap;
        font-variant-numeric:tabular-nums;
      }
      .pdf-incident-card__car .pdf-dmg-sil{width:96px;}
      .pdf-incident-card__facts{min-width:0;}
      .pdf-incident-card__amount{font-size:24px;font-weight:800;color:#0f172a;line-height:1.1;letter-spacing:-0.03em;}
      .pdf-incident-card__amount .pdf-num-warn{font-size:24px!important;}
      .pdf-incident-card__amount .pdf-num-warn-digits{font-size:24px;font-weight:800!important;letter-spacing:-0.03em;}
      .pdf-incident-card__country{
        display:flex;align-items:center;gap:6px;font-size:11px;font-weight:500;color:#64748b;
        white-space:nowrap;
      }
      .pdf-incident-card__country .pdf-country-flag{font-size:13px;line-height:1;}
      .pdf-incident-chips{display:flex;flex-wrap:wrap;gap:6px;margin:12px 0 0;padding:0;list-style:none;}
      .pdf-incident-chips li{
        margin:0;padding:3px 8px;border-radius:999px;border:1px solid #E2E8F0;background:#F8FAFC;
        color:#475569;font-size:11px;font-weight:600;line-height:1.3;
        -webkit-print-color-adjust:exact;print-color-adjust:exact;
      }
      .pdf-incident-card__srcs{margin:16px 0 0;padding:8px 0 12px;border-top:1px solid #F1F5F9;}
      .pdf-dmg-sil{display:block;width:120px;height:auto;max-width:100%;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
      .pdf-listing-price-history-foot{
        display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;
        background:#F7F9FC;border-top:1px solid var(--pdf-line-soft);
        padding:8px 12px;font-size:var(--pdf-fs-table);color:#64748b;font-weight:500;
        -webkit-print-color-adjust:exact;print-color-adjust:exact;
      }
      .pdf-listing-price-history-foot strong{font-weight:700;color:#0f172a;}
      .pdf-listing-price-history-foot strong.pdf-stat-tone--down{color:#059669;}
      .pdf-listing-price-history-foot strong.pdf-stat-tone--up{color:#dc2626;}
      .pdf-listing-price-history-foot strong.pdf-stat-tone--alert{color:#B91C1C;}
      .pdf-listing-price-history--tirgus .pdf-listing-price-history-foot{
        background:#F2FBF6;border-top-color:#DCEFE1;
      }
      .pdf-ltab-loss-history .pdf-listing-price-history-foot,
      .pdf-incident-history-card .pdf-listing-price-history-foot{
        background:#FDF4F4;border-top-color:#F6D9D9;
      }
      .mirror-block{margin:0 0 10px;padding:0 0 8px;border-bottom:1px solid #f1f5f9;}
      .mirror-block.pdf-surface-card{border-bottom:none;padding-bottom:0;margin-bottom:12px;}
      .mirror-block-head{display:flex;align-items:center;gap:8px;margin:0 0 6px;}
      .mirror-ico{color:${PDF_BRAND_BLUE_HEX};}
      .mirror-ico .pdf-ico{width:14px;height:14px;}
      .mirror-pre{
        white-space:pre-wrap;font-size:0.72rem;margin:0;padding:0;font-family:Inter,sans-serif!important;
        color:#1d1d1f;line-height:1.45;
      }
      .mirror-pre.pdf-manual-comment-body{
        display:block;
        box-sizing:border-box;
        width:100%;
        max-width:100%;
        margin:4px 0 0;
        padding:var(--pdf-pad-inner);
        border:1px solid #E4EDFA;
        border-left:3px solid #C6DAF6;
        border-radius:var(--pdf-radius-inner);
        background:#F6FAFF;
        font-size:calc(0.72rem + 1px)!important;
        font-weight:595!important;
        font-style:normal!important;
        line-height:1.45;
        color:#1d1d1f;
        white-space:pre-wrap;
        font-family:Inter,sans-serif!important;
        -webkit-print-color-adjust:exact;print-color-adjust:exact;
      }
      .pdf-listing-analysis-chunk .mirror-pre.pdf-manual-comment-body{margin-top:6px;}
      .pdf-iriss-approved .mirror-pre.pdf-manual-comment-body{
        background:#fff!important;
      }
      .provin-report-doc .pdf-iriss-approved{
        border:1px solid #B6D2F6!important;background:#F3F8FF!important;
        box-shadow:0 2px 10px rgba(0,97,210,0.10)!important;
      }
      .pdf-iriss-approved .pdf-sec-head--brand{border-bottom-color:#CFE0FA;}
      .pdf-iriss-approved h2.pdf-sec{font-size:15px;}
      .pdf-iriss-approved .pdf-sec-ico-wrap{background:${PDF_BRAND_BLUE_HEX}!important;}
      .pdf-iriss-approved .pdf-sec-ico-wrap .pdf-ico{color:#fff!important;}
      .pdf-iriss-approved .pdf-report-comment-note{
        background:#fff!important;border-color:#DCE8F8!important;border-left-color:${PDF_BRAND_BLUE_HEX}!important;
      }
      .pdf-iriss-approved .pdf-subhead{color:#0f172a;}
      .mirror-line{font-size:0.72rem;margin:0.25rem 0;line-height:1.45;}
      /* Faktu saraksti (CSDD, dīleris, transportlīdzekļa dati) — viena režģa un tipogrāfijas valoda. */
      .mirror-table{width:100%;border-collapse:collapse;font-size:var(--pdf-fs-table);margin:0;}
      .mirror-table td,.mirror-table th{
        padding:7px 0;border-bottom:1px solid var(--pdf-line-soft);vertical-align:top;text-align:left;
        line-height:1.45;
      }
      .mirror-table tr:last-child td{border-bottom:none;}
      .mirror-table thead th{
        font-size:var(--pdf-fs-label);font-weight:600;color:#86868b;text-transform:uppercase;letter-spacing:0.06em;
      }
      .mirror-table td:first-child{width:38%;color:#86868b;font-weight:500;padding-right:12px;}
      .mirror-table td:nth-child(2){color:#0f172a;}
      .mirror-table--csdd td.pdf-csdd-alert-td{
        width:100%!important;max-width:none!important;padding:5px 0!important;
      }
      .pdf-csdd-alert{
        flex:1;display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:4px;font-size:var(--pdf-fs-table)!important;line-height:1.25;
        border:1px solid #e8eaed;background:#fff;
        -webkit-print-color-adjust:exact;print-color-adjust:exact;
      }
      .pdf-csdd-alert--red{border-left:3px solid #FF4D4D;}
      .pdf-csdd-alert--yellow{border-left:3px solid #FFC107;}
      .pdf-csdd-alert-label{width:38%;color:#86868b;font-weight:500;white-space:nowrap;}
      .pdf-csdd-alert-val{color:#0f172a;text-align:left;flex:1;min-width:0;}
      .mirror-table--csdd td.pdf-csdd-tech-compact{
        width:auto;max-width:none;white-space:normal;padding:5px 0 6px;
        font-size:var(--pdf-fs-table);line-height:1.35;color:#0f172a;text-align:left;
      }
      .pdf-csdd-tech-line{font-size:var(--pdf-fs-table);line-height:1.25;margin:0 0 3px;}
      .pdf-csdd-tech-line:last-child{margin-bottom:0;}
      .pdf-csdd-tech-bit{color:#1d1d1f;}
      .mirror-pre--csdd-dense{font-size:var(--pdf-fs-table)!important;line-height:1.3!important;margin:0 0 4px!important;}
      .mirror-table--csdd-defect-current{font-size:var(--pdf-fs-table)!important;margin:2px 0 6px!important;}
      .mirror-table--csdd-defect-current td,.mirror-table--csdd-defect-current th{padding:3px 5px!important;line-height:1.25!important;border-bottom:1px solid #f1f5f9!important;}
      .mirror-table--csdd-defect-historic{font-size:var(--pdf-fs-table)!important;margin:2px 0 4px!important;color:#64748b!important;}
      .mirror-table--csdd-defect-historic td,.mirror-table--csdd-defect-historic th{
        padding:3px 4px!important;line-height:1.25!important;border-bottom:1px solid #eef2f7!important;
        color:#64748b!important;
      }
      .mirror-table--csdd-defect-historic .pdf-csdd-defect-rating--1{color:#16a34a!important;font-weight:700;}
      .mirror-table--csdd-defect-historic .pdf-csdd-defect-rating--2{color:#d97706!important;font-weight:700;}
      .mirror-table--csdd-defect-historic .pdf-csdd-defect-rating--3{color:#dc2626!important;font-weight:700;}
      .mirror-table--csdd-mh{font-size:var(--pdf-fs-table)!important;margin:2px 0 4px!important;}
      .mirror-table--csdd-mh td,.mirror-table--csdd-mh th{padding:3px 4px!important;line-height:1.25!important;border-bottom:1px solid #f1f5f9!important;}
      .mirror-table--csdd-mh thead th{font-size:var(--pdf-fs-table)!important;}
      .pdf-csdd-ta-section{margin-top:14px;}
      .pdf-csdd-ta-table-wrap{display:flex;flex-direction:column;gap:10px;}
      .pdf-csdd-ta-year-block{break-inside:avoid;page-break-inside:avoid;margin:0 0 10px;}
      /* Gads pie apskatēm — tā pati zilā skaitļa valoda kā laikposmā. */
      .pdf-csdd-ta-year-heading{
        margin:0 0 5px;font-size:13px;font-weight:700;letter-spacing:0.06em;color:${PDF_BRAND_BLUE_HEX};
        font-variant-numeric:tabular-nums;
      }
      .pdf-csdd-ta-year-frame{
        padding:var(--pdf-pad-inner);border:1px solid var(--pdf-line);border-radius:var(--pdf-radius-inner);
        background:#FCFDFF;
        -webkit-print-color-adjust:exact;print-color-adjust:exact;
      }
      .pdf-csdd-ta-warnings{margin:0 0 8px;display:flex;flex-direction:column;gap:6px;}
      .pdf-csdd-ta-warnings:last-child{margin-bottom:0;}
      .pdf-csdd-ta-warn{
        margin:0;padding:6px 8px;border-radius:4px;font-size:var(--pdf-fs-table);line-height:1.35;
        -webkit-print-color-adjust:exact;print-color-adjust:exact;
      }
      .pdf-csdd-ta-warn--gray{border-left:3px solid #94a3b8;background:#f8fafc;color:#334155;}
      .pdf-csdd-ta-warn--yellow{border-left:3px solid #d97706;background:#fffbeb;color:#78350f;}
      .pdf-csdd-ta-warn--red{border-left:3px solid #dc2626;background:#fef2f2;color:#991b1b;}
      .pdf-csdd-ta-inspection{margin:0 0 8px;}
      .pdf-csdd-ta-inspection:last-child{margin-bottom:0;}
      .pdf-csdd-ta-inspection--historic{opacity:0.92;}
      .pdf-csdd-ta-inspection-meta{
        margin:0 0 3px;font-size:var(--pdf-fs-table);font-weight:600;line-height:1.3;color:#1d1d1f;
      }
      .pdf-csdd-ta-extras{margin:0 0 4px;}
      .mirror-table--csdd-defect-2col{table-layout:fixed;width:100%;}
      .mirror-table--csdd-defect-2col .pdf-csdd-defect-col-nov{width:2.25em;}
      .mirror-table--csdd-defect-2col .pdf-csdd-defect-col-desc{width:auto;}
      .pdf-csdd-defect-rating{
        width:2.25em;min-width:2.25em;max-width:2.75em;text-align:left!important;white-space:nowrap;
        padding:3px 12px 3px 0!important;
      }
      .pdf-csdd-defect-desc{text-align:left!important;white-space:normal;width:auto;padding:3px 0 3px 4px!important;}
      .pdf-csdd-defect-empty{color:#64748b;font-style:italic;}
      .pdf-csdd-defect-rating--1{color:#16a34a!important;font-weight:700;}
      .pdf-csdd-defect-rating--2{color:#d97706!important;font-weight:700;}
      .pdf-csdd-defect-rating--3{color:#dc2626!important;font-weight:700;}
      .mirror-table--csdd-defect-2col th:nth-child(1){
        width:2.25em;min-width:2.25em;text-align:left!important;white-space:nowrap;
        padding:3px 12px 3px 0!important;
      }
      .mirror-table--csdd-defect-2col th:nth-child(2){width:auto;text-align:left!important;padding:3px 0 3px 4px!important;}
      .mirror-table--csdd-defect-2col td.pdf-csdd-defect-rating{
        padding-right:12px!important;
      }
      .mirror-table--csdd-defect-2col td.pdf-csdd-defect-desc{
        padding-left:4px!important;
      }
      .pdf-csdd-owner-timeline{
        margin:14px 0 0;padding:var(--pdf-pad-inner);border-radius:var(--pdf-radius-inner);
        background:#FCFDFF;border:1px solid var(--pdf-line);
        -webkit-print-color-adjust:exact;print-color-adjust:exact;
      }
      .pdf-cv-subsection-title{
        margin:0 0 6px;font-size:var(--pdf-fs-label);font-weight:600;letter-spacing:0.07em;
        text-transform:uppercase;color:#86868b;
      }
      .pdf-csdd-owner-count{margin:0 0 6px;font-size:var(--pdf-fs-table);color:#1d1d1f;}
      .pdf-csdd-owner-events{display:flex;flex-direction:column;gap:3px;}
      .pdf-csdd-owner-event{display:flex;gap:8px;font-size:var(--pdf-fs-table);line-height:1.35;}
      .pdf-csdd-owner-date{min-width:72px;font-weight:600;color:#475569;}
      .pdf-csdd-owner-label{color:#1d1d1f;}
      .pdf-outvin-dealer-stack{margin:0;}
      .pdf-outvin-plain{font-size:var(--pdf-fs-base);line-height:1.5;color:#0f172a;margin:0;}
      .tabular{font-variant-numeric:tabular-nums;}
      .mirror-font-error{padding:16px;color:#991b1b;font-size:13px;}
${pdfDocFooterCss()}
      code{font-family:Inter,sans-serif!important;font-variant-numeric:normal!important;font-size:0.72rem;background:#f5f5f7;padding:1px 6px;border-radius:4px;}
      .pdf-vin{font-family:Inter,sans-serif!important;font-variant-numeric:normal!important;font-size:0.72rem;background:transparent;padding:0;}
      .pdf-flag-num{font-weight:600;}
      @media print{
        @page{margin:0;size:auto;}
        html,body{
          margin:0!important;
          padding:10mm 11mm!important;
          background:#fff!important;
          -webkit-print-color-adjust:exact!important;
          print-color-adjust:exact!important;
          color-adjust:exact!important;
        }
        body{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;}
        .no-print{display:none!important;}
        thead{display:table-header-group;}
        tfoot{display:table-footer-group;}
        .pdf-v1-panel--clean,.pdf-summary-tile,.pdf-doc-footer,.pdf-page-flow-chunk--avoid{
          break-inside:avoid-page!important;
          page-break-inside:avoid!important;
        }
      }
    ` +
    pdfLayoutDraftExtraCss() +
    CC_VIN_PDF_CSS +
    `
      .provin-report-doc .pdf-unified-mileage-zone.pdf-surface-card,
      .provin-report-doc .pdf-unified-incidents-zone.pdf-surface-card{
        margin:0 0 var(--pdf-gap-section)!important;padding:var(--pdf-pad-outer)!important;
        border:1px solid var(--pdf-line)!important;border-radius:var(--pdf-radius-outer)!important;
        background:#fff!important;box-shadow:var(--pdf-shadow)!important;
      }
    `;
}

export function buildClientReportDocumentHtml(args: {
  payload: ClientReportPayload;
  portfolio: ClientReportPortfolioRow[];
  pdfInsights: PdfPortfolioFileInsight[];
  dateFmt: Intl.DateTimeFormat;
  formatBytes: (n: number) => string;
  listingAnalysisPhotoDataUrls?: Map<string, string>;
  autoRecordsPhotoDataUrls?: Map<string, string>;
  ccVinPhotoDataUrls?: Map<string, string>;
}): string {
  const {
    payload: p,
    dateFmt,
    listingAnalysisPhotoDataUrls,
    autoRecordsPhotoDataUrls,
    ccVinPhotoDataUrls,
  } = args;
  const vis = mergePdfVisibility(p.pdfVisibility);

  const money =
    p.amountTotal == null
      ? "—"
      : new Intl.NumberFormat("lv-LV", { style: "currency", currency: p.currency ?? "EUR" }).format(
          p.amountTotal / 100,
        );

  const makeModel =
    extractVehicleMakeModel(p.csddForm?.rawUnprocessedData ?? "") ||
    extractVehicleMakeModel(p.csdd) ||
    null;

  const lines: string[] = [];
  lines.push('<div class="sheet">');
  lines.push('<header class="pdf-v1-hero">');
  lines.push('<div class="pdf-v1-hero-inner">');
  lines.push(provincLogoSvg());
  lines.push('<div class="pdf-v1-hero-text">');
  lines.push(`<h1 class="pdf-v1-doc-title">${escapeHtml(PDF_MAIN_TITLE)}</h1>`);
  {
    const vin = p.vin?.trim();
    const vinHtml = vin
      ? ` · VIN <span class="pdf-vin">${escapeHtml(vin)}</span>`
      : "";
    lines.push(`<p class="pdf-v1-meta">Ģenerēts: ${escapeHtml(dateFmt.format(new Date()))}${vinHtml}</p>`);
  }
  lines.push("</div></div></header>");

  // Viena kartīšu valoda kopsavilkumā: manuālās (admin) → automātiskie brīdinājumi → informatīvās.
  const summaryBannerTiles = vis.alerts
    ? buildPdfSummaryBannerTiles({
        manualBanners: mergeProvinManualBanners(p.manualBanners),
        alertBanners: filterAlertBannersForPdf(
          computeProvinAlertBannersFromPayloadSlice({
            csddForm: p.csddForm,
            autoRecordsBlock: p.autoRecordsBlock ?? null,
            ccVinBlock: p.ccVinBlock ?? null,
            manualVendorBlocks: p.manualVendorBlocks ?? null,
            citiAvotiBlock: p.citiAvoti ?? null,
            manualLtabBlock: p.manualLtabBlock ?? null,
            tirgusForm: p.tirgusForm ?? null,
            listingUrl: p.listingUrl ?? null,
          }),
          p.pdfBannerInclude,
        ),
        infoBanners: filterInfoBannersForPdf(
          computeProvinInfoBannersFromPayloadSlice({
            csddForm: p.csddForm,
            autoRecordsBlock: p.autoRecordsBlock ?? null,
            ccVinBlock: p.ccVinBlock ?? null,
            manualVendorBlocks: p.manualVendorBlocks ?? null,
            manualLtabBlock: p.manualLtabBlock ?? null,
            citiAvotiBlock: p.citiAvoti ?? null,
          }),
          p.pdfBannerInclude,
        ),
      })
    : [];
  lines.push(buildPdfReportSummaryHtml(p, summaryBannerTiles));

  const vehicleSpecHtml = buildPdfVehicleSpecSectionHtml(p.csddForm, p.vin, vis);
  if (vehicleSpecHtml) lines.push(vehicleSpecHtml);

  const provinSourcesStrip = buildProvinPdfSourcesUsedStripHtml(p, vis);
  if (provinSourcesStrip) lines.push(provinSourcesStrip);

  const aboutBlock = buildPdfAboutReportBlock({
    order: p,
    money,
    dateFmt,
    makeModel: vehicleSpecHtml ? null : makeModel,
    show: { payment: vis.payment, vehicle: vis.vehicle, client: vis.client, notes: vis.notes },
    titleIconHtml: sectionIconPdfHtml("fileText"),
  });
  if (aboutBlock) lines.push(aboutBlock);

  const lifecycleHtml = buildPdfLifecycleTimelineHtml(p, vis);
  if (lifecycleHtml) lines.push(lifecycleHtml);

  const mileageOpts: CollectUnifiedMileageOptions | undefined = vis.unifiedMileage
    ? {
        omitCsddMileage: !vis.csdd || !vis.csddMileageTable,
        omitAutoRecords: !vis.auto_records,
        omitCcVin: !vis.cc_vin,
        omitVendorBlockTitles: vendorTitlesOmittedForPdf(vis),
        omitListingMileage: !vis.sludinajums,
      }
    : undefined;
  const unifiedMileageHtml = vis.unifiedMileage ? buildUnifiedMileageTableHtml(p, mileageOpts) : "";
  if (unifiedMileageHtml) lines.push(unifiedMileageHtml);

  const unifiedIncidentsHtml = buildUnifiedIncidentsTableHtml(p, vis);
  if (unifiedIncidentsHtml) lines.push(unifiedIncidentsHtml);

  const avotuHtml = buildAvotuDatiSectionHtml(p, vis, autoRecordsPhotoDataUrls, ccVinPhotoDataUrls);
  if (avotuHtml) lines.push(avotuHtml);

  const listingPriorityHtml = buildListingAnalysisPriorityHtml(p, vis, listingAnalysisPhotoDataUrls);
  if (listingPriorityHtml) lines.push(listingPriorityHtml);

  const approvedHtml = buildApprovedByIrissHtml(p, vis);
  if (approvedHtml) lines.push(approvedHtml);

  if (p.isDemo) {
    lines.push('<p class="mirror-line"><strong>Demonstrācijas dati</strong> — daļa lauku ir parauga rakstura.</p>');
  }

  lines.push(
    '<p class="no-print" style="margin-top:12px"><button type="button" style="padding:7px 14px;font-size:12px;border-radius:6px;border:1px solid #94a3b8;background:#fff;color:#475569;cursor:pointer;font-family:Inter,sans-serif;font-weight:600" onclick="window.print()">Drukāt / PDF</button></p>',
  );

  lines.push(
    buildPdfDocFooterHtml({
      vin: p.vin,
      amountTotalCents: p.amountTotal,
      generatedLabel: `Ģenerēts ${dateFmt.format(new Date())}`,
    }),
  );
  lines.push("</div>");

  const vinForFile = (p.vin?.trim().replace(/[^A-Za-z0-9]/g, "_") || "nav_VIN").slice(0, 48);
  const docTitle = `Atskaite_${vinForFile}.pdf`;
  const html = `<!DOCTYPE html><html lang="lv"><head><meta charset="utf-8"/>
<meta name="color-scheme" content="light"/>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet"/>
<title>${escapeHtml(docTitle)}</title><style>${clientReportPrintCss()}</style></head><body class="provin-report-doc">${lines.join("\n")}${reportFontGuardScript()}</body></html>`;
  return html;
}
