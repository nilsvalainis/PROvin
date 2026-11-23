import { translateClientReportStatic, type ClientReportLang } from "@/lib/client-report-i18n";
import {
  formatDealerEngineCode,
  formatDealerTransmissionCode,
  isBareTrimCode,
  stripPaintWord,
  translateDealerVehicleValue,
} from "@/lib/dealer-vehicle-value-i18n";
import { countryLabelToIso2 } from "@/lib/country-names-lv";
import { decodeVinLocal } from "@/lib/vin-scan/vin-decode";
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

/** „1950 cc” - capitalize padarīja par „1950 Cc” (23.11.2026); tilpuma vienība paliek ar mazo burtu. */
export function keepVolumeUnitLowercase(v: string): string {
  return v.replace(/^(\d[\d\s.,]*)Cc(m)?(?![\p{L}])/u, "$1cc$2");
}
import { translateDealerVehicleCodeLv } from "@/lib/dealer-vehicle-code-lv";
import { maskVinForDemo } from "@/lib/demo-vin-mask";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function collapseSpaces(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function pdfSubLabel(title: string): string {
  return `<p class="pdf-subhead">${escapeHtml(title)}</p>`;
}

function vehicleInfoTable(
  vi: OutvinVehicleInfo,
  opts?: { maskDemoVin?: boolean; lang?: ClientReportLang },
): string {
  const lang = opts?.lang ?? "lv";
  const rows: { k: string; v: string }[] = [];
  const translated = (key: keyof OutvinVehicleInfo): string => {
    const raw = vi[key].trim();
    if (!raw || isPdfEmptyPlaceholder(raw)) return "";
    return translateDealerVehicleValue(key, translateDealerVehicleCodeLv(key, raw), lang);
  };
  const bodyShown = translated("body");
  for (const { key, labelLv, labelEn } of OUTVIN_VEHICLE_INFO_ROWS) {
    let v = vi[key].trim();
    if (!v || isPdfEmptyPlaceholder(v)) continue;
    let labelLvShown = labelLv;
    let keepCase = key === "power";
    if (key === "vinCode" && opts?.maskDemoVin) v = maskVinForDemo(v);
    else if (key === "transmission" && formatDealerTransmissionCode(v, lang)) {
      v = formatDealerTransmissionCode(v, lang)!;
    } else if (key === "engineCode") {
      const formatted = formatDealerEngineCode(v, vi.displacement, lang);
      if (!formatted) continue;
      keepCase = formatted !== collapseSpaces(v);
      v = formatted;
    } else if (key === "interior" && isBareTrimCode(v)) {
      continue;
    } else if (key === "countryRegion") {
      // A9: Outvin „Country/region” ir ražošanas valsts (sakrīt ar VIN WMI: VXE->FR, SJN->GB, WBA->DE).
      // Rāda tikai tad, ja VIN to apstiprina, un ar precīzu etiķeti; citādi nozīme nav droša - nerāda.
      const vinCountry = decodeVinLocal(vi.vinCode.trim()).countryCode;
      if (!vinCountry || countryLabelToIso2(v) !== vinCountry) continue;
      labelLvShown = "Ražošanas valsts";
      v = translateDealerVehicleValue(key, v, lang);
    } else {
      if (key === "color") v = stripPaintWord(v);
      v = translateDealerVehicleCodeLv(key, v);
      v = translateDealerVehicleValue(key, v, lang);
      // B27: „Transportlīdzekļa tips: Furgons” + „Virsbūve: Furgons” - viens lauks.
      if (key === "vehicleType" && bodyShown && v.toLowerCase() === bodyShown.toLowerCase()) continue;
    }
    if (!v) continue;
    const label = translateClientReportStatic(labelLvShown || labelEn, lang);
    // Jaudai vienība „kW” paliek ar mazo burtu (capitalize to padarītu par „KW”).
    rows.push({ k: label, v: keepCase ? v : keepVolumeUnitLowercase(capitalizeFactValue(v)) });
  }
  const table = buildPdfKvPairHtml(rows);
  if (!table) return "";
  return `<div class="pdf-dealer-vehicle-kv">${table}</div>`;
}

/** Aprīkojuma bloks (kods + apraksts) - dīlera PDF liek zem komentāra. */
export function buildOutvinDealerEquipmentPdfHtml(
  report: OutvinDealerReport | undefined | null,
  opts?: { lang?: ClientReportLang },
): string {
  if (!report) return "";
  const equip = report.equipment.filter(outvinEquipmentLineHasData);
  if (equip.length === 0) return "";
  const lang = opts?.lang ?? "lv";
  return [
    pdfSubLabel(translateClientReportStatic("Aprīkojums", lang)),
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
  opts?: { omitEquipment?: boolean; maskDemoVin?: boolean; lang?: ClientReportLang },
): string {
  if (!outvinDealerReportHasContent(report) || !report) return "";

  const parts: string[] = [];
  const vi = report.vehicleInfo;
  const lang = opts?.lang ?? "lv";

  const vehicleTable = vehicleInfoTable(vi, { maskDemoVin: opts?.maskDemoVin, lang });
  if (vehicleTable) {
    parts.push(
      `<div class="pdf-keep-head">${pdfSubLabel(translateClientReportStatic("Transportlīdzekļa informācija", lang))}${vehicleTable}</div>`,
    );
  }

  if (!opts?.omitEquipment) {
    const equipHtml = buildOutvinDealerEquipmentPdfHtml(report, { lang });
    if (equipHtml) parts.push(equipHtml);
  }

  return parts.join("\n");
}
