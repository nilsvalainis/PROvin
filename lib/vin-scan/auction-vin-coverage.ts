/**
 * Copart/IAAI VIN lookup coverage and merge.
 * JoJ /search-vin is USA + Canada only. Copart FI (copart.fi) is a later provider slot.
 */

import { AUCTION_LOT_MAX, AUCTION_PHOTO_BLOCK_MAX } from "@/lib/vin-scan/auction-photo-urls";
import type { VinScanAuction, VinScanMileage, VinScanParse } from "@/lib/vin-scan/types";

export type AuctionVinRegion = "us_ca" | "fi_eu";

export type AuctionVinProviderMeta = {
  id: string;
  region: AuctionVinRegion;
  sites: readonly string[];
  lotDomains: readonly string[];
  implemented: boolean;
  notes: string;
};

/** Live JoJ Copart and IAAI API: US/CA. Docs: USA and Canada; domains copart_com / iaai_com. */
export const JOJ_COPART_IAAI_COVERAGE: AuctionVinProviderMeta = {
  id: "joj_copart_iaai",
  region: "us_ca",
  sites: ["copart.com", "iaai.com"],
  lotDomains: ["copart_com", "iaai_com"],
  implemented: true,
  notes:
    "JoJ GET /search-vin/{vin} covers Copart and IAAI in the USA and Canada. Lot lookup domains are copart_com and iaai_com. Location dictionaries are /usa/states (us|ca). Copart FI/EU is not listed.",
};

/** Slot for a later Copart Finland / EU VIN API. Not JoJ. */
export const COPART_FI_PROVIDER_COVERAGE: AuctionVinProviderMeta = {
  id: "copart_fi",
  region: "fi_eu",
  sites: ["copart.fi"],
  lotDomains: ["copart_fi"],
  implemented: false,
  notes:
    "copart.fi is Copart Finland (EU). JoJ Copart/IAAI does not document this site or a copart_fi domain. Wire a dedicated client in EXTRA_AUCTION_VIN_PROVIDERS when a provider exists.",
};

export const AUCTION_VIN_PROVIDER_COVERAGE = [JOJ_COPART_IAAI_COVERAGE, COPART_FI_PROVIDER_COVERAGE] as const;

export function jojSearchVinCoversCopartFi(): boolean {
  return false;
}

export function jojSearchVinCoversCopartEu(): boolean {
  return false;
}

function photoUrlsOf(parse: VinScanParse): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (url?: string) => {
    const u = String(url || "").trim();
    if (!u.startsWith("https://") || seen.has(u) || out.length >= AUCTION_PHOTO_BLOCK_MAX) return;
    seen.add(u);
    out.push(u);
  };
  push(parse.media?.photoUrl);
  for (const url of parse.media?.photoUrls ?? []) push(url);
  for (const row of parse.auctions ?? []) {
    push(row.photoUrl);
    for (const extra of row.photoUrls ?? []) push(extra);
  }
  return out;
}

/** Combine US JoJ lots with a later Copart FI provider. Found wins; skipped extras do not hide none. */
export function mergeAuctionVinParses(parts: readonly VinScanParse[]): VinScanParse {
  if (parts.length === 0) return { status: "none", summary: "Nav izsoles ieraksta" };
  if (parts.length === 1) return parts[0]!;
  const found = parts.filter((p) => p.status === "found");
  if (!found.length) {
    const none = parts.find((p) => p.status === "none");
    if (none) return none;
    const unknown = parts.find((p) => p.status === "unknown");
    if (unknown) return unknown;
    return parts[0]!;
  }
  if (found.length === 1) return found[0]!;

  const auctions: VinScanAuction[] = [];
  const mileage: Omit<VinScanMileage, "source">[] = [];
  const photos: string[] = [];
  const seenPhoto = new Set<string>();
  const seenLot = new Set<string>();
  let vehicle = found[0]?.vehicle;
  let openUrl = found[0]?.openUrl;

  for (const part of found) {
    if (!vehicle && part.vehicle) vehicle = part.vehicle;
    if (!openUrl && part.openUrl) openUrl = part.openUrl;
    for (const row of part.auctions ?? []) {
      const key = `${row.venue || ""}|${row.title || ""}|${row.date || ""}`;
      if (seenLot.has(key)) continue;
      seenLot.add(key);
      auctions.push(row);
      if (auctions.length >= AUCTION_LOT_MAX) break;
    }
    for (const row of part.mileage ?? []) {
      mileage.push(row);
    }
    for (const url of photoUrlsOf(part)) {
      if (seenPhoto.has(url) || photos.length >= AUCTION_PHOTO_BLOCK_MAX) continue;
      seenPhoto.add(url);
      photos.push(url);
    }
  }

  const venues = [...new Set(auctions.map((a) => a.venue).filter(Boolean))];
  const year = auctions[0]?.date?.slice(0, 4) || vehicle?.year || "";
  const bits = [
    venues.join("/") || "Izsole",
    year,
    photos.length ? `${photos.length} foto` : auctions.length > 1 ? `${auctions.length} lots` : "",
  ].filter(Boolean);
  const jojFacts = found.find((p) => p.jojFacts)?.jojFacts;
  const detail = found
    .map((p) => p.detail?.trim())
    .filter(Boolean)
    .join("\n\n");

  return {
    status: "found",
    summary: bits.join(", ") || "Ir izsoles ieraksts",
    ...(detail ? { detail } : {}),
    vehicle,
    auctions: auctions.slice(0, AUCTION_LOT_MAX),
    mileage: mileage.slice(0, AUCTION_LOT_MAX),
    media: {
      photoUrl: photos[0],
      photoCount: photos.length,
      photoUrls: photos,
    },
    flags: { photoCount: photos.length },
    openUrl: openUrl || undefined,
    ...(jojFacts ? { jojFacts } : {}),
  };
}
