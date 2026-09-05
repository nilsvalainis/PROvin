/** Klase uz `<html>` — tikai drukājamajai atskaitei, digitālo PDF CSS nemaina. */
export const PROVIN_REPORT_PRINT_INK_CLASS = "provin-report-print-ink";

/**
 * Papīra versija: tumšāks teksts, lai pelēkie paraksti printerī paliek salasāmi.
 * Kartīšu rāmji paliek 1px un tā pati gaišā valoda — tikai par vienu soli tumšāki.
 */
export function clientReportPrintInkCss(): string {
  const root = `html.${PROVIN_REPORT_PRINT_INK_CLASS}`;
  return `
      ${root}{
        --pdf-line:#C5CDD8;
        --pdf-line-soft:#D8DEE7;
        --pdf-shadow:0 1px 2px rgba(15,23,42,.06);
        --pdf-comment-bg:#F6FAFF;
        --pdf-comment-line:#C5D4EA;
        --pdf-comment-edge:#8AA9D4;
      }
      ${root} body.provin-report-doc{color:#0f172a;}
      @media print{
        ${root},
        ${root} body{-webkit-font-smoothing:none;-moz-osx-font-smoothing:grayscale;}
        ${root} .no-print,
        ${root} .pdf-print-chrome,
        ${root} .pdf-print-ink-banner{
          display:none!important;visibility:hidden!important;height:0!important;
          margin:0!important;padding:0!important;overflow:hidden!important;
        }
      }
      @media screen{
        ${root} .pdf-print-chrome{margin:0 0 14px;}
        ${root} .pdf-print-ink-banner{
          margin:0 0 12px;padding:8px 10px;border:1px solid #C5CDD8;border-radius:8px;
          font-size:12px;font-weight:500;color:#334155;background:#f8fafc;
        }
      }
      ${root} .provin-report-doc .pdf-v1-meta,
      ${root} .provin-report-doc .pdf-v1-meta .pdf-vin,
      ${root} .provin-report-doc .pdf-life-ico,
      ${root} .provin-report-doc .pdf-life-meta,
      ${root} .provin-report-doc .pdf-life-card__sub,
      ${root} .provin-report-doc .pdf-life-imp__arrow,
      ${root} .provin-report-doc .pdf-summary-tile__note,
      ${root} .provin-report-doc .pdf-sources-checked-count,
      ${root} .provin-report-doc .pdf-ltab-izzi-footer,
      ${root} .provin-report-doc .pdf-subhead,
      ${root} .provin-report-doc .pdf-subhead__ico,
      ${root} .provin-report-doc .pdf-cv-subsection-title,
      ${root} .provin-report-doc .pdf-csdd-owner-date,
      ${root} .provin-report-doc .pdf-ccvin-facts,
      ${root} .provin-report-doc .pdf-doc-footer__meta,
      ${root} .provin-report-doc .pdf-doc-footer__text,
      ${root} .provin-report-doc .pdf-doc-footer__col--confidential .pdf-doc-footer__text,
      ${root} .provin-report-doc .mirror-table td:first-child,
      ${root} .provin-report-doc .pdf-csdd-alert-label,
      ${root} .provin-report-doc .pdf-v1-kv td:first-child,
      ${root} .provin-report-doc .pdf-listing-price-history-table td:last-child,
      ${root} .provin-report-doc .pdf-listing-price-delta--note,
      ${root} .provin-report-doc .pdf-incident-source-vals,
      ${root} .provin-report-doc .pdf-csdd-defect-empty,
      ${root} .provin-report-doc [style*="#64748b"],
      ${root} .provin-report-doc [style*="#86868b"],
      ${root} .provin-report-doc [style*="#6e6e73"],
      ${root} .provin-report-doc [style*="#94a3b8"],
      ${root} .provin-report-doc [style*="#475569"]{
        color:#334155;
      }
      ${root} .provin-report-doc .pdf-life-rail{background:#94A3B8;}
      ${root} .provin-report-doc .pdf-src-mileage-spark-ghost{
        stroke:#64748B;opacity:0.4;
      }
      ${root} .provin-report-doc .pdf-csdd-ta-warn--gray{color:#1e293b;}
  `;
}
