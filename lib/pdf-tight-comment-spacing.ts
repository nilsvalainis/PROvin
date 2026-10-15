/**
 * Vienots PDF komentāru / rindkopu atstarpe: viena rindas augstums pirms katra virsraksta (izņemot pirmo).
 */

export const PDF_TIGHT_GAP_SECTION = "1em";
export const PDF_TIGHT_GAP_BLOCK = "1em";
export const PDF_TIGHT_GAP_HEADING = "1em";

/** `:root` mainīgie klienta atskaites CSS. */
export const PDF_TIGHT_GAP_CSS_ROOT = `
        --pdf-gap-section:${PDF_TIGHT_GAP_SECTION};
        --pdf-gap-block:${PDF_TIGHT_GAP_BLOCK};
        --pdf-gap-heading:${PDF_TIGHT_GAP_HEADING};`;

/** Papildu noteikumi, ko importē atsevišķi PDF varianti. */
export const PDF_TIGHT_RICH_BODY_RULES_CSS = `
      .pdf-report-comment-note-body br + strong,
      .pdf-incident-internal-note-body br + strong,
      .pdf-mileage-comment-note-body br + strong,
      .pdf-select-rich-body br + strong,
      .ipdf-rich-comment br + strong{display:inline-block;margin-top:${PDF_TIGHT_GAP_BLOCK};}
      .pdf-select-rich-body,.ipdf-rich-comment,.ipdf-rich-comment p{margin:0;line-height:1.45;}
      .pdf-select-rich-body p + p,.ipdf-rich-comment p + p{margin-top:1em;}
      .pdf-select-slot-body{gap:1em;}
      .pdf-select-csdd-stack{gap:1em;}
      .pdf-select-subsection + .pdf-select-subsection{margin-top:1em;}
      .ipdf-blk + .ipdf-blk{margin-top:1em;}
      .oem-work,.oem-extra{line-height:1.45;}
      .oem-extra{margin-top:0;}
      .pdf-ccvin-flags{margin-bottom:1em;}`;

/** Konsultācijas PDF papildu CSS (aizstāj lielākus gap). */
export const PDF_TIGHT_SELECT_EXTRA_CSS = `
    .pdf-select-slot-body{padding:10px 12px 12px;display:flex;flex-direction:column;gap:1em;}
    .pdf-select-csdd-stack{display:flex;flex-direction:column;gap:1em;}
    .pdf-select-subsection-title{margin:0 0 0.35em;}
    ${PDF_TIGHT_RICH_BODY_RULES_CSS}`;
