import { vinScanCatalogItem, type VinScanSourceId } from "@/lib/vin-scan/catalog";

/** found: avots apstiprina ierakstu. none: avots atbildēja, ieraksta nav. unknown: tīkls, captcha, limits. manual: maksas avots līdz pirkuma pogai. skipped: nav atslēgas. */
export const VIN_SCAN_STATUSES = ["found", "none", "unknown", "manual", "skipped"] as const;
export type VinScanStatus = (typeof VIN_SCAN_STATUSES)[number];

export type VinScanVehicle = {
  make: string;
  model: string;
  year: string;
};

export type VinScanMileage = {
  date: string;
  odometer: string;
  source: string;
};

export type VinScanMedia = {
  photoUrl?: string;
  photoCount?: number;
};

export type VinScanPaidKeys = {
  oneauto: boolean;
  outvin: boolean;
};

export type VinScanIndicator = {
  id: VinScanSourceId;
  label: string;
  country: string;
  status: VinScanStatus;
  summary: string;
  detail: string;
  openUrl: string | null;
  vehicle?: VinScanVehicle;
  mileage?: VinScanMileage[];
  media?: VinScanMedia;
};

export type VinScanParse = {
  status: VinScanStatus;
  summary: string;
  detail?: string;
  vehicle?: VinScanVehicle;
  mileage?: Omit<VinScanMileage, "source">[];
  media?: VinScanMedia;
};

export function buildVinScanIndicator(
  id: VinScanSourceId,
  vin: string,
  parsed: VinScanParse,
): VinScanIndicator {
  const meta = vinScanCatalogItem(id);
  return {
    id,
    label: meta.label,
    country: meta.country,
    status: parsed.status,
    summary: parsed.summary,
    detail: parsed.detail?.trim() ?? "",
    openUrl: meta.openUrl(vin),
    vehicle: parsed.vehicle,
    mileage: (parsed.mileage ?? []).map((row) => ({ ...row, source: meta.label })),
    media: parsed.media,
  };
}

export function countVinScanStatuses(items: readonly { status: VinScanStatus }[]): Record<VinScanStatus, number> {
  const counts: Record<VinScanStatus, number> = { found: 0, none: 0, unknown: 0, manual: 0, skipped: 0 };
  for (const item of items) counts[item.status] += 1;
  return counts;
}
