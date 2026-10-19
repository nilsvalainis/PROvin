/**
 * LIST kartītes spec → meklēšanas lauki (pasūtījums un Radars).
 */

import type { OrderSearchFields } from "@/lib/iriss-listings-ecarstrade-search";

export function listingBrandModelLabel(v: { manufacturer?: string; title?: string }): string {
  const manufacturer = (v.manufacturer ?? "").trim();
  const title = (v.title ?? "").trim();
  if (manufacturer && title && title.toLowerCase().includes(manufacturer.toLowerCase())) return title;
  return [manufacturer, title].filter(Boolean).join(" ").trim() || title;
}

export function listingProductionYears(v: { year?: string; firstRegistration?: string }): string {
  const year = (v.year ?? "").trim();
  if (year) return year;
  const m = (v.firstRegistration ?? "").match(/(?:19|20)\d{2}/);
  return m?.[0] ?? "";
}

export function listingOrderSearchFields(v: {
  manufacturer?: string;
  title?: string;
  year?: string;
  firstRegistration?: string;
  fuel?: string;
  powerKw?: string;
  transmission?: string;
  bodyType?: string;
}): OrderSearchFields {
  return {
    brandModel: listingBrandModelLabel(v),
    productionYears: listingProductionYears(v),
    engineType: [v.fuel, v.powerKw].map((s) => (s ?? "").trim()).filter(Boolean).join(" "),
    transmission: (v.transmission ?? "").trim(),
    bodyType: (v.bodyType ?? "").trim(),
  };
}
