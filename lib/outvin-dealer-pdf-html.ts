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
  return `<p class="pdf-subhead">${escapeHtml(title)}</p>`;
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
    parts.push(pdfSubLabel("Transportlīdzekļa informācija"));
    parts.push(vehicleTable);
  }

  const accident = report.accidentCheck.trim();
  if (accident) {
    parts.push(pdfSubLabel("Negadījumu pārbaude"));
    parts.push(pdfPlainBlock(accident));
  }

  const stolen = report.stolenCheck.trim();
  if (stolen) {
    parts.push(pdfSubLabel("Zagto transportlīdzekļu datubāze"));
    parts.push(pdfPlainBlock(stolen));
  }

  const equip = report.equipment.filter(outvinEquipmentLineHasData);
  if (equip.length > 0) {
    parts.push(pdfSubLabel("Aprīkojums"));
    parts.push(
      `<ul class="pdf-dealer-eq">${equip
        .map((line) => {
          const code = line.code.trim();
          const desc = line.description.trim();
          const label = code ? `<b>${escapeHtml(code)}</b>${escapeHtml(desc)}` : escapeHtml(desc);
          return `<li>${label}</li>`;
        })
        .join("")}</ul>`,
    );
  }

  return parts.join("\n");
}
