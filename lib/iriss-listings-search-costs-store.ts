/**
 * LIST izmaksu iestatījumu servera kopija meklēšanas robežām (cron, API maršruti), jo
 * pārlūka localStorage serverim nav pieejams. Loģistikas krātuvē, viens mazs JSON fails.
 * Raksta tikai LIST lapa, kad operators maina "Izmaksu pieņēmumi"; pasūtījumus neaiztiek.
 */
import "server-only";

import type { ListingCostParts } from "@/lib/iriss-listings-cost";
import { isIrissLogisticsStoreEnabled, readLogisticsJsonFile, writeLogisticsJsonFile } from "@/lib/iriss-logistics-store";
import { parseListingSearchCosts, setListingSearchCosts } from "@/lib/iriss-listings-search-costs";

export const IRISS_LIST_SEARCH_COSTS_FILE = "iriss-list-search-costs.json";

export async function readListingSearchCostsSetting(): Promise<Partial<ListingCostParts> | null> {
  if (!isIrissLogisticsStoreEnabled()) return null;
  const raw = await readLogisticsJsonFile(IRISS_LIST_SEARCH_COSTS_FILE).catch(() => null);
  return parseListingSearchCosts(raw);
}

export async function writeListingSearchCostsSetting(costs: unknown): Promise<Partial<ListingCostParts> | null> {
  const parsed = parseListingSearchCosts(costs);
  if (isIrissLogisticsStoreEnabled()) await writeLogisticsJsonFile(IRISS_LIST_SEARCH_COSTS_FILE, parsed ?? {});
  setListingSearchCosts(parsed);
  return parsed;
}

/** Pirms meklēšanas robežu rēķināšanas serverī: ielādē iestatījumus (vai noklusējumus). Nekad nemet. */
export async function primeListingSearchCostsFromStore(): Promise<void> {
  try {
    setListingSearchCosts(await readListingSearchCostsSetting());
  } catch {
    setListingSearchCosts(null);
  }
}
