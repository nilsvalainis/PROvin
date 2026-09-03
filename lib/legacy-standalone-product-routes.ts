import { isProvinSelectPublic } from "@/lib/provin-select-flags";

/** Pagaidu slēptās standalone produktu lapas (faili paliek repozitorijā). */
export const PROVIN_AUDITS_STANDALONE_PATH = "/provin-audits" as const;
export const PROVIN_SELECT_STANDALONE_PATH = "/provin-select" as const;
export const PROVIN_SELECT_PIETEIKUMS_PATH = "/provin-select-pieteikums" as const;

const HIDDEN_STANDALONE_PATHS = [
  PROVIN_AUDITS_STANDALONE_PATH,
  PROVIN_SELECT_STANDALONE_PATH,
  PROVIN_SELECT_PIETEIKUMS_PATH,
] as const;

export function normalizePathWithoutLocale(pathname: string): string {
  let p = pathname.endsWith("/") && pathname.length > 1 ? pathname.slice(0, -1) : pathname;
  if (p === "/lv" || p === "/en") return "/";
  if (p.startsWith("/lv/")) p = p.slice(3);
  else if (p.startsWith("/en/")) p = p.slice(3);
  return p || "/";
}

export function isLegacyStandaloneProductPath(pathname: string): boolean {
  const p = normalizePathWithoutLocale(pathname);
  return HIDDEN_STANDALONE_PATHS.some((segment) => p === segment || p.startsWith(`${segment}/`));
}

/**
 * Standalone `/provin-audits` — pēc noklusējuma slēpts (primārais ir sākumlapa).
 * Atkal ieslēgt: `NEXT_PUBLIC_PROVIN_AUDITS_STANDALONE_PUBLIC=1`
 */
export function isProvinAuditsStandalonePublic(): boolean {
  const v = (process.env.NEXT_PUBLIC_PROVIN_AUDITS_STANDALONE_PUBLIC ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

const CLOSED_PREVIEW_PATHS = [
  "/silhouette-preview",
  "/incident-card-preview",
  "/history-hub-preview",
  "/pdf-footer-preview",
] as const;

/**
 * Vecās cenu A/B, demo un iekšējie preview URL — redirect uz sākumu.
 * AZ.VIN kods paliek (`/demo/azvin`); URL slēgts, līdz atkal atveram.
 */
export function shouldBlockClosedExperimentPath(pathname: string): boolean {
  const p = normalizePathWithoutLocale(pathname);
  if (p === "/test-pricing" || p.startsWith("/test-pricing-") || p === "/test-checkout") return true;
  if (p === "/demo" || p.startsWith("/demo/")) return true;
  return CLOSED_PREVIEW_PATHS.some((segment) => p === segment || p.startsWith(`${segment}/`));
}

export function shouldBlockLegacyStandaloneProductPath(pathname: string): boolean {
  const p = normalizePathWithoutLocale(pathname);
  if (p === PROVIN_AUDITS_STANDALONE_PATH || p.startsWith(`${PROVIN_AUDITS_STANDALONE_PATH}/`)) {
    return !isProvinAuditsStandalonePublic();
  }
  if (
    p === PROVIN_SELECT_STANDALONE_PATH ||
    p.startsWith(`${PROVIN_SELECT_STANDALONE_PATH}/`) ||
    p === PROVIN_SELECT_PIETEIKUMS_PATH ||
    p.startsWith(`${PROVIN_SELECT_PIETEIKUMS_PATH}/`)
  ) {
    return !isProvinSelectPublic();
  }
  return false;
}
