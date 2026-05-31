/**
 * Tehnisko apskašu vēstures tabula (PDF) — pa gadiem, 2 kolonnas (Nov. + Trūkumi).
 */

import {
  groupTechnicalInspectionsByYear,
  previousInspectionBlockToRow,
  type CsddPreviousInspectionBlock,
  type CsddTechnicalInspectionRow,
} from "@/lib/csdd-extended-parse";
import type { CsddInspectionDefectRow } from "@/lib/csdd-extended-parse";

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

function inspectionYearFromDate(date: string): number | null {
  const m = date.trim().match(/\d{2}\.\d{2}\.(\d{4})/);
  if (!m?.[1]) return null;
  const y = Number(m[1]);
  return Number.isFinite(y) ? y : null;
}

function buildDefectTableHtml(defects: CsddInspectionDefectRow[], historic: boolean): string {
  const tableClass = historic
    ? "mirror-table mirror-table--csdd-defect-historic mirror-table--csdd-defect-2col"
    : "mirror-table mirror-table--csdd-defect-current mirror-table--csdd-defect-2col";
  const defectBody =
    defects.length > 0
      ? defects
          .map((d) => {
            const rc = defectRatingClass(d.rating);
            return `<tr><td class="pdf-csdd-defect-rating tabular ${rc}">${escapeHtml(d.rating)}</td><td class="pdf-csdd-defect-desc">${escapeHtml(d.description)}</td></tr>`;
          })
          .join("\n")
      : `<tr><td colspan="2" class="pdf-csdd-defect-empty">Nav reģistrētu trūkumu vai bojājumi.</td></tr>`;

  return `<table class="${tableClass}" role="table">
<thead><tr><th scope="col">Nov.</th><th scope="col">Trūkumi vai bojājumi</th></tr></thead>
<tbody>${defectBody}</tbody>
</table>`;
}

function buildInspectionInnerHtml(
  row: CsddTechnicalInspectionRow,
  historic: boolean,
  opts?: { odometer?: string; nextInspectionDateText?: string },
): string {
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
  const extrasHtml = extras.length > 0 ? `<div class="pdf-csdd-ta-extras">${extras.join("")}</div>` : "";
  const tableHtml = buildDefectTableHtml(row.defects ?? [], historic);

  return `<div class="pdf-csdd-ta-inspection${historic ? " pdf-csdd-ta-inspection--historic" : ""}">
<p class="pdf-csdd-ta-inspection-meta">${meta}</p>
${extrasHtml}
${tableHtml}
</div>`;
}

function buildYearFramedBlock(year: number | null, innerHtml: string): string {
  if (!innerHtml.trim()) return "";
  const heading = year != null ? `<p class="pdf-csdd-ta-year-heading">${year}</p>` : "";
  return `<div class="pdf-csdd-ta-year-block">${heading}<div class="pdf-csdd-ta-year-frame">${innerHtml}</div></div>`;
}

/** PDF — viena kolonna, bloki pa gadiem (jaunākais gads augšā). */
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
      const inner = inspections
        .map((row) => buildInspectionInnerHtml(row, row.date !== newestDate))
        .join("");
      return buildYearFramedBlock(year, inner);
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
  const inner = buildInspectionInnerHtml(row, false, {
    odometer: block.odometer,
    nextInspectionDateText: block.nextInspectionDateText,
  });
  return buildYearFramedBlock(inspectionYearFromDate(dateDisplay), inner);
}
