/**
 * Klienta PDF atskaite — tikai admin paneļa ievadīto datu spogulis.
 * Ar vienotu nobraukuma tabulu un gadu asi ar līknes grafiku PDF augšdaļā (visi avoti kopā).
 */

import type { PdfPortfolioFileInsight } from "@/lib/admin-portfolio-pdf-analysis";
import {
  autoRecordsBlockHasContent,
  CSDD_FORM_STRUCTURED_FIELDS,
  csddFormHasContent,
  LISTING_ANALYSIS_SUBSECTIONS,
  SOURCE_BLOCK_LABELS,
  listingAnalysisHasContent,
  LISTING_ANALYSIS_COMMENT_LABEL,
  LISTING_HISTORY_SUBSECTION_TITLE,
  NEGADIJUMU_VESTURE_TITLE,
  TIRGUS_LABEL_CREATED,
  TIRGUS_LABEL_LISTED,
  TIRGUS_LABEL_PRICE_DROP,
  tirgusFormHasContent,
  type AutoRecordsBlockState,
  type ClientManualLtabBlockPdf,
  type ClientManualVendorBlockPdf,
  type CitiAvotiBlockState,
  type CsddFormFields,
  type ListingAnalysisBlockState,
  type TirgusFormFields,
} from "@/lib/admin-source-blocks";
import {
  buildPdfAdminMirrorClientBlock,
  buildPdfAdminMirrorNotesBlock,
  buildPdfAdminMirrorPaymentBlock,
  buildPdfAdminMirrorVehicleBlock,
  pdfLayoutDraftExtraCss,
  provincLogoSvg,
} from "@/lib/client-report-pdf-layout-draft";
import { contactMailtoHref, whatsappChatUrl } from "@/lib/contact";
import {
  APPROVED_BY_IRISS_BODY_BG,
  APPROVED_BY_IRISS_HEADER_BG,
  LISTING_ANALYSIS_BODY_BG,
  LISTING_ANALYSIS_HEADER_BG,
  NEUTRAL_AVOTU_HEADER_BG,
} from "@/lib/admin-header-gradients";
import { pdfCountryFlagEmoji } from "@/lib/pdf-country-flags";
import {
  buildPdfAlertBannersHtml,
  computeProvinAlertBannersFromPayloadSlice,
} from "@/lib/provin-alert-banners";
import { CLIENT_REPORT_FOOTER_DISCLAIMER } from "@/lib/report-pdf-standards";
import { buildUnifiedMileageChartWrapHtml } from "@/lib/unified-mileage-chart";
import {
  collectUnifiedIncidentRows,
  sortUnifiedIncidentsNewestFirst,
  type UnifiedIncidentRow,
} from "@/lib/unified-incidents";
import {
  collectUnifiedMileageRows,
  computeOdometerAnomalyBySourceOrder,
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

/** PDF dokumenta virsraksti (UPPERCASE, saskaņoti ar produkta terminoloģiju). */
const PDF_MAIN_TITLE = "TRANSPORTLĪDZEKĻA AUDITS";
const PDF_SECTION_AVOTU_DATI = "AVOTU DATI";
const PDF_APPROVED_BY_IRISS = "APPROVED BY IRISS";
const PDF_IRISS_SECTION_1 = "1. Kopsavilkums";
const PDF_IRISS_SECTION_2 = "2. Ieteikumi klātienes apskatei";
const PDF_IRISS_SECTION_3 = "3. Cenas atbilstība";
const PDF_SUB_CSDD = "CSDD";
const PDF_SUB_BLOCK_COMMENTS = "Komentāri";
const PDF_SECTION_LISTING_ANALYSIS = "SLUDINĀJUMA ANALĪZE";

/** Mājaslapas primārais zils — grafiks, akcenti. */
const PDF_BRAND_BLUE = "#0061D2";
const PDF_MILEAGE_CHART_LINE = PDF_BRAND_BLUE;
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
};

export type ClientReportPortfolioRow = { name: string; size: number };

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const ICO = {
  user: `<svg class="pdf-ico" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/><circle cx="12" cy="7" r="4" stroke="currentColor" stroke-width="1.75"/></svg>`,
  shield: `<svg class="pdf-ico" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round"/></svg>`,
  car: `<svg class="pdf-ico" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 11l1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11M5 11h14v6a1 1 0 0 1-1 1h-1M5 11H4a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h1m14 0h1a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1h-1" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/><circle cx="7.5" cy="17.5" r="1.5" fill="currentColor"/><circle cx="16.5" cy="17.5" r="1.5" fill="currentColor"/></svg>`,
  chart: `<svg class="pdf-ico" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 3v18h18" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/><path d="M7 16l4-6 4 3 5-8" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  tag: `<svg class="pdf-ico" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 2H2v10l9.29 9.29a1 1 0 0 0 1.41 0l6.59-6.59a1 1 0 0 0 0-1.41L12 2z" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round"/><circle cx="7.5" cy="7.5" r="1" fill="currentColor"/></svg>`,
  clip: `<svg class="pdf-ico" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/><rect x="8" y="2" width="8" height="4" rx="1" stroke="currentColor" stroke-width="1.75"/></svg>`,
  spark: `<svg class="pdf-ico" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m12 3 1.6 5.2h5.4l-4.4 3.4 1.7 5.4L12 15.8 7.7 17.2l1.7-5.4L5 8.2h5.4L12 3z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>`,
  layers: `<svg class="pdf-ico" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 2 2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round"/></svg>`,
  clock: `<svg class="pdf-ico" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.75"/><path d="M12 7v6l4 2" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  alertTriangle: `<svg class="pdf-ico" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3 2 20h20L12 3z" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round"/><path d="M12 9v5M12 17h.01" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/></svg>`,
};

function sectionHeadBrand(icon: string, title: string): string {
  return `<div class="pdf-sec-head pdf-sec-head--brand"><span class="pdf-sec-ico-bubble" aria-hidden="true">${icon}</span><h2 class="pdf-sec pdf-sec--nobar">${escapeHtml(title)}</h2></div>`;
}

function sectionHead(icon: string, title: string, opts?: { noBar?: boolean }): string {
  const noBar = opts?.noBar === true;
  const headExtra = noBar ? " pdf-sec-head--nobar" : "";
  const hExtra = noBar ? " pdf-sec--nobar" : "";
  return `<div class="pdf-sec-head${headExtra}">${icon}<h2 class="pdf-sec${hExtra}">${escapeHtml(title)}</h2></div>`;
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

function pdfLossAmountAlertIconHtml(tier: "yellow" | "red"): string {
  const stroke = tier === "red" ? "#FF4D4D" : "#FFC107";
  return `<svg class="pdf-loss-amt-ico" width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="10" stroke="${stroke}" stroke-width="2"/><path d="M12 8v4M12 16h.01" stroke="${stroke}" stroke-width="2" stroke-linecap="round"/></svg>`;
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
  const ico = pdfLossAmountAlertIconHtml("red");
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

/** Neitrāla pelēka josla; krāsa tikai ikonā (pdf-avotu-ico-brand--*). */
function pdfAvotuNeutralHeader(iconHtml: string, title: string, iconBrandClass: string): string {
  return `<div class="pdf-avotu-header pdf-avotu-header--neutral"><span class="pdf-avotu-header-ico ${iconBrandClass}" aria-hidden="true">${iconHtml}</span><h3 class="pdf-avotu-header-title">${escapeHtml(title)}</h3></div>`;
}

/** Neatkarīga komentāru „sala” zem datu kartes — bez rāmja, #f9f9f9, slīpraksts. */
function pdfAvotuCommentIsland(text: string): string {
  const t = text.trim();
  if (!t) return "";
  return `<div class="pdf-avotu-comment-island" role="note">
    <p class="pdf-avotu-comment-island-label">${escapeHtml(PDF_SUB_BLOCK_COMMENTS)}</p>
    <pre class="mirror-pre pdf-avotu-comment-island-body">${escapeHtml(t)}</pre>
  </div>`;
}

function wrapPdfAvotuStack(cardHtml: string, islandHtml: string): string {
  if (!islandHtml) return cardHtml;
  return `<div class="pdf-avotu-block-wrap">${cardHtml}${islandHtml}</div>`;
}

function buildUnifiedMileageTableRowHtml(r: UnifiedMileageRow, anomalyBySourceOrder: Map<number, boolean>): string {
  const flag = pdfCountryFlagEmoji(r.country);
  const aria = escapeHtml(r.country);
  const odoEscaped = escapeHtml(r.odometer);
  const anom = anomalyBySourceOrder.get(r.sourceOrder) === true;
  const rowClass = anom ? "pdf-mileage-history-row pdf-mileage-history-row--anomaly" : "pdf-mileage-history-row";
  const ico = pdfLossAmountAlertIconHtml("red");
  const odoTd = anom
    ? `<td class="tabular pdf-mileage-cell-odo"><span class="pdf-data-alert-wrap pdf-num-warn pdf-num-warn--red"><span class="pdf-data-alert-ico" aria-hidden="true">${ico}</span><span class="tabular pdf-num-warn-digits">${odoEscaped}</span></span></td>`
    : `<td class="tabular pdf-mileage-cell-odo"><span class="pdf-mileage-odo-value">${odoEscaped}</span></td>`;
  return `<tr class="${rowClass}"><td class="pdf-mileage-cell-date">${escapeHtml(r.date)}</td>${odoTd}<td class="pdf-mileage-cell-flag"><span class="pdf-country-flag" role="img" aria-label="${aria}">${flag}</span></td></tr>`;
}

/** Pēdējie 10 ieraksti (jaunākie) + visas anomālijas; pārējie tiek paslēpti. */
function filterMileageRowsForPdfSmartView(
  rowsSortedNewestFirst: UnifiedMileageRow[],
  anomalyBySourceOrder: Map<number, boolean>,
): { display: UnifiedMileageRow[]; hiddenCount: number } {
  const n = rowsSortedNewestFirst.length;
  if (n <= 10) return { display: rowsSortedNewestFirst, hiddenCount: 0 };
  const keys = new Set<number>();
  for (let i = 0; i < 10; i++) keys.add(rowsSortedNewestFirst[i]!.sourceOrder);
  for (const r of rowsSortedNewestFirst) {
    if (anomalyBySourceOrder.get(r.sourceOrder)) keys.add(r.sourceOrder);
  }
  const display = rowsSortedNewestFirst.filter((r) => keys.has(r.sourceOrder));
  return { display, hiddenCount: n - display.length };
}

function buildMileageHistoryTableHtml(rows: UnifiedMileageRow[], anomalyBySourceOrder: Map<number, boolean>): string {
  if (rows.length === 0) return "";
  const colgroup = `<colgroup><col class="pdf-mileage-col-date" /><col class="pdf-mileage-col-odo" /><col class="pdf-mileage-col-flag" /></colgroup>`;
  const head = `<tr><th class="pdf-mileage-th-date" scope="col">Datums</th><th class="pdf-mileage-th-odo" scope="col">Odometrs (km)</th><th class="pdf-mileage-th-flag" scope="col">Valsts</th></tr>`;
  const body = rows.map((r) => buildUnifiedMileageTableRowHtml(r, anomalyBySourceOrder)).join("\n");
  return `<div class="pdf-mileage-history-table-wrap"><table class="pdf-mileage-history-table" role="table">${colgroup}<thead>${head}</thead><tbody>${body}</tbody></table></div>`;
}

export function buildUnifiedMileageTableHtml(p: UnifiedMileageSourcePayload): string {
  const collected = collectUnifiedMileageRows(p);
  if (collected.length === 0) return "";

  const anomalyBySourceOrder = computeOdometerAnomalyBySourceOrder(collected);

  const rows = [...collected].sort((a, b) => {
    if (a.sortableTime !== b.sortableTime) return b.sortableTime - a.sortableTime;
    return a.sourceOrder - b.sourceOrder;
  });

  const { display, hiddenCount } = filterMileageRowsForPdfSmartView(rows, anomalyBySourceOrder);
  const chartHtml = buildUnifiedMileageChartWrapHtml(collected, anomalyBySourceOrder, { compact: true });

  const mid = Math.ceil(display.length / 2) || 0;
  const leftRows = display.slice(0, mid);
  const rightRows = display.slice(mid);
  const dualTables =
    display.length === 0
      ? ""
      : display.length <= 4
        ? buildMileageHistoryTableHtml(display, anomalyBySourceOrder)
        : `<div class="pdf-mileage-dual"><div class="pdf-mileage-dual__cell">${buildMileageHistoryTableHtml(leftRows, anomalyBySourceOrder)}</div><div class="pdf-mileage-dual__cell">${buildMileageHistoryTableHtml(rightRows, anomalyBySourceOrder)}</div></div>`;

  const note =
    hiddenCount > 0
      ? `<p class="pdf-mileage-smart-note" role="note">Rādīti pēdējie 10 ieraksti un visi ar odometra anomāliju; vēl ${hiddenCount} ieraksti nav rādīti.</p>`
      : "";

  return `<div class="pdf-unified-mileage-zone pdf-surface-card" role="region">${sectionHeadBrand(ICO.clock, "NOBRAUKUMA VĒSTURE")}${chartHtml}${dualTables}${note}</div>`;
}

function buildUnifiedIncidentRowHtml(r: UnifiedIncidentRow): string {
  const lossCell = formatLossAmountEurCell(r.lossAmount);
  const flag = pdfCountryFlagEmoji(r.country);
  const aria = escapeHtml(r.country.trim() || "—");
  return `<tr class="pdf-mileage-history-row"><td class="pdf-mileage-cell-date">${escapeHtml(r.date)}</td><td class="tabular pdf-mileage-cell-odo">${lossCell}</td><td class="pdf-mileage-cell-flag"><span class="pdf-country-flag" role="img" aria-label="${aria}">${flag}</span></td></tr>`;
}

function buildIncidentHistoryTableHtml(rows: UnifiedIncidentRow[]): string {
  if (rows.length === 0) return "";
  const colgroup = `<colgroup><col class="pdf-mileage-col-date" /><col class="pdf-mileage-col-odo" /><col class="pdf-mileage-col-flag" /></colgroup>`;
  const head = `<tr><th class="pdf-mileage-th-date" scope="col">Datums</th><th class="pdf-mileage-th-odo" scope="col">Zaudējuma summa</th><th class="pdf-mileage-th-flag" scope="col">Valsts</th></tr>`;
  const body = rows.map(buildUnifiedIncidentRowHtml).join("\n");
  return `<div class="pdf-mileage-history-table-wrap"><table class="pdf-mileage-history-table" role="table">${colgroup}<thead>${head}</thead><tbody>${body}</tbody></table></div>`;
}

/** Apvienota negadījumu tabula (AutoDNA, CarVertical, LTAB, Citi avoti) — tikai rindas ar aizpildītu zaudējumu summu. */
function buildUnifiedIncidentsTableHtml(p: ClientReportPayload): string {
  const collected = collectUnifiedIncidentRows({
    manualVendorBlocks: p.manualVendorBlocks ?? null,
    manualLtabBlock: p.manualLtabBlock ?? null,
  });
  if (collected.length === 0) return "";
  const rows = sortUnifiedIncidentsNewestFirst(collected);
  const mid = Math.ceil(rows.length / 2);
  const left = rows.slice(0, mid);
  const right = rows.slice(mid);
  const tablesHtml =
    rows.length <= 3
      ? buildIncidentHistoryTableHtml(rows)
      : `<div class="pdf-mileage-dual"><div class="pdf-mileage-dual__cell">${buildIncidentHistoryTableHtml(left)}</div><div class="pdf-mileage-dual__cell">${buildIncidentHistoryTableHtml(right)}</div></div>`;
  return `<div class="pdf-unified-incidents-zone pdf-surface-card" role="region">${sectionHeadBrand(ICO.alertTriangle, NEGADIJUMU_VESTURE_TITLE)}${tablesHtml}</div>`;
}

/** CSDD — apskates datumi + nobraukuma tabulas (pilns eksports); raw nav PDF. */
function buildCsddAvotuSubsection(p: ClientReportPayload): string {
  const hasStruct = Boolean(p.csddForm && csddFormHasContent(p.csddForm));
  const hasRaw = p.csdd.trim().length > 0;
  if (!hasStruct && !hasRaw) return "";

  const header = pdfAvotuNeutralHeader(ICO.clip, PDF_SUB_CSDD, "pdf-avotu-ico-brand--csdd");

  if (hasStruct && p.csddForm) {
    const f = p.csddForm;
    const bodyParts: string[] = [];
    const regRows: string[] = [];
    for (const { key, label } of CSDD_FORM_STRUCTURED_FIELDS) {
      const v = (f[key] as string).trim();
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
    if (regRows.length > 0) {
      bodyParts.push(`<table class="mirror-table mirror-table--csdd"><tbody>${regRows.join("\n")}</tbody></table>`);
    }
    const bodyHtml = bodyParts.join("\n");
    const card =
      bodyHtml.trim() === ""
        ? `<div class="pdf-avotu-card pdf-avotu-card--neutral pdf-avotu-card--no-body">${header}</div>`
        : `<div class="pdf-avotu-card pdf-avotu-card--neutral">${header}<div class="pdf-avotu-body">${bodyHtml}</div></div>`;
    return card;
  }

  const card = `<div class="pdf-avotu-card pdf-avotu-card--neutral">${header}<div class="pdf-avotu-body"><pre class="mirror-pre">${escapeHtml(p.csdd.trim())}</pre></div></div>`;
  return card;
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
        `<tr><td>${escapeHtml(TIRGUS_LABEL_PRICE_DROP)}</td><td>${escapeHtml(f.priceDrop.trim())}</td></tr>`,
      );
    }
    const table =
      rows.length > 0
        ? `<table class="mirror-table"><tbody>${rows.join("\n")}</tbody></table>`
        : "";
    if (table) parts.push(table);
    if (f.comments.trim()) {
      parts.push(`<p class="pdf-field-label">${escapeHtml(LISTING_ANALYSIS_COMMENT_LABEL)}</p>`);
      parts.push(
        `<div class="pdf-listing-analysis-chunk"><pre class="mirror-pre pdf-listing-analysis-chunk-pre">${escapeHtml(f.comments.trim())}</pre></div>`,
      );
    }
  } else {
    parts.push(`<pre class="mirror-pre pdf-listing-analysis-chunk-pre">${escapeHtml(p.tirgus.trim())}</pre>`);
  }
  return parts.join("\n");
}

function pdfIconForVendorTitle(title: string): string {
  if (title === SOURCE_BLOCK_LABELS.autodna) return ICO.layers;
  if (title === SOURCE_BLOCK_LABELS.carvertical) return ICO.chart;
  if (title === SOURCE_BLOCK_LABELS.auto_records) return ICO.spark;
  return ICO.layers;
}

function vendorPdfIconBrandClass(title: string): string {
  if (title === SOURCE_BLOCK_LABELS.autodna) return "pdf-avotu-ico-brand--autodna";
  if (title === SOURCE_BLOCK_LABELS.carvertical) return "pdf-avotu-ico-brand--carvertical";
  if (title === SOURCE_BLOCK_LABELS.auto_records) return "pdf-avotu-ico-brand--auto-records";
  return "pdf-avotu-ico-brand--autodna";
}

/** AUTO RECORDS — PDF blokā rādam komentārus; nobraukums ir vienotajā tabulā augšā. */
function buildAutoRecordsAvotuSubsection(b: AutoRecordsBlockState | null | undefined): string {
  if (!b || !autoRecordsBlockHasContent(b)) return "";
  const hasComments = b.comments.trim().length > 0;
  if (!hasComments) return "";
  const header = pdfAvotuNeutralHeader(ICO.spark, SOURCE_BLOCK_LABELS.auto_records, "pdf-avotu-ico-brand--auto-records");
  const card = `<div class="pdf-avotu-card pdf-avotu-card--neutral pdf-avotu-card--no-body">${header}</div>`;
  return wrapPdfAvotuStack(card, hasComments ? pdfAvotuCommentIsland(b.comments) : "");
}

/** Viena trešā pušu avota apakšbloks zem „AVOTU DATI“ — tikai komentāri (nobraukums un negadījumi ir vienotajās tabulās augšā). */
function buildVendorAvotuSubsection(b: ClientManualVendorBlockPdf): string {
  const hasComments = b.comments.trim().length > 0;
  if (!hasComments) return "";
  const icon = pdfIconForVendorTitle(b.title);
  const iconBrand = vendorPdfIconBrandClass(b.title);
  const header = pdfAvotuNeutralHeader(icon, b.title, iconBrand);
  const card = `<div class="pdf-avotu-card pdf-avotu-card--neutral pdf-avotu-card--no-body">${header}</div>`;
  return wrapPdfAvotuStack(card, pdfAvotuCommentIsland(b.comments));
}

function buildLtabAvotuSubsection(b: ClientManualLtabBlockPdf | null | undefined): string {
  if (!b) return "";
  const hasComments = b.comments.trim().length > 0;
  if (!hasComments) return "";
  const header = pdfAvotuNeutralHeader(ICO.shield, SOURCE_BLOCK_LABELS.ltab, "pdf-avotu-ico-brand--ltab");
  const card = `<div class="pdf-avotu-card pdf-avotu-card--neutral pdf-avotu-card--no-body">${header}</div>`;
  return wrapPdfAvotuStack(card, pdfAvotuCommentIsland(b.comments));
}

/**
 * Sludinājuma analīze — patstāvīgs bloks: vispirms „Sludinājuma vēsture” (tirgus dati), tad pārējās apakšsadaļas.
 */
function buildListingAnalysisPriorityHtml(p: ClientReportPayload): string {
  const tirgusBody = buildTirgusListingHistoryBodyHtml(p);
  const b = p.listingAnalysis;
  const hasListingFields = Boolean(b && listingAnalysisHasContent(b));

  const inner: string[] = [];
  if (tirgusBody) {
    inner.push(`<p class="pdf-field-label">${escapeHtml(LISTING_HISTORY_SUBSECTION_TITLE)}</p>`);
    inner.push(`<div class="pdf-listing-analysis-chunk">${tirgusBody}</div>`);
  }
  if (b && hasListingFields) {
    const L = LISTING_ANALYSIS_SUBSECTIONS;
    const cat = (title: string, text: string) => {
      const t = text.trim();
      if (!t) return;
      inner.push(`<p class="pdf-field-label">${escapeHtml(title)}</p>`);
      inner.push(
        `<div class="pdf-listing-analysis-chunk"><pre class="mirror-pre pdf-listing-analysis-chunk-pre">${escapeHtml(t)}</pre></div>`,
      );
    };
    cat(L.sellerPortrait, b.sellerPortrait);
    cat(L.photoAnalysis, b.photoAnalysis);
    cat(L.listingDescription, b.listingDescription);
  }
  if (inner.length === 0) return "";
  const parts: string[] = [];
  parts.push(`<div class="pdf-listing-priority" role="region">`);
  parts.push(
    `<div class="pdf-listing-priority-header"><span class="pdf-listing-priority-ico" aria-hidden="true">${ICO.spark}</span><h2 class="pdf-listing-priority-title">${escapeHtml(PDF_SECTION_LISTING_ANALYSIS)}</h2></div>`,
  );
  parts.push(`<div class="pdf-listing-priority-body">${inner.join("\n")}</div>`);
  parts.push(`</div>`);
  return parts.join("\n");
}

/** Citi avoti — tīri komentāri (nobraukums un negadījumi ir vienotajās tabulās augšā). */
function buildCitiAvotiAvotuSubsection(p: ClientReportPayload): string {
  const b = p.citiAvoti;
  if (!b || !b.comments.trim()) return "";
  const header = pdfAvotuNeutralHeader(ICO.layers, SOURCE_BLOCK_LABELS.citi_avoti, "pdf-avotu-ico-brand--citi-avoti");
  const card = `<div class="pdf-avotu-card pdf-avotu-card--neutral pdf-avotu-card--no-body">${header}</div>`;
  return wrapPdfAvotuStack(card, pdfAvotuCommentIsland(b.comments));
}

/**
 * AVOTU DATI (PDF): CSDD, AutoDNA / CarVertical / Auto-Records, LTAB, Citi avoti.
 * Nobraukuma un negadījumu tabulas ir augšā (NOBRAUKUMA / NEGADĪJUMU VĒSTURE); šeit — komentāri un CSDD.
 * Tirgus dati ir integrēti „Sludinājuma analīzē” (buildListingAnalysisPriorityHtml).
 */
function buildAvotuDatiSectionHtml(p: ClientReportPayload): string {
  const csdd = buildCsddAvotuSubsection(p);
  const ltab = buildLtabAvotuSubsection(p.manualLtabBlock);
  const citiAvoti = buildCitiAvotiAvotuSubsection(p);

  const vendors = p.manualVendorBlocks ?? [];
  const byTitle = new Map(vendors.map((b) => [b.title, b]));
  const vendorHtml = (title: string) => {
    const b = byTitle.get(title);
    return b ? buildVendorAvotuSubsection(b) : "";
  };
  const autodna = vendorHtml(SOURCE_BLOCK_LABELS.autodna);
  const carvertical = vendorHtml(SOURCE_BLOCK_LABELS.carvertical);
  const autoRecords = buildAutoRecordsAvotuSubsection(p.autoRecordsBlock ?? null);

  const stack = [csdd, autodna, carvertical, autoRecords, ltab, citiAvoti].filter(Boolean);
  if (stack.length === 0) return "";

  const parts: string[] = [];
  parts.push(`<div class="pdf-avotu-zone" role="region">`);
  parts.push(sectionHead(ICO.user, PDF_SECTION_AVOTU_DATI, { noBar: true }));
  parts.push(stack.join("\n"));
  parts.push(`</div>`);
  return parts.join("\n");
}

/** Galvenais eksperta kopsavilkums — pilnā platumā, pēdējais lielais bloks pirms juridiskās piezīmes. */
function buildApprovedByIrissHtml(p: ClientReportPayload): string {
  const iriss = p.iriss.trim();
  const plan = p.apskatesPlāns.trim();
  const priceFit = p.cenasAtbilstiba.trim();
  if (!iriss && !plan && !priceFit) return "";
  const priceFitBlock = priceFit
    ? `Cenas atbilstība balstoties uz mūsu rīcībā esošajiem datiem:\n${priceFit}`
    : "";
  const parts: string[] = [];
  parts.push(`<div class="pdf-iriss-approved" role="region">`);
  parts.push(
    `<div class="pdf-iriss-approved-header"><span class="pdf-iriss-approved-ico" aria-hidden="true">${ICO.shield}</span><h2 class="pdf-iriss-approved-title">${escapeHtml(PDF_APPROVED_BY_IRISS)}</h2></div>`,
  );
  parts.push(`<div class="pdf-iriss-approved-body">`);
  if (iriss) {
    parts.push(`<div class="pdf-iriss-approved-part">`);
    parts.push(`<h3 class="pdf-iriss-approved-subsection">${escapeHtml(PDF_IRISS_SECTION_1)}</h3>`);
    parts.push(`<pre class="mirror-pre pdf-iriss-approved-text">${escapeHtml(iriss)}</pre>`);
    parts.push(`</div>`);
  }
  if (plan) {
    parts.push(`<div class="pdf-iriss-approved-part">`);
    parts.push(`<h3 class="pdf-iriss-approved-subsection">${escapeHtml(PDF_IRISS_SECTION_2)}</h3>`);
    parts.push(`<pre class="mirror-pre pdf-iriss-approved-text">${escapeHtml(plan)}</pre>`);
    parts.push(`</div>`);
  }
  if (priceFitBlock) {
    parts.push(`<div class="pdf-iriss-approved-part">`);
    parts.push(`<h3 class="pdf-iriss-approved-subsection">${escapeHtml(PDF_IRISS_SECTION_3)}</h3>`);
    parts.push(`<pre class="mirror-pre pdf-iriss-approved-text">${escapeHtml(priceFitBlock)}</pre>`);
    parts.push(`</div>`);
  }
  parts.push(`</div></div>`);
  return parts.join("\n");
}

function buildPdfFooterCtaHtml(): string {
  const mail = contactMailtoHref();
  const wa = whatsappChatUrl();
  return `<footer class="pdf-footer-cta" role="contentinfo">
  <div class="pdf-footer-cta__inner">
    <div class="pdf-footer-cta__logo">${provincLogoSvg().replace('class="pdf-v1-logo"', 'class="pdf-v1-logo pdf-footer-cta__logo-img"')}</div>
    <p class="pdf-footer-cta__line">
      <a href="${escapeHtml(mail)}" class="pdf-footer-cta__link">E-pasts</a>
      <span class="pdf-footer-cta__sep"> · </span>
      <a href="${escapeHtml(wa)}" class="pdf-footer-cta__link" target="_blank" rel="noopener noreferrer">WhatsApp</a>
    </p>
    <p class="pdf-footer-cta__hint">Jautājumi pēc atskates — sazinieties ar PROVIN.LV</p>
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
  const neutralBg = NEUTRAL_AVOTU_HEADER_BG;
  const listHdr = LISTING_ANALYSIS_HEADER_BG;
  const listingBodyBg = LISTING_ANALYSIS_BODY_BG;
  const irissHdr = APPROVED_BY_IRISS_HEADER_BG;
  const irissBody = APPROVED_BY_IRISS_BODY_BG;
  return `
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
        background:#fff;
        -webkit-font-smoothing:antialiased;
      }
      .sheet{background:#fff;padding:0;}
      .pdf-sec-head{display:flex;align-items:center;gap:8px;margin:0.75rem 0 0.35rem;}
      .pdf-sec-head--nobar{margin-top:0;}
      .pdf-sec-head .pdf-ico{color:${PDF_BRAND_BLUE};width:14px;height:14px;flex-shrink:0;}
      h2.pdf-sec{
        font-size:0.75rem;font-weight:700;margin:0;flex:1;color:#0f172a;letter-spacing:0.06em;line-height:1.35;
        padding:0 0 0 8px;border-left:2px solid ${PDF_BRAND_BLUE};text-transform:uppercase;
      }
      h2.pdf-sec--nobar{border-left:none;padding-left:0;}
      h3.pdf-sub{font-size:0.75rem;font-weight:700;margin:0.6rem 0 0.35rem;color:#000;text-transform:uppercase;letter-spacing:0.05em;}
      h3.pdf-sub:first-child{margin-top:0;}
      .pdf-subhead{display:flex;align-items:center;gap:8px;margin:0 0 0.4rem;}
      .pdf-subhead-ico{display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;}
      .pdf-subhead-ico .pdf-ico{width:14px;height:14px;}
      h3.pdf-sub.pdf-sub--with-ico{margin:0;border-left:none;padding:0;}
      .pdf-sec-head--brand{align-items:center;gap:10px;margin:0 0 12px;}
      .pdf-sec-ico-bubble{
        display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:50%;
        background:rgba(0,97,210,0.1);color:${PDF_BRAND_BLUE};flex-shrink:0;
        -webkit-print-color-adjust:exact;print-color-adjust:exact;
      }
      .pdf-sec-ico-bubble .pdf-ico{width:18px;height:18px;}
      .pdf-field-label{font-size:0.68rem;font-weight:600;margin:0.45rem 0 0.2rem;color:#334155;letter-spacing:0.02em;}
      .pdf-avotu-block-wrap{margin:0 0 12px;}
      .pdf-avotu-block-wrap:last-child{margin-bottom:0;}
      .pdf-avotu-card{
        border:1px solid #e8eaed;border-radius:8px;overflow:hidden;background:#fff;
        box-shadow:0 1px 3px rgba(15,23,42,.06);
        -webkit-print-color-adjust:exact;print-color-adjust:exact;
      }
      .pdf-avotu-card--no-body .pdf-avotu-header{border-radius:8px;}
      .pdf-avotu-header{
        display:flex;align-items:center;gap:8px;padding:8px 12px;border-radius:8px 8px 0 0;
        -webkit-print-color-adjust:exact;print-color-adjust:exact;
      }
      .pdf-avotu-header-ico{display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;}
      .pdf-avotu-header-ico .pdf-ico{width:14px;height:14px;}
      .pdf-avotu-header-title{
        margin:0;font-size:0.75rem;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;flex:1;line-height:1.25;
      }
      .pdf-avotu-header--neutral{background:${neutralBg};color:#334155;}
      .pdf-avotu-header--neutral .pdf-avotu-header-title{color:#334155;}
      .pdf-avotu-ico-brand--csdd .pdf-ico{color:#059669;}
      .pdf-avotu-ico-brand--autodna .pdf-ico{color:#1d4ed8;}
      .pdf-avotu-ico-brand--carvertical .pdf-ico{color:#d97706;}
      .pdf-avotu-ico-brand--auto-records .pdf-ico{color:#ea580c;}
      .pdf-avotu-ico-brand--ltab .pdf-ico{color:#dc2626;}
      .pdf-avotu-ico-brand--tirgus .pdf-ico{color:#0284c7;}
      .pdf-avotu-ico-brand--citi-avoti .pdf-ico{color:#7c3aed;}
      .pdf-avotu-body{padding:10px 12px;background:#fff;border-radius:0 0 8px 8px;}
      .pdf-listing-priority{
        margin:0 0 18px;border-radius:16px;overflow:hidden;border:0;
        box-shadow:0 4px 20px rgba(15,23,42,.07);
        -webkit-print-color-adjust:exact;print-color-adjust:exact;
      }
      .pdf-listing-priority-header{
        display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:10px 10px 0 0;
        background:${listHdr};color:#fff;
        -webkit-print-color-adjust:exact;print-color-adjust:exact;
      }
      .pdf-listing-priority-ico .pdf-ico{width:18px;height:18px;color:#fff;flex-shrink:0;}
      .pdf-listing-priority-title{
        margin:0;font-size:0.72rem;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;
      }
      .pdf-listing-priority-body{
        padding:12px 14px 14px;background:${listingBodyBg};
        -webkit-print-color-adjust:exact;print-color-adjust:exact;
      }
      .pdf-listing-analysis-chunk{
        margin:0 0 8px;padding:8px 10px;background:#f8fafc;border-radius:4px;
        -webkit-print-color-adjust:exact;print-color-adjust:exact;
      }
      .pdf-listing-analysis-chunk:last-child{margin-bottom:0;}
      .pdf-listing-analysis-chunk-pre{font-style:italic;margin:0;}
      .pdf-avotu-comment-island{
        margin-top:14px;padding:12px 14px;background:#F8FAFC;border-radius:6px;
        -webkit-print-color-adjust:exact;print-color-adjust:exact;
      }
      .pdf-avotu-comment-island-label{
        font-size:0.65rem;font-weight:700;margin:0 0 5px;color:#000;letter-spacing:0.06em;text-transform:uppercase;
      }
      .pdf-avotu-comment-island-body{font-style:italic;margin:0;}
      .pdf-avotu-zone{
        margin:0 0 18px;padding:16px 18px;border:0;border-radius:16px;
        background:#fff;box-shadow:0 4px 20px rgba(15,23,42,.07);
        -webkit-print-color-adjust:exact;print-color-adjust:exact;
      }
      .pdf-avotu-zone .pdf-sec-head{margin-top:0;}
      .pdf-avotu-zone > .pdf-avotu-card{margin-bottom:12px;}
      .pdf-avotu-zone > .pdf-avotu-card:last-child{margin-bottom:0;}
      .pdf-unified-mileage-zone{margin:0 0 18px;padding:16px 18px;}
      .pdf-unified-mileage-zone .pdf-sec-head{margin-top:0;}
      .pdf-unified-incidents-zone{margin:0 0 18px;padding:16px 18px;}
      .pdf-unified-incidents-zone .pdf-sec-head{margin-top:0;}
      .pdf-mileage-dual{
        display:grid;grid-template-columns:1fr 1fr;gap:10px 12px;align-items:start;margin:8px 0 0;
      }
      .pdf-mileage-dual__cell{min-width:0;}
      .pdf-mileage-smart-note{
        margin:10px 0 0;font-size:0.62rem;color:#64748b;line-height:1.4;font-style:italic;
      }
      .pdf-mileage-history-table-wrap{
        width:100%;margin:6px 0 0;border-radius:8px;overflow:hidden;
        -webkit-print-color-adjust:exact;print-color-adjust:exact;
      }
      .pdf-mileage-history-table{
        width:100%;border-collapse:collapse;table-layout:fixed;
        font-family:Inter,sans-serif!important;font-size:11px;line-height:1.35;
        -webkit-font-feature-settings:"tnum" 1;font-feature-settings:"tnum" 1;
      }
      .pdf-mileage-history-table col.pdf-mileage-col-date{width:27%;}
      .pdf-mileage-history-table col.pdf-mileage-col-odo{width:40%;}
      .pdf-mileage-history-table col.pdf-mileage-col-flag{width:33%;}
      .pdf-mileage-history-table thead th{
        font-weight:700!important;color:#64748b!important;
        letter-spacing:0.04em!important;text-transform:none;
        padding:8px 10px 6px 10px!important;border-bottom:1px solid #E0E0E0!important;
        font-family:Inter,sans-serif!important;font-size:11px!important;
        vertical-align:bottom!important;
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
      .pdf-mileage-history-table th.pdf-mileage-th-flag{text-align:right!important;}
      .pdf-mileage-history-table td.pdf-mileage-cell-date{
        color:#374151!important;font-weight:500!important;white-space:nowrap;text-align:left!important;
      }
      .pdf-mileage-history-table td.pdf-mileage-cell-odo{text-align:center!important;}
      .pdf-mileage-history-table td.pdf-mileage-cell-flag{
        text-align:right!important;vertical-align:middle!important;
      }
      .pdf-mileage-odo-value{color:#1d1d1f;font-weight:500;}
      .pdf-country-flag{
        font-style:normal;font-variant:normal;letter-spacing:0;
        font-size:1.05em;line-height:1;display:inline-flex;align-items:center;justify-content:center;
        font-family:"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",Inter,sans-serif;
        -webkit-print-color-adjust:exact;print-color-adjust:exact;
      }
      .pdf-mileage-chart-wrap{
        margin:0 0 10px;padding:8px 10px 4px;border-radius:12px;border:0;background:#fff;
        box-shadow:0 1px 0 rgba(15,23,42,.06) inset;
        -webkit-print-color-adjust:exact;print-color-adjust:exact;
      }
      .pdf-mileage-chart-wrap--compact .pdf-mileage-chart-svg{max-height:92px;}
      .pdf-mileage-chart-svg{display:block;width:100%;max-width:480px;height:auto;margin:0 auto;}
      .pdf-mileage-chart-grid{stroke:${PDF_MILEAGE_CHART_GRID};stroke-width:1;fill:none;}
      .pdf-mileage-chart-path{
        stroke:${PDF_MILEAGE_CHART_LINE};stroke-width:2.25;fill:none;stroke-linecap:round;stroke-linejoin:round;
      }
      .pdf-mileage-chart-dot{
        fill:#fff;stroke:${PDF_MILEAGE_CHART_LINE};stroke-width:1.75;
        -webkit-print-color-adjust:exact;print-color-adjust:exact;
      }
      .pdf-mileage-chart-year{
        fill:${PDF_MILEAGE_CHART_AXIS};font-family:Inter,sans-serif;font-size:8.5px;font-weight:500;
      }
      .pdf-mileage-chart-legend{
        display:flex;align-items:center;gap:6px;padding:0 10px 8px 12px;font-size:0.62rem;color:#64748b;
      }
      .pdf-mileage-chart-legend-line{
        display:inline-block;width:18px;height:2px;border-radius:1px;background:${PDF_MILEAGE_CHART_LINE};
        flex-shrink:0;
      }
      .pdf-mileage-chart-legend-text{font-weight:500;color:#64748b;}
      .pdf-mileage-chart-dot--anomaly{
        fill:#ef4444!important;stroke:#b91c1c!important;stroke-width:1.75!important;
        -webkit-print-color-adjust:exact;print-color-adjust:exact;
      }
      .pdf-alert-banners-stack{
        display:flex;flex-direction:column;gap:8px;margin:0 0 10px;
      }
      .pdf-alert-banner{
        display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:0 6px 6px 0;
        -webkit-print-color-adjust:exact;print-color-adjust:exact;
      }
      .pdf-alert-banner--red{
        background:#fff8f8;border-left:5px solid #FF4D4D;color:#FF4D4D;
      }
      .pdf-alert-banner--yellow{
        background:#fffdf5;border-left:5px solid #FFC107;color:#FFC107;
      }
      .pdf-alert-banner-text{
        flex:1;margin:0;font-size:8pt;line-height:1.35;color:#374151;font-family:Inter,sans-serif!important;
      }
      .pdf-alert-banner-ico{flex-shrink:0;display:block;}
      .pdf-alert-banner--red .pdf-alert-banner-text{color:#374151;}
      .pdf-alert-banner--yellow .pdf-alert-banner-text{color:#374151;}
      .pdf-alert-banner .pdf-alert-banner-ico:last-child{margin-left:auto;}
      .pdf-data-alert-wrap{
        display:inline-flex;align-items:center;gap:6px;max-width:100%;vertical-align:middle;
      }
      .pdf-data-alert-ico{flex-shrink:0;display:block;line-height:0;}
      .pdf-csdd-alert-wrap{
        display:flex;align-items:center;gap:6px;width:100%;
      }
      .pdf-num-warn{font-size:9pt!important;line-height:1.2;font-family:Inter,sans-serif!important;vertical-align:middle;}
      .pdf-num-warn--red .pdf-num-warn-digits{color:#FF4D4D!important;font-weight:600!important;}
      .pdf-num-warn--yellow .pdf-num-warn-digits{color:#FFC107!important;font-weight:600!important;}
      .pdf-loss-amt-ico{flex-shrink:0;display:block;}
      .mirror-block{margin:0 0 10px;padding:0 0 8px;border-bottom:1px solid #f1f5f9;}
      .mirror-block.pdf-surface-card{border-bottom:none;padding-bottom:0;margin-bottom:12px;}
      .mirror-block-head{display:flex;align-items:center;gap:8px;margin:0 0 6px;}
      .mirror-ico{color:${PDF_BRAND_BLUE};}
      .mirror-ico .pdf-ico{width:14px;height:14px;}
      .mirror-pre{
        white-space:pre-wrap;font-size:0.72rem;margin:0;padding:0;font-family:Inter,sans-serif!important;
        color:#1d1d1f;line-height:1.45;
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
        flex:1;display:flex;align-items:center;gap:6px;padding:6px 8px;border-radius:4px;font-size:9pt!important;line-height:1.25;
        border:1px solid #e2e8f0;
        -webkit-print-color-adjust:exact;print-color-adjust:exact;
      }
      .pdf-csdd-alert--red{background:#fff1f2;}
      .pdf-csdd-alert--yellow{background:#fefce8;}
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
      .mirror-table--csdd-mh{font-size:9pt!important;margin:2px 0 4px!important;}
      .mirror-table--csdd-mh td,.mirror-table--csdd-mh th{padding:3px 4px!important;line-height:1.25!important;border-bottom:1px solid #f1f5f9!important;}
      .mirror-table--csdd-mh thead th{font-size:9pt!important;}
      .tabular{font-variant-numeric:tabular-nums;}
      .pdf-iriss-approved{
        margin:0 0 14px;border-radius:10px;overflow:hidden;border:1px solid #bfdbfe;
        box-shadow:0 8px 24px rgba(15,23,42,.1);
        -webkit-print-color-adjust:exact;print-color-adjust:exact;
      }
      .pdf-iriss-approved-header{
        display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:10px 10px 0 0;
        background:${irissHdr};color:#fff;
        -webkit-print-color-adjust:exact;print-color-adjust:exact;
      }
      .pdf-iriss-approved-ico .pdf-ico{width:18px;height:18px;color:#fff;flex-shrink:0;}
      .pdf-iriss-approved-title{
        margin:0;font-size:0.72rem;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;
      }
      .pdf-iriss-approved-body{padding:14px 16px 16px;background:${irissBody};}
      .pdf-iriss-approved-subtitle{
        margin:0 0 8px;font-size:0.68rem;font-weight:700;color:#000;letter-spacing:0.06em;text-transform:uppercase;
      }
      .pdf-iriss-approved-part:not(:first-child){margin-top:10px;}
      .pdf-iriss-approved-subsection{
        margin:0 0 6px;font-size:0.72rem;font-weight:700;color:#000;letter-spacing:0.02em;text-transform:none;
      }
      .pdf-iriss-approved-text{font-size:0.78rem;}
      .mirror-font-error{padding:16px;color:#991b1b;font-size:13px;}
      .legal-block{margin-top:12px;padding-top:8px;border-top:1px solid #f1f5f9;font-size:0.68rem;color:#86868b;line-height:1.45;}
      .report-foot{margin-top:12px;padding-top:8px;border-top:1px solid #f1f5f9;font-size:0.65rem;color:#94a3b8;}
      .pdf-footer-cta{
        margin-top:16px;padding:16px 18px;border-radius:14px;background:#fff;
        box-shadow:0 4px 20px rgba(15,23,42,.07);text-align:center;
        -webkit-print-color-adjust:exact;print-color-adjust:exact;
      }
      .pdf-footer-cta__inner{max-width:100%;}
      .pdf-footer-cta__logo{margin:0 auto 8px}
      .pdf-footer-cta__logo-img{display:block;width:180px;max-width:100%;height:auto;margin:0 auto}
      .pdf-footer-cta__line{margin:0;font-size:0.72rem;font-weight:600;}
      .pdf-footer-cta__link{color:${PDF_BRAND_BLUE}!important;text-decoration:none;}
      .pdf-footer-cta__sep{color:#94a3b8;margin:0 4px;}
      .pdf-footer-cta__hint{margin:8px 0 0;font-size:0.62rem;color:#64748b;}
      code{font-family:Inter,sans-serif!important;font-variant-numeric:normal!important;font-size:0.72rem;background:#f5f5f7;padding:1px 6px;border-radius:4px;}
      .pdf-vin{font-family:Inter,sans-serif!important;font-variant-numeric:normal!important;font-size:0.72rem;background:transparent;padding:0;}
      .pdf-flag-num{font-weight:600;}
      @media print{
        body{padding:8mm 10mm;}
        .no-print{display:none!important;}
        .pdf-avotu-block-wrap{break-inside:avoid-page;}
        .pdf-mileage-chart-wrap{break-inside:avoid-page;}
        .pdf-mileage-history-table-wrap{break-inside:avoid-page;}
        .pdf-listing-priority{break-inside:avoid-page;}
        .pdf-iriss-approved{break-inside:avoid-page;}
        .pdf-alert-banners-stack{break-inside:avoid-page;}
      }
    ` + pdfLayoutDraftExtraCss();
}

export function buildClientReportDocumentHtml(args: {
  payload: ClientReportPayload;
  portfolio: ClientReportPortfolioRow[];
  pdfInsights: PdfPortfolioFileInsight[];
  dateFmt: Intl.DateTimeFormat;
  formatBytes: (n: number) => string;
}): string {
  const { payload: p, dateFmt } = args;

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

  const alertBannersHtml = buildPdfAlertBannersHtml(
    computeProvinAlertBannersFromPayloadSlice({
      csddForm: p.csddForm,
      autoRecordsBlock: p.autoRecordsBlock ?? null,
      manualVendorBlocks: p.manualVendorBlocks ?? null,
      manualLtabBlock: p.manualLtabBlock ?? null,
      tirgusForm: p.tirgusForm ?? null,
    }),
  );
  if (alertBannersHtml) lines.push(alertBannersHtml);

  const payBlock = buildPdfAdminMirrorPaymentBlock(p, money, dateFmt, ICO.chart);
  if (payBlock) lines.push(payBlock);
  const vehicleBlock = buildPdfAdminMirrorVehicleBlock(p, makeModel, ICO.car);
  if (vehicleBlock) lines.push(vehicleBlock);
  const clientBlock = buildPdfAdminMirrorClientBlock(p, ICO.user);
  if (clientBlock) lines.push(clientBlock);
  const notesBlock = buildPdfAdminMirrorNotesBlock(p.notes, ICO.clip);
  if (notesBlock) lines.push(notesBlock);

  const unifiedMileageHtml = buildUnifiedMileageTableHtml(p);
  if (unifiedMileageHtml) lines.push(unifiedMileageHtml);

  const unifiedIncidentsHtml = buildUnifiedIncidentsTableHtml(p);
  if (unifiedIncidentsHtml) lines.push(unifiedIncidentsHtml);

  const avotuHtml = buildAvotuDatiSectionHtml(p);
  if (avotuHtml) lines.push(avotuHtml);

  const listingPriorityHtml = buildListingAnalysisPriorityHtml(p);
  if (listingPriorityHtml) lines.push(listingPriorityHtml);

  const approvedHtml = buildApprovedByIrissHtml(p);
  if (approvedHtml) lines.push(approvedHtml);

  lines.push('<div class="legal-block">');
  lines.push(`<p>${escapeHtml(CLIENT_REPORT_FOOTER_DISCLAIMER)}</p>`);
  lines.push("</div>");

  if (p.isDemo) {
    lines.push('<p class="mirror-line"><strong>Demonstrācijas dati</strong> — daļa lauku ir parauga rakstura.</p>');
  }

  lines.push(
    '<p class="no-print" style="margin-top:12px"><button type="button" style="padding:7px 14px;font-size:12px;border-radius:6px;border:1px solid #94a3b8;background:#fff;color:#475569;cursor:pointer;font-family:Inter,sans-serif;font-weight:600" onclick="window.print()">Drukāt / PDF</button></p>',
  );

  lines.push(
    `<div class="report-foot">© PROVIN.LV · konsultatīva atskaite · ${escapeHtml(dateFmt.format(new Date()))}</div>`,
  );
  lines.push(buildPdfFooterCtaHtml());
  lines.push("</div>");

  const title = `PROVIN ${p.vin ?? p.sessionId}`;
  const html = `<!DOCTYPE html><html lang="lv"><head><meta charset="utf-8"/>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet"/>
<title>${escapeHtml(title)}</title><style>${clientReportPrintCss()}</style></head><body class="provin-report-doc">${lines.join("\n")}${reportFontGuardScript()}</body></html>`;
  return html;
}
