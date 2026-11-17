/**
 * Meklēšanas cenas robežu izmaksas = LIST paneļa "Izmaksu pieņēmumi" (`IrissListPrefs.costs`),
 * tas pats avots, ko LIST maks. solījums (`listingMaxBid`) lieto kartītēs.
 *
 * Avots pēc prioritātes:
 * 1. `setListingSearchCosts` (LIST lapa pēc paneļa izmaiņām; serverī no krātuves, sk.
 *    `primeListingSearchCostsFromStore`).
 * 2. Pārlūkā: localStorage `provin-iriss-list-v4` -> `costs` (kešots, tīrās `storage` notikumā).
 * 3. `DEFAULT_LISTING_COSTS` (katram neiestatītam laukam atsevišķi).
 */

import { resolveListingCosts, type ListingCostParts } from "@/lib/iriss-listings-cost";
import { IRISS_LIST_PREFS_KEY } from "@/lib/iriss-listings-operator-prefs";

const FIELDS = ["fee", "transport", "commission", "unplanned"] as const;

let active: Partial<ListingCostParts> | null = null;
let browserCache: Partial<ListingCostParts> | null | undefined;
let storageListener = false;

/** Tikai derīgi skaitļi ≥ 0; pārējais = neiestatīts. */
export function parseListingSearchCosts(raw: unknown): Partial<ListingCostParts> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const out: Partial<ListingCostParts> = {};
  for (const f of FIELDS) {
    const n = o[f];
    if (typeof n === "number" && Number.isFinite(n) && n >= 0) out[f] = n;
  }
  return Object.keys(out).length > 0 ? out : null;
}

function readBrowserCosts(): Partial<ListingCostParts> | null {
  if (typeof window === "undefined") return null;
  if (browserCache !== undefined) return browserCache;
  if (!storageListener) {
    storageListener = true;
    try {
      window.addEventListener("storage", (e) => {
        if (e.key === null || e.key === IRISS_LIST_PREFS_KEY) browserCache = undefined;
      });
    } catch {
      /* nav window notikumu */
    }
  }
  try {
    const raw = window.localStorage.getItem(IRISS_LIST_PREFS_KEY);
    browserCache = raw ? parseListingSearchCosts((JSON.parse(raw) as { costs?: unknown })?.costs) : null;
  } catch {
    browserCache = null;
  }
  return browserCache;
}

export function setListingSearchCosts(costs: Partial<ListingCostParts> | null | undefined): void {
  active = parseListingSearchCosts(costs);
  browserCache = undefined;
}

/** Pilnas izmaksas meklēšanas robežām (iestatījumi, citādi noklusējumi). */
export function currentListingSearchCosts(): ListingCostParts {
  return resolveListingCosts(active ?? readBrowserCosts());
}
