import { ORDER_SECTION_ID } from "@/lib/order-section";

/**
 * Publiskais ceļš ar lokales prefiksu (`localePrefix: "always"` → `/lv`).
 * Lietot Stripe / `window.location` / pilniem URL — **ne** `next-intl` `Link`.
 */
export function homePath(locale: string): string {
  return `/${locale}`;
}

/**
 * Pasūtījuma forma sākumlapā — `Link` no `@/i18n/navigation` (prefiksu pievieno next-intl).
 */
export function orderSectionHref(): string {
  return `/#${ORDER_SECTION_ID}`;
}

/** BUJ sadaļas enkurss mājas lapā — `Link`-drošs ceļš. */
export function faqHashHref(): string {
  return "/#biezi-jautajumi";
}

/** IRISS / „kas slēpjās” sadaļa — `Link`-drošs ceļš. */
export function irissAnchorHref(): string {
  return "/#kas-ir-iriss";
}
