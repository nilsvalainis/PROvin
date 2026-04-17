import { faqHashHref, homePath, irissAnchorHref } from "@/lib/paths";
import { ORDER_SECTION_ID } from "@/lib/order-section";

/** Viens enkurs uz lapu — bez atsevišķa „pasūtīt”; forma ir hero plūsmā (`#pasutit` joprojām ritina uz formu). */
export const SITE_RAIL_HOME_SCROLL_IDS = [
  "home-hero",
  "cena",
  "kas-ir-iriss",
  "biezi-jautajumi",
  "kontakti",
] as const;

export type SiteRailLabelKey =
  | "sakums"
  | "kasIekljauts"
  | "approvedIriss"
  | "buj"
  | "kontakti";

export type SiteRailSection = {
  href: string;
  labelKey: SiteRailLabelKey;
};

export function normalizeSitePath(pathname: string | null | undefined): string {
  if (pathname == null) return "";
  let p = pathname.endsWith("/") && pathname.length > 1 ? pathname.slice(0, -1) : pathname;
  /* next-intl `localePrefix: as-needed` — dažkārt `/lv` vietā `/` */
  if (p === "/lv") p = "/";
  return p;
}

export function buildSiteRailSections(
  locale: string,
  normalizedPath: string,
): readonly SiteRailSection[] {
  const base = homePath(locale);
  const cenaHref = base === "/" ? "/#cena" : `${base}#cena`;
  const bujHref = normalizedPath === "/biezi-jautajumi" ? "/biezi-jautajumi" : faqHashHref(locale);
  const kontaktiHref = base === "/" ? "/#kontakti" : `${base}#kontakti`;
  return [
    { href: base === "/" ? "/" : base, labelKey: "sakums" },
    { href: cenaHref, labelKey: "kasIekljauts" },
    { href: irissAnchorHref(locale), labelKey: "approvedIriss" },
    { href: bujHref, labelKey: "buj" },
    { href: kontaktiHref, labelKey: "kontakti" },
  ] as const;
}

export function siteRailActiveFromHash(raw: string): number | null {
  const h = raw.replace(/^#/, "").toLowerCase();
  if (!h) return null;
  if (h === "home-hero") return 0;
  if (h === "home-intro") return 0;
  if (h === ORDER_SECTION_ID || h === "order-form") return 0;
  if (h === "site-content") return 1;
  if (h === "cena") return 1;
  if (h.startsWith("kas-ir-iriss") || h.startsWith("kas-stav")) return 2;
  if (h === "biezi-jautajumi") return 3;
  if (h === "kontakti") return 4;
  return null;
}

export function siteRailRouteActiveIndex(pathname: string | null | undefined): number | null {
  if (pathname == null) return null;
  const p = normalizeSitePath(pathname);
  if (p === "/pasutit") return 0;
  if (p === "/biezi-jautajumi") return 3;
  return null;
}

/**
 * Vienkāršota „aktīvā” sadaļa izvēlnei (ceļš + hash; bez scroll pozīcijas).
 */
export function siteRailMenuActiveIndex(pathname: string | undefined, hash: string): number {
  const p = normalizeSitePath(pathname);
  const fromRoute = siteRailRouteActiveIndex(pathname);
  if (fromRoute !== null) return fromRoute;
  const fromHash = siteRailActiveFromHash(hash);
  if (fromHash !== null) return fromHash;
  if (p === "/" || p === "") return 0;
  return 0;
}
