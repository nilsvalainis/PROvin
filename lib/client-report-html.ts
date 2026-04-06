/**
 * Klienta PDF atskaite — tikai admin paneļa ievadīto datu spogulis.
 * Nav apvienoto tabulu, grafiku, prognožu vai automātisku risku kopsavilkumu.
 */

import type { PdfPortfolioFileInsight } from "@/lib/admin-portfolio-pdf-analysis";
import { amountToIntRough } from "@/lib/claim-rows-parse";
import {
  citiAvotiHasContent,
  LISTING_ANALYSIS_SUBSECTIONS,
  SOURCE_BLOCK_LABELS,
  listingAnalysisHasContent,
  type ClientManualLtabBlockPdf,
  type ClientManualVendorBlockPdf,
  type CitiAvotiBlockState,
  type CsddFormFields,
  type ListingAnalysisBlockState,
  type TirgusFormFields,
} from "@/lib/admin-source-blocks";
import {
  CSDD_FORM_SHORT_FIELDS,
  CSDD_LABEL_PREV_RATING,
  csddFormHasContent,
  TIRGUS_LABEL_CREATED,
  TIRGUS_LABEL_LISTED,
  TIRGUS_LABEL_PRICE_DROP,
  tirgusFormHasContent,
} from "@/lib/admin-source-blocks";
import {
  buildPdfAdminMirrorClientBlock,
  buildPdfAdminMirrorNotesBlock,
  buildPdfAdminMirrorPaymentBlock,
  buildPdfAdminMirrorVehicleBlock,
  pdfLayoutDraftExtraCss,
  provincLogoSvg,
} from "@/lib/client-report-pdf-layout-draft";
import { CLIENT_REPORT_FOOTER_DISCLAIMER } from "@/lib/report-pdf-standards";

/** PDF dokumenta virsraksti (UPPERCASE, saskaņoti ar produkta terminoloģiju). */
const PDF_MAIN_TITLE = "TRANSPORTLĪDZEKĻA AUDITS";
const PDF_SECTION_AVOTU_DATI = "AVOTU DATI";
const PDF_SECTION_TIRGUS_DATI = "TIRGUS DATI";
const PDF_APPROVED_BY_IRISS = "APPROVED BY IRISS";
const PDF_KOPSAVILKUMS_UN_APSKATES_PLANS = "KOPSAVILKUMS UN APSKATES PLĀNS";
const PDF_SUB_CSDD = "CSDD";
const PDF_SUB_BLOCK_COMMENTS = "Komentāri";
const PDF_SECTION_LISTING_ANALYSIS = "SLUDINĀJUMA ANALĪZE";

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
  listingMarket?: import("@/lib/listing-scrape").ListingMarketSnapshot | null;
  manualVendorBlocks?: ClientManualVendorBlockPdf[];
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
};

function sectionHead(icon: string, title: string, opts?: { noBar?: boolean }): string {
  const noBar = opts?.noBar === true;
  const headExtra = noBar ? " pdf-sec-head--nobar" : "";
  const hExtra = noBar ? " pdf-sec--nobar" : "";
  return `<div class="pdf-sec-head${headExtra}">${icon}<h2 class="pdf-sec${hExtra}">${escapeHtml(title)}</h2></div>`;
}

function parseSolidParticleNumeric(raw: string): number | null {
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return null;
  const n = parseInt(digits, 10);
  return Number.isNaN(n) ? null : n;
}

function formatCsddSolidParticlesCell(v: string): string {
  const esc = escapeHtml(v);
  const n = parseSolidParticleNumeric(v);
  if (n == null) return esc;
  if (n > 1_000_000) return `<span class="pdf-flag-num">${esc}</span>`;
  if (n >= 200_000 && n <= 1_000_000) return `<span class="pdf-flag-num">${esc}</span>`;
  return esc;
}

function formatCsddNextInspectionCell(v: string): string {
  return escapeHtml(v);
}

function formatLossAmountEurCell(raw: string): string {
  const t = raw.trim();
  const esc = escapeHtml(t);
  if (!t) return esc;
  const n = amountToIntRough(raw);
  if (n <= 0) return esc;
  return esc;
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

/** Krāsainā augšējā josla (Colored Header) — ikona + nosaukums, kontrastējošs teksts. */
function pdfAvotuColoredHeader(iconHtml: string, title: string, modClass: string): string {
  return `<div class="pdf-avotu-header ${modClass}"><span class="pdf-avotu-header-ico" aria-hidden="true">${iconHtml}</span><h3 class="pdf-avotu-header-title">${escapeHtml(title)}</h3></div>`;
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

/** CSDD — Colored Header + datu ķermenis; komentāri atsevišķi zem kartes. */
function buildCsddAvotuSubsection(p: ClientReportPayload): string {
  const hasStruct = Boolean(p.csddForm && csddFormHasContent(p.csddForm));
  const hasRaw = p.csdd.trim().length > 0;
  if (!hasStruct && !hasRaw) return "";

  const header = pdfAvotuColoredHeader(ICO.clip, PDF_SUB_CSDD, "pdf-avotu-header--csdd");

  if (hasStruct && p.csddForm) {
    const f = p.csddForm;
    const bodyParts: string[] = [];
    const regRows: string[] = [];
    for (const { key, label } of CSDD_FORM_SHORT_FIELDS) {
      const v = f[key].trim();
      if (!v) continue;
      let cellHtml: string;
      if (key === "solidParticlesCm3") cellHtml = formatCsddSolidParticlesCell(v);
      else if (key === "nextInspectionDate") cellHtml = formatCsddNextInspectionCell(v);
      else cellHtml = escapeHtml(v);
      regRows.push(`<tr><td>${escapeHtml(label)}</td><td>${cellHtml}</td></tr>`);
    }
    if (regRows.length > 0) {
      bodyParts.push(`<table class="mirror-table mirror-table--csdd"><tbody>${regRows.join("\n")}</tbody></table>`);
    }
    if (f.prevInspectionRating.trim()) {
      bodyParts.push(`<p class="pdf-field-label">${escapeHtml(CSDD_LABEL_PREV_RATING)}</p>`);
      bodyParts.push(`<pre class="mirror-pre">${escapeHtml(f.prevInspectionRating.trim())}</pre>`);
    }
    const bodyHtml = bodyParts.join("\n");
    const card =
      bodyHtml.trim() === ""
        ? `<div class="pdf-avotu-card pdf-avotu-card--csdd pdf-avotu-card--no-body">${header}</div>`
        : `<div class="pdf-avotu-card pdf-avotu-card--csdd">${header}<div class="pdf-avotu-body">${bodyHtml}</div></div>`;
    return wrapPdfAvotuStack(card, f.comments.trim() ? pdfAvotuCommentIsland(f.comments) : "");
  }

  const card = `<div class="pdf-avotu-card pdf-avotu-card--csdd">${header}<div class="pdf-avotu-body"><pre class="mirror-pre">${escapeHtml(p.csdd.trim())}</pre></div></div>`;
  return card;
}

/** Tirgus — Colored Header + dati; komentāri sala zem kartes. */
function buildTirgusAvotuSubsection(p: ClientReportPayload): string {
  const hasForm = tirgusFormHasContent(p.tirgusForm);
  const hasText = p.tirgus.trim().length > 0;
  if (!hasForm && !hasText) return "";

  const header = pdfAvotuColoredHeader(ICO.tag, PDF_SECTION_TIRGUS_DATI, "pdf-avotu-header--tirgus");
  let bodyInner: string;
  let island = "";

  if (hasForm && p.tirgusForm) {
    const f = p.tirgusForm;
    const rows: string[] = [];
    if (f.listedForSale.trim()) {
      rows.push(
        `<tr><td>${escapeHtml(TIRGUS_LABEL_LISTED)}</td><td>${escapeHtml(f.listedForSale.trim())}</td></tr>`,
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
    bodyInner = table;
    if (f.comments.trim()) island = pdfAvotuCommentIsland(f.comments);
  } else {
    bodyInner = `<pre class="mirror-pre">${escapeHtml(p.tirgus.trim())}</pre>`;
  }

  const card =
    bodyInner.trim() === ""
      ? `<div class="pdf-avotu-card pdf-avotu-card--tirgus pdf-avotu-card--no-body">${header}</div>`
      : `<div class="pdf-avotu-card pdf-avotu-card--tirgus">${header}<div class="pdf-avotu-body">${bodyInner}</div></div>`;
  return wrapPdfAvotuStack(card, island);
}

function pdfIconForVendorTitle(title: string): string {
  if (title === SOURCE_BLOCK_LABELS.autodna) return ICO.layers;
  if (title === SOURCE_BLOCK_LABELS.carvertical) return ICO.chart;
  if (title === SOURCE_BLOCK_LABELS.auto_records) return ICO.spark;
  return ICO.layers;
}

function vendorPdfHeaderModifierClass(title: string): string {
  if (title === SOURCE_BLOCK_LABELS.autodna) return "pdf-avotu-header--autodna";
  if (title === SOURCE_BLOCK_LABELS.carvertical) return "pdf-avotu-header--carvertical";
  if (title === SOURCE_BLOCK_LABELS.auto_records) return "pdf-avotu-header--auto-records";
  return "pdf-avotu-header--vendor-fallback";
}

/** Viena trešā pušu avota apakšbloks zem „AVOTU DATI“. */
function buildVendorAvotuSubsection(b: ClientManualVendorBlockPdf): string {
  const hasTable = b.rows.length > 0;
  const hasComments = b.comments.trim().length > 0;
  if (!hasTable && !hasComments) return "";
  const icon = pdfIconForVendorTitle(b.title);
  const headerMod = vendorPdfHeaderModifierClass(b.title);
  const header = pdfAvotuColoredHeader(icon, b.title, headerMod);
  const bodyParts: string[] = [];
  if (hasTable) {
    const amountTh = escapeHtml(b.amountColumnLabel ?? "Zaudējumu summa");
    bodyParts.push(
      `<table class="mirror-table"><thead><tr><th>Gads / Datums</th><th class="tabular">KM</th><th class="tabular">${amountTh}</th></tr></thead><tbody>`,
    );
    for (const r of b.rows) {
      bodyParts.push(
        `<tr><td>${escapeHtml(r.date)}</td><td class="tabular">${escapeHtml(r.km)}</td><td class="tabular">${formatLossAmountEurCell(r.amount)}</td></tr>`,
      );
    }
    bodyParts.push(`</tbody></table>`);
  }
  const cardMod = headerMod.replace("pdf-avotu-header--", "pdf-avotu-card--");
  const bodyHtml = bodyParts.join("\n");
  const card =
    bodyHtml.trim() === ""
      ? `<div class="pdf-avotu-card ${cardMod} pdf-avotu-card--no-body">${header}</div>`
      : `<div class="pdf-avotu-card ${cardMod}">${header}<div class="pdf-avotu-body">${bodyHtml}</div></div>`;
  return wrapPdfAvotuStack(card, hasComments ? pdfAvotuCommentIsland(b.comments) : "");
}

function buildLtabAvotuSubsection(b: ClientManualLtabBlockPdf | null | undefined): string {
  if (!b) return "";
  const hasTable = b.rows.length > 0;
  const hasComments = b.comments.trim().length > 0;
  if (!hasTable && !hasComments) return "";
  const header = pdfAvotuColoredHeader(ICO.shield, SOURCE_BLOCK_LABELS.ltab, "pdf-avotu-header--ltab");
  const bodyParts: string[] = [];
  if (hasTable) {
    bodyParts.push(
      `<table class="mirror-table"><thead><tr><th>Negadījumu skaits</th><th class="tabular">CSNg datums</th><th class="tabular">Zaudējumu summa</th></tr></thead><tbody>`,
    );
    for (const r of b.rows) {
      bodyParts.push(
        `<tr><td>${escapeHtml(r.incidentNo)}</td><td class="tabular">${escapeHtml(r.csngDate)}</td><td class="tabular">${formatLossAmountEurCell(r.lossAmount)}</td></tr>`,
      );
    }
    bodyParts.push(`</tbody></table>`);
  }
  const bodyHtml = bodyParts.join("\n");
  const card =
    bodyHtml.trim() === ""
      ? `<div class="pdf-avotu-card pdf-avotu-card--ltab pdf-avotu-card--no-body">${header}</div>`
      : `<div class="pdf-avotu-card pdf-avotu-card--ltab">${header}<div class="pdf-avotu-body">${bodyHtml}</div></div>`;
  return wrapPdfAvotuStack(card, hasComments ? pdfAvotuCommentIsland(b.comments) : "");
}

/**
 * Sludinājuma analīze — patstāvīgs prioritārs bloks (nav „AVOTU DATI” grupā).
 * Stils līdzīgs APPROVED BY IRISS: pilns platums, zaļa galvene, maigi zaļš ķermenis.
 */
function buildListingAnalysisPriorityHtml(p: ClientReportPayload): string {
  const b = p.listingAnalysis;
  if (!b || !listingAnalysisHasContent(b)) return "";
  const L = LISTING_ANALYSIS_SUBSECTIONS;
  const inner: string[] = [];
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

/** Citi avoti — header + komentāru sala. */
function buildCitiAvotiAvotuSubsection(p: ClientReportPayload): string {
  const b = p.citiAvoti;
  if (!b || !citiAvotiHasContent(b)) return "";
  const header = pdfAvotuColoredHeader(ICO.layers, SOURCE_BLOCK_LABELS.citi_avoti, "pdf-avotu-header--citi-avoti");
  const card = `<div class="pdf-avotu-card pdf-avotu-card--citi-avoti pdf-avotu-card--no-body">${header}</div>`;
  return wrapPdfAvotuStack(card, pdfAvotuCommentIsland(b.comments));
}

/**
 * AVOTU DATI (PDF): 7 avoti — CSDD, tad AutoDNA / CarVertical / Auto-Records, tad LTAB / Tirgus / Citi avoti.
 * Sludinājuma analīze ir atsevišķi (buildListingAnalysisPriorityHtml).
 */
function buildAvotuDatiSectionHtml(p: ClientReportPayload): string {
  const csdd = buildCsddAvotuSubsection(p);
  const tirgus = buildTirgusAvotuSubsection(p);
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
  const autoRecords = vendorHtml(SOURCE_BLOCK_LABELS.auto_records);

  const stack = [csdd, autodna, carvertical, autoRecords, ltab, tirgus, citiAvoti].filter(Boolean);
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
  if (!iriss && !plan) return "";
  const body = [iriss, plan].filter(Boolean).join("\n\n");
  const parts: string[] = [];
  parts.push(`<div class="pdf-iriss-approved" role="region">`);
  parts.push(
    `<div class="pdf-iriss-approved-header"><span class="pdf-iriss-approved-ico" aria-hidden="true">${ICO.shield}</span><h2 class="pdf-iriss-approved-title">${escapeHtml(PDF_APPROVED_BY_IRISS)}</h2></div>`,
  );
  parts.push(`<div class="pdf-iriss-approved-body">`);
  parts.push(`<h3 class="pdf-iriss-approved-subtitle">${escapeHtml(PDF_KOPSAVILKUMS_UN_APSKATES_PLANS)}</h3>`);
  parts.push(`<pre class="mirror-pre pdf-iriss-approved-text">${escapeHtml(body)}</pre>`);
  parts.push(`</div></div>`);
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

function clientReportPrintCss(): string {
  return `
      *{box-sizing:border-box;}
      html,body,.provin-report-doc{font-family:Inter,sans-serif!important;}
      .provin-report-doc .pdf-vin,.provin-report-doc code,.provin-report-doc kbd,.provin-report-doc samp,.provin-report-doc tt{
        font-family:Inter,sans-serif!important;font-variant-numeric:normal!important;
      }
      body{
        font-size:12px;
        line-height:1.45;
        max-width:190mm;
        margin:0 auto;
        padding:8mm 11mm;
        color:#1d1d1f;
        background:#fff;
        -webkit-font-smoothing:antialiased;
      }
      .sheet{background:#fff;padding:0;}
      .pdf-sec-head{display:flex;align-items:center;gap:8px;margin:0.75rem 0 0.35rem;}
      .pdf-sec-head--nobar{margin-top:0;}
      .pdf-sec-head .pdf-ico{color:#0066d6;width:14px;height:14px;flex-shrink:0;}
      h2.pdf-sec{
        font-size:0.75rem;font-weight:700;margin:0;flex:1;color:#000;letter-spacing:0.06em;line-height:1.3;
        padding:0 0 0 8px;border-left:2px solid #0066d6;text-transform:uppercase;
      }
      h2.pdf-sec--nobar{border-left:none;padding-left:0;}
      h3.pdf-sub{font-size:0.75rem;font-weight:700;margin:0.6rem 0 0.35rem;color:#000;text-transform:uppercase;letter-spacing:0.05em;}
      h3.pdf-sub:first-child{margin-top:0;}
      .pdf-subhead{display:flex;align-items:center;gap:8px;margin:0 0 0.4rem;}
      .pdf-subhead-ico{display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;}
      .pdf-subhead-ico .pdf-ico{width:14px;height:14px;}
      h3.pdf-sub.pdf-sub--with-ico{margin:0;border-left:none;padding:0;}
      .pdf-field-label{font-size:0.68rem;font-weight:600;margin:0.45rem 0 0.2rem;color:#000;letter-spacing:0.02em;}
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
      .pdf-avotu-header--csdd{background:#00aaff;color:#fff;}
      .pdf-avotu-header--csdd .pdf-ico{color:#fff;}
      .pdf-avotu-header--tirgus{background:#ff7700;color:#fff;}
      .pdf-avotu-header--tirgus .pdf-ico{color:#fff;}
      .pdf-avotu-header--autodna{background:#003366;color:#fff;}
      .pdf-avotu-header--autodna .pdf-ico{color:#fff;}
      .pdf-avotu-header--carvertical{background:#ffcc00;color:#1d1d1f;}
      .pdf-avotu-header--carvertical .pdf-ico{color:#1d1d1f;}
      .pdf-avotu-header--auto-records{background:#666666;color:#fff;}
      .pdf-avotu-header--auto-records .pdf-ico{color:#fff;}
      .pdf-avotu-header--ltab{background:#4caf50;color:#fff;}
      .pdf-avotu-header--ltab .pdf-ico{color:#fff;}
      .pdf-avotu-header--vendor-fallback{background:#666666;color:#fff;}
      .pdf-avotu-header--vendor-fallback .pdf-ico{color:#fff;}
      .pdf-avotu-header--citi-avoti{background:#8d6e63;color:#fff;}
      .pdf-avotu-header--citi-avoti .pdf-ico{color:#fff;}
      .pdf-avotu-body{padding:10px 12px;background:#fff;border-radius:0 0 8px 8px;}
      .pdf-listing-priority{
        margin:0 0 14px;border-radius:10px;overflow:hidden;border:1px solid #a5d6a7;
        box-shadow:0 4px 14px rgba(46,125,50,.14);
        -webkit-print-color-adjust:exact;print-color-adjust:exact;
      }
      .pdf-listing-priority-header{
        display:flex;align-items:center;gap:10px;padding:10px 14px;background:#66bb6a;color:#fff;
      }
      .pdf-listing-priority-ico .pdf-ico{width:18px;height:18px;color:#fff;flex-shrink:0;}
      .pdf-listing-priority-title{
        margin:0;font-size:0.72rem;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;
      }
      .pdf-listing-priority-body{padding:12px 14px 14px;background:#e8f5e9;}
      .pdf-listing-analysis-chunk{
        margin:0 0 8px;padding:8px 10px;background:#f5f5f5;border-radius:4px;
        -webkit-print-color-adjust:exact;print-color-adjust:exact;
      }
      .pdf-listing-analysis-chunk:last-child{margin-bottom:0;}
      .pdf-listing-analysis-chunk-pre{font-style:italic;margin:0;}
      .pdf-avotu-comment-island{
        margin-top:8px;padding:10px 12px;background:#f9f9f9;
        -webkit-print-color-adjust:exact;print-color-adjust:exact;
      }
      .pdf-avotu-comment-island-label{
        font-size:0.65rem;font-weight:700;margin:0 0 5px;color:#000;letter-spacing:0.06em;text-transform:uppercase;
      }
      .pdf-avotu-comment-island-body{font-style:italic;margin:0;}
      .pdf-avotu-zone{
        margin:0 0 12px;padding:12px 14px;border:1px solid #e8eaed;border-radius:10px;
        background:#f8f9fa;
        -webkit-print-color-adjust:exact;print-color-adjust:exact;
      }
      .pdf-avotu-zone .pdf-sec-head{margin-top:0;}
      .pdf-avotu-zone > .pdf-avotu-card{margin-bottom:12px;}
      .pdf-avotu-zone > .pdf-avotu-card:last-child{margin-bottom:0;}
      .mirror-block{margin:0 0 10px;padding:0 0 8px;border-bottom:1px solid #ececee;}
      .mirror-block.pdf-surface-card{border-bottom:none;padding-bottom:0;margin-bottom:12px;}
      .mirror-block-head{display:flex;align-items:center;gap:8px;margin:0 0 6px;}
      .mirror-ico{color:#0066d6;}
      .mirror-ico .pdf-ico{width:14px;height:14px;}
      .mirror-pre{
        white-space:pre-wrap;font-size:0.72rem;margin:0;padding:0;font-family:Inter,sans-serif!important;
        color:#1d1d1f;line-height:1.45;
      }
      .mirror-line{font-size:0.72rem;margin:0.25rem 0;line-height:1.45;}
      .mirror-table{width:100%;border-collapse:collapse;font-size:0.72rem;margin:4px 0;}
      .mirror-table td,.mirror-table th{padding:4px 0;border-bottom:1px solid #ececee;vertical-align:top;text-align:left;}
      .mirror-table thead th{font-weight:600;color:#000;font-size:0.68rem;}
      .mirror-table td:first-child{color:#86868b;width:38%;}
      .mirror-table--csdd td:first-child{
        width:54%;min-width:14em;max-width:62%;white-space:nowrap;color:#86868b;
      }
      .mirror-table--csdd td:nth-child(2){text-align:right;}
      .tabular{font-variant-numeric:tabular-nums;}
      .pdf-iriss-approved{
        margin:0 0 14px;border-radius:10px;overflow:hidden;border:1px solid #b3d4fc;
        box-shadow:0 4px 14px rgba(0,102,214,.14);
        -webkit-print-color-adjust:exact;print-color-adjust:exact;
      }
      .pdf-iriss-approved-header{
        display:flex;align-items:center;gap:10px;padding:10px 14px;background:#0066d6;color:#fff;
      }
      .pdf-iriss-approved-ico .pdf-ico{width:18px;height:18px;color:#fff;flex-shrink:0;}
      .pdf-iriss-approved-title{
        margin:0;font-size:0.72rem;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;
      }
      .pdf-iriss-approved-body{padding:12px 14px 14px;background:#e6f2ff;}
      .pdf-iriss-approved-subtitle{
        margin:0 0 8px;font-size:0.68rem;font-weight:700;color:#000;letter-spacing:0.06em;text-transform:uppercase;
      }
      .pdf-iriss-approved-text{font-size:0.78rem;}
      .mirror-font-error{padding:16px;color:#991b1b;font-size:13px;}
      .legal-block{margin-top:12px;padding-top:8px;border-top:1px solid #ececee;font-size:0.68rem;color:#86868b;line-height:1.45;}
      .report-foot{margin-top:12px;padding-top:8px;border-top:1px solid #ececee;font-size:0.65rem;color:#aeaeb2;}
      code,.pdf-vin{font-family:Inter,sans-serif!important;font-variant-numeric:normal!important;font-size:0.72rem;background:#f5f5f7;padding:1px 6px;border-radius:4px;}
      .pdf-flag-num{font-weight:600;}
      @media print{
        body{padding:8mm 10mm;}
        .no-print{display:none!important;}
        .pdf-avotu-block-wrap{break-inside:avoid-page;}
        .pdf-listing-priority{break-inside:avoid-page;}
        .pdf-iriss-approved{break-inside:avoid-page;}
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
    p.csddForm?.makeModel?.trim() || extractVehicleMakeModel(p.csdd) || null;

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

  const payBlock = buildPdfAdminMirrorPaymentBlock(p, money, dateFmt, ICO.chart);
  if (payBlock) lines.push(payBlock);

  const vehicleBlock = buildPdfAdminMirrorVehicleBlock(p, makeModel, ICO.car);
  if (vehicleBlock) lines.push(vehicleBlock);

  const clientBlock = buildPdfAdminMirrorClientBlock(p, ICO.user);
  if (clientBlock) lines.push(clientBlock);

  const notesBlock = buildPdfAdminMirrorNotesBlock(p.notes, ICO.clip);
  if (notesBlock) lines.push(notesBlock);

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
    '<p class="no-print" style="margin-top:12px"><button type="button" style="padding:8px 16px;font-size:12px;border-radius:6px;border:0;background:#0066d6;color:#fff;cursor:pointer;font-family:Inter,sans-serif;font-weight:600" onclick="window.print()">Drukāt / PDF</button></p>',
  );

  lines.push(
    `<div class="report-foot">© PROVIN.LV · konsultatīva atskaite · ${escapeHtml(dateFmt.format(new Date()))}</div>`,
  );
  lines.push("</div>");

  const title = `PROVIN ${p.vin ?? p.sessionId}`;
  const html = `<!DOCTYPE html><html lang="lv"><head><meta charset="utf-8"/>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet"/>
<title>${escapeHtml(title)}</title><style>${clientReportPrintCss()}</style></head><body class="provin-report-doc">${lines.join("\n")}${reportFontGuardScript()}</body></html>`;
  return html;
}
