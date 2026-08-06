import { ORDER_SECTION_ID } from "@/lib/order-section";
import { isProvinSelectPublic } from "@/lib/provin-select-flags";
import { PROVIN_SELECT_FORM_HASH, PROVIN_SELECT_SECTION_ID } from "@/lib/provin-select-section";

/** Sadaļu DOM `id` secība mājas lapā (scroll / rail — sakrīt ar dokumenta secību un izvēlnes rindām). */
export function getSiteRailHomeScrollIds(): readonly string[] {
  if (isProvinSelectPublic()) {
    return ["home-hero", PROVIN_SELECT_SECTION_ID] as const;
  }
  return ["home-hero"] as const;
}

export type SiteRailLabelKey =
  | "sakums"
  | "pakalpojumi"
  | "blogs"
  | "provinSelect"
  | "kasSlapjasAizProvin";

export type SiteRailSection = {
  href: string;
  labelKey: SiteRailLabelKey;
};

export function normalizeSitePath(pathname: string | null | undefined): string {
  if (pathname == null) return "";
  let p = pathname.endsWith("/") && pathname.length > 1 ? pathname.slice(0, -1) : pathname;
  /* `localePrefix: "always"` — pathname ir `/lv/…`, `/en/…` → salīdzināšanai bez prefiksa */
  if (p === "/lv" || p === "/en") p = "/";
  else if (p.startsWith("/lv/")) p = p.slice(3);
  else if (p.startsWith("/en/")) p = p.slice(3);
  return p;
}

function railIndex(labelKey: SiteRailLabelKey, sections: readonly SiteRailSection[]): number {
  return sections.findIndex((s) => s.labelKey === labelKey);
}

/**
 * Mobilā / sliežu izvēlne: `href` bez `/lv` — `next-intl` `Link` pats prefiksē (`applyPathnamePrefix`).
 */
export function buildSiteRailSections(_normalizedPath: string): readonly SiteRailSection[] {
  /* Secība: Sākums → Pakalpojumi → Par mums → Blogs → Konsultācija (ja publiska) */
  const out: SiteRailSection[] = [
    { href: "/", labelKey: "sakums" },
    { href: "/pakalpojumi", labelKey: "pakalpojumi" },
    { href: "/par-mums", labelKey: "kasSlapjasAizProvin" },
    { href: "/blogs", labelKey: "blogs" },
  ];
  if (isProvinSelectPublic()) out.push({ href: `/#${PROVIN_SELECT_SECTION_ID}`, labelKey: "provinSelect" });
  return out;
}

export function siteRailActiveFromHash(raw: string): number | null {
  const h = raw.replace(/^#/, "").toLowerCase();
  if (!h) return null;
  const sections = buildSiteRailSections("/");
  if (h === "home-hero" || h === "home-intro" || h === ORDER_SECTION_ID || h === "order-form") {
    return railIndex("sakums", sections);
  }
  /* Cena / vecais Audits / FAQ / kontakti enkuri — nav atsevišķas izvēlnes rindas. */
  if (h === "site-content" || h === "cena" || h === "paketes" || h === "biezi-jautajumi" || h === "kontakti") {
    return railIndex("sakums", sections);
  }
  if (h === PROVIN_SELECT_SECTION_ID || h === PROVIN_SELECT_FORM_HASH) {
    const idx = railIndex("provinSelect", sections);
    return idx >= 0 ? idx : null;
  }
  if (h.startsWith("kas-ir-iriss") || h.startsWith("kas-stav") || h === "par-mums") {
    return railIndex("kasSlapjasAizProvin", sections);
  }
  if (h === "pakalpojumi" || h.startsWith("pakalpojums-")) {
    return railIndex("pakalpojumi", sections);
  }
  if (h === "blogs") {
    return railIndex("blogs", sections);
  }
  return null;
}

export function siteRailRouteActiveIndex(pathname: string | null | undefined): number | null {
  if (pathname == null) return null;
  const p = normalizeSitePath(pathname);
  const sections = buildSiteRailSections(p);
  if (p === "/pasutit") return railIndex("sakums", sections);
  if (p === "/pakalpojumi") return railIndex("pakalpojumi", sections);
  if (p === "/par-mums") return railIndex("kasSlapjasAizProvin", sections);
  if (p === "/blogs") return railIndex("blogs", sections);
  /* FAQ page remains reachable but is no longer a menu item. */
  if (p === "/biezi-jautajumi") return railIndex("sakums", sections);
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
