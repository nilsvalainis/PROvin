/** Klase uz `<html>` — tikai drukājamajai atskaitei, digitālo PDF CSS nemaina. */
export const PROVIN_REPORT_PRINT_INK_CLASS = "provin-report-print-ink";

/**
 * Papīra versija: gaišie pelēkie toņi un 1px līnijas printerī pazūd.
 * Pārraksta tokenus + zināmos sekundāros tekstus uz gandrīz melnu, bez foto filtra.
 */
export function clientReportPrintInkCss(): string {
  const root = `html.${PROVIN_REPORT_PRINT_INK_CLASS}`;
  return `
      ${root}{
        --pdf-line:#111827;
        --pdf-line-soft:#4b5563;
        --pdf-shadow:none;
        --pdf-comment-bg:#fff;
        --pdf-comment-line:#111827;
        --pdf-comment-edge:#111827;
      }
      ${root},
      ${root} body{
        color:#000!important;
        -webkit-font-smoothing:none;
        -moz-osx-font-smoothing:grayscale;
      }
      ${root} body.provin-report-doc{font-weight:500;}
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
        color:#111827!important;font-weight:600;
      }
      ${root} .provin-report-doc .pdf-surface-card,
      ${root} .provin-report-doc .pdf-v1-panel,
      ${root} .provin-report-doc .pdf-unified-mileage-zone,
      ${root} .provin-report-doc .pdf-unified-incidents-zone,
      ${root} .provin-report-doc .pdf-life-card,
      ${root} .provin-report-doc .pdf-summary-tile,
      ${root} .provin-report-doc .pdf-listing-price-history,
      ${root} .provin-report-doc .pdf-ltab-loss-history,
      ${root} .provin-report-doc .pdf-doc-footer{
        border-color:#111827!important;
        border-width:1.75px!important;
        box-shadow:none!important;
      }
      ${root} .provin-report-doc .pdf-sec-head--brand,
      ${root} .provin-report-doc .pdf-iriss-approved .pdf-sec-head--brand{
        border-bottom-color:#111827!important;
        border-bottom-width:2px!important;
      }
      ${root} .provin-report-doc .pdf-life-rail{
        background:#1e293b!important;width:3px;
      }
      ${root} .provin-report-doc .pdf-life-dot{
        border-color:#0f172a!important;border-width:2.5px;
      }
      ${root} .provin-report-doc .pdf-life-item--alert .pdf-life-dot,
      ${root} .provin-report-doc .pdf-life-item--incident .pdf-life-dot{
        background:#b91c1c!important;border-color:#b91c1c!important;
      }
      ${root} .provin-report-doc .pdf-life-year{
        background:#e2e8f0!important;border:1.5px solid #111827;
      }
      ${root} .provin-report-doc .pdf-life-year__num{color:#003a7a!important;}
      ${root} .provin-report-doc .pdf-life-km{
        background:#e2e8f0!important;border:1px solid #111827;color:#000!important;
      }
      ${root} .provin-report-doc .pdf-src-zone{border-top-color:#111827;}
      ${root} .provin-report-doc .pdf-src-mileage-spark-grid{
        stroke:#64748b!important;opacity:1!important;
      }
      ${root} .provin-report-doc .pdf-src-mileage-spark-ghost{
        stroke:#334155!important;opacity:0.85!important;
      }
      ${root} .provin-report-doc .pdf-csdd-ta-warn--gray{
        border-left-color:#111827!important;color:#000!important;background:#f1f5f9!important;
      }
      ${root} .provin-report-doc .pdf-doc-footer__heading{color:#003a7a!important;}
      ${root} .provin-report-doc .pdf-doc-footer__col--confidential{
        border-left-color:#003a7a!important;background:#e2e8f0!important;
      }
      ${root} .provin-report-doc .pdf-v1-logo tspan[fill="#0061D2"]{fill:#003a7a;}
      ${root} .pdf-print-ink-banner{
        margin:0 0 12px;padding:8px 10px;border:1px solid #111827;border-radius:8px;
        font-size:12px;font-weight:600;color:#111827;background:#f8fafc;
      }
  `;
}
