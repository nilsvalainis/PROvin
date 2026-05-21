/**
 * PROVIN SELECT stratēģiskās konsultācijas PDF / drukas HTML — tās pašas vizuālās līnijas kā klienta auditam.
 */

import type {
  ConsultationDraftWorkspaceBody,
  ConsultationSlotDraft,
} from "@/lib/admin-consultation-draft-types";
import {
  csddFormToConsultationPdfStructuredText,
  ltabBlockToPlainText,
  mergeSourceBlocksWithDefaults,
  type CsddFormFields,
} from "@/lib/admin-source-blocks";
import {
  buildPdfAdminMirrorClientBlock,
  buildPdfAdminMirrorNotesBlock,
  buildPdfAdminMirrorPaymentBlock,
  pdfLayoutDraftExtraCss,
  provincLogoSvg,
} from "@/lib/client-report-pdf-layout-draft";
import { getClientReportPrintCss } from "@/lib/client-report-html";
import { adminRichHtmlToPdfSafeHtml } from "@/lib/admin-rich-comment-html";
import { mergePdfVisibility, type PdfVisibilitySettings } from "@/lib/pdf-visibility";
import { sectionIconPdfHtml } from "@/lib/section-icons";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const DOC_TITLE = "PROVIN SELECT, STRATĒĢISKĀ KONSULTĀCIJA";

/** Gads no CSDD „Pirmā reģistrācija” (bez pilna datuma virsrakstā). */
function extractRegistrationYear(firstRegistration: string): string | null {
  const t = firstRegistration.trim();
  if (!t) return null;
  const iso = t.match(/^(\d{4})-\d{2}-\d{2}$/);
  if (iso?.[1]) return iso[1];
  const dmy = t.match(/(\d{1,2})[./](\d{1,2})[./](\d{4})/);
  if (dmy?.[3]) return dmy[3];
  const yOnly = t.match(/\b(19|20)\d{2}\b/);
  return yOnly?.[0] ?? null;
}

/** Piem. „11 000 eiro”. */
function formatConsultationPriceLabel(salePrice: string): string | null {
  const t = salePrice.trim();
  if (!t) return null;
  if (/eiro/i.test(t)) return t.replace(/eur\b/gi, "eiro").replace(/€/g, "eiro");
  const digits = t.replace(/[^\d]/g, "");
  if (!digits) return t;
  const n = parseInt(digits, 10);
  if (!Number.isFinite(n)) return t;
  return `${n.toLocaleString("lv-LV")} eiro`;
}

function buildSlotPanelTitle(csdd: CsddFormFields, salePrice: string, slotNumber: number): string {
  const parts: string[] = [];
  const mm = csdd.makeModel.trim();
  if (mm) parts.push(mm);
  const year = extractRegistrationYear(csdd.firstRegistration);
  if (year) parts.push(year);
  const price = formatConsultationPriceLabel(salePrice);
  if (price) parts.push(price);
  if (parts.length > 0) return parts.join(", ");
  return `Nr. ${slotNumber}`;
}

function richBlockSubsection(title: string, bodyHtml: string): string {
  const inner = bodyHtml.trim();
  if (!inner) return "";
  return `<div class="pdf-select-subsection" role="region">
    <p class="pdf-select-subsection-title">${esc(title)}</p>
    <div class="pdf-select-rich-body">${inner}</div>
  </div>`;
}

function plainBlockSubsection(title: string, body: string): string {
  const t = body.trim();
  if (!t) return "";
  return `<div class="pdf-select-subsection" role="region">
    <p class="pdf-select-subsection-title">${esc(title)}</p>
    <pre class="pdf-select-plain">${esc(t)}</pre>
  </div>`;
}

function richCommentSubsection(title: string, html: string): string {
  const safe = adminRichHtmlToPdfSafeHtml(html);
  if (!safe) return "";
  return richBlockSubsection(title, safe);
}

function buildCsddConsultationSubsection(csdd: CsddFormFields): string {
  const structured = csddFormToConsultationPdfStructuredText(csdd).trim();
  const commentsHtml = adminRichHtmlToPdfSafeHtml(csdd.comments);
  if (!structured && !commentsHtml) return "";
  const body: string[] = [];
  if (structured) {
    body.push(`<pre class="pdf-select-plain">${esc(structured)}</pre>`);
  }
  if (commentsHtml) {
    body.push(`<div class="pdf-select-rich-body">${commentsHtml}</div>`);
  }
  return `<div class="pdf-select-subsection" role="region">
    <p class="pdf-select-subsection-title">${esc("CSDD")}</p>
    ${body.join("")}
  </div>`;
}

function buildConsultationSlotPhotosInner(
  slot: ConsultationSlotDraft,
  dataUrls: Map<string, string> | undefined,
): string {
  const photos = slot.photos ?? [];
  const parts: string[] = [];
  for (const ph of photos) {
    const src = dataUrls?.get(ph.id);
    if (!src) continue;
    const cap = adminRichHtmlToPdfSafeHtml(ph.comment);
    parts.push(
      `<figure class="pdf-slot-photo-card"><img class="pdf-slot-photo-img" src="${src}" alt=""/>
${cap ? `<figcaption class="pdf-slot-photo-caption">${cap}</figcaption>` : ""}</figure>`,
    );
  }
  if (parts.length === 0) return "";
  return `<div class="pdf-slot-photo-grid">${parts.join("")}</div>`;
}

function consultationSlotHasPdfContent(
  slot: ConsultationSlotDraft,
  csdd: CsddFormFields,
  vis: PdfVisibilitySettings,
): boolean {
  if (slot.listingUrl.trim() || slot.salePrice.trim()) return true;
  if (slot.ieteikumiApskatei.trim() || slot.cenasAtbilstiba.trim() || slot.kopsavilkums.trim()) return true;
  if ((slot.photos ?? []).length > 0) return true;
  if (vis.csdd && (csddFormToConsultationPdfStructuredText(csdd).trim() || csdd.comments.trim())) return true;
  if (vis.ltab && ltabBlockToPlainText(mergeSourceBlocksWithDefaults(slot.sourceBlocks).ltab).trim()) return true;
  return false;
}

function buildConsultationSlotPanel(
  slot: ConsultationSlotDraft,
  slotNumber: number,
  photoDataUrlById: Map<string, string> | undefined,
  vis: PdfVisibilitySettings,
): string {
  const safeBlocks = mergeSourceBlocksWithDefaults(
    slot.sourceBlocks && typeof slot.sourceBlocks === "object" ? slot.sourceBlocks : {},
  );
  const csdd = safeBlocks.csdd;
  if (!consultationSlotHasPdfContent(slot, csdd, vis)) return "";

  const panelTitle = buildSlotPanelTitle(csdd, slot.salePrice, slotNumber);
  const inner: string[] = [];

  const kv: string[] = [];
  if (slot.listingUrl.trim()) {
    const u = esc(slot.listingUrl.trim());
    kv.push(
      `<tr><td>Sludinājuma links</td><td><a href="${u}" class="pdf-v1-listing-link">${u}</a></td></tr>`,
    );
  } else {
    kv.push(`<tr><td>Sludinājuma links</td><td>—</td></tr>`);
  }
  kv.push(
    `<tr><td>Pārdošanas cena</td><td>${slot.salePrice.trim() ? esc(slot.salePrice.trim()) : "—"}</td></tr>`,
  );
  inner.push(`<table class="pdf-v1-kv pdf-select-slot-kv"><tbody>${kv.join("")}</tbody></table>`);

  if (vis.csdd) {
    inner.push(buildCsddConsultationSubsection(csdd));
  }

  if (vis.ltab) {
    inner.push(plainBlockSubsection("LTAB", ltabBlockToPlainText(safeBlocks.ltab)));
  }

  inner.push(richCommentSubsection("Ieteikumi klātienes apskatei", slot.ieteikumiApskatei));
  inner.push(richCommentSubsection("Cenas atbilstība", slot.cenasAtbilstiba));
  inner.push(richCommentSubsection("Kopsavilkums", slot.kopsavilkums));

  const photosInner = buildConsultationSlotPhotosInner(slot, photoDataUrlById);
  if (photosInner) {
    inner.push(
      `<div class="pdf-select-subsection" role="region">
        <p class="pdf-select-subsection-title">${esc("Fotogrāfijas")}</p>
        ${photosInner}
      </div>`,
    );
  }

  const body = inner.filter(Boolean).join("");
  if (!body) return "";

  return `<div class="pdf-v1-panel pdf-v1-panel--clean pdf-surface-card pdf-select-slot-panel" role="region">
    <div class="pdf-v1-panel-head"><p class="pdf-v1-panel-title">${esc(panelTitle)}</p></div>
    <div class="pdf-select-slot-body">${body}</div>
  </div>`;
}

export function buildSelectConsultationDocumentHtml(args: {
  order: {
    created: number;
    amountTotal: number | null;
    currency: string | null;
    paymentStatus: string;
    customerEmail: string | null;
    customerName: string | null;
    phone: string | null;
    contactMethod?: string | null;
    notes: string | null;
  };
  workspace: ConsultationDraftWorkspaceBody;
  dateFmt: Intl.DateTimeFormat;
  /** JPEG kā data URL drukai (ielādē admin pārlūkā pirms `document.write`). */
  photoDataUrlById?: Map<string, string>;
}): string {
  const { order: o, workspace: w, dateFmt, photoDataUrlById } = args;
  const vis = mergePdfVisibility(w.pdfVisibility);
  const money =
    o.amountTotal == null
      ? "—"
      : new Intl.NumberFormat("lv-LV", { style: "currency", currency: o.currency ?? "EUR" }).format(
          o.amountTotal / 100,
        );

  const lines: string[] = [];
  lines.push('<div class="sheet provin-report-doc">');
  lines.push('<header class="pdf-v1-hero">');
  lines.push('<div class="pdf-v1-hero-inner">');
  lines.push(provincLogoSvg());
  lines.push('<div class="pdf-v1-hero-text">');
  lines.push(`<h1 class="pdf-v1-doc-title">${esc(DOC_TITLE)}</h1>`);
  lines.push(`<p class="pdf-v1-meta">Ģenerēts: ${esc(dateFmt.format(new Date()))}</p>`);
  lines.push("</div></div></header>");

  lines.push(
    buildPdfAdminMirrorPaymentBlock(
      {
        created: o.created,
        paymentStatus: o.paymentStatus,
        amountTotal: o.amountTotal,
        currency: o.currency,
      },
      money,
      dateFmt,
      sectionIconPdfHtml("creditCard"),
    ),
  );

  lines.push(
    buildPdfAdminMirrorClientBlock(
      {
        customerName: o.customerName,
        customerEmail: o.customerEmail,
        customerPhone: o.phone,
        contactMethod: o.contactMethod ?? null,
      },
      sectionIconPdfHtml("userCircle"),
    ),
  );

  lines.push(buildPdfAdminMirrorNotesBlock(o.notes, sectionIconPdfHtml("messageSquare")));

  w.slots.forEach((slot, idx) => {
    const panel = buildConsultationSlotPanel(slot, idx + 1, photoDataUrlById, vis);
    if (panel) lines.push(panel);
  });

  lines.push(
    richCommentSubsection(
      "APPROVED BY IRISS",
      w.irissApproved,
    ) || "",
  );

  lines.push(
    '<p class="no-print" style="margin-top:12px"><button type="button" style="padding:7px 14px;font-size:12px;border-radius:6px;border:1px solid #94a3b8;background:#fff;color:#475569;cursor:pointer;font-family:Inter,sans-serif;font-weight:500" onclick="window.print()">Drukāt / PDF</button></p>',
  );

  lines.push("</div>");

  const printTitle = "PROVIN_SELECT_Konsultacija.pdf";
  const extraPlainCss = `
    .pdf-select-slot-panel{break-inside:avoid-page;}
    .pdf-select-slot-body{padding:10px 12px 12px;display:flex;flex-direction:column;gap:12px;}
    .pdf-select-slot-kv{margin:0;}
    .pdf-select-subsection{margin:0;}
    .pdf-select-subsection-title{
      margin:0 0 6px;font-family:Inter,ui-sans-serif,sans-serif;font-size:0.7rem;font-weight:700;
      letter-spacing:0.04em;text-transform:uppercase;color:#334155;
    }
    .pdf-select-plain{
      margin:0;padding:10px 12px;font-family:Inter,ui-sans-serif,sans-serif;font-size:0.72rem;line-height:1.45;
      white-space:pre-wrap;word-break:break-word;color:#1d1d1f;background:#fafafa;border-radius:8px;border:1px solid #f1f5f9;
    }
    .pdf-select-rich-body{
      margin:0;padding:10px 12px;font-family:Inter,ui-sans-serif,sans-serif;font-size:0.72rem;line-height:1.45;
      color:#1d1d1f;background:#fafafa;border-radius:8px;border:1px solid #f1f5f9;word-break:break-word;
    }
    .pdf-select-rich-body strong{font-weight:700;color:#0f172a;}
    .pdf-slot-photo-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;}
    .pdf-slot-photo-card{margin:0;break-inside:avoid;}
    .pdf-slot-photo-img{width:100%;height:auto;max-height:280px;object-fit:contain;border-radius:8px;border:1px solid #e2e8f0;display:block;}
    .pdf-slot-photo-caption{margin-top:6px;font-family:Inter,ui-sans-serif,sans-serif;font-size:0.68rem;line-height:1.35;color:#475569;word-break:break-word;}
    .pdf-slot-photo-caption strong{font-weight:700;}
  `;
  const html = `<!DOCTYPE html><html lang="lv"><head><meta charset="utf-8"/>
<title>${esc(printTitle)}</title>
<meta name="viewport" content="width=device-width, initial-scale=1" />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet"/>
<style>${getClientReportPrintCss()}${pdfLayoutDraftExtraCss()}${extraPlainCss}</style></head>
<body class="provin-report-doc">${lines.join("")}</body></html>`;
  return html;
}
