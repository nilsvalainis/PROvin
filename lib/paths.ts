/**
 * Publiskais ceļš uz sākumu ar lokalizācijas prefiksu (`localePrefix: "always"` → `/lv`).
 * (Projektā tikai `lv`.)
 */
export function homePath(locale: string): string {
  return `/${locale}`;
}

/** Link to order section on the home page, e.g. `/lv#pasutit`. */
export function orderSectionHref(locale: string): string {
  return `${homePath(locale)}#pasutit`;
}

/** Home page with FAQ section hash. */
export function faqHashHref(locale: string): string {
  return `${homePath(locale)}#biezi-jautajumi`;
}

export function irissAnchorHref(locale: string): string {
  return `${homePath(locale)}#kas-ir-iriss`;
}
