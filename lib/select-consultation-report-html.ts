/**
 * PROVIN SELECT stratēģiskās konsultācijas PDF / drukas HTML — tās pašas vizuālās līnijas kā klienta auditam.
 */

import type { ConsultationDraftWorkspaceBody } from "@/lib/admin-consultation-draft-types";
import {
  csddFormToPlainText,
  ltabBlockToPlainText,
  mergeSourceBlocksWithDefaults,
} from "@/lib/admin-source-blocks";
import {
  buildPdfAdminMirrorClientBlock,
  buildPdfAdminMirrorNotesBlock,
  buildPdfAdminMirrorPaymentBlock,
  pdfLayoutDraftExtraCss,
  provincLogoSvg,
} from "@/lib/client-report-pdf-layout-draft";
import { getClientReportPrintCss } from "@/lib/client-report-html";
import { internalCommentHtmlToPdfPlain } from "@/lib/admin-internal-comment-pdf";
import { sectionIconPdfHtml } from "@/lib/section-icons";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const DOC_TITLE = "PROVIN SELECT, STRATĒĢISKĀ KONSULTĀCIJA";

function plainBlockPanel(title: string, body: string): string {
  const t = internalCommentHtmlToPdfPlain(body).trim();
  if (!t) return "";
  return `<div class="pdf-v1-panel pdf-v1-panel--clean pdf-surface-card" role="region">
    <div class="pdf-v1-panel-head"><p class="pdf-v1-panel-title">${esc(title)}</p></div>
    <pre class="pdf-select-plain">${esc(t)}</pre>
  </div>`;
}

function buildConsultationSlotPhotosPdf(
  slot: ConsultationDraftWorkspaceBody["slots"][number],
  dataUrls: Map<string, string> | undefined,
): string {
  const photos = slot.photos ?? [];
  const parts: string[] = [];
  for (const ph of photos) {
    const src = dataUrls?.get(ph.id);
    if (!src) continue;
    const cap = internalCommentHtmlToPdfPlain(ph.comment).trim();
    parts.push(
      `<figure class="pdf-slot-photo-card"><img class="pdf-slot-photo-img" src="${src}" alt=""/>
${cap ? `<figcaption class="pdf-slot-photo-caption">${esc(cap)}</figcaption>` : ""}</figure>`,
    );
  }
  if (parts.length === 0) return "";
  return `<div class="pdf-v1-panel pdf-v1-panel--clean pdf-surface-card" role="region">
    <div class="pdf-v1-panel-head"><p class="pdf-v1-panel-title">${esc("Fotogrāfijas")}</p></div>
    <div class="pdf-slot-photo-grid">${parts.join("")}</div>
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
    const n = idx + 1;
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
    lines.push(`<div class="pdf-v1-panel pdf-v1-panel--clean pdf-surface-card" role="region">
      <div class="pdf-v1-panel-head"><p class="pdf-v1-panel-title">Nr. ${n}</p></div>
      <table class="pdf-v1-kv"><tbody>${kv.join("")}</tbody></table>
    </div>`);

    const safeBlocks = mergeSourceBlocksWithDefaults(
      slot.sourceBlocks && typeof slot.sourceBlocks === "object" ? slot.sourceBlocks : {},
    );
    const csddTxt = csddFormToPlainText(safeBlocks.csdd);
    const ltabTxt = ltabBlockToPlainText(safeBlocks.ltab);
    lines.push(plainBlockPanel(`Nr. ${n} — CSDD`, csddTxt));
    lines.push(plainBlockPanel(`Nr. ${n} — LTAB`, ltabTxt));
    lines.push(plainBlockPanel(`Nr. ${n} — IETEIKUMI KLĀTIENES APSKATEI`, slot.ieteikumiApskatei));
    lines.push(plainBlockPanel(`Nr. ${n} — CENAS ATBILSTĪBA`, slot.cenasAtbilstiba));
    lines.push(plainBlockPanel(`Nr. ${n} — KOPSAVILKUMS`, slot.kopsavilkums));
    lines.push(buildConsultationSlotPhotosPdf(slot, photoDataUrlById));
  });

  lines.push(
    plainBlockPanel("APPROVED BY IRISS", w.irissApproved),
  );

  lines.push(
    '<p class="no-print" style="margin-top:12px"><button type="button" style="padding:7px 14px;font-size:12px;border-radius:6px;border:1px solid #94a3b8;background:#fff;color:#475569;cursor:pointer;font-family:Inter,sans-serif;font-weight:500" onclick="window.print()">Drukāt / PDF</button></p>',
  );

  lines.push("</div>");

  const printTitle = "PROVIN_SELECT_Konsultacija.pdf";
  const extraPlainCss = `
    .pdf-select-plain{
      margin:0;padding:10px 12px;font-family:Inter,ui-sans-serif,sans-serif;font-size:0.72rem;line-height:1.45;
      white-space:pre-wrap;word-break:break-word;color:#1d1d1f;background:#fafafa;border-radius:8px;border:1px solid #f1f5f9;
    }
    .pdf-slot-photo-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;padding:10px 12px 12px;}
    .pdf-slot-photo-card{margin:0;break-inside:avoid;}
    .pdf-slot-photo-img{width:100%;height:auto;max-height:280px;object-fit:contain;border-radius:8px;border:1px solid #e2e8f0;display:block;}
    .pdf-slot-photo-caption{margin-top:6px;font-family:Inter,ui-sans-serif,sans-serif;font-size:0.68rem;line-height:1.35;color:#475569;white-space:pre-wrap;word-break:break-word;}
  `;
  const html = `<!DOCTYPE html><html lang="lv"><head><meta charset="utf-8"/>
<title>${esc(printTitle)}</title>
<meta name="viewport" content="width=device-width, initial-scale=1" />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet"/>
<style>${getClientReportPrintCss()}${pdfLayoutDraftExtraCss()}${extraPlainCss}</style></head>
<body class="provin-report-doc">${lines.join("")}</body></html>`;
  return html;
}
