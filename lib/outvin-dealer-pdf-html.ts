import { isPdfEmptyPlaceholder } from "@/lib/pdf-odometer-display";
import { buildPdfKvPairHtml } from "@/lib/pdf-fact-card";
import {
  OUTVIN_VEHICLE_INFO_ROWS,
  outvinDealerReportHasContent,
  outvinEquipmentLineHasData,
  type OutvinDealerReport,
  type OutvinVehicleInfo,
} from "@/lib/outvin-dealer-types";
import { capitalizeFactValue } from "@/lib/vin-sources/translate-lv";
import { translateDealerVehicleCodeLv } from "@/lib/dealer-vehicle-code-lv";
import { maskVinForDemo } from "@/lib/demo-vin-mask";

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

function vehicleInfoTable(vi: OutvinVehicleInfo, opts?: { maskDemoVin?: boolean }): string {
  const rows: { k: string; v: string }[] = [];
  for (const { key, labelLv, labelEn } of OUTVIN_VEHICLE_INFO_ROWS) {
    let v = vi[key].trim();
    if (!v || isPdfEmptyPlaceholder(v)) continue;
    if (key === "vinCode" && opts?.maskDemoVin) v = maskVinForDemo(v);
    else v = translateDealerVehicleCodeLv(key, v);
    rows.push({ k: labelLv || labelEn, v: capitalizeFactValue(v) });
  }
  const table = buildPdfKvPairHtml(rows);
  if (!table) return "";
  return `<div class="pdf-dealer-vehicle-kv">${table}</div>`;
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
  opts?: { omitEquipment?: boolean; maskDemoVin?: boolean },
): string {
  if (!outvinDealerReportHasContent(report) || !report) return "";

  const parts: string[] = [];
  const vi = report.vehicleInfo;

  const vehicleTable = vehicleInfoTable(vi, { maskDemoVin: opts?.maskDemoVin });
  if (vehicleTable) {
    parts.push(
      `<div class="pdf-keep-head">${pdfSubLabel("Transportlīdzekļa informācija")}${vehicleTable}</div>`,
    );
  }

  if (!opts?.omitEquipment) {
    const equipHtml = buildOutvinDealerEquipmentPdfHtml(report);
    if (equipHtml) parts.push(equipHtml);
  }

  return parts.join("\n");
}
