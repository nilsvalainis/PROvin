import "server-only";

import { readIrissListingsLatestView } from "@/lib/iriss-listings-aggregate-store";
import type { IrissListingsLatestView } from "@/lib/iriss-listings-types";
import { mergeMarketplaceIntoLatestView } from "@/lib/marketplace/merge";
import { readMarketplaceListingsState } from "@/lib/marketplace/store";

/** Izsoļu latest.json + pasūtījumā ielādētie tirgus sludinājumi. Sync šo skatu neieraksta. */
export async function readIrissListingsLatestViewWithMarketplace(): Promise<IrissListingsLatestView | null> {
  const [latest, marketplace] = await Promise.all([
    readIrissListingsLatestView().catch(() => null),
    readMarketplaceListingsState().catch(() => null),
  ]);
  return mergeMarketplaceIntoLatestView(latest, marketplace?.items ?? []);
}
