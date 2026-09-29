import { buildPdfKvPairHtml } from "@/lib/pdf-fact-card";
import {
  OUTVIN_VEHICLE_INFO_ROWS,
  outvinDealerReportHasContent,
  outvinEquipmentLineHasData,
  type OutvinDealerReport,
  type OutvinVehicleInfo,
} from "@/lib/outvin-dealer-types";
import { capitalizeFactValue } from "@/lib/vin-sources/translate-lv";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function pdfSubLabel(title: string): string {
  return `<p class="pdf-subhead">${escapeHtml(title)}</p>`;
}

function vehicleInfoTable(vi: OutvinVehicleInfo): string {
  const rows: { k: string; v: string }[] = [];
  for (const { key, labelLv, labelEn } of OUTVIN_VEHICLE_INFO_ROWS) {
    const v = vi[key].trim();
    if (!v) continue;
    rows.push({ k: labelLv || labelEn, v: capitalizeFactValue(v) });
  }
  return buildPdfKvPairHtml(rows);
}

/** Aprīkojuma bloks (kods + apraksts) - dīlera PDF liek zem komentāra. */
export function buildOutvinDealerEquipmentPdfHtml(report: OutvinDealerReport | undefined | null): string {
  if (!report) return "";
  const equip = report.equipment.filter(outvinEquipmentLineHasData);
  if (equip.length === 0) return "";
  return [
    pdfSubLabel("Aprīkojums"),
    `<ul class="pdf-dealer-eq">${equip
      .map((line) => {
        const code = line.code.trim();
        const desc = line.description.trim();
        const label = code ? `<b>${escapeHtml(code)}</b>${escapeHtml(desc)}` : escapeHtml(desc);
        return `<li>${label}</li>`;
      })
      .join("")}</ul>`,
  ].join("\n");
}

export function buildOutvinDealerReportPdfInnerHtml(
  report: OutvinDealerReport | undefined | null,
  opts?: { omitEquipment?: boolean },
): string {
  if (!outvinDealerReportHasContent(report) || !report) return "";

  const parts: string[] = [];
  const vi = report.vehicleInfo;

  const vehicleTable = vehicleInfoTable(vi);
  if (vehicleTable) {
    parts.push(pdfSubLabel("Transportlīdzekļa informācija"));
    parts.push(vehicleTable);
  }

  if (!opts?.omitEquipment) {
    const equipHtml = buildOutvinDealerEquipmentPdfHtml(report);
    if (equipHtml) parts.push(equipHtml);
  }

  return parts.join("\n");
}
