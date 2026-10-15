import { vinScanCatalogItem, type VinScanSourceId } from "@/lib/vin-scan/catalog";
import type { JojCcVinFacts } from "@/lib/vin-scan/joj-labels";
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
  /** Izsoļu JPEG URL (stat.vin / Copart / JoJ), visi lots. */
  photoUrls?: string[];
};

export type VinScanInspection = {
  date: string;
  result?: string;
  odometer?: string;
};

export type VinScanRecall = {
  title: string;
  date?: string;
};

export type VinScanIncident = {
  date?: string;
  summary: string;
};

export type VinScanAuction = {
  title?: string;
  date?: string;
  price?: string;
  venue?: string;
  lot?: string;
  photoUrl?: string;
  photoCount?: number;
  photoUrls?: string[];
};

export type VinScanListing = {
  date: string;
  price?: string;
  odometer?: string;
  photoUrl?: string;
};

export type VinScanFlags = {
  wanted?: boolean;
  stolen?: boolean;
  recallCount?: number;
  photoCount?: number;
  registrationCountry?: string;
  napJudgement?: string;
  finlandLinked?: boolean;
  finlandLinkSource?: string;
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
  inspections?: VinScanInspection[];
  recalls?: VinScanRecall[];
  incidents?: VinScanIncident[];
  auctions?: VinScanAuction[];
  listings?: VinScanListing[];
  jojFacts?: JojCcVinFacts;
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
  inspections?: VinScanInspection[];
  recalls?: VinScanRecall[];
  incidents?: VinScanIncident[];
  auctions?: VinScanAuction[];
  listings?: VinScanListing[];
  jojFacts?: JojCcVinFacts;
};

export type VinScanContext = {
  vin: string;
  plates: VinScanPlates;
  listingUrl: string;
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
    inspections: parsed.inspections,
    recalls: parsed.recalls,
    incidents: parsed.incidents,
    auctions: parsed.auctions,
    listings: parsed.listings,
    jojFacts: parsed.jojFacts,
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

/** Unknown that needs a browser, not a solver/network kļūda. */
export function vinScanNeedsBrowser(status: string, summary = ""): boolean {
  if (status === "found" || status === "none" || status === "skipped" || status === "needs_input" || status === "manual") {
    return false;
  }
  return /atver pārlūkā|atver saiti|prasa pārlūku|prasa pilnvaru|lapa nav atpazīta/i.test(summary);
}

export type VinScanCountBreakdown = {
  total: number;
  ok: number;
  error: number;
  browser: number;
};

export function vinScanCountBreakdown(
  items: readonly { status: string; summary?: string }[],
): VinScanCountBreakdown {
  let ok = 0;
  let error = 0;
  let browser = 0;
  for (const item of items) {
    if (item.status === "found" || item.status === "none") {
      ok += 1;
      continue;
    }
    if (item.status === "skipped" || item.status === "needs_input" || item.status === "manual") {
      continue;
    }
    if (vinScanNeedsBrowser(item.status, item.summary ?? "")) {
      browser += 1;
      continue;
    }
    if (item.status === "unknown" || item.status === "error") error += 1;
  }
  return { total: items.length, ok, error, browser };
}

export function formatVinScanCountLine(counts: VinScanCountBreakdown): string {
  const bits = [`${counts.ok}/${counts.total} OK`];
  if (counts.error) bits.push(`${counts.error} kļūda`);
  if (counts.browser) bits.push(`${counts.browser} pārlūks`);
  return bits.join(" · ");
}
