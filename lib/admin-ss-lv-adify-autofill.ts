/**
 * SS.LV / m.ss.lv — Adify vēsture + sludinājuma odometrs sludinājumu sadaļā.
 */
import {
  applyAdifyHistoryToTirgus,
  type AdifyListingHistorySnapshot,
} from "@/lib/adify-listing-history";
import { tirgusPriceHistoryHasRows, type TirgusFormFields } from "@/lib/admin-source-blocks";
import { applyListingOdometerToTirgus, isSsLvListingUrl } from "@/lib/listing-odometer";

export type SsLvListingScrapeBits = {
  ok?: boolean;
  currentKm?: string | null;
  postedDateRaw?: string | null;
};

export function shouldAutofillSsLvListing(
  listingUrl: string | null | undefined,
  tirgus: TirgusFormFields,
): boolean {
  if (!isSsLvListingUrl(listingUrl)) return false;
  if (tirgusPriceHistoryHasRows(tirgus.priceHistory)) return false;
  if (tirgus.listingCreated.trim()) return false;
  return true;
}

export function applySsLvAdifyAutofill(
  prev: TirgusFormFields,
  listingUrl: string,
  snapshot: AdifyListingHistorySnapshot | null | undefined,
  scrape: SsLvListingScrapeBits | null | undefined,
): TirgusFormFields | null {
  let next = prev;
  if (snapshot?.found) {
    next = applyAdifyHistoryToTirgus(next, snapshot);
  }
  next = applyListingOdometerToTirgus(next, {
    listingUrl,
    scrapeKm: scrape?.ok ? scrape.currentKm : null,
    scrapePostedDate: scrape?.ok ? scrape.postedDateRaw : null,
  });
  const meaningful =
    tirgusPriceHistoryHasRows(next.priceHistory) ||
    Boolean(next.listingCreated.trim()) ||
    Boolean(next.listingMileageOdometer.trim()) ||
    Boolean(next.listedForSale.trim());
  if (!meaningful) return null;
  return next;
}
