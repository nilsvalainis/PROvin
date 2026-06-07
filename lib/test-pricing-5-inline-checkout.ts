import {
  isPlausibleListingUrl,
  isValidVin,
  normalizeVin,
} from "@/lib/order-field-validation";

export const TP5_INLINE_CHECKOUT_SOURCE = "test-pricing-5" as const;

export type Tp5InlineFieldErrors = {
  listingUrl?: string;
  vin?: string;
};

export function validateTp5InlineFields(
  listingUrl: string,
  vin: string,
): { ok: true } | { ok: false; errors: Tp5InlineFieldErrors } {
  const errors: Tp5InlineFieldErrors = {};
  const listing = listingUrl.trim();

  if (!listing) {
    errors.listingUrl = "Ievadi sludinājuma saiti.";
  } else if (!isPlausibleListingUrl(listing)) {
    errors.listingUrl = "Saitei jābūt pilnai adresei uz konkrētu sludinājumu.";
  }

  const normalized = normalizeVin(vin.trim());
  if (!normalized || !isValidVin(normalized)) {
    errors.vin = "Ievadi derīgu 17 zīmju VIN kodu.";
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true };
}
