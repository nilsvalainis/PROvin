import { routing } from "@/i18n/routing";

/** Home path for locale (`/` for default). */
export function homePath(locale: string): string {
  return locale === routing.defaultLocale ? "/" : `/${locale}`;
}

/** Link to order section on the home page, e.g. `/#pasutit` or `/en#pasutit`. */
export function orderSectionHref(locale: string): string {
  const base = homePath(locale);
  return base === "/" ? "/#pasutit" : `${base}#pasutit`;
}

/** Home page with FAQ section hash. */
export function faqHashHref(locale: string): string {
  const base = homePath(locale);
  return base === "/" ? "/#biezi-jautajumi" : `${base}#biezi-jautajumi`;
}

export function irissAnchorHref(locale: string): string {
  const base = homePath(locale);
  return base === "/" ? "/#kas-ir-iriss" : `${base}#kas-ir-iriss`;
}
