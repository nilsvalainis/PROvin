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
  TIRGUS_LABEL_PRICE_DROP,
  tirgusFormHasContent,
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
  buildPdfAdminMirrorClientBlock,
  buildPdfAdminMirrorNotesBlock,
  buildPdfAdminMirrorPaymentBlock,
  buildPdfAdminMirrorVehicleBlock,
  pdfLayoutDraftExtraCss,
  pdfProvinWordmarkHtml,
  pdfV1PanelHead,
  PDF_BRAND_BLUE_HEX,
  provincLogoSvg,
} from "@/lib/client-report-pdf-layout-draft";
import { pdfCountryCodeLetters, pdfCountryFlagEmoji } from "@/lib/pdf-country-flags";
import {
  buildPdfAlertBannersHtml,
  buildPdfInfoBannersHtml,
  computeProvinAlertBannersFromPayloadSlice,
  computeProvinInfoBannersFromPayloadSlice,
  filterAlertBannersForPdf,
  filterInfoBannersForPdf,
} from "@/lib/provin-alert-banners";
import {
  sectionIconPdfHtml,
  vendorPdfTitleToIconId,
} from "@/lib/section-icons";
import {
  getClientReportLegalFooterBlocks,
} from "@/lib/report-pdf-standards";
import { buildUnifiedMileageChartWrapHtml } from "@/lib/unified-mileage-chart";
import {
  collectUnifiedIncidentRows,
  sortUnifiedIncidentsNewestFirst,
  type UnifiedIncidentRow,
} from "@/lib/unified-incidents";
import {
  MILEAGE_PDF_SOURCE_LEGEND,
  collectMileagePdfSourceKeysFromLabels,
  mileagePdfLegendKeysInOrder,
  mileageSourceLabelToPdfKey,
  type MileagePdfSourceKey,
} from "@/lib/pdf-mileage-source";
import {
  collectUnifiedMileageRows,
  computeOdometerAnomalyBySourceOrder,
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
  PDF_MILEAGE_HISTORY_COMMENT_LABEL,
} from "@/lib/admin-workspace-field-labels";
import { buildOwnerRegistrationTimelineHtml } from "@/lib/csdd-history-charts";
import { buildCarVerticalIncidentDamageSubHtml, buildCarVerticalTimelineHtml } from "@/lib/carvertical-report-html";
import { matchCarVerticalDamageDetail } from "@/lib/carvertical-damage-match";
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
const PDF_IRISS_SECTION_1 = "1. Ieteikumi klātienes apskatei";
const PDF_IRISS_SECTION_2 = "2. Kopsavilkums";
const PDF_LISTING_SECTION_PRICE = "3. Cenas atbilstība";
const PDF_INCIDENT_INTERNAL_COMMENT_LABEL = "Komentārs";
/** Vienots komentāru bloka virsraksts visā PDF atskaitē (kā NEGADĪJUMU VĒSTURE). */
const PDF_REPORT_COMMENT_LABEL = PDF_INCIDENT_INTERNAL_COMMENT_LABEL;
const PDF_SUB_CSDD = "CSDD";
const PDF_SECTION_LISTING_ANALYSIS = "SLUDINĀJUMA ANALĪZE";

function vendorTitlesOmittedForPdf(vis: PdfVisibilitySettings): Set<string> {
  const L = SOURCE_BLOCK_LABELS;
  const s = new Set<string>();
  if (!vis.autodna) s.add(L.autodna);
  if (!vis.carvertical) s.add(L.carvertical);
  if (!vis.citi_avoti) s.add(L.citi_avoti);
  return s;
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
  cenasAtbilstiba: string;
  listingMarket?: import("@/lib/listing-scrape").ListingMarketSnapshot | null;
  manualVendorBlocks?: ClientManualVendorBlockPdf[];
  /** AUTO RECORDS — servisa vēsture (PDF: tabula; raw netiek drukāts). */
  autoRecordsBlock?: AutoRecordsBlockState | null;
  manualLtabBlock?: ClientManualLtabBlockPdf | null;
  citiAvoti?: CitiAvotiBlockState | null;
  listingAnalysis?: ListingAnalysisBlockState | null;
  /** Ja nav — PDF iekļauj visu (admin noklusējums). */
  pdfVisibility?: PdfVisibilitySettings | null;
  /** Atsevišķi brīdinājumu / info baneri PDF (noklusējums — visi ieslēgti). */
  pdfBannerInclude?: import("@/lib/provin-alert-banners").ProvinBannerPdfInclude | null;
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

function capSourceCount(n: number): number {
  return Math.min(Math.max(0, n), 9);
}

function vendorPdfBlockHasData(b: ClientManualVendorBlockPdf | undefined): boolean {
  if (!b) return false;
  return (
    b.mileageRows.length > 0 ||
    b.incidentRows.length > 0 ||
    b.comments.trim().length > 0 ||
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

function payloadLtabHasData(p: ClientReportPayload, vis: PdfVisibilitySettings): boolean {
  if (!vis.ltab) return false;
  const b = p.manualLtabBlock;
  if (!b) return false;
  return b.rows.length > 0 || b.comments.trim().length > 0;
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

function buildProvinPdfSourcesUsedStripHtml(p: ClientReportPayload, vis: PdfVisibilitySettings): string {
  const { n1, n2, n3 } = computeProvinPdfSourcesUsedCounts(p, vis);
  const nTotal = capSourceCount(n1 + n2 + n3);
  if (nTotal === 0) return "";

  const cards = [
    { n: n1, label: PDF_PROVIN_SOURCES_L1 },
    { n: n2, label: PDF_PROVIN_SOURCES_L2 },
    { n: n3, label: PDF_PROVIN_SOURCES_L3 },
  ].filter((c) => c.n > 0);

  const head = `<div class="pdf-v1-panel-head"><p id="pdf-provin-sources-h" class="pdf-v1-panel-title pdf-v1-panel-title--provin-sources">${pdfProvinWordmarkHtml()}${escapeHtml(PDF_PROVIN_SOURCES_TITLE_SUFFIX)}</p></div>`;
  const categoryRows = cards
    .map((c) => `<tr><td>${escapeHtml(c.label)}</td><td>${escapeHtml(String(c.n))}</td></tr>`)
    .join("");
  const totalRow = `<tr class="pdf-provin-sources-total"><td><strong>${escapeHtml(PDF_PROVIN_SOURCES_L_TOTAL)}</strong></td><td><strong>${escapeHtml(String(nTotal))}</strong></td></tr>`;
  const body = `${categoryRows}${totalRow}`;
  return `<section class="pdf-provin-sources-wrap pdf-v1-panel pdf-v1-panel--clean pdf-surface-card" role="region" aria-labelledby="pdf-provin-sources-h">${head}<table class="pdf-v1-kv"><tbody>${body}</tbody></table></section>`;
}

function buildPdfCountryFlagCellHtml(countryLabel: string): string {
  const flag = pdfCountryFlagEmoji(countryLabel);
  const code = pdfCountryCodeLetters(countryLabel);
  const ariaLabel = escapeHtml(countryLabel.trim() || "—");
  const codeEsc = escapeHtml(code);
  return `<span class="pdf-country-flag-wrap" role="img" aria-label="${ariaLabel}"><span class="pdf-country-flag" aria-hidden="true">${flag}</span><span class="pdf-country-code">${codeEsc}</span></span>`;
}

function sectionHeadBrand(icon: string, title: string): string {
  return `<div class="pdf-sec-head pdf-sec-head--brand"><span class="pdf-sec-ico-wrap" aria-hidden="true">${icon}</span><h2 class="pdf-sec pdf-sec--nobar">${escapeHtml(title)}</h2></div>`;
}

function pdfFieldLabelWithIcon(iconHtml: string, label: string): string {
  return `<p class="pdf-field-label pdf-field-label--row"><span class="pdf-field-label-ico" aria-hidden="true">${iconHtml}</span><span>${escapeHtml(label)}</span></p>`;
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

function formatLossAmountEurCell(raw: string): string {
  const t = raw.trim();
  const esc = escapeHtml(t);
  if (!t) return esc;
  const flag = getLossAmountUiFlag(raw);
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

/** Komentāru bloks — vienots stils visā atskaitē (kā NEGADĪJUMU VĒSTURE). */
function pdfReportCommentBox(text: string, label = PDF_REPORT_COMMENT_LABEL): string {
  const body = adminRichHtmlToPdfSafeHtml(text).trim();
  if (!body) return "";
  return `<div class="pdf-report-comment-note" role="note"><p class="pdf-field-label">${escapeHtml(label)}</p><div class="pdf-report-comment-note-body">${body}</div></div>`;
}

/** Komentāru bloks zem avota (PDF). */
function pdfAvotuCommentIsland(text: string): string {
  return pdfReportCommentBox(text);
}

/** Svītriņa HTML — tabulas „Avots” kolonnā vai leģendā. */
function buildPdfMileageSourceStripeSpan(sourceLabel: string, size: "table" | "legend" = "table"): string {
  const key = mileageSourceLabelToPdfKey(sourceLabel);
  const stripeMod = key === "unknown" ? "unknown" : key;
  const sizeCls = size === "legend" ? " pdf-mileage-source-stripe--legend" : " pdf-mileage-source-stripe--table";
  const stripeCls = `pdf-mileage-source-stripe pdf-mileage-source-stripe--${stripeMod}${sizeCls}`;
  const aria =
    key !== "unknown"
      ? `Avots: ${MILEAGE_PDF_SOURCE_LEGEND[key].full}`
      : `Avots: ${sourceLabel.trim() || "nezināms"}`;
  return `<span class="${stripeCls}" role="img" aria-label="${escapeHtml(aria)}"></span>`;
}

function buildPdfMileageSourceStripeSpanForKey(key: MileagePdfSourceKey): string {
  const stripeMod = key === "unknown" ? "unknown" : key;
  const stripeCls = `pdf-mileage-source-stripe pdf-mileage-source-stripe--${stripeMod} pdf-mileage-source-stripe--legend`;
  if (key === "unknown") {
    return `<span class="${stripeCls}" aria-hidden="true"></span>`;
  }
  return `<span class="${stripeCls}" role="img" aria-label="${escapeHtml(`Avots: ${MILEAGE_PDF_SOURCE_LEGEND[key].full}`)}"></span>`;
}

function buildPdfSourceLegendAbbrevsHtml(sourceLabels: string[]): string {
  const keySet = collectMileagePdfSourceKeysFromLabels(sourceLabels);
  const ordered = mileagePdfLegendKeysInOrder(keySet);
  const parts: string[] = [];
  for (const k of ordered) {
    const abbrev = MILEAGE_PDF_SOURCE_LEGEND[k].abbrev;
    parts.push(
      `<span class="pdf-mileage-legend-term"><span class="pdf-mileage-legend-term-stripe">${buildPdfMileageSourceStripeSpanForKey(k)}</span><span class="pdf-mileage-legend-term-text">${escapeHtml(abbrev)}</span></span>`,
    );
  }
  if (keySet.has("unknown")) {
    parts.push(
      `<span class="pdf-mileage-legend-term"><span class="pdf-mileage-legend-term-stripe">${buildPdfMileageSourceStripeSpanForKey("unknown")}</span><span class="pdf-mileage-legend-term-text">?</span></span>`,
    );
  }
  if (parts.length === 0) return "";
  return `<span class="pdf-mileage-legend-terms-row">${parts.join("")}</span>`;
}

/** Vairākas avota svītriņas tabulas „Avots” kolonnā — horizontāli, ar nelielu atstarpi. */
function buildPdfMileageSourceStripesHtml(sourceLabels: string[], size: "table" | "legend" = "table"): string {
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
  if (unique.length === 0) unique.push("Nezināms avots");
  const sizeCls = size === "legend" ? " pdf-mileage-source-stripes--legend" : " pdf-mileage-source-stripes--table";
  const inner = unique.map((lbl) => buildPdfMileageSourceStripeSpan(lbl, size)).join("");
  return `<span class="pdf-mileage-source-stripes${sizeCls}" role="presentation">${inner}</span>`;
}

function buildPdfMileageSourceLegendAbbrevsHtml(mileageRows: UnifiedMileageDisplayRow[]): string {
  const labels = mileageRows.flatMap((r) => (r.sourceLabels.length > 0 ? r.sourceLabels : [r.sourceLabel]));
  return buildPdfSourceLegendAbbrevsHtml(labels);
}

function buildUnifiedMileageTableRowHtml(
  r: UnifiedMileageDisplayRow,
  anomalyBySourceOrder: Map<number, boolean>,
): string {
  const flagCell = buildPdfCountryFlagCellHtml(r.country);
  const odoEscaped = escapeHtml(r.odometer);
  const labels = r.sourceLabels.length > 0 ? r.sourceLabels : [r.sourceLabel];
  const stripeSpan = buildPdfMileageSourceStripesHtml(labels, "table");
  const anom = anomalyBySourceOrder.get(r.sourceOrder) === true;
  const rowClass = anom ? "pdf-mileage-history-row pdf-mileage-history-row--anomaly" : "pdf-mileage-history-row";
  const ico = pdfLossAmountAlertIconHtml("red");
  const odoTd = anom
    ? `<td class="tabular pdf-mileage-cell-odo"><span class="pdf-data-alert-wrap pdf-num-warn pdf-num-warn--red"><span class="pdf-data-alert-ico" aria-hidden="true">${ico}</span><span class="tabular pdf-num-warn-digits">${odoEscaped}</span></span></td>`
    : `<td class="tabular pdf-mileage-cell-odo"><span class="pdf-mileage-odo-value">${odoEscaped}</span></td>`;
  const srcTd = `<td class="pdf-mileage-cell-src"><span class="pdf-mileage-cell-src-inner">${stripeSpan}</span></td>`;
  return `<tr class="${rowClass}"><td class="pdf-mileage-cell-date">${escapeHtml(r.date)}</td>${odoTd}${srcTd}<td class="pdf-mileage-cell-flag">${flagCell}</td></tr>`;
}

function buildMileageHistoryTableHtml(
  rows: UnifiedMileageDisplayRow[],
  anomalyBySourceOrder: Map<number, boolean>,
): string {
  if (rows.length === 0) return "";
  const colgroup = `<colgroup><col class="pdf-mileage-col-date" /><col class="pdf-mileage-col-odo" /><col class="pdf-mileage-col-src" /><col class="pdf-mileage-col-flag" /></colgroup>`;
  const head = `<tr><th class="pdf-mileage-th-date" scope="col">Datums</th><th class="pdf-mileage-th-odo" scope="col">Odometrs (km)</th><th class="pdf-mileage-th-src" scope="col">Avots</th><th class="pdf-mileage-th-flag" scope="col">Valsts</th></tr>`;
  const body = rows.map((r) => buildUnifiedMileageTableRowHtml(r, anomalyBySourceOrder)).join("\n");
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
      manualVendorBlocks: p.manualVendorBlocks,
      citiAvotiBlock: "citiAvoti" in p ? (p as ClientReportPayload).citiAvoti ?? null : p.citiAvotiBlock ?? null,
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

  const anomalyBySourceOrder = computeOdometerAnomalyBySourceOrder(mileageRows);

  const rows = [...mileageRows].sort((a, b) => {
    if (a.sortableTime !== b.sortableTime) return b.sortableTime - a.sortableTime;
    return a.sourceOrder - b.sourceOrder;
  });

  const display = rows;
  const chartHtml = buildUnifiedMileageChartWrapHtml(mileageRows, anomalyBySourceOrder, { compact: true });

  const mid = Math.ceil(display.length / 2) || 0;
  const leftRows = display.slice(0, mid);
  const rightRows = display.slice(mid);
  const dualTables =
    display.length === 0
      ? ""
      : display.length <= 4
        ? buildMileageHistoryTableHtml(display, anomalyBySourceOrder)
        : `<div class="pdf-mileage-dual"><div class="pdf-mileage-dual__cell">${buildMileageHistoryTableHtml(leftRows, anomalyBySourceOrder)}</div><div class="pdf-mileage-dual__cell">${buildMileageHistoryTableHtml(rightRows, anomalyBySourceOrder)}</div></div>`;

  const sourceCount = new Set(mileageRows.flatMap((r) => r.sourceLabels)).size;
  const legendAbbrevs = buildPdfMileageSourceLegendAbbrevsHtml(mileageRows);
  const sourceCountHtml = `<p class="pdf-source-count-note pdf-source-count-note--mileage"><span class="pdf-mileage-source-count-title">Grafika ģenerēšanā izmantotais avotu skaits: ${sourceCount}</span>${
    legendAbbrevs
      ? `<span class="pdf-mileage-source-count-abbrevs">${legendAbbrevs}</span>`
      : ""
  }</p>`;

  const head = sectionHeadBrand(sectionIconPdfHtml("route"), "NOBRAUKUMA VĒSTURE");
  const commentHtml = pdfReportCommentBox(p.mileageComment ?? "", PDF_MILEAGE_HISTORY_COMMENT_LABEL);

  const body = `${chartHtml}${dualTables}${sourceCountHtml}${commentHtml}`;
  return `<div class="pdf-page-flow-chunk pdf-unified-mileage-zone pdf-surface-card" role="region">${head}<div class="pdf-unified-mileage-zone__body">${body}</div></div>`;
}

function buildUnifiedIncidentRowHtml(
  r: UnifiedIncidentRow,
  damageDetail?: { damagedSides: string; damageGroups: string },
): string {
  const lossCell = formatLossAmountEurCell(r.lossAmount);
  const flagCell = buildPdfCountryFlagCellHtml(r.country);
  const stripeSpan = buildPdfMileageSourceStripeSpan(r.sourceLabel, "table");
  const srcTd = `<td class="pdf-mileage-cell-src"><span class="pdf-mileage-cell-src-inner">${stripeSpan}</span></td>`;
  const mainRow = `<tr class="pdf-mileage-history-row"><td class="pdf-mileage-cell-date">${escapeHtml(r.date)}</td><td class="tabular pdf-mileage-cell-odo pdf-mileage-cell-loss">${lossCell}</td>${srcTd}<td class="pdf-mileage-cell-flag">${flagCell}</td></tr>`;
  if (!damageDetail || (!damageDetail.damagedSides.trim() && !damageDetail.damageGroups.trim())) {
    return mainRow;
  }
  const subHtml = buildCarVerticalIncidentDamageSubHtml(damageDetail);
  return `${mainRow}<tr class="pdf-cv-damage-sub-row"><td class="pdf-cv-damage-sub-cell" colspan="4">${subHtml}</td></tr>`;
}

function buildIncidentHistoryTableHtml(
  rows: UnifiedIncidentRow[],
  carverticalDamageDetails: import("@/lib/carvertical-pdf-parse").CarVerticalDamageDetailRow[] = [],
): string {
  if (rows.length === 0) return "";
  const colgroup = `<colgroup><col class="pdf-mileage-col-date" /><col class="pdf-mileage-col-odo" /><col class="pdf-mileage-col-src" /><col class="pdf-mileage-col-flag" /></colgroup>`;
  const head = `<tr><th class="pdf-mileage-th-date" scope="col">Datums</th><th class="pdf-mileage-th-odo" scope="col">Zaudējuma summa</th><th class="pdf-mileage-th-src" scope="col">Avots</th><th class="pdf-mileage-th-flag" scope="col">Valsts</th></tr>`;
  const body = rows
    .map((r) => {
      const damage =
        r.sourceLabel === SOURCE_BLOCK_LABELS.carvertical
          ? matchCarVerticalDamageDetail(
              { csngDate: r.date, incidentNo: r.country, lossAmount: r.lossAmount },
              carverticalDamageDetails,
            )
          : undefined;
      return buildUnifiedIncidentRowHtml(
        r,
        damage ? { damagedSides: damage.damagedSides, damageGroups: damage.damageGroups } : undefined,
      );
    })
    .join("\n");
  return `<div class="pdf-mileage-history-table-wrap"><table class="pdf-mileage-history-table pdf-mileage-history-table--mileage-rows pdf-mileage-history-table--incidents" role="table">${colgroup}<thead>${head}</thead><tbody>${body}</tbody></table></div>`;
}

/** Apvienota negadījumu tabula (AutoDNA, CarVertical, LTAB, Citi avoti) — tikai rindas ar aizpildītu zaudējumu summu. */
export function buildUnifiedIncidentsTableHtml(p: ClientReportPayload, vis: PdfVisibilitySettings): string {
  if (!vis.unifiedIncidents) return "";
  // Per-source „Rādīt laukus” nefiltrē datus no šīs apvienotās sadaļas — tikai atsevišķos avotu blokos.
  const collected = collectUnifiedIncidentRows({
    manualVendorBlocks: p.manualVendorBlocks ?? null,
    manualLtabBlock: p.manualLtabBlock ?? null,
  });
  const carverticalDamageRows =
    (p.manualVendorBlocks ?? []).find((b) => b.title === SOURCE_BLOCK_LABELS.carvertical)?.damageDetails ??
    [];
  const adminNoteHtml = pdfReportCommentBox(p.internalComment ?? "", ADMIN_INCIDENTS_SUMMARY_LABEL);
  const hasTable = collected.length > 0;
  if (!hasTable && !adminNoteHtml) return "";
  const rows = sortUnifiedIncidentsNewestFirst(collected);
  const tablesHtml = hasTable ? buildIncidentHistoryTableHtml(rows, carverticalDamageRows) : "";
  const sourceCount = hasTable ? new Set(collected.map((r) => r.sourceLabel)).size : 0;
  const legendAbbrevs = hasTable ? buildPdfSourceLegendAbbrevsHtml(collected.map((r) => r.sourceLabel)) : "";
  const sourceCountHtml = hasTable
    ? `<p class="pdf-source-count-note pdf-source-count-note--mileage"><span class="pdf-mileage-source-count-title">Grafika ģenerēšanā izmantotais avotu skaits: ${sourceCount}</span>${
        legendAbbrevs
          ? `<span class="pdf-mileage-source-count-abbrevs">${legendAbbrevs}</span>`
          : ""
      }</p>`
    : "";
  const head = sectionHeadBrand(sectionIconPdfHtml("shield"), NEGADIJUMU_VESTURE_TITLE);
  const body = `${tablesHtml}${sourceCountHtml}${adminNoteHtml}`;
  return `<div class="pdf-page-flow-chunk pdf-unified-incidents-zone pdf-surface-card" role="region">${head}<div class="pdf-unified-incidents-zone__body">${body}</div></div>`;
}

/** CSDD — strukturētie lauki + komentāri (viena PDF zona, kā audita atskaitē). */
export function buildCsddAvotuZoneHtml(form: CsddFormFields): string {
  if (!csddFormHasContent(form)) return "";

  const head = sectionHeadBrand(sectionIconPdfHtml("scrollText"), PDF_SUB_CSDD);
  const commentTrim = mergePdfChecklistAndComments(form.pdfChecklist, form.comments ?? "").trim();
  const hasComments = commentTrim.length > 0;
  const regRows: string[] = [];
  for (const { key, label } of CSDD_FORM_STRUCTURED_FIELDS) {
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
      ? `<div class="pdf-csdd-ta-section"><p class="pdf-csdd-subsection-title">${escapeHtml(CSDD_PREVIOUS_INSPECTION_TITLE)}</p>${buildPreviousInspectionBlockHtml(prevBlock ?? emptyCsddPreviousInspectionBlock(), prevInspectionDateDisplay, prevWarnings)}</div>`
      : "";

  const taRows = (form.technicalInspectionHistory ?? []).filter((r) => r.date.trim());
  const taWarnings = filterCsddInspectionWarnings(form.technicalInspectionWarnings);
  const taTableHtml =
    taRows.length > 0 || taWarnings.length > 0
      ? `<div class="pdf-csdd-ta-section"><p class="pdf-csdd-subsection-title">${escapeHtml(CSDD_TECHNICAL_INSPECTION_HISTORY_TITLE)}</p>${buildTechnicalInspectionHistoryTableHtml(taRows, taWarnings)}</div>`
      : "";

  const commentHtml = hasComments ? pdfAvotuCommentIsland(commentTrim) : "";
  if (!tableHtml && !ownerTimelineHtml && !prevInspectionHtml && !taTableHtml && !commentHtml) return "";
  const bodyInner = `${tableHtml}${ownerTimelineHtml}${prevInspectionHtml}${taTableHtml}${commentHtml}`;
  return `<div class="pdf-unified-mileage-zone pdf-surface-card" role="region">${head}<div class="pdf-source-section-body">${bodyInner}</div></div>`;
}

/** CSDD — apskates datumi + strukturētie lauki (viena galvenā līmeņa zona, kā NOBRAUKUMA VĒSTURE). */
function buildCsddAvotuSubsection(p: ClientReportPayload, vis: PdfVisibilitySettings): string {
  if (!vis.csdd) return "";
  const form = p.csddForm;
  const hasStruct = Boolean(form && csddFormHasContent(form));
  const hasRaw = p.csdd.trim().length > 0;
  if (!hasStruct && !hasRaw) return "";

  if (hasStruct && form) {
    const zone = buildCsddAvotuZoneHtml(form);
    if (zone) return zone;
    if (hasRaw) {
      const head = sectionHeadBrand(sectionIconPdfHtml("scrollText"), PDF_SUB_CSDD);
      return `<div class="pdf-unified-mileage-zone pdf-surface-card" role="region">${head}<div class="pdf-source-section-body"><pre class="mirror-pre">${escapeHtml(p.csdd.trim())}</pre></div></div>`;
    }
    return "";
  }

  const head = sectionHeadBrand(sectionIconPdfHtml("scrollText"), PDF_SUB_CSDD);
  return `<div class="pdf-unified-mileage-zone pdf-surface-card" role="region">${head}<div class="pdf-source-section-body"><pre class="mirror-pre">${escapeHtml(p.csdd.trim())}</pre></div></div>`;
}

/** Tirgus dati — HTML ķermenis „Sludinājuma vēsture” apakšsadaļai (bez ārējās kartes). */
function buildTirgusListingHistoryBodyHtml(p: ClientReportPayload): string {
  const hasForm = tirgusFormHasContent(p.tirgusForm);
  const hasText = p.tirgus.trim().length > 0;
  if (!hasForm && !hasText) return "";

  const parts: string[] = [];
  if (hasForm && p.tirgusForm) {
    const f = p.tirgusForm;
    const rows: string[] = [];
    if (f.listedForSale.trim()) {
      rows.push(
        `<tr><td>${escapeHtml(TIRGUS_LABEL_LISTED)}</td><td>${formatListedForSaleDaysCellHtml(f.listedForSale)}</td></tr>`,
      );
    }
    if (f.listingCreated.trim()) {
      rows.push(
        `<tr><td>${escapeHtml(TIRGUS_LABEL_CREATED)}</td><td>${escapeHtml(f.listingCreated.trim())}</td></tr>`,
      );
    }
    if (f.priceDrop.trim()) {
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

/** AUTO RECORDS — Outvin dīlera dati PDF; nobraukums tikai vienotajā tabulā; komentāri atsevišķi. */
function buildAutoRecordsAvotuSubsection(
  b: AutoRecordsBlockState | null | undefined,
  vis: PdfVisibilitySettings,
): string {
  if (!vis.auto_records) return "";
  if (!b || !autoRecordsBlockHasContent(b)) return "";

  const bundle = getAutoRecordsOutvinBundle(b);
  const bundleInner = outvinBundleHasStructuredContent(bundle)
    ? buildOutvinBundlePdfInnerHtml(bundle)
    : "";
  const legacyInner = buildOutvinDealerReportPdfInnerHtml(b.outvinReport);
  const outvinInner = bundleInner.trim() || legacyInner.trim();
  const commentBlock = mergePdfChecklistAndComments(b.pdfChecklist, b.comments);
  const hasComments = commentBlock.trim().length > 0;
  const hasOutvin = outvinInner.length > 0;

  if (!hasOutvin && !hasComments) return "";

  const head = pdfV1PanelHead(
    SOURCE_BLOCK_LABELS.auto_records.toLowerCase(),
    sectionIconPdfHtml("shieldCheck"),
  );
  const bodyParts: string[] = [];
  if (hasOutvin) bodyParts.push(`<div class="pdf-outvin-dealer-stack">${outvinInner}</div>`);
  if (hasComments) bodyParts.push(pdfAvotuCommentIsland(commentBlock));
  return `<div class="pdf-v1-panel pdf-v1-panel--clean pdf-surface-card" role="region">${head}${bodyParts.join("\n")}</div>`;
}

/** Trešās puses avots — komentāri + CarVertical laikposms. */
function buildVendorAvotuSubsection(b: ClientManualVendorBlockPdf, vis: PdfVisibilitySettings): string {
  const L = SOURCE_BLOCK_LABELS;
  if (b.title === L.autodna && !vis.autodna) return "";
  if (b.title === L.carvertical && !vis.carvertical) return "";
  const commentBlock = mergePdfChecklistAndComments(b.pdfChecklist, b.comments);
  const hasComments = commentBlock.trim().length > 0;
  const timelineHtml =
    b.title === L.carvertical && (b.vehicleHistoryTimeline ?? []).length > 0
      ? buildCarVerticalTimelineHtml(b.vehicleHistoryTimeline ?? [], { compact: true })
      : "";
  if (!hasComments && !timelineHtml) return "";
  const head = sectionHeadBrand(sectionIconPdfHtml(vendorPdfTitleToIconId(b.title)), b.title);
  const body = `<div class="pdf-source-section-body">${timelineHtml}${hasComments ? pdfAvotuCommentIsland(commentBlock) : ""}</div>`;
  return `<div class="pdf-unified-mileage-zone pdf-surface-card" role="region">${head}${body}</div>`;
}

function buildLtabAvotuSubsection(
  b: ClientManualLtabBlockPdf | null | undefined,
  vis: PdfVisibilitySettings,
): string {
  if (!vis.ltab) return "";
  if (!b) return "";
  const hasComments = b.comments.trim().length > 0;
  if (!hasComments) return "";
  const head = sectionHeadBrand(sectionIconPdfHtml("shield"), SOURCE_BLOCK_LABELS.ltab);
  const body = `<div class="pdf-source-section-body">${pdfAvotuCommentIsland(b.comments)}</div>`;
  return `<div class="pdf-unified-mileage-zone pdf-surface-card" role="region">${head}${body}</div>`;
}

/**
 * Sludinājuma analīze — patstāvīgs bloks: vispirms „Sludinājuma vēsture” (tirgus dati), tad pārējās apakšsadaļas.
 */
function buildListingAnalysisPriorityHtml(p: ClientReportPayload, vis: PdfVisibilitySettings): string {
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
    cat(L.photoAnalysis, b.photoAnalysis);
    cat(L.listingSalesContext, b.listingSalesContext);
  }
  const priceFitBox = pdfReportCommentBox(p.cenasAtbilstiba ?? "");
  if (priceFitBox) {
    inner.push(pdfFieldLabelWithIcon(sectionIconPdfHtml("priceTag"), PDF_LISTING_SECTION_PRICE));
    inner.push(priceFitBox);
  }
  if (inner.length === 0) return "";
  const parts: string[] = [];
  parts.push(`<div class="pdf-unified-mileage-zone pdf-surface-card pdf-listing-analysis-root" role="region">`);
  parts.push(sectionHeadBrand(sectionIconPdfHtml("search"), PDF_SECTION_LISTING_ANALYSIS));
  parts.push(`<div class="pdf-source-section-body pdf-listing-analysis-stack">${inner.join("\n")}</div>`);
  parts.push(`</div>`);
  return parts.join("\n");
}

/** Citi avoti — tīri komentāri (nobraukums un negadījumi ir vienotajās tabulās augšā). */
function buildCitiAvotiAvotuSubsection(p: ClientReportPayload, vis: PdfVisibilitySettings): string {
  if (!vis.citi_avoti) return "";
  const b = p.citiAvoti;
  if (!b?.sections?.length) return "";
  const islands: string[] = [];
  const total = b.sections.length;
  for (const [i, section] of b.sections.entries()) {
    const comments = section.comments.trim();
    if (!comments) continue;
    const subheadLabel = section.label?.trim() || (total > 1 ? `Avots ${i + 1}` : "");
    islands.push(
      subheadLabel ?
        `<p class="pdf-citi-avoti-subhead">${escapeHtml(subheadLabel)}</p>${pdfAvotuCommentIsland(comments)}`
      : pdfAvotuCommentIsland(comments),
    );
  }
  if (islands.length === 0) return "";
  const head = sectionHeadBrand(sectionIconPdfHtml("layers"), SOURCE_BLOCK_LABELS.citi_avoti);
  const body = `<div class="pdf-source-section-body">${islands.join("\n")}</div>`;
  return `<div class="pdf-unified-mileage-zone pdf-surface-card pdf-citi-avoti-plain" role="region">${head}${body}</div>`;
}

/**
 * Avotu apakšsadaļas (PDF): katra patstāvīga pilna platuma zona — CSDD, AutoDNA, CarVertical, utt.
 * Nav kopējā „Avotu bloki“ mātes sadaļas.
 */
function buildAvotuDatiSectionHtml(p: ClientReportPayload, vis: PdfVisibilitySettings): string {
  const csdd = buildCsddAvotuSubsection(p, vis);
  const ltab = buildLtabAvotuSubsection(p.manualLtabBlock, vis);
  const citiAvoti = buildCitiAvotiAvotuSubsection(p, vis);

  const vendors = p.manualVendorBlocks ?? [];
  const byTitle = new Map(vendors.map((b) => [b.title, b]));
  const vendorHtml = (title: string) => {
    const b = byTitle.get(title);
    return b ? buildVendorAvotuSubsection(b, vis) : "";
  };
  const autodna = vendorHtml(SOURCE_BLOCK_LABELS.autodna);
  const carvertical = vendorHtml(SOURCE_BLOCK_LABELS.carvertical);
  const autoRecords = buildAutoRecordsAvotuSubsection(p.autoRecordsBlock ?? null, vis);

  const stack = [csdd, autodna, carvertical, autoRecords, ltab, citiAvoti].filter(Boolean);
  if (stack.length === 0) return "";
  return stack.join("\n");
}

/** Galvenais eksperta kopsavilkums — pilnā platumā, pēdējais lielais bloks pirms juridiskās piezīmes. */
function buildApprovedByIrissHtml(p: ClientReportPayload, vis: PdfVisibilitySettings): string {
  if (!vis.iriss) return "";
  const irissHtml = (p.iriss ?? "").trim();
  const planHtml = (p.apskatesPlāns ?? "").trim();
  if (!irissHtml && !planHtml) return "";
  const inner: string[] = [];
  if (planHtml) {
    inner.push(pdfFieldLabelWithIcon(sectionIconPdfHtml("car"), PDF_IRISS_SECTION_1));
    inner.push(pdfReportCommentBox(planHtml));
  }
  if (irissHtml) {
    inner.push(pdfFieldLabelWithIcon(sectionIconPdfHtml("fileSearch"), PDF_IRISS_SECTION_2));
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

function buildPdfSiteFooterHtml(year: number): string {
  const b = getClientReportLegalFooterBlocks();
  const logo = provincLogoSvg().replace(
    'class="pdf-v1-logo"',
    'class="pdf-v1-logo pdf-site-footer__logo"',
  );
  const disclaimer = escapeHtml(b.disclaimer);
  const confidentiality = escapeHtml(b.confidentiality);
  const valueBody = escapeHtml(b.valueBody);
  const copyright = escapeHtml(`© ${year} PROVIN.LV`);
  const refs = escapeHtml(b.legalLabels);
  const gdpr = escapeHtml(b.gdprLine);
  const importantTitle = escapeHtml(b.importantTitle);
  return `<footer class="pdf-site-footer" role="contentinfo">
<div class="pdf-site-footer__grid">
<div class="pdf-site-footer__col pdf-site-footer__col--legal">
<h3 class="pdf-site-footer__important-title">${importantTitle}</h3>
<p class="pdf-site-footer__disclaimer">${disclaimer}</p>
<p class="pdf-site-footer__confidentiality"><strong>${confidentiality}</strong></p>
</div>
<div class="pdf-site-footer__col pdf-site-footer__col--brand">
${logo}
<p class="pdf-site-footer__value-body">${valueBody}</p>
</div>
</div>
<div class="pdf-site-footer__bottom" aria-label="Juridiskā informācija">
<p class="pdf-site-footer__copyright">${copyright}</p>
<p class="pdf-site-footer__refs">${refs}</p>
<p class="pdf-site-footer__gdpr">${gdpr}</p>
</div>
</footer>`;
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

function clientReportPrintCss(): string {
  return `
      @page{margin:0;size:auto;}
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
      .provin-report-doc .pdf-alert-banners-stack,
      .provin-report-doc .pdf-info-banners-stack,
      .provin-report-doc .pdf-site-footer{
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
      .pdf-sec-head{display:flex;align-items:center;gap:8px;margin:0.75rem 0 0.35rem;}
      .pdf-sec-head--nobar{margin-top:0;}
      .pdf-sec-head .pdf-ico{color:${PDF_BRAND_BLUE_HEX};width:16px;height:16px;flex-shrink:0;opacity:0.88;}
      h2.pdf-sec{
        font-size:0.72rem;font-weight:500;margin:0;flex:1;color:#475569;letter-spacing:0.06em;line-height:1.35;
        padding:0 0 0 8px;border-left:2px solid ${PDF_BRAND_BLUE_HEX};text-transform:uppercase;
      }
      h2.pdf-sec--nobar{border-left:none;padding-left:0;}
      h3.pdf-sub{font-size:0.75rem;font-weight:700;margin:0.6rem 0 0.35rem;color:#000;text-transform:uppercase;letter-spacing:0.05em;}
      h3.pdf-sub:first-child{margin-top:0;}
      .pdf-subhead{display:flex;align-items:center;gap:8px;margin:0 0 0.4rem;}
      .pdf-subhead-ico{display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;}
      .pdf-subhead-ico .pdf-ico{width:14px;height:14px;}
      h3.pdf-sub.pdf-sub--with-ico{margin:0;border-left:none;padding:0;}
      .pdf-sec-head--brand{align-items:center;gap:10px;margin:0 0 12px;}
      .pdf-sec-ico-wrap{
        display:inline-flex;align-items:center;justify-content:center;color:${PDF_BRAND_BLUE_HEX};flex-shrink:0;
      }
      .pdf-sec-ico-wrap .pdf-ico{width:16px;height:16px;}
      .pdf-listing-analysis-root .pdf-sec-ico-wrap,
      .pdf-iriss-approved .pdf-sec-ico-wrap{
        width:26px;height:26px;border-radius:999px;background:rgba(0,97,210,0.1);
      }
      .pdf-source-section-body{width:100%;margin:0;padding:0;}
      .pdf-field-label{font-size:0.68rem;font-weight:600;margin:0.45rem 0 0.2rem;color:#334155;letter-spacing:0.02em;}
      .pdf-field-label--row{display:flex;align-items:center;gap:8px;}
      .pdf-field-label-ico{flex-shrink:0;line-height:0;}
      .pdf-field-label-ico .pdf-ico{width:18px;height:18px;color:${PDF_BRAND_BLUE_HEX};}
      .pdf-listing-analysis-stack{width:100%;}
      .pdf-listing-analysis-chunk{
        margin:0 0 8px;padding:8px 0;background:#fff;border-bottom:1px solid #f1f5f9;
      }
      .pdf-listing-analysis-stack > .pdf-report-comment-note{margin:0 0 10px;}
      .pdf-listing-analysis-stack > .pdf-field-label--row + .pdf-report-comment-note{margin-top:4px;}
      .pdf-listing-history-frame{
        border:1px solid #f1f5f9;
        border-radius:6px;
        background:#fff;
        padding:10px 10px;
      }
      .pdf-listing-analysis-chunk:last-child{margin-bottom:0;border-bottom:none;}
      .pdf-listing-analysis-chunk-pre{margin:0;}
      .pdf-unified-mileage-zone{margin:0 0 14px;padding:12px 14px;background:#fff!important;border:1px solid #f1f5f9;border-radius:8px;box-shadow:0 1px 4px rgba(15,23,42,.05);}
      .pdf-unified-mileage-zone .pdf-sec-head{margin-top:0;}
      .pdf-provin-sources-wrap{margin:0 0 18px;}
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
        border:1px solid #f1f5f9;border-radius:8px;
        box-shadow:0 1px 4px rgba(15,23,42,.05);
        -webkit-print-color-adjust:exact;print-color-adjust:exact;
      }
      .pdf-unified-incidents-zone{margin:0 0 14px;padding:12px 14px;background:#fff!important;border:1px solid #f1f5f9;border-radius:8px;box-shadow:0 1px 4px rgba(15,23,42,.05);}
      .pdf-unified-incidents-zone .pdf-sec-head{margin-top:0;}
      .pdf-unified-incidents-zone__body > .pdf-report-comment-note:last-child,
      .pdf-unified-mileage-zone__body > .pdf-report-comment-note:last-child{
        margin-bottom:0;
      }
      .pdf-mileage-history-table--incidents tbody tr.pdf-mileage-history-row:nth-child(4n+1),
      .pdf-mileage-history-table--incidents tbody tr.pdf-mileage-history-row:nth-child(4n+2){
        background:#fafbfc;
      }
      .pdf-cv-damage-sub{margin:0 0 2px;border:1px solid #e2e8f0;border-radius:6px;background:#f8fafc;overflow:hidden;}
      .pdf-cv-damage-sub-head,.pdf-cv-damage-sub-row{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:5px 10px;font-size:9px;line-height:1.35;}
      .pdf-cv-damage-sub-head{font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:#64748b;border-bottom:1px solid #e2e8f0;background:#f1f5f9;}
      .pdf-cv-damage-sub-row{border-bottom:none;}
      .pdf-cv-damage-sub-row .pdf-cv-damage-sides{color:#1d1d1f;font-weight:500;}
      .pdf-cv-damage-sub-row .pdf-cv-damage-groups{color:#64748b;}
      .pdf-cv-damage-sub-row td,.pdf-cv-damage-sub-cell{padding:2px 0 4px!important;border:none!important;background:transparent!important;}
      .pdf-cv-damage-sub-row .pdf-cv-damage-sub{width:100%;}
      .pdf-source-section-body > .pdf-report-comment-note:first-child{margin-top:0;}
      .pdf-report-comment-note,
      .pdf-incident-internal-note,
      .pdf-mileage-comment-note{
        margin:10px 0 0;padding:10px 12px;border:1px solid #e2e8f0;border-radius:6px;background:#fafafa;
        -webkit-print-color-adjust:exact;print-color-adjust:exact;
      }
      .pdf-report-comment-note .pdf-field-label,
      .pdf-incident-internal-note .pdf-field-label,
      .pdf-mileage-comment-note .pdf-field-label{margin:0 0 6px;font-size:11px;font-weight:700;color:#0f172a;}
      .pdf-report-comment-note-body,
      .pdf-incident-internal-note-body,
      .pdf-mileage-comment-note-body{margin:0;font-size:11px;line-height:1.55;color:#0f172a;font-family:Inter,sans-serif!important;}
      .pdf-report-comment-note-body strong,
      .pdf-report-comment-note-body b{font-weight:700;}
      .pdf-report-comment-note-body em,
      .pdf-report-comment-note-body i{font-style:italic;}
      .pdf-report-comment-note-body u{text-decoration:underline;}
      .pdf-report-comment-note-body span{-webkit-print-color-adjust:exact;print-color-adjust:exact;}
      .pdf-mileage-dual{
        display:grid;grid-template-columns:1fr 1fr;gap:10px 12px;align-items:start;margin:8px 0 0;
      }
      .pdf-mileage-dual__cell{min-width:0;}
      .pdf-mileage-smart-note{
        margin:10px 0 0;font-size:0.62rem;color:#64748b;line-height:1.4;font-style:italic;
      }
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
      .pdf-mileage-source-stripe{
        display:inline-block;flex-shrink:0;border-radius:2px;vertical-align:middle;
        -webkit-print-color-adjust:exact;print-color-adjust:exact;
      }
      .pdf-mileage-source-stripe--table{width:9px!important;height:4px!important;}
      .pdf-mileage-source-stripe--legend{width:7px!important;height:3px!important;}
      .pdf-mileage-source-stripe--csdd{background:#16a34a!important;}
      .pdf-mileage-source-stripe--autodna{background:#1e3a8a!important;}
      .pdf-mileage-source-stripe--carvertical{background:#eab308!important;}
      .pdf-mileage-source-stripe--dealer{background:#dc2626!important;}
      .pdf-mileage-source-stripe--cits{background:#ea580c!important;}
      .pdf-mileage-source-stripe--unknown{background:#94a3b8!important;}
      .pdf-mileage-source-stripes{
        display:inline-flex;align-items:center;justify-content:center;vertical-align:middle;
        flex-wrap:nowrap;flex-shrink:0;
        -webkit-print-color-adjust:exact;print-color-adjust:exact;
      }
      .pdf-mileage-source-stripes--table{gap:3px;}
      .pdf-mileage-source-stripes--legend{gap:2px;}
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
      .pdf-mileage-chart-dot{
        fill:#fff;stroke:${PDF_MILEAGE_CHART_LINE};stroke-width:1.75;
        -webkit-print-color-adjust:exact;print-color-adjust:exact;
      }
      .pdf-mileage-chart-year{
        fill:${PDF_MILEAGE_CHART_AXIS};font-family:Inter,sans-serif;font-size:8px;font-weight:500;
      }
      .pdf-mileage-chart-wrap--compact .pdf-mileage-chart-year{font-size:7.5px;}
      .pdf-mileage-chart-legend{
        display:flex;align-items:center;gap:6px;padding:0 10px 8px 12px;font-size:0.62rem;color:#64748b;
      }
      .pdf-mileage-chart-legend-line{
        display:inline-block;width:18px;height:2px;border-radius:1px;background:${PDF_MILEAGE_CHART_LINE};
        flex-shrink:0;
      }
      .pdf-mileage-chart-legend-text{font-weight:500;color:#64748b;}
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
      .pdf-mileage-source-count-abbrevs{
        display:block!important;
        margin:10px 0 0!important;
        padding:0!important;
        white-space:nowrap!important;
        font-weight:600!important;
        letter-spacing:0.02em!important;
        color:#475569!important;
      }
      .pdf-mileage-legend-terms-row{
        display:inline-flex!important;align-items:center!important;flex-wrap:nowrap!important;
        gap:18px!important;
      }
      .pdf-mileage-legend-term{
        display:inline-flex!important;align-items:center!important;vertical-align:middle!important;
        gap:3px!important;
      }
      .pdf-mileage-legend-term-stripe{display:inline-flex!important;align-items:center!important;flex-shrink:0!important;}
      .pdf-mileage-legend-term-text{font-weight:600!important;color:#475569!important;}
      .pdf-mileage-chart-dot--anomaly{
        fill:#ef4444!important;stroke:#b91c1c!important;stroke-width:1.75!important;
        -webkit-print-color-adjust:exact;print-color-adjust:exact;
      }
      .pdf-alert-banners-stack{
        display:flex;flex-direction:column;gap:8px;margin:0 0 10px;
      }
      .pdf-alert-banner{
        display:flex;align-items:flex-start;gap:12px;padding:6px 12px 6px 14px;border-radius:8px;
        box-shadow:0 2px 16px rgba(15,23,42,0.06);
        -webkit-print-color-adjust:exact;print-color-adjust:exact;
      }
      .pdf-alert-banner--red{
        background:rgba(255,77,77,0.04);border-left:2px solid #FF4D4D;color:#FF4D4D;
      }
      .pdf-alert-banner--yellow{
        background:rgba(255,193,7,0.04);border-left:2px solid #FFC107;color:#FFC107;
      }
      .pdf-alert-banner-text{
        flex:1;margin:0;font-size:8pt;line-height:1.35;color:#1d1d1f;font-weight:400;font-family:Inter,sans-serif!important;
      }
      .pdf-alert-banner-ico{flex-shrink:0;display:block;width:18px;height:18px;margin-top:1px;}
      .pdf-alert-banner--red .pdf-alert-banner-ico{color:#FF4D4D;}
      .pdf-alert-banner--yellow .pdf-alert-banner-ico{color:#FFC107;}
      .pdf-alert-banner--red .pdf-alert-banner-text{color:#1d1d1f;}
      .pdf-alert-banner--yellow .pdf-alert-banner-text{color:#1d1d1f;}
      .pdf-info-banners-stack{
        display:flex;flex-direction:column;gap:8px;margin:0 0 10px;
      }
      .pdf-info-banner{
        display:flex;align-items:flex-start;gap:12px;padding:6px 12px 6px 14px;border-radius:8px;
        box-shadow:0 2px 16px rgba(15,23,42,0.04);
        -webkit-print-color-adjust:exact;print-color-adjust:exact;
      }
      .pdf-info-banner--grey{
        background:rgba(142,142,147,0.08);border-left:2px solid #8e8e93;color:#636366;
      }
      .pdf-info-banner-text{
        flex:1;margin:0;font-size:8pt;line-height:1.35;color:#3a3a3c;font-weight:400;font-family:Inter,sans-serif!important;
      }
      .pdf-info-banner-ico{flex-shrink:0;display:block;width:18px;height:18px;margin-top:1px;color:#8e8e93;}
      .pdf-data-alert-wrap{
        display:inline-flex;align-items:center;gap:8px;max-width:100%;vertical-align:middle;
      }
      .pdf-data-alert-ico{flex-shrink:0;display:block;line-height:0;}
      .pdf-csdd-alert-wrap{
        display:flex;align-items:center;gap:8px;width:100%;
      }
      .pdf-num-warn{font-size:9pt!important;line-height:1.2;font-family:Inter,sans-serif!important;vertical-align:middle;}
      .pdf-num-warn--red .pdf-num-warn-digits,.pdf-num-warn--yellow .pdf-num-warn-digits{
        color:#000!important;font-weight:600!important;
      }
      .pdf-loss-amt-ico,.pdf-warn-tri-ico{flex-shrink:0;display:block;width:13px;height:13px;}
      .pdf-warn-tri-ico--lg{width:17px!important;height:17px!important;}
      .pdf-price-drop-wrap{display:inline-flex;align-items:center;gap:6px;vertical-align:middle;}
      .pdf-price-drop-val{color:#000!important;font-weight:600!important;}
      .pdf-price-drop-ico{display:inline-flex;align-items:center;justify-content:center;line-height:0;}
      .pdf-price-drop-arrow{flex-shrink:0;display:block;width:17px;height:17px;}
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
        padding:10px 12px;
        border-radius:10px;
        background:#f1f5f9;
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
        background:rgba(0,97,210,0.09)!important;
      }
      .mirror-line{font-size:0.72rem;margin:0.25rem 0;line-height:1.45;}
      .mirror-table{width:100%;border-collapse:collapse;font-size:0.72rem;margin:4px 0;}
      .mirror-table td,.mirror-table th{padding:6px 0;border-bottom:1px solid #f1f5f9;vertical-align:top;text-align:left;}
      .mirror-table thead th{font-weight:600;color:#000;font-size:0.68rem;}
      .mirror-table td:first-child{color:#86868b;width:38%;}
      .mirror-table--csdd{font-size:9pt!important;}
      .mirror-table--csdd td,.mirror-table--csdd th{font-size:9pt!important;}
      .mirror-table--csdd td:first-child{
        width:54%;min-width:14em;max-width:62%;white-space:nowrap;color:#86868b;
      }
      .mirror-table--csdd td:nth-child(2){text-align:right;}
      .mirror-table--csdd td.pdf-csdd-alert-td{
        width:100%!important;max-width:none!important;padding:4px 0!important;border-bottom:1px solid #f1f5f9!important;
      }
      .pdf-csdd-alert{
        flex:1;display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:4px;font-size:9pt!important;line-height:1.25;
        border:1px solid #e8eaed;background:#fff;
        -webkit-print-color-adjust:exact;print-color-adjust:exact;
      }
      .pdf-csdd-alert--red{border-left:3px solid #FF4D4D;}
      .pdf-csdd-alert--yellow{border-left:3px solid #FFC107;}
      .pdf-csdd-alert-label{color:#86868b;font-weight:600;white-space:nowrap;}
      .pdf-csdd-alert-val{color:#1d1d1f;text-align:right;flex:1;min-width:0;}
      .mirror-table--csdd td.pdf-csdd-tech-compact{
        width:auto;max-width:none;white-space:normal;padding:4px 0 6px;
        font-size:9pt;line-height:1.25;color:#1d1d1f;text-align:left;border-bottom:1px solid #f1f5f9;
      }
      .pdf-csdd-tech-line{font-size:9pt;line-height:1.25;margin:0 0 3px;}
      .pdf-csdd-tech-line:last-child{margin-bottom:0;}
      .pdf-csdd-tech-bit{color:#1d1d1f;}
      .mirror-pre--csdd-dense{font-size:9pt!important;line-height:1.3!important;margin:0 0 4px!important;}
      .pdf-field-label--historic{color:#64748b!important;}
      .mirror-table--csdd-defect-current{font-size:9pt!important;margin:2px 0 6px!important;}
      .mirror-table--csdd-defect-current td,.mirror-table--csdd-defect-current th{padding:3px 5px!important;line-height:1.25!important;border-bottom:1px solid #f1f5f9!important;}
      .mirror-table--csdd-defect-historic{font-size:9pt!important;margin:2px 0 4px!important;color:#64748b!important;}
      .mirror-table--csdd-defect-historic td,.mirror-table--csdd-defect-historic th{
        padding:3px 4px!important;line-height:1.25!important;border-bottom:1px solid #eef2f7!important;
        color:#64748b!important;
      }
      .mirror-table--csdd-defect-historic .pdf-csdd-defect-rating--1{color:#16a34a!important;font-weight:700;}
      .mirror-table--csdd-defect-historic .pdf-csdd-defect-rating--2{color:#d97706!important;font-weight:700;}
      .mirror-table--csdd-defect-historic .pdf-csdd-defect-rating--3{color:#dc2626!important;font-weight:700;}
      .mirror-table--csdd-mh{font-size:9pt!important;margin:2px 0 4px!important;}
      .mirror-table--csdd-mh td,.mirror-table--csdd-mh th{padding:3px 4px!important;line-height:1.25!important;border-bottom:1px solid #f1f5f9!important;}
      .mirror-table--csdd-mh thead th{font-size:9pt!important;}
      .pdf-csdd-subsection-title{
        margin:10px 0 6px;font-size:9pt;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:#64748b;
      }
      .pdf-csdd-ta-section{margin-top:8px;}
      .pdf-csdd-ta-table-wrap{display:flex;flex-direction:column;gap:10px;}
      .pdf-csdd-ta-year-block{break-inside:avoid;page-break-inside:avoid;margin:0 0 10px;}
      .pdf-csdd-ta-year-heading{
        margin:0 0 4px;font-size:9pt;font-weight:700;letter-spacing:0.04em;
        text-transform:uppercase;color:#475569;
      }
      .pdf-csdd-ta-year-frame{
        padding:10px 12px;border:1px solid #e2e8f0;border-radius:6px;background:#ffffff;
        -webkit-print-color-adjust:exact;print-color-adjust:exact;
      }
      .pdf-csdd-ta-warnings{margin:0 0 8px;display:flex;flex-direction:column;gap:6px;}
      .pdf-csdd-ta-warnings:last-child{margin-bottom:0;}
      .pdf-csdd-ta-warn{
        margin:0;padding:6px 8px;border-radius:4px;font-size:9pt;line-height:1.35;
        -webkit-print-color-adjust:exact;print-color-adjust:exact;
      }
      .pdf-csdd-ta-warn--gray{border-left:3px solid #94a3b8;background:#f8fafc;color:#334155;}
      .pdf-csdd-ta-warn--yellow{border-left:3px solid #d97706;background:#fffbeb;color:#78350f;}
      .pdf-csdd-ta-warn--red{border-left:3px solid #dc2626;background:#fef2f2;color:#991b1b;}
      .pdf-csdd-ta-inspection{margin:0 0 8px;}
      .pdf-csdd-ta-inspection:last-child{margin-bottom:0;}
      .pdf-csdd-ta-inspection--historic{opacity:0.92;}
      .pdf-csdd-ta-inspection-meta{
        margin:0 0 3px;font-size:9pt;font-weight:600;line-height:1.3;color:#1d1d1f;
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
      .pdf-csdd-owner-timeline{margin:8px 0 4px;padding:8px 10px;border-radius:8px;background:#f8fafc;border:1px solid #e2e8f0;}
      .pdf-cv-subsection-title{margin:0 0 6px;font-size:10px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#64748b;}
      .pdf-cv-timeline{margin:6px 0 10px;padding:8px 10px;border-radius:8px;background:#fffbeb;border:1px solid #fde68a;}
      .pdf-cv-timeline-event{display:flex;flex-wrap:wrap;gap:6px 10px;font-size:10px;line-height:1.35;margin:0 0 3px;}
      .pdf-cv-timeline-date{min-width:72px;font-weight:700;color:#475569;}
      .pdf-cv-timeline-country{color:#64748b;}
      .pdf-cv-timeline-desc{color:#1d1d1f;flex:1 1 160px;}
      .pdf-csdd-owner-count{margin:0 0 6px;font-size:9pt;color:#1d1d1f;}
      .pdf-csdd-owner-events{display:flex;flex-direction:column;gap:3px;}
      .pdf-csdd-owner-event{display:flex;gap:8px;font-size:9pt;line-height:1.35;}
      .pdf-csdd-owner-date{min-width:72px;font-weight:600;color:#475569;}
      .pdf-csdd-owner-label{color:#1d1d1f;}
      .pdf-outvin-dealer-stack{margin:4px 0 0;}
      .pdf-outvin-subhead{
        margin:10px 0 4px!important;font-size:0.68rem!important;font-weight:600!important;
        color:#86868b!important;letter-spacing:0.02em;text-transform:none;
      }
      .pdf-outvin-dealer-stack > .pdf-outvin-subhead:first-child{margin-top:0!important;}
      .pdf-outvin-dealer-stack .pdf-v1-kv{margin:0 0 8px;}
      .pdf-outvin-plain{font-size:0.74rem;line-height:1.45;color:#0f172a;margin:0 0 8px;}
      .tabular{font-variant-numeric:tabular-nums;}
      .mirror-font-error{padding:16px;color:#991b1b;font-size:13px;}
      .pdf-site-footer{
        margin-top:22px;padding-top:0;border-top:1px solid #ececec;background:transparent;
        break-inside:avoid;page-break-inside:avoid;-webkit-column-break-inside:avoid;
      }
      .pdf-site-footer__grid{
        display:grid;grid-template-columns:1fr 1fr;gap:18px 26px;padding:18px 0 14px;align-items:start;
      }
      .pdf-site-footer__important-title{
        margin:0 0 8px;font-size:11px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;
        color:#6b7280;line-height:1.35;
      }
      .pdf-site-footer__disclaimer{margin:0;font-size:10px;font-weight:400;line-height:1.8;color:#6b7280;}
      .pdf-site-footer__confidentiality{
        margin:10px 0 0;font-size:10px;font-weight:700;line-height:1.8;color:#6b7280;
      }
      .pdf-site-footer__confidentiality strong{font-weight:700;}
      .pdf-site-footer__logo{display:block;width:118px;max-width:100%;height:auto;margin:0 0 10px;}
      .pdf-site-footer__value-body{margin:0;font-size:11px;font-weight:400;line-height:1.8;color:#6b7280;}
      .pdf-site-footer__bottom{
        border-top:1px solid #ececec;padding:14px 6px 2px;text-align:center;
      }
      .pdf-site-footer__bottom p{margin:0 0 5px;}
      .pdf-site-footer__bottom p:last-child{margin-bottom:0;}
      .pdf-site-footer__copyright{font-size:10px;font-weight:400;line-height:1.5;color:#9ca3af;}
      .pdf-site-footer__refs{font-size:10px;font-weight:400;line-height:1.5;color:#9ca3af;}
      .pdf-site-footer__gdpr{
        margin-top:6px!important;font-size:9px;font-weight:400;line-height:1.45;color:#9ca3af;
      }
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
        .pdf-v1-panel--clean,.pdf-alert-banners-stack,.pdf-info-banners-stack,.pdf-site-footer,.pdf-page-flow-chunk--avoid{
          break-inside:avoid-page!important;
          page-break-inside:avoid!important;
        }
      }
    ` +
    pdfLayoutDraftExtraCss() +
    `
      .provin-report-doc .pdf-unified-mileage-zone.pdf-surface-card,
      .provin-report-doc .pdf-unified-incidents-zone.pdf-surface-card{
        margin:0 0 14px!important;padding:12px 14px!important;border:1px solid #f1f5f9!important;border-radius:8px!important;
        background:#fff!important;box-shadow:0 1px 4px rgba(15,23,42,.05)!important;
      }
    `;
}

export function buildClientReportDocumentHtml(args: {
  payload: ClientReportPayload;
  portfolio: ClientReportPortfolioRow[];
  pdfInsights: PdfPortfolioFileInsight[];
  dateFmt: Intl.DateTimeFormat;
  formatBytes: (n: number) => string;
}): string {
  const { payload: p, dateFmt } = args;
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

  const infoBannersHtml = vis.alerts
    ? buildPdfInfoBannersHtml(
        filterInfoBannersForPdf(
          computeProvinInfoBannersFromPayloadSlice({
            csddForm: p.csddForm,
            autoRecordsBlock: p.autoRecordsBlock ?? null,
            manualVendorBlocks: p.manualVendorBlocks ?? null,
            manualLtabBlock: p.manualLtabBlock ?? null,
          }),
          p.pdfBannerInclude,
        ),
      )
    : "";
  if (infoBannersHtml) lines.push(infoBannersHtml);

  const alertBannersHtml = vis.alerts
    ? buildPdfAlertBannersHtml(
        filterAlertBannersForPdf(
          computeProvinAlertBannersFromPayloadSlice({
            csddForm: p.csddForm,
            autoRecordsBlock: p.autoRecordsBlock ?? null,
            manualVendorBlocks: p.manualVendorBlocks ?? null,
            citiAvotiBlock: p.citiAvoti ?? null,
            manualLtabBlock: p.manualLtabBlock ?? null,
            tirgusForm: p.tirgusForm ?? null,
          }),
          p.pdfBannerInclude,
        ),
      )
    : "";
  if (alertBannersHtml) lines.push(alertBannersHtml);

  const payBlock = vis.payment
    ? buildPdfAdminMirrorPaymentBlock(p, money, dateFmt, sectionIconPdfHtml("creditCard"))
    : "";
  if (payBlock) lines.push(payBlock);
  const vehicleBlock = vis.vehicle ? buildPdfAdminMirrorVehicleBlock(p, makeModel, sectionIconPdfHtml("carFront")) : "";
  if (vehicleBlock) lines.push(vehicleBlock);
  const clientBlock = vis.client ? buildPdfAdminMirrorClientBlock(p, sectionIconPdfHtml("userCircle")) : "";
  if (clientBlock) lines.push(clientBlock);
  const notesBlock = vis.notes ? buildPdfAdminMirrorNotesBlock(p.notes, sectionIconPdfHtml("messageSquare")) : "";
  if (notesBlock) lines.push(notesBlock);

  const provinSourcesStrip = buildProvinPdfSourcesUsedStripHtml(p, vis);
  if (provinSourcesStrip) lines.push(provinSourcesStrip);

  const mileageOpts: CollectUnifiedMileageOptions | undefined = vis.unifiedMileage
    ? {
        omitCsddMileage: !vis.csdd || !vis.csddMileageTable,
        omitAutoRecords: !vis.auto_records,
        omitVendorBlockTitles: vendorTitlesOmittedForPdf(vis),
      }
    : undefined;
  const unifiedMileageHtml = vis.unifiedMileage ? buildUnifiedMileageTableHtml(p, mileageOpts) : "";
  if (unifiedMileageHtml) lines.push(unifiedMileageHtml);

  const unifiedIncidentsHtml = buildUnifiedIncidentsTableHtml(p, vis);
  if (unifiedIncidentsHtml) lines.push(unifiedIncidentsHtml);

  const avotuHtml = buildAvotuDatiSectionHtml(p, vis);
  if (avotuHtml) lines.push(avotuHtml);

  const listingPriorityHtml = buildListingAnalysisPriorityHtml(p, vis);
  if (listingPriorityHtml) lines.push(listingPriorityHtml);

  const approvedHtml = buildApprovedByIrissHtml(p, vis);
  if (approvedHtml) lines.push(approvedHtml);

  if (p.isDemo) {
    lines.push('<p class="mirror-line"><strong>Demonstrācijas dati</strong> — daļa lauku ir parauga rakstura.</p>');
  }

  lines.push(
    '<p class="no-print" style="margin-top:12px"><button type="button" style="padding:7px 14px;font-size:12px;border-radius:6px;border:1px solid #94a3b8;background:#fff;color:#475569;cursor:pointer;font-family:Inter,sans-serif;font-weight:600" onclick="window.print()">Drukāt / PDF</button></p>',
  );

  lines.push(buildPdfSiteFooterHtml(new Date().getFullYear()));
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
