/**
 * OFICIĀLĀ DĪLERA DATI PDF: vāka bloks (koncepts 10) + servisa nobraukuma josla.
 */
import type { AutoRecordsServiceWorkRow } from "@/lib/auto-records-service-works";
import { buildDealerServiceSpanHtml } from "@/lib/pdf-dealer-service-visits";
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

export function buildDealerSectionCoverHtml(args: {
  vehicle?: OutvinVehicleInfo | null;
  makeModel?: string;
  serviceWorks: AutoRecordsServiceWorkRow[];
}): string {
  const vi = args.vehicle;
  const model = (vi?.model.trim() || args.makeModel?.trim() || "").trim();
  const vin = vi?.vinCode.trim() ?? "";
  const colorCode = (vi?.colorCode.trim() || vi?.color.trim() || "").trim();
  const power = vi?.power.trim() ?? "";
  const span = buildDealerServiceSpanHtml(args.serviceWorks, { cover: true });
  if (!model && !vin && !colorCode && !power && !span) return "";

  const meta = [vin ? `VIN ${vin}` : "", colorCode, power].filter(Boolean).join(" · ");
  const title = model
    ? `<h3 class="pdf-dealer-cover__model">${escapeHtml(model)}</h3>`
    : "";
  const metaHtml = meta ? `<p class="pdf-dealer-cover__meta">${escapeHtml(meta)}</p>` : "";
  return `<div class="pdf-dealer-cover">
    <p class="pdf-dealer-cover__kicker">PROVIN DĪLERIS</p>
    ${title}
    ${metaHtml}
    ${span}
  </div>`;
}
