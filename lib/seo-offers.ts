import { publicPageUrl } from "@/lib/seo-public-metadata";
import { TP5_MINI_PUBLIC } from "@/lib/test-pricing-5-mobile";

export type PublicServiceOffer = {
  id: "mini" | "audits" | "dealer";
  sku: string;
  price: string;
  priceCurrency: "EUR";
  anchor: string;
};

/** Publiskās cenas, kas redzamas sākumlapā / pakalpojumos (Stripe `price_data`). */
const ALL_SERVICE_OFFERS: readonly PublicServiceOffer[] = [
  { id: "mini", sku: "PROVIN MINI", price: "39.99", priceCurrency: "EUR", anchor: "pakalpojums-mini" },
  { id: "audits", sku: "PROVIN AUDITS", price: "99.99", priceCurrency: "EUR", anchor: "pakalpojums-audits" },
  { id: "dealer", sku: "DĪLERA DATI", price: "24.99", priceCurrency: "EUR", anchor: "pakalpojums-dealer" },
];

/** MINI paslēpts, kamēr `TP5_MINI_PUBLIC` ir false. */
export const PUBLIC_SERVICE_OFFERS: readonly PublicServiceOffer[] = ALL_SERVICE_OFFERS.filter(
  (offer) => offer.id !== "mini" || TP5_MINI_PUBLIC,
);

export function serviceOfferUrl(locale: string, offer: PublicServiceOffer): string {
  return `${publicPageUrl(locale, "/pakalpojumi")}#${offer.anchor}`;
}
