/**
 * OFICIĀLĀ DĪLERA DATI PDF: vāka bloks + izplūstoša nobraukuma līkne (koncepts 01).
 */
import type { AutoRecordsServiceWorkRow } from "@/lib/auto-records-service-works";
import { PDF_BRAND_BLUE_HEX } from "@/lib/client-report-pdf-layout-draft";
import { buildDealerServiceSpanHtml, printableDealerServiceWorks } from "@/lib/pdf-dealer-service-visits";
import { outvinVehicleInfoHasData, type OutvinVehicleInfo } from "@/lib/outvin-dealer-types";
import { monotoneCubicSvgPath } from "@/lib/unified-mileage-chart";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function visitTimeMs(date: string): number | null {
  const t = date.trim();
  const dmy = t.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (dmy) return Date.UTC(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
  const y = t.match(/^(\d{4})$/);
  if (y) return Date.UTC(Number(y[1]), 0, 1);
  return null;
}

function visitKm(odometer: string): number | null {
  const digits = odometer.replace(/\D/g, "");
  if (!digits) return null;
  const n = Number(digits);
  return Number.isFinite(n) ? n : null;
}

export function buildDealerCoverBlendCurveHtml(serviceWorks: AutoRecordsServiceWorkRow[]): string {
  const pts = printableDealerServiceWorks(serviceWorks)
    .map((row) => ({ t: visitTimeMs(row.date), km: visitKm(row.odometer) }))
    .filter((p): p is { t: number; km: number } => p.t != null && p.km != null)
    .sort((a, b) => a.t - b.t);
  if (pts.length < 2) return "";

  const w = 640;
  const h = 120;
  const pad = 18;
  const tMin = pts[0]!.t;
  const tMax = pts[pts.length - 1]!.t;
  const kmMin = Math.min(...pts.map((p) => p.km));
  const kmMax = Math.max(...pts.map((p) => p.km));
  const kmPad = Math.max(800, (kmMax - kmMin) * 0.08);
  const y0 = kmMin - kmPad;
  const y1 = kmMax + kmPad;
  const xy = pts.map((p) => ({
    x: tMax === tMin ? w / 2 : pad + ((p.t - tMin) / (tMax - tMin)) * (w - pad * 2),
    y: pad + (1 - (p.km - y0) / (y1 - y0)) * (h - pad * 2),
  }));
  const d = monotoneCubicSvgPath(xy);
  if (!d) return "";
  const last = xy[xy.length - 1]!;
  const first = xy[0]!;
  const area = `${d} L ${last.x.toFixed(1)} ${h} L ${first.x.toFixed(1)} ${h} Z`;
  return `<svg class="pdf-dealer-cover-curve" viewBox="0 0 ${w} ${h}" role="img" aria-label="Nobraukuma līkne">
    <defs>
      <linearGradient id="pdfDealerCoverFade" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${PDF_BRAND_BLUE_HEX}" stop-opacity="0.22"/>
        <stop offset="1" stop-color="#E8F1FC" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <path d="${area}" fill="url(#pdfDealerCoverFade)"/>
    <path d="${d}" fill="none" stroke="${PDF_BRAND_BLUE_HEX}" stroke-width="2.2" stroke-linecap="round"/>
  </svg>`;
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
  const curve = buildDealerCoverBlendCurveHtml(args.serviceWorks);
  if (!model && !vin && !colorCode && !power && !span) return "";

  const meta = [vin ? `VIN ${vin}` : "", colorCode, power].filter(Boolean).join(" · ");
  const title = model
    ? `<h3 class="pdf-dealer-cover__model">${escapeHtml(model)}</h3>`
    : "";
  const metaHtml = meta ? `<p class="pdf-dealer-cover__meta">${escapeHtml(meta)}</p>` : "";
  return `<div class="pdf-dealer-cover">
    ${title}
    ${metaHtml}
    ${curve}
    ${span}
  </div>`;
}
