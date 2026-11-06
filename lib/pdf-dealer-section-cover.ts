/**
 * OFICIĀLĀ DĪLERA DATI PDF: vāka bloks + nobraukuma līkne / gadu stabiņi
 * (Dizaineris kanons 06.11.2026).
 */
import type { AutoRecordsServiceRow } from "@/lib/auto-records-paste-parse";
import type { AutoRecordsServiceWorkRow } from "@/lib/auto-records-service-works";
import type { ClientReportLang } from "@/lib/client-report-i18n";
import { translateDealerVehicleValue } from "@/lib/dealer-vehicle-value-i18n";
import {
  buildDealerCoverMileageChartHtml,
  collectDealerCoverMileagePoints,
  filterDealerCoverPrecisePoints,
} from "@/lib/pdf-dealer-cover-mileage";
import { outvinVehicleInfoHasData, type OutvinVehicleInfo } from "@/lib/outvin-dealer-types";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function resolveDealerCoverVehicle(
  vehicle: OutvinVehicleInfo | null | undefined,
  fallback: OutvinVehicleInfo | null | undefined,
): OutvinVehicleInfo | null {
  if (vehicle && outvinVehicleInfoHasData(vehicle)) return vehicle;
  if (fallback && outvinVehicleInfoHasData(fallback)) return fallback;
  return null;
}

/** Tikai 17 zīmju VIN kods, bez vārda „VIN”. */
export function formatDealerCoverVin(raw: string, opts?: { maskDemo?: boolean }): string {
  const compact = raw.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  if (compact.length !== 17) return "";
  if (opts?.maskDemo) return `${compact.slice(0, 11)}XXXXXX`;
  return compact;
}

export function buildDealerSectionCoverHtml(args: {
  vehicle?: OutvinVehicleInfo | null;
  makeModel?: string;
  serviceWorks: AutoRecordsServiceWorkRow[];
  mileageRows?: AutoRecordsServiceRow[] | null;
  maskDemoVin?: boolean;
  lang?: ClientReportLang;
}): string {
  const lang = args.lang ?? "lv";
  const vi = args.vehicle;
  const model = (vi?.model.trim() || args.makeModel?.trim() || "").trim();
  const vin = formatDealerCoverVin(vi?.vinCode ?? "", { maskDemo: args.maskDemoVin === true });
  const powerRaw = vi?.power.trim() ?? "";
  const power = powerRaw ? translateDealerVehicleValue("power", powerRaw, lang) : "";
  const points = collectDealerCoverMileagePoints(args.serviceWorks, args.mileageRows);
  const series = filterDealerCoverPrecisePoints(points);
  const chart = buildDealerCoverMileageChartHtml(series, lang);
  if (!model && !vin && !power && !chart) return "";

  const metaParts = [vin, power].filter(Boolean);
  const title = model
    ? `<h3 class="pdf-dealer-cover__model">${escapeHtml(model)}</h3>`
    : "";
  const metaHtml = metaParts.length
    ? `<p class="pdf-dealer-cover__meta">${metaParts
        .map((part) =>
          part === vin
            ? `<span class="pdf-vin">${escapeHtml(part)}</span>`
            : escapeHtml(part),
        )
        .join(" · ")}</p>`
    : "";
  return `<div class="pdf-dealer-cover">
    ${title}
    ${metaHtml}
    ${chart}
  </div>`;
}
