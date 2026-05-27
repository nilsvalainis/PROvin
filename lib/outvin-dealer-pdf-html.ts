import {
  OUTVIN_VEHICLE_INFO_ROWS,
  outvinDealerReportHasContent,
  outvinEquipmentLineHasData,
  type OutvinDealerReport,
  type OutvinVehicleInfo,
} from "@/lib/outvin-dealer-types";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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

function pdfKvTable(rows: { k: string; v: string }[]): string {
  if (rows.length === 0) return "";
  const body = rows
    .map((r) => `<tr><td>${escapeHtml(r.k)}</td><td>${escapeHtml(r.v)}</td></tr>`)
    .join("\n");
  return `<table class="pdf-v1-kv"><tbody>${body}</tbody></table>`;
}

function vehicleInfoTable(vi: OutvinVehicleInfo): string {
  const rows: { k: string; v: string }[] = [];
  for (const { key, labelLv, labelEn } of OUTVIN_VEHICLE_INFO_ROWS) {
    const v = vi[key].trim();
    if (!v) continue;
    rows.push({ k: labelLv || labelEn, v });
  }
  return pdfKvTable(rows);
}

export function buildOutvinDealerReportPdfInnerHtml(report: OutvinDealerReport | undefined | null): string {
  if (!outvinDealerReportHasContent(report) || !report) return "";

  const parts: string[] = [];
  const vi = report.vehicleInfo;

  const vehicleTable = vehicleInfoTable(vi);
  if (vehicleTable) {
    parts.push(pdfSubLabel("VEHICLE INFORMATION"));
    parts.push(vehicleTable);
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
    parts.push(
      pdfKvTable(
        equip.map((line, i) => {
          const text =
            line.code.trim() && line.description.trim()
              ? `${line.code.trim()} — ${line.description.trim()}`
              : line.code.trim() || line.description.trim();
          return { k: equip.length > 1 ? `${i + 1}.` : "Aprīkojums", v: text };
        }),
      ),
    );
  }

  return parts.join("\n");
}
