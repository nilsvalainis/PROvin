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

/** VIN koda pārbaudes skaidrojums — `Link`-drošs ceļš. */
export function vinCheckHref(): string {
  return "/vin-koda-parbaude";
}

/** Bezmaksas VIN / sludinājuma novērtējuma sadaļa sākumlapā. */
export const FREE_EVAL_SECTION_ID = "bezmaksas-novertejums" as const;

/** Iepriekšējais `#riska-celvedis` enkurs - paliek kā dublikāts. */
export const FREE_EVAL_SECTION_ID_LEGACY = "riska-celvedis" as const;

/** Bezmaksas novērtējuma forma sākumlapā — `Link`-drošs ceļš. */
export function freeEvalHref(): string {
  return `/#${FREE_EVAL_SECTION_ID}`;
}

/** BUJ lapa — `Link`-drošs ceļš. */
export function faqPageHref(): string {
  return "/biezi-jautajumi";
}

/** @deprecated Prefer `parMumsHref()` — sadaļa tagad ir atsevišķa lapa. */
export function irissAnchorHref(): string {
  return "/par-mums";
}

/** PROVIN SELECT konsultācijas pieteikums — atsevišķa lapa (bez formas sākumlapā). */
export function provinSelectConsultationHref(): string {
  return "/provin-select-pieteikums";
}
