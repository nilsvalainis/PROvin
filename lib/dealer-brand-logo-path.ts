/**
 * Public paths for OEM dealer brand marks (white-background primary set).
 * Light-on-dark legacy SVGs live under /brand-logos/on-dark/.
 */

/** Slugs with a 512×128 -wide.svg companion (see public/brand-logos/manifest.json). */
export const DEALER_BRAND_WIDE_SLUGS = new Set([
  "aston-martin",
  "audi",
  "bentley",
  "dacia",
  "ford",
  "genesis",
  "infiniti",
  "jaguar",
  "jeep",
  "kia",
  "lancia",
  "mini",
  "skoda",
  "subaru",
]);

export type DealerBrandLogoVariant = "primary" | "wide";
export type DealerBrandLogoSurface = "light" | "dark";

const LOGO_CACHE_BUST = "13";

function logoFilename(slug: string, variant: DealerBrandLogoVariant): string {
  if (variant === "wide" && DEALER_BRAND_WIDE_SLUGS.has(slug)) return `${slug}-wide.svg`;
  return `${slug}.svg`;
}

/** Path under /public for a dealer brand mark. */
export function dealerBrandLogoPublicPath(
  slug: string,
  opts?: {
    variant?: DealerBrandLogoVariant;
    surface?: DealerBrandLogoSurface;
    cacheBust?: boolean;
  },
): string {
  const variant = opts?.variant ?? "primary";
  const surface = opts?.surface ?? "light";
  const base = surface === "dark" ? "/brand-logos/on-dark" : "/brand-logos";
  const file = logoFilename(slug, variant);
  const v = opts?.cacheBust === false ? "" : `?v=${LOGO_CACHE_BUST}`;
  return `${base}/${file}${v}`;
}

export function dealerBrandHasWideMark(slug: string): boolean {
  return DEALER_BRAND_WIDE_SLUGS.has(slug);
}
