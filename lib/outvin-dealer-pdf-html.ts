import {
  OUTVIN_VEHICLE_INFO_PDF_PAIRS,
  OUTVIN_VEHICLE_INFO_ROWS,
  outvinDealerReportHasContent,
  outvinEquipmentLineHasData,
  type OutvinDealerReport,
} from "@/lib/outvin-dealer-types";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function labelForKey(key: (typeof OUTVIN_VEHICLE_INFO_ROWS)[number]["key"]): string {
  return OUTVIN_VEHICLE_INFO_ROWS.find((r) => r.key === key)?.labelEn ?? key;
}

function pdfSubLabel(title: string): string {
  return `<p class="pdf-field-label pdf-field-label--row pdf-outvin-subhead"><span>${escapeHtml(title)}</span></p>`;
}

function pdfPlainBlock(text: string): string {
  const t = text.trim();
  if (!t) return "";
  const body = escapeHtml(t).replace(/\r?\n/g, "<br />");
  return `<div class="pdf-outvin-plain">${body}</div>`;
}

export function buildOutvinDealerReportPdfInnerHtml(report: OutvinDealerReport | undefined | null): string {
  if (!outvinDealerReportHasContent(report) || !report) return "";

  const parts: string[] = [];
  const vi = report.vehicleInfo;

  const vehicleRows: string[] = [];
  for (const [leftKey, rightKey] of OUTVIN_VEHICLE_INFO_PDF_PAIRS) {
    const lVal = vi[leftKey].trim();
    const rVal = vi[rightKey].trim();
    if (!lVal && !rVal) continue;
    vehicleRows.push(
      `<tr>
        <td>${escapeHtml(labelForKey(leftKey))}</td><td>${escapeHtml(lVal || "—")}</td>
        <td>${escapeHtml(labelForKey(rightKey))}</td><td>${escapeHtml(rVal || "—")}</td>
      </tr>`,
    );
  }
  if (vehicleRows.length > 0) {
    parts.push(pdfSubLabel("VEHICLE INFORMATION"));
    parts.push(
      `<table class="mirror-table mirror-table--outvin-vehicle"><tbody>${vehicleRows.join("\n")}</tbody></table>`,
    );
  }

  const accident = report.accidentCheck.trim();
  if (accident) {
    parts.push(pdfSubLabel("ACCIDENT CHECK"));
    parts.push(pdfPlainBlock(accident));
  }

  const stolen = report.stolenCheck.trim();
  if (stolen) {
    parts.push(pdfSubLabel("STOLEN VEHICLE DATABASE"));
    parts.push(pdfPlainBlock(stolen));
  }

  const equip = report.equipment.filter(outvinEquipmentLineHasData);
  if (equip.length > 0) {
    parts.push(pdfSubLabel("EQUIPMENT LIST"));
    const cells = equip.map((line) => {
      const text =
        line.code.trim() && line.description.trim()
          ? `${line.code.trim()} - ${line.description.trim()}`
          : line.code.trim() || line.description.trim();
      return `<span class="pdf-outvin-equip-item">${escapeHtml(text)}</span>`;
    });
    parts.push(`<div class="pdf-outvin-equipment-grid">${cells.join("")}</div>`);
  }

  return parts.join("\n");
}
