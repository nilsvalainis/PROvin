/**
 * Sludinājuma cenu vēstures ielase ar bezmaksas fallback.
 * Adify un tirgusdati.lv tiek vaicāti paralēli; pietiek ar pirmo, kas atrod datus.
 */

import {
  type AdifyListingHistorySnapshot,
  extractAdifyHistorySsrPayload,
  fetchAdifyListingHistory,
  normalizeAdifyHistoryItems,
} from "@/lib/adify-listing-history";
import {
  extractTirgusDatiHistoryFromHtml,
  fetchTirgusDatiListingHistory,
  looksLikeTirgusDatiCloudflareChallenge,
  tirgusDatiSupportsListingUrl,
} from "@/lib/tirgusdati-listing-history";

export const LISTING_HISTORY_HTML_MAX_CHARS = 500_000;

function emptySnapshot(message: string): AdifyListingHistorySnapshot {
  return {
    found: false,
    message,
    rows: [],
    durationDays: 0,
    oldestDate: "",
    newestDate: "",
    priceChangeEur: 0,
    listingUrl: null,
  };
}

/** Parsē operatora pārlūkā ielasīto Adify / Tirgus Dati HTML (Vercel IP ir bloķēts). */
export function snapshotFromVendorHistoryHtml(
  html: string,
  now: Date = new Date(),
): AdifyListingHistorySnapshot {
  const raw = html.trim();
  if (!raw) return emptySnapshot("Tukša vēstures lapa");
  if (looksLikeTirgusDatiCloudflareChallenge(raw)) {
    return emptySnapshot("Tirgus Dati / Adify bloķēja pieprasījumu (Cloudflare)");
  }

  const td = extractTirgusDatiHistoryFromHtml(raw);
  if (td.items.length > 0) {
    const snap = normalizeAdifyHistoryItems(td.items, now);
    if (!snap.found) return snap;
    return {
      ...snap,
      listingUrl: snap.listingUrl ?? td.listingUrl,
      source: "tirgusdati",
      message: `Atrasta sludinājuma vēsture (Tirgus Dati, ${snap.rows.length} ieraksti)`,
    };
  }

  const adify = extractAdifyHistorySsrPayload(raw);
  if (adify.retryAfter != null) {
    return emptySnapshot(`Adify ierobežo pieprasījumus (mēģini pēc ${adify.retryAfter} s)`);
  }
  if (adify.items != null) {
    const snap = normalizeAdifyHistoryItems(adify.items, now);
    return snap.found ? { ...snap, source: "adify" } : snap;
  }

  return emptySnapshot("Pārlūka ielase neatpazina vēstures tabulu");
}

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
