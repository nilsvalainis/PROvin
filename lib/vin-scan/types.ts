import { vinScanCatalogItem, type VinScanSourceId } from "@/lib/vin-scan/catalog";
import { emptyVinScanPlates, type VinScanPlates } from "@/lib/vin-scan/plates";

/** found: ir dati. none: atbildēja, ieraksta nav. unknown: tīkls/captcha. manual: maksas solis. skipped: nav atslēgas. needs_input: vajag numuru vai VIN. */
export const VIN_SCAN_STATUSES = ["found", "none", "unknown", "manual", "skipped", "needs_input"] as const;
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

export type VinScanFlags = {
  wanted?: boolean;
  stolen?: boolean;
  recallCount?: number;
  photoCount?: number;
  registrationCountry?: string;
  napJudgement?: string;
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
  flags?: VinScanFlags;
};

export type VinScanParse = {
  status: VinScanStatus;
  summary: string;
  detail?: string;
  vehicle?: VinScanVehicle;
  mileage?: Omit<VinScanMileage, "source">[];
  media?: VinScanMedia;
  flags?: VinScanFlags;
  openUrl?: string | null;
};

export type VinScanContext = {
  vin: string;
  plates: VinScanPlates;
};

export function buildVinScanIndicator(
  id: VinScanSourceId,
  vin: string,
  parsed: VinScanParse,
  plates?: VinScanPlates,
): VinScanIndicator {
  const meta = vinScanCatalogItem(id);
  return {
    id,
    label: meta.label,
    country: meta.country,
    status: parsed.status,
    summary: parsed.summary,
    detail: parsed.detail?.trim() ?? "",
    openUrl: parsed.openUrl?.trim() || meta.openUrl(vin, plates ?? emptyVinScanPlates()),
    vehicle: parsed.vehicle,
    mileage: (parsed.mileage ?? []).map((row) => ({ ...row, source: meta.label })),
    media: parsed.media,
    flags: parsed.flags,
  };
}

export function countVinScanStatuses(items: readonly { status: VinScanStatus }[]): Record<VinScanStatus, number> {
  const counts: Record<VinScanStatus, number> = {
    found: 0,
    none: 0,
    unknown: 0,
    manual: 0,
    skipped: 0,
    needs_input: 0,
  };
  for (const item of items) counts[item.status] += 1;
  return counts;
}
