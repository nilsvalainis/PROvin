/**
 * CSDD TA brīdinājumu rindas — admin + PDF.
 */

import type { CsddInspectionWarningRow, CsddInspectionWarningSeverity } from "@/lib/admin-source-blocks";
import { filterCsddInspectionWarnings } from "@/lib/admin-source-blocks";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function warningSeverityClass(severity: CsddInspectionWarningSeverity): string {
  return `pdf-csdd-ta-warn pdf-csdd-ta-warn--${severity}`;
}

export function buildCsddInspectionWarningsHtml(warnings: CsddInspectionWarningRow[] | undefined): string {
  const rows = filterCsddInspectionWarnings(warnings);
  if (rows.length === 0) return "";
  const items = rows
    .map(
      (w) =>
        `<p class="${warningSeverityClass(w.severity)}" role="note">${escapeHtml(w.text.trim())}</p>`,
    )
    .join("");
  return `<div class="pdf-csdd-ta-warnings">${items}</div>`;
}
