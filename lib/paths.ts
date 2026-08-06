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
  return "/#home-hero";
}

/** BUJ sadaļas enkurss mājas lapā — `Link`-drošs ceļš. */
export function faqHashHref(): string {
  return "/#biezi-jautajumi";
}

/** Pakalpojumu katalogs — `Link`-drošs ceļš. */
export function pakalpojumiHref(): string {
  return "/pakalpojumi";
}

/** Blogs — `Link`-drošs ceļš. */
export function blogsHref(): string {
  return "/blogs";
}

/** Par mums — `Link`-drošs ceļš. */
export function parMumsHref(): string {
  return "/par-mums";
}

/** @deprecated Prefer `parMumsHref()` — sadaļa tagad ir atsevišķa lapa. */
export function irissAnchorHref(): string {
  return "/par-mums";
}

/** PROVIN SELECT konsultācijas pieteikums — atsevišķa lapa (bez formas sākumlapā). */
export function provinSelectConsultationHref(): string {
  return "/provin-select-pieteikums";
}
