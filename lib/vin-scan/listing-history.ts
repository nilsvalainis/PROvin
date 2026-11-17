import {
  type AdifyListingHistorySnapshot,
  formatAdifyGroupedNumber,
  formatAdifyLvDate,
  formatAdifyPriceLabel,
} from "@/lib/adify-listing-history";
import type { VinScanParse } from "@/lib/vin-scan/types";

/** Adify / Tirgus Dati kļūdas teksti. Tie nav „vēstures nav” un nedrīkst palikt kešā 12 h. */
const LISTING_HISTORY_ERROR_RE =
  /noildz|neizdevās|neatbildēja|ierobežo|bloķēja|formāts mainījies|neatpazina|http \d{3}|relej|cloudflare/i;

export function vinScanParseFromListingHistory(snap: AdifyListingHistorySnapshot): VinScanParse {
  if (!snap.found || snap.rows.length === 0) {
    const msg = (snap.message ?? "").trim();
    if (snap.blocked) return { status: "blocked", summary: msg || "Sludinājuma vēstures avots bloķē serveri" };
    if (LISTING_HISTORY_ERROR_RE.test(msg)) return { status: "unknown", summary: msg.slice(0, 240) };
    return { status: "none", summary: "Nav" };
  }
  const listings = snap.rows.map((row) => ({
    date: formatAdifyLvDate(row.date),
    price: formatAdifyPriceLabel(row.price),
    odometer:
      row.mileage != null && Number.isFinite(row.mileage) && row.mileage > 0
        ? `${formatAdifyGroupedNumber(row.mileage)} km`
        : "",
  }));
  const mileage = snap.rows
    .filter((row) => row.mileage != null && Number.isFinite(row.mileage) && (row.mileage ?? 0) > 0)
    .map((row) => ({
      date: formatAdifyLvDate(row.date),
      odometer: `${formatAdifyGroupedNumber(row.mileage ?? 0)} km`,
    }));
  const year = snap.rows.find((row) => row.year && row.year > 0)?.year;
  const latest = listings[0];
  const openUrl = snap.listingUrl
    ? `https://adify.lv/history?url=${encodeURIComponent(snap.listingUrl)}`
    : undefined;
  return {
    status: "found",
    summary: [latest?.price, latest?.date].filter(Boolean).join(" · "),
    listings,
    mileage,
    vehicle: year ? { make: "", model: "", year: String(year) } : undefined,
    openUrl,
  };
}
