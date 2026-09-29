/**
 * Sludinājuma cenu vēstures ielase ar bezmaksas fallback.
 * Adify un tirgusdati.lv tiek vaicāti paralēli; pietiek ar pirmo, kas atrod datus.
 */

import { type AdifyListingHistorySnapshot, fetchAdifyListingHistory } from "@/lib/adify-listing-history";
import { fetchTirgusDatiListingHistory, tirgusDatiSupportsListingUrl } from "@/lib/tirgusdati-listing-history";

export function pickListingPriceHistory(
  adify: AdifyListingHistorySnapshot,
  tirgusdati: AdifyListingHistorySnapshot | null,
): AdifyListingHistorySnapshot {
  if (adify.found) return adify;
  if (tirgusdati?.found) return tirgusdati;
  if (!tirgusdati) return adify;
  return { ...adify, message: `${adify.message} · Tirgus Dati: ${tirgusdati.message}` };
}

export async function fetchListingPriceHistory(
  listingUrl: string,
  now: Date = new Date(),
): Promise<AdifyListingHistorySnapshot> {
  const adifyPromise = fetchAdifyListingHistory(listingUrl, now);
  if (!tirgusDatiSupportsListingUrl(listingUrl)) return adifyPromise;

  const tirgusPromise = fetchTirgusDatiListingHistory(listingUrl, now);

  const firstFound = await new Promise<AdifyListingHistorySnapshot | null>((resolve) => {
    let remaining = 2;
    let done = false;
    const consider = (snap: AdifyListingHistorySnapshot | null) => {
      if (done) return;
      if (snap?.found) {
        done = true;
        resolve(snap);
        return;
      }
      remaining -= 1;
      if (remaining <= 0) {
        done = true;
        resolve(null);
      }
    };
    void adifyPromise.then(consider, () => consider(null));
    void tirgusPromise.then(consider, () => consider(null));
  });
  if (firstFound?.found) return firstFound;

  const [adify, tirgusdati] = await Promise.all([adifyPromise, tirgusPromise]);
  return pickListingPriceHistory(adify, tirgusdati);
}
