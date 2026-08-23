/**
 * Klienta audita PDF kolofons — logo, atruna, konfidencialitāte.
 * Bez juridiskā vārda, reģ. nr. un adreses.
 */

import { resolveProvinAuditPdfProductBrand } from "@/lib/audit-report-pdf-filename";
import { provincLogoSvg } from "@/lib/client-report-pdf-layout-draft";
import {
  buildPdfDocFooterMetaLine,
  formatPdfDocFooterProductLabel,
  getClientReportLegalFooterBlocks,
  PDF_DOC_FOOTER_CONFIDENTIALITY_TITLE,
  PDF_DOC_FOOTER_DISCLAIMER_TITLE,
} from "@/lib/report-pdf-standards";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildPdfDocFooterHtml(args: {
  vin: string | null;
  amountTotalCents: number | null;
  generatedLabel: string;
}): string {
  const b = getClientReportLegalFooterBlocks();
  const productLabel = formatPdfDocFooterProductLabel(
    resolveProvinAuditPdfProductBrand({ amountTotalCents: args.amountTotalCents }),
  );
  const meta = buildPdfDocFooterMetaLine({
    vin: args.vin,
    generatedLabel: args.generatedLabel,
  });
  const logo = provincLogoSvg().replace(
    'class="pdf-v1-logo"',
    'class="pdf-v1-logo pdf-doc-footer__logo"',
  );
  return `<footer class="pdf-doc-footer" role="contentinfo">
<div class="pdf-doc-footer__head">
${logo}
<div class="pdf-doc-footer__head-end">
<p class="pdf-doc-footer__product">${escapeHtml(productLabel)}</p>
${meta ? `<p class="pdf-doc-footer__meta">${escapeHtml(meta)}</p>` : ""}
</div>
</div>
<div class="pdf-doc-footer__legal">
<div class="pdf-doc-footer__col">
<h3 class="pdf-doc-footer__heading">${escapeHtml(PDF_DOC_FOOTER_DISCLAIMER_TITLE)}</h3>
<p class="pdf-doc-footer__text">${escapeHtml(b.disclaimer)}</p>
</div>
<div class="pdf-doc-footer__col pdf-doc-footer__col--confidential">
<h3 class="pdf-doc-footer__heading">${escapeHtml(PDF_DOC_FOOTER_CONFIDENTIALITY_TITLE)}</h3>
<p class="pdf-doc-footer__text">${escapeHtml(b.confidentiality)}</p>
</div>
</div>
</footer>`;
}

export function pdfDocFooterCss(): string {
  return `
      .pdf-doc-footer{
        margin-top:28px;padding:0;background:#fff;border:0;
        break-inside:avoid;page-break-inside:avoid;-webkit-column-break-inside:avoid;
      }
      .pdf-doc-footer__head{
        display:flex;align-items:flex-end;justify-content:space-between;gap:16px;
        padding:0 0 12px;border-bottom:1px solid #E9EDF3;
      }
      .pdf-doc-footer__logo{display:block;width:118px;max-width:42%;height:auto;margin:0;}
      .pdf-doc-footer__head-end{text-align:right;min-width:0;}
      .pdf-doc-footer__product{
        margin:0;font-size:9.5px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;
        color:#0f172a;line-height:1.3;
      }
      .pdf-doc-footer__meta{
        margin:4px 0 0;font-size:8.5px;font-weight:500;line-height:1.4;color:#64748b;
      }
      .pdf-doc-footer__legal{display:flex;flex-direction:column;gap:11px;padding:13px 0 10px;}
      .pdf-doc-footer__heading{
        margin:0 0 4px;font-size:8px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;
        color:#0061D2;line-height:1.3;
      }
      .pdf-doc-footer__text{margin:0;font-size:9px;font-weight:400;line-height:1.5;color:#64748b;}
      .pdf-doc-footer__col--confidential{
        padding:9px 12px;background:#F7F9FC;border-left:2px solid #0061D2;
        -webkit-print-color-adjust:exact;print-color-adjust:exact;
      }
      .pdf-doc-footer__col--confidential .pdf-doc-footer__text{font-weight:600;color:#475569;}
      @media screen and (max-width:720px){
        .pdf-doc-footer__head{flex-wrap:wrap;align-items:flex-start;}
        .pdf-doc-footer__head-end{text-align:left;}
      }
  `;
}
