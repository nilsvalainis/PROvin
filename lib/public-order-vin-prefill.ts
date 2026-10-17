import { normalizeVin } from "@/lib/order-field-validation";

/** VIN prefills pasūtījuma formu, ja atver caur `/lv/pasutit?vin=…` vai mājaslapu ar to pašu parametru. */
export const PUBLIC_ORDER_VIN_QUERY = "vin";

const DEFAULT_PUBLIC_ORIGIN = "https://www.provin.lv";

export function publicOrderVinFromQuery(raw: string | null | undefined): string {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return "";
  const normalized = normalizeVin(trimmed);
  return normalized || trimmed.toUpperCase();
}

/** Absolūta saite uz pasūtījuma plūsmu ar VIN (novirza uz sākumlapas hero ar prefilla parametru). */
export function buildPublicOrderPasutitUrl(
  vin: string,
  locale = "lv",
  origin = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || DEFAULT_PUBLIC_ORIGIN,
): string {
  const clean = publicOrderVinFromQuery(vin);
  const base = `${origin.replace(/\/$/, "")}/${locale}/pasutit`;
  if (!clean) return base;
  return `${base}?${PUBLIC_ORDER_VIN_QUERY}=${encodeURIComponent(clean)}`;
}
