import type {
  VinScanAuction,
  VinScanInspection,
  VinScanListing,
  VinScanMileage,
  VinScanRecall,
  VinScanVehicle,
} from "@/lib/vin-scan/types";

export type VinScanResultRow = {
  id: string;
  label: string;
  status: string;
  summary?: string;
  detail?: string;
  openUrl?: string | null;
  vehicle?: VinScanVehicle;
  mileage?: VinScanMileage[];
  media?: { photoUrl?: string; photoCount?: number };
  flags?: { recallCount?: number; photoCount?: number; wanted?: boolean; stolen?: boolean };
  inspections?: VinScanInspection[];
  recalls?: VinScanRecall[];
  incidents?: { date?: string; summary: string }[];
  auctions?: VinScanAuction[];
  listings?: VinScanListing[];
};

export type VinScanResultCard = {
  id: string;
  label: string;
  href: string;
  vehicle: VinScanVehicle | null;
  mileage: { date: string; odometer: string }[];
  inspections: VinScanInspection[];
  incidents: { date?: string; summary: string }[];
  recalls: VinScanRecall[];
  auctions: VinScanAuction[];
  listings: VinScanListing[];
  photoUrl: string;
  photoCount: number;
};

const DATE_LINE =
  /^(\d{4}-\d{2}-\d{2}|\d{1,2}\.\d{1,2}\.\d{4})(?:[,·]| -)?\s*(.+)$/;

function inspectionsFromDetail(detail: string): VinScanInspection[] {
  const out: VinScanInspection[] = [];
  for (const raw of detail.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const m = DATE_LINE.exec(line);
    if (!m) continue;
    const rest = m[2] ?? "";
    const km = /([\d\s]{2,})\s*km/i.exec(rest);
    const result = rest.replace(/[,·]?\s*[\d\s]{2,}\s*km/i, "").replace(/^[,·]\s*/, "").trim();
    out.push({
      date: m[1] ?? "",
      result,
      odometer: km ? `${km[1]!.replace(/\s+/g, " ").trim()} km` : "",
    });
  }
  return out;
}

function recallsFromDetail(detail: string): VinScanRecall[] {
  const out: VinScanRecall[] = [];
  for (const raw of detail.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const parts = line.split(/\s·\s/).map((p) => p.trim()).filter(Boolean);
    if (parts.length === 0) continue;
    const date = parts.find((p) => /^\d{4}-\d{2}-\d{2}/.test(p) || /^\d{1,2}\.\d{1,2}\.\d{4}/.test(p)) ?? "";
    const title = parts.find((p) => p !== date) ?? line;
    if (title) out.push({ title, date });
  }
  return out;
}

export function buildVinScanResultCard(row: VinScanResultRow): VinScanResultCard | null {
  const inspections =
    (row.inspections ?? []).filter((item) => item.date || item.result || item.odometer).length > 0
      ? (row.inspections ?? []).filter((item) => item.date || item.result || item.odometer)
      : inspectionsFromDetail(row.detail ?? "");
  const fromParse = (row.recalls ?? []).filter((item) => item.title);
  const fromDetail = fromParse.length > 0 ? [] : recallsFromDetail(row.detail ?? "");
  const recalls =
    fromParse.length > 0
      ? fromParse
      : fromDetail.length > 0
        ? fromDetail
        : row.flags?.recallCount
          ? [{ title: String(row.flags.recallCount) }]
          : [];
  const incidents = (row.incidents ?? []).filter((item) => item.summary);
  const auctions = (row.auctions ?? []).filter(
    (item) => item.title || item.date || item.price || item.venue || item.photoUrl || item.photoCount,
  );
  const listings = (row.listings ?? []).filter((item) => item.date || item.price || item.odometer || item.photoUrl);
  const mileage = (row.mileage ?? []).filter((item) => item.date || item.odometer);
  const vehicle =
    row.vehicle && (row.vehicle.make || row.vehicle.model || row.vehicle.year) ? row.vehicle : null;
  const photoUrl = row.media?.photoUrl || auctions.find((item) => item.photoUrl)?.photoUrl || "";
  const photoCount = row.media?.photoCount || row.flags?.photoCount || 0;
  if (
    !vehicle &&
    mileage.length === 0 &&
    inspections.length === 0 &&
    incidents.length === 0 &&
    recalls.length === 0 &&
    auctions.length === 0 &&
    listings.length === 0 &&
    !photoUrl &&
    photoCount <= 0
  ) {
    return null;
  }
  return {
    id: row.id,
    label: row.label,
    href: String(row.openUrl || "").trim(),
    vehicle,
    mileage: mileage.map((item) => ({ date: item.date, odometer: item.odometer })),
    inspections,
    incidents,
    recalls,
    auctions,
    listings,
    photoUrl,
    photoCount,
  };
}

export function vinScanResultCards(rows: readonly VinScanResultRow[]): VinScanResultCard[] {
  return rows.map(buildVinScanResultCard).filter((card): card is VinScanResultCard => Boolean(card));
}
