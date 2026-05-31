/**
 * Tehnisko apskašu vēstures tabula (PDF + admin HTML) — pa gadiem, katrs aizrādījums atsevišķā rindā.
 */

import {
  groupTechnicalInspectionsByYear,
  previousInspectionBlockToRow,
  type CsddPreviousInspectionBlock,
  type CsddTechnicalInspectionRow,
} from "@/lib/csdd-extended-parse";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function defectRatingClass(rating: string): string {
  if (rating === "1") return "pdf-csdd-defect-rating--1";
  if (rating === "2") return "pdf-csdd-defect-rating--2";
  if (rating === "3") return "pdf-csdd-defect-rating--3";
  return "";
}

function buildInspectionBlockHtml(
  row: CsddTechnicalInspectionRow,
  historic: boolean,
  opts?: { odometer?: string; nextInspectionDateText?: string },
): string {
  const tableClass = historic
    ? "mirror-table mirror-table--csdd-defect-historic"
    : "mirror-table mirror-table--csdd-defect-current";
  const metaParts = [row.date, row.inspectionType];
  if (opts?.odometer?.trim()) metaParts.push(`${opts.odometer.trim()} km`);
  if (row.ratingLabel.trim()) metaParts.push(`Novērtējums ${row.ratingLabel.trim()}`);
  const meta = escapeHtml(metaParts.filter(Boolean).join(" · "));
  const extras: string[] = [];
  if (opts?.nextInspectionDateText?.trim()) {
    extras.push(
      `<p class="pdf-csdd-tech-line"><span class="pdf-csdd-tech-bit">Nākamās apskates datums:</span> ${escapeHtml(opts.nextInspectionDateText.trim())}</p>`,
    );
  }
  if (row.smokeCoefficient?.trim()) {
    extras.push(
      `<p class="pdf-csdd-tech-line"><span class="pdf-csdd-tech-bit">Dūmainības koeficients (m⁻¹):</span> ${escapeHtml(row.smokeCoefficient.trim())}</p>`,
    );
  }
  if (row.notes?.trim()) {
    extras.push(
      `<p class="pdf-csdd-tech-line"><span class="pdf-csdd-tech-bit">Piezīmes:</span> ${escapeHtml(row.notes.trim())}</p>`,
    );
  }
  const extrasHtml = extras.length > 0 ? `<div class="pdf-csdd-ta-extras">${extras.join("")}</div>` : "";

  const defects = row.defects ?? [];
  const defectBody =
    defects.length > 0
      ? defects
          .map((d) => {
            const rc = defectRatingClass(d.rating);
            return `<tr><td class="pdf-csdd-defect-code tabular">${escapeHtml(d.code)}</td><td class="pdf-csdd-defect-rating tabular ${rc}">${escapeHtml(d.rating)}</td><td class="pdf-csdd-defect-desc">${escapeHtml(d.description)}</td></tr>`;
          })
          .join("\n")
      : `<tr><td colspan="3" class="pdf-csdd-defect-empty">Nav reģistrētu trūkumu vai bojājumu.</td></tr>`;

  return `<div class="pdf-csdd-ta-inspection${historic ? " pdf-csdd-ta-inspection--historic" : ""}">
<p class="pdf-csdd-ta-inspection-meta">${meta}</p>
${extrasHtml}
<table class="${tableClass}" role="table">
<thead><tr><th scope="col">Kods</th><th scope="col">Nov.</th><th scope="col">Trūkumi vai bojājumi</th></tr></thead>
<tbody>${defectBody}</tbody>
</table>
</div>`;
}

/** PDF / admin — viena kolonna, bloki pa gadiem (jaunākais gads augšā). */
export function buildTechnicalInspectionHistoryTableHtml(
  rows: CsddTechnicalInspectionRow[],
): string {
  const data = rows.filter((r) => r.date.trim());
  if (data.length === 0) return "";

  const byYear = groupTechnicalInspectionsByYear(data);
  const years = [...byYear.keys()].sort((a, b) => b - a);
  const newestDate = data[0]?.date ?? "";

  const yearBlocks = years
    .map((year) => {
      const inspections = byYear.get(year) ?? [];
      const blocks = inspections
        .map((row) => buildInspectionBlockHtml(row, row.date !== newestDate))
        .join("");
      return `<div class="pdf-csdd-ta-year-block"><p class="pdf-csdd-ta-year-heading">${year}</p>${blocks}</div>`;
    })
    .join("");

  return `<div class="pdf-csdd-ta-table-wrap">${yearBlocks}</div>`;
}

/** „Iepriekšējās apskates dati” — viena TA ar defektu tabulu. */
export function buildPreviousInspectionBlockHtml(
  block: CsddPreviousInspectionBlock,
  inspectionDate: string,
): string {
  if (!block.inspectionType.trim() && !(block.defects?.length)) return "";
  const dateDisplay = block.inspectionDateText.trim() || inspectionDate;
  const row = previousInspectionBlockToRow(block, dateDisplay);
  return buildInspectionBlockHtml(row, false, {
    odometer: block.odometer,
    nextInspectionDateText: block.nextInspectionDateText,
  });
}
