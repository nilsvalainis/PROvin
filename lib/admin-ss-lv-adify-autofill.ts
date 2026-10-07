/**
 * Sludinājuma vēsture + odometrs tirgus blokā (ss.lv un citi portāli).
 */
import {
  applyAdifyHistoryToTirgus,
  type AdifyListingHistorySnapshot,
} from "@/lib/adify-listing-history";
import { tirgusPriceHistoryHasRows, type TirgusFormFields } from "@/lib/admin-source-blocks";
import { isListingAutofillUrl } from "@/lib/listing-host";
import { applyListingOdometerToTirgus } from "@/lib/listing-odometer";

export type SsLvListingScrapeBits = {
  ok?: boolean;
  currentKm?: string | null;
  postedDateRaw?: string | null;
};

export function shouldAutofillListing(
  listingUrl: string | null | undefined,
  tirgus: TirgusFormFields,
): boolean {
  if (!isListingAutofillUrl(listingUrl)) return false;
  if (tirgusPriceHistoryHasRows(tirgus.priceHistory)) return false;
  if (tirgus.listingCreated.trim()) return false;
  return true;
}

/** @deprecated izmanto shouldAutofillListing */
export function shouldAutofillSsLvListing(
  listingUrl: string | null | undefined,
  tirgus: TirgusFormFields,
): boolean {
  return shouldAutofillListing(listingUrl, tirgus);
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
