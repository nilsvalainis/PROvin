/**
 * Klienta PDF atskaite — tikai admin paneļa ievadīto datu spogulis.
 * Nav apvienoto tabulu, grafiku, prognožu vai automātisku risku kopsavilkumu.
 */

import type { PdfPortfolioFileInsight } from "@/lib/admin-portfolio-pdf-analysis";
import { amountToIntRough } from "@/lib/claim-rows-parse";
import {
  SOURCE_BLOCK_LABELS,
  type ClientManualLtabBlockPdf,
  type ClientManualVendorBlockPdf,
  type CsddFormFields,
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
import {
  CLIENT_REPORT_FOOTER_DISCLAIMER,
  CLIENT_REPORT_PDF_SECTIONS,
  CLIENT_REPORT_SERVICE_NOTICE,
  REPORT_PDF_STANDARDS,
} from "@/lib/report-pdf-standards";

/** PDF dokumenta virsraksti (UPPERCASE, saskaņoti ar produkta terminoloģiju). */
const PDF_MAIN_TITLE = "TRANSPORTLĪDZEKĻA AUDITS";
const PDF_SECTION_AVOTU_DATI = "AVOTU DATI";
const PDF_SECTION_TIRGUS_DATI = "TIRGUS DATI";
const PDF_SECTION_SLIEDZIENS_APSKATE = "SLĒDZIENS UN APSKATES PLĀNS";
const PDF_SUB_CSDD = "CSDD";
const PDF_SUB_BLOCK_COMMENTS = "Komentāri";

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

/** CSDD — apakšbloks zem „AVOTU DATI“. */
function buildCsddAvotuSubsection(p: ClientReportPayload): string {
  const hasStruct = Boolean(p.csddForm && csddFormHasContent(p.csddForm));
  const hasRaw = p.csdd.trim().length > 0;
  if (!hasStruct && !hasRaw) return "";

  const parts: string[] = [];
  parts.push(`<div class="pdf-subhead"><span class="pdf-subhead-ico" aria-hidden="true">${ICO.clip}</span><h3 class="pdf-sub pdf-sub--with-ico">${escapeHtml(PDF_SUB_CSDD)}</h3></div>`);

  if (hasStruct && p.csddForm) {
    const f = p.csddForm;
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
      parts.push(`<table class="mirror-table"><tbody>${regRows.join("\n")}</tbody></table>`);
    }
    if (f.prevInspectionRating.trim()) {
      parts.push(`<p class="pdf-field-label">${escapeHtml(CSDD_LABEL_PREV_RATING)}</p>`);
      parts.push(`<pre class="mirror-pre">${escapeHtml(f.prevInspectionRating.trim())}</pre>`);
    }
    if (f.comments.trim()) {
      parts.push(`<p class="pdf-field-label">${escapeHtml(PDF_SUB_BLOCK_COMMENTS)}</p>`);
      parts.push(`<pre class="mirror-pre">${escapeHtml(f.comments.trim())}</pre>`);
    }
    const nd = f.nextInspectionDate.trim();
    if (nd) {
      parts.push(`<p class="pdf-field-label">nākamā apskate (no lauka)</p>`);
      parts.push(`<p class="mirror-line">${escapeHtml(nd)}</p>`);
    }
  } else if (hasRaw) {
    parts.push(`<pre class="mirror-pre">${escapeHtml(p.csdd.trim())}</pre>`);
  }

  return `<div class="pdf-avotu-sub pdf-avotu-sub--csdd">${parts.join("\n")}</div>`;
}

function buildManualTirgusStructuredHtml(f: TirgusFormFields): string {
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
  const parts: string[] = [];
  if (rows.length > 0) {
    parts.push(`<table class="mirror-table"><tbody>${rows.join("\n")}</tbody></table>`);
  }
  if (f.comments.trim()) {
    parts.push(`<p class="pdf-field-label">${escapeHtml(PDF_SUB_BLOCK_COMMENTS)}</p>`);
    parts.push(`<pre class="mirror-pre">${escapeHtml(f.comments.trim())}</pre>`);
  }
  return parts.join("\n");
}

/** Tirgus — apakšbloks zem „AVOTU DATI“. */
function buildTirgusAvotuSubsection(p: ClientReportPayload): string {
  const hasForm = tirgusFormHasContent(p.tirgusForm);
  const hasText = p.tirgus.trim().length > 0;
  if (!hasForm && !hasText) return "";

  const inner: string[] = [
    `<div class="pdf-subhead"><span class="pdf-subhead-ico" aria-hidden="true">${ICO.tag}</span><h3 class="pdf-sub pdf-sub--with-ico">${escapeHtml(PDF_SECTION_TIRGUS_DATI)}</h3></div>`,
  ];
  if (hasForm && p.tirgusForm) {
    inner.push(buildManualTirgusStructuredHtml(p.tirgusForm));
  } else if (hasText) {
    inner.push(`<pre class="mirror-pre">${escapeHtml(p.tirgus.trim())}</pre>`);
  }
  return `<div class="pdf-avotu-sub pdf-avotu-sub--tirgus">${inner.join("\n")}</div>`;
}

function pdfIconForVendorTitle(title: string): string {
  if (title === SOURCE_BLOCK_LABELS.autodna) return ICO.layers;
  if (title === SOURCE_BLOCK_LABELS.carvertical) return ICO.chart;
  if (title === SOURCE_BLOCK_LABELS.auto_records) return ICO.spark;
  return ICO.layers;
}

function vendorAvotuEdgeClass(title: string): string {
  if (title === SOURCE_BLOCK_LABELS.autodna) return "pdf-avotu-sub--autodna";
  if (title === SOURCE_BLOCK_LABELS.carvertical) return "pdf-avotu-sub--carvertical";
  if (title === SOURCE_BLOCK_LABELS.auto_records) return "pdf-avotu-sub--auto-records";
  return "pdf-avotu-sub--vendor-fallback";
}

const PDF_VENDOR_BLOCK_ORDER: string[] = [
  SOURCE_BLOCK_LABELS.autodna,
  SOURCE_BLOCK_LABELS.carvertical,
  SOURCE_BLOCK_LABELS.auto_records,
];

function orderVendorBlocksForPdf(blocks: ClientManualVendorBlockPdf[] | undefined): ClientManualVendorBlockPdf[] {
  const list = blocks ?? [];
  const byTitle = new Map(list.map((b) => [b.title, b]));
  const ordered: ClientManualVendorBlockPdf[] = [];
  for (const t of PDF_VENDOR_BLOCK_ORDER) {
    const b = byTitle.get(t);
    if (b) ordered.push(b);
  }
  for (const b of list) {
    if (!PDF_VENDOR_BLOCK_ORDER.includes(b.title)) ordered.push(b);
  }
  return ordered;
}

/** Viena trešā pušu avota apakšbloks zem „AVOTU DATI“. */
function buildVendorAvotuSubsection(b: ClientManualVendorBlockPdf): string {
  const hasTable = b.rows.length > 0;
  const hasComments = b.comments.trim().length > 0;
  if (!hasTable && !hasComments) return "";
  const parts: string[] = [];
  const icon = pdfIconForVendorTitle(b.title);
  const edge = vendorAvotuEdgeClass(b.title);
  parts.push(
    `<div class="pdf-subhead"><span class="pdf-subhead-ico" aria-hidden="true">${icon}</span><h3 class="pdf-sub pdf-sub--with-ico">${escapeHtml(b.title)}</h3></div>`,
  );
  if (hasTable) {
    const amountTh = escapeHtml(b.amountColumnLabel ?? "Zaudējumu summa");
    parts.push(
      `<table class="mirror-table"><thead><tr><th>Gads / Datums</th><th class="tabular">KM</th><th class="tabular">${amountTh}</th></tr></thead><tbody>`,
    );
    for (const r of b.rows) {
      parts.push(
        `<tr><td>${escapeHtml(r.date)}</td><td class="tabular">${escapeHtml(r.km)}</td><td class="tabular">${formatLossAmountEurCell(r.amount)}</td></tr>`,
      );
    }
    parts.push(`</tbody></table>`);
  }
  if (hasComments) {
    parts.push(`<p class="pdf-field-label">${escapeHtml(PDF_SUB_BLOCK_COMMENTS)}</p>`);
    parts.push(`<pre class="mirror-pre">${escapeHtml(b.comments.trim())}</pre>`);
  }
  return `<div class="pdf-avotu-sub ${edge}">${parts.join("\n")}</div>`;
}

function buildLtabAvotuSubsection(b: ClientManualLtabBlockPdf | null | undefined): string {
  if (!b) return "";
  const hasTable = b.rows.length > 0;
  const hasComments = b.comments.trim().length > 0;
  if (!hasTable && !hasComments) return "";
  const parts: string[] = [];
  parts.push(
    `<div class="pdf-subhead"><span class="pdf-subhead-ico" aria-hidden="true">${ICO.shield}</span><h3 class="pdf-sub pdf-sub--with-ico">${escapeHtml(SOURCE_BLOCK_LABELS.ltab)}</h3></div>`,
  );
  if (hasTable) {
    parts.push(
      `<table class="mirror-table"><thead><tr><th>Negadījumu skaits</th><th class="tabular">CSNg datums</th><th class="tabular">Zaudējumu summa</th></tr></thead><tbody>`,
    );
    for (const r of b.rows) {
      parts.push(
        `<tr><td>${escapeHtml(r.incidentNo)}</td><td class="tabular">${escapeHtml(r.csngDate)}</td><td class="tabular">${formatLossAmountEurCell(r.lossAmount)}</td></tr>`,
      );
    }
    parts.push(`</tbody></table>`);
  }
  if (hasComments) {
    parts.push(`<p class="pdf-field-label">${escapeHtml(PDF_SUB_BLOCK_COMMENTS)}</p>`);
    parts.push(`<pre class="mirror-pre">${escapeHtml(b.comments.trim())}</pre>`);
  }
  return `<div class="pdf-avotu-sub pdf-avotu-sub--ltab">${parts.join("\n")}</div>`;
}

/** CSDD → Tirgus → AutoDNA → CarVertical → Auto-Records → LTAB vienā vizuālā grupā. */
function buildAvotuDatiSectionHtml(p: ClientReportPayload): string {
  const chunks: string[] = [];
  const csdd = buildCsddAvotuSubsection(p);
  const tirgus = buildTirgusAvotuSubsection(p);
  if (csdd) chunks.push(csdd);
  if (tirgus) chunks.push(tirgus);
  for (const b of orderVendorBlocksForPdf(p.manualVendorBlocks)) {
    const v = buildVendorAvotuSubsection(b);
    if (v) chunks.push(v);
  }
  const ltab = buildLtabAvotuSubsection(p.manualLtabBlock);
  if (ltab) chunks.push(ltab);

  if (chunks.length === 0) return "";

  return `<div class="pdf-avotu-zone" role="region">
    ${sectionHead(ICO.user, PDF_SECTION_AVOTU_DATI, { noBar: true })}
    ${chunks.join("\n")}
  </div>`;
}

function splitExpertConclusion(iriss: string): { rating: string | null; summary: string } {
  const t = iriss.trim();
  if (!t) return { rating: null, summary: "" };
  const lines = t.split(/\r?\n/);
  const first = lines[0]?.trim() ?? "";
  const looksLikeHeadline =
    first.length <= 88 &&
    (/^(IZSKATĀS|UZMANĪBU|ĻOTI|BR[ĪI]DIN|OK|LABI|SLIKTI|NAV\s+IETEIC|IETEIC|NEIESAK)/i.test(first) ||
      /[!?⚠️✅🚩]/.test(first) ||
      /^.{1,55}!$/.test(first));
  if (looksLikeHeadline && lines.length > 1) {
    return { rating: first, summary: lines.slice(1).join("\n").trim() };
  }
  if (looksLikeHeadline && lines.length === 1) {
    return { rating: first, summary: "" };
  }
  return { rating: null, summary: t };
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
      .pdf-avotu-zone{
        margin:0 0 12px;padding:12px 14px;border:1px solid #e8eaed;border-radius:10px;
        background:#f8f9fa;
        -webkit-print-color-adjust:exact;print-color-adjust:exact;
      }
      .pdf-avotu-zone .pdf-sec-head{margin-top:0;}
      .pdf-avotu-sub{
        margin:0 0 10px;padding:10px 12px;background:#fff;border:1px solid #e8eaed;border-radius:8px;
        border-left:4px solid #ccc;
        -webkit-print-color-adjust:exact;print-color-adjust:exact;
      }
      .pdf-avotu-sub:last-child{margin-bottom:0;}
      .pdf-avotu-sub--csdd{border-left-color:#00aaff;}
      .pdf-avotu-sub--csdd .pdf-subhead-ico{color:#00aaff;}
      .pdf-avotu-sub--tirgus{border-left-color:#ff7700;}
      .pdf-avotu-sub--tirgus .pdf-subhead-ico{color:#ff7700;}
      .pdf-avotu-sub--autodna{border-left-color:#003366;}
      .pdf-avotu-sub--autodna .pdf-subhead-ico{color:#003366;}
      .pdf-avotu-sub--carvertical{border-left-color:#ffcc00;}
      .pdf-avotu-sub--carvertical .pdf-subhead-ico{color:#ffcc00;}
      .pdf-avotu-sub--auto-records{border-left-color:#666666;}
      .pdf-avotu-sub--auto-records .pdf-subhead-ico{color:#666666;}
      .pdf-avotu-sub--ltab{border-left-color:#4caf50;}
      .pdf-avotu-sub--ltab .pdf-subhead-ico{color:#4caf50;}
      .pdf-avotu-sub--vendor-fallback{border-left-color:#666666;}
      .pdf-avotu-sub--vendor-fallback .pdf-subhead-ico{color:#666666;}
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
      .tabular{font-variant-numeric:tabular-nums;}
      .mirror-block--expert .expert-panel{margin:0;padding:0;border-top:none;}
      .expert-panel{margin:8px 0 0;padding:6px 0 0;border-top:1px solid #ececee;}
      .expert-body{font-size:0.78rem;white-space:pre-wrap;line-height:1.5;color:#1d1d1f;}
      .expert-rating{font-size:0.78rem;margin:0 0 6px;}
      .expert-summary-label{font-size:0.72rem;margin:0 0 4px;color:#424245;}
      .mirror-font-error{padding:16px;color:#991b1b;font-size:13px;}
      .legal-block{margin-top:12px;padding-top:8px;border-top:1px solid #ececee;font-size:0.68rem;color:#86868b;line-height:1.45;}
      .report-foot{margin-top:12px;padding-top:8px;border-top:1px solid #ececee;font-size:0.65rem;color:#aeaeb2;}
      code,.pdf-vin{font-family:Inter,sans-serif!important;font-variant-numeric:normal!important;font-size:0.72rem;background:#f5f5f7;padding:1px 6px;border-radius:4px;}
      .mirror-line--meta .pdf-vin{background:transparent;padding:0;}
      .pdf-flag-num{font-weight:600;}
      @media print{
        body{padding:8mm 10mm;}
        .no-print{display:none!important;}
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
  const expertParts = splitExpertConclusion(p.iriss);

  const lines: string[] = [];
  lines.push('<div class="sheet">');
  lines.push('<header class="pdf-v1-hero">');
  lines.push('<div class="pdf-v1-hero-inner">');
  lines.push(provincLogoSvg());
  lines.push('<div class="pdf-v1-hero-text">');
  lines.push(`<h1 class="pdf-v1-doc-title">${escapeHtml(PDF_MAIN_TITLE)}</h1>`);
  lines.push(
    `<p class="pdf-v1-meta">Ģenerēts: ${escapeHtml(dateFmt.format(new Date()))} · VIN <span class="pdf-vin">${escapeHtml(p.vin ?? "—")}</span></p>`,
  );
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

  lines.push(`<div class="mirror-block pdf-surface-card mirror-block--expert" role="region">`);
  lines.push(sectionHead(ICO.spark, PDF_SECTION_SLIEDZIENS_APSKATE, { noBar: true }));
  lines.push(`<div class="expert-panel">`);
  if (expertParts.rating) {
    lines.push(`<div class="expert-verdict"><p class="expert-rating"><strong>Vērtējums:</strong> ${escapeHtml(expertParts.rating)}</p>`);
    if (expertParts.summary) {
      lines.push(`<p class="expert-summary-label"><strong>Eksperta kopsavilkums</strong></p>`);
      lines.push(`<div class="expert-body">${escapeHtml(expertParts.summary)}</div>`);
    }
    lines.push(`</div>`);
  } else {
    lines.push(`<p class="expert-summary-label">${escapeHtml(REPORT_PDF_STANDARDS.firstPageExpertBlockTitle)}</p>`);
    lines.push(`<div class="expert-body">${escapeHtml(expertParts.summary || p.iriss.trim())}</div>`);
  }
  lines.push(`</div>`);

  if (p.apskatesPlāns.trim()) {
    lines.push(`<h3 class="pdf-sub">${escapeHtml(CLIENT_REPORT_PDF_SECTIONS.inspectionPlan)}</h3>`);
    lines.push(`<pre class="mirror-pre">${escapeHtml(p.apskatesPlāns.trim())}</pre>`);
  }
  lines.push(`</div>`);

  lines.push(
    `<p class="mirror-line mirror-line--meta">pasūtījums: <span class="pdf-vin">${escapeHtml(p.sessionId)}</span> · ${escapeHtml(p.paymentStatus)} · ${escapeHtml(money)}</p>`,
  );

  lines.push('<div class="legal-block">');
  lines.push(`<p><strong>Juridisks pārskats.</strong> ${escapeHtml(CLIENT_REPORT_SERVICE_NOTICE)}</p>`);
  lines.push(`<p style="margin-top:6px">${escapeHtml(CLIENT_REPORT_FOOTER_DISCLAIMER)}</p>`);
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
