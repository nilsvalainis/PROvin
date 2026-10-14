/**
 * Auction VIN providers behind the Copart/IAAI (JoJ API) tile.
 * JoJ = US/CA. Add a Copart FI client to EXTRA_AUCTION_VIN_PROVIDERS when available.
 */
import "server-only";

import { mergeAuctionVinParses } from "@/lib/vin-scan/auction-vin-coverage";
import { fetchJojSearchVin, type FetchJojSearchVinDeps } from "@/lib/vin-scan/joj-api";
import type { VinScanParse } from "@/lib/vin-scan/types";

export type ExtraAuctionVinProvider = {
  id: "copart_fi";
  configured: (env?: Record<string, string | undefined>) => boolean;
  searchVin: (vin: string, deps?: FetchJojSearchVinDeps) => Promise<VinScanParse>;
};

/**
 * Later Copart Finland / EU VIN lookup. Keep empty until a real client exists.
 * Do not call JoJ for copart.fi: /search-vin is USA and Canada only.
 */
export const EXTRA_AUCTION_VIN_PROVIDERS: ExtraAuctionVinProvider[] = [];

export function configuredExtraAuctionVinProviders(
  env: Record<string, string | undefined> = process.env,
): ExtraAuctionVinProvider[] {
  return EXTRA_AUCTION_VIN_PROVIDERS.filter((p) => p.configured(env));
}

export async function fetchAuctionVinLots(vin: string, deps: FetchJojSearchVinDeps = {}): Promise<VinScanParse> {
  const env = deps.env ?? process.env;
  const parts: VinScanParse[] = [await fetchJojSearchVin(vin, { ...deps, env })];
  for (const extra of configuredExtraAuctionVinProviders(env)) {
    parts.push(await extra.searchVin(vin, deps));
  }
  return mergeAuctionVinParses(parts);
}
