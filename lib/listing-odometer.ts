/**
 * Sludinājuma odometra rinda — admin „Sludinājuma vēsture” + kopējais nobraukuma grafiks.
 * SS.LV: valsts vienmēr Latvija, datums vienmēr pirmā publicēšana (Adify oldest / Izveidots).
 */

import type { TirgusPriceHistoryRow } from "@/lib/adify-listing-history";
import type { TirgusFormFields } from "@/lib/admin-source-blocks";
import { canonicalizeListingUrl } from "@/lib/order-field-validation";

export const LISTING_ODOMETER_COUNTRY_LV = "Latvija";
export const LISTING_MILEAGE_SOURCE_SSLV = "ss.lv";
export const LISTING_MILEAGE_SOURCE_GENERIC = "Sludinājums";

export function isSsLvListingUrl(raw: string | null | undefined): boolean {
  const t = (raw ?? "").trim();
  if (!t) return false;
  try {
    const u = new URL(canonicalizeListingUrl(t));
    const host = u.hostname.replace(/^www\./i, "").toLowerCase();
    return host === "ss.lv" || host.endsWith(".ss.lv") || host === "ss.com" || host.endsWith(".ss.com");
  } catch {
    return /(?:^|[/.])ss\.(?:lv|com)(?:[/:?]|$)/i.test(t);
  }
}

function groupKmDigits(n: number): string {
  const rounded = Math.round(n);
  if (!Number.isFinite(rounded) || rounded <= 0) return "";
  return String(Math.abs(rounded)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/** „233 000 km” / „233000” → grupēti cipari bez vienības. */
export function formatListingOdometerKm(raw: string | null | undefined): string {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (!digits) return "";
  const n = Number.parseInt(digits, 10);
  if (!Number.isFinite(n) || n < 100) return "";
  return groupKmDigits(n);
}

export function pickAdifyListingMileageKm(rows: TirgusPriceHistoryRow[] | null | undefined): number | null {
  for (const r of rows ?? []) {
    if (r.mileage != null && Number.isFinite(r.mileage) && r.mileage >= 100) return r.mileage;
  }
  return null;
}

export type ListingOdometerScrapeInput = {
  listingUrl?: string | null;
  scrapeKm?: string | null;
  scrapePostedDate?: string | null;
};

/**
 * Aizpilda odometra rindu pēc Adify vēstures un/vai ss.lv scrape.
 * SS.LV: datums = listingCreated (pirmā publicēšana), valsts = Latvija.
 */
export function applyListingOdometerToTirgus(
  prev: TirgusFormFields,
  input: ListingOdometerScrapeInput = {},
): TirgusFormFields {
  const ss = isSsLvListingUrl(input.listingUrl);
  const fromScrape = formatListingOdometerKm(input.scrapeKm);
  const fromAdify = pickAdifyListingMileageKm(prev.priceHistory);
  const km =
    fromScrape ||
    (fromAdify != null ? groupKmDigits(fromAdify) : "") ||
    prev.listingMileageOdometer.trim();

  const firstPub =
    prev.listingCreated.trim() ||
    String(input.scrapePostedDate ?? "").trim() ||
    prev.listingMileageDate.trim();

  const listingCreated = prev.listingCreated.trim() || (ss ? String(input.scrapePostedDate ?? "").trim() : prev.listingCreated);

  return {
    ...prev,
    listingCreated,
    listingMileageOdometer: km,
    listingMileageDate: ss ? firstPub : prev.listingMileageDate.trim() || firstPub,
    listingMileageCountry: ss ? LISTING_ODOMETER_COUNTRY_LV : prev.listingMileageCountry,
  };
}

export type ListingMileageChartRow = {
  date: string;
  odometer: string;
  country: string;
  sourceLabel: string;
};

/**
 * Viena sludinājuma odometra rinda kopējam grafikam.
 * SS.LV: datums vienmēr listingCreated (pirmā publicēšana), valsts vienmēr Latvija.
 */
export function resolveListingMileageChartRow(
  tirgus: TirgusFormFields | null | undefined,
  listingUrl?: string | null,
): ListingMileageChartRow | null {
  if (!tirgus) return null;
  const odometer = formatListingOdometerKm(tirgus.listingMileageOdometer) || tirgus.listingMileageOdometer.trim();
  if (!odometer) return null;

  const ss = isSsLvListingUrl(listingUrl);
  const date = ss
    ? tirgus.listingCreated.trim() || tirgus.listingMileageDate.trim()
    : tirgus.listingMileageDate.trim() || tirgus.listingCreated.trim();
  if (!date) return null;

  const country = ss ? LISTING_ODOMETER_COUNTRY_LV : tirgus.listingMileageCountry.trim();
  const sourceLabel =
    ss || (!listingUrl?.trim() && country === LISTING_ODOMETER_COUNTRY_LV)
      ? LISTING_MILEAGE_SOURCE_SSLV
      : LISTING_MILEAGE_SOURCE_GENERIC;

  return { date, odometer, country, sourceLabel };
}
