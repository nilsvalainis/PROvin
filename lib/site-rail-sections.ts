import { ORDER_SECTION_ID } from "@/lib/order-section";
import { isProvinSelectPublic } from "@/lib/provin-select-flags";
import { PROVIN_SELECT_FORM_HASH, PROVIN_SELECT_SECTION_ID } from "@/lib/provin-select-section";

/** Sadaļu DOM `id` secība mājas lapā (scroll / rail — sakrīt ar dokumenta secību). */
export function getSiteRailHomeScrollIds(): readonly string[] {
  if (isProvinSelectPublic()) {
    return ["home-hero", "cena", PROVIN_SELECT_SECTION_ID, "kas-ir-iriss", "biezi-jautajumi", "kontakti"] as const;
  }
  return ["home-hero", "cena", "kas-ir-iriss", "biezi-jautajumi", "kontakti"] as const;
}

export type SiteRailLabelKey =
  | "sakums"
  | "kasIekljauts"
  | "provinSelect"
  | "kasSlapjasAizProvin"
  | "buj"
  | "kontakti";

export type SiteRailSection = {
  href: string;
  labelKey: SiteRailLabelKey;
};

export function normalizeSitePath(pathname: string | null | undefined): string {
  if (pathname == null) return "";
  let p = pathname.endsWith("/") && pathname.length > 1 ? pathname.slice(0, -1) : pathname;
  /* `localePrefix: "always"` — pathname ir `/lv`, `/lv/pasutit`, … → `/`, `/pasutit`, … salīdzināšanai */
  if (p === "/lv") p = "/";
  else if (p.startsWith("/lv/")) p = p.slice(3);
  return p;
}

/**
 * Mobilā / sliežu izvēlne: `href` bez `/lv` — `next-intl` `Link` pats prefiksē (`applyPathnamePrefix`).
 */
export function buildSiteRailSections(normalizedPath: string): readonly SiteRailSection[] {
  const bujHref = normalizedPath === "/biezi-jautajumi" ? "/biezi-jautajumi" : "/#biezi-jautajumi";
  /* Secība: Sākums → Audits → Konsultācija → Par mums → BUJ → Kontakti */
  const out: SiteRailSection[] = [
    { href: "/", labelKey: "sakums" },
    { href: "/#cena", labelKey: "kasIekljauts" },
  ];
  if (isProvinSelectPublic()) out.push({ href: `/#${PROVIN_SELECT_SECTION_ID}`, labelKey: "provinSelect" });
  out.push(
    { href: "/#kas-ir-iriss", labelKey: "kasSlapjasAizProvin" },
    { href: bujHref, labelKey: "buj" },
    { href: "/#kontakti", labelKey: "kontakti" },
  );
  return out;
}

export function siteRailActiveFromHash(raw: string): number | null {
  const h = raw.replace(/^#/, "").toLowerCase();
  if (!h) return null;
  const provin = isProvinSelectPublic();
  const bujIdx = provin ? 4 : 3;
  const kontaktiIdx = provin ? 5 : 4;

  if (h === "home-hero" || h === "home-intro") return 0;
  if (h === ORDER_SECTION_ID || h === "order-form") return 0;
  if (h === "site-content" || h === "cena") return 1;
  if (provin && (h === PROVIN_SELECT_SECTION_ID || h === PROVIN_SELECT_FORM_HASH)) return 2;
  if (h.startsWith("kas-ir-iriss") || h.startsWith("kas-stav")) return provin ? 3 : 2;
  if (h === "biezi-jautajumi") return bujIdx;
  if (h === "kontakti") return kontaktiIdx;
  return null;
}

export function siteRailRouteActiveIndex(pathname: string | null | undefined): number | null {
  if (pathname == null) return null;
  const p = normalizeSitePath(pathname);
  const provin = isProvinSelectPublic();
  if (p === "/pasutit") return 0;
  if (p === "/biezi-jautajumi") return provin ? 4 : 3;
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
