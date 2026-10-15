/**
 * Klienta drošie statusa tipi un atslēga.
 * Neimportē meklēšanas avotus (node:crypto) un neko neielādē.
 */

export const IRISS_LISTING_HIT_STATUSES = ["jauns", "skatits", "interesants", "piedavats", "noraidits"] as const;
export type IrissListingHitStatus = (typeof IRISS_LISTING_HIT_STATUSES)[number];

export const IRISS_LISTING_HIT_STATUS_LV: Record<IrissListingHitStatus, string> = {
  jauns: "Jauns",
  skatits: "Skatīts",
  interesants: "Interesants",
  piedavats: "Piedāvāts",
  noraidits: "Noraidīts",
};

export type IrissListingMatchNotice = {
  orderId: string;
  listingId: string;
  title: string;
  clientName: string;
  platform: string;
  href: string;
  matchedAt: string;
};

export function isIrissListingHitStatus(v: string): v is IrissListingHitStatus {
  return (IRISS_LISTING_HIT_STATUSES as readonly string[]).includes(v);
}

export function irissListingMatchKey(orderId: string, listingId: string): string {
  return `${orderId}|${listingId}`;
}
