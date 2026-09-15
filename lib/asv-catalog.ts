/**
 * ASV vēsture (VIN Audit caur One Auto API) — produktu katalogs admin ielādei.
 * Cenas ir operatora plāna USD (mazāks apjoms = dārgāk nekā e-pasta piedāvājumā).
 */

export const ASV_SOURCE_TAG = "vinaudit" as const;

export const ASV_PRODUCT_IDS = ["vhr_lite", "vhr_full"] as const;

export type AsvProductId = (typeof ASV_PRODUCT_IDS)[number];

/** Jauns pasūtījums: ieķeksēts Lite — lētais skrīnings. */
export const ASV_DEFAULT_PRODUCT_IDS: readonly AsvProductId[] = ["vhr_lite"];

export type AsvProduct = {
  id: AsvProductId;
  label: string;
  hint: string;
  /** Cena USD centos ($0.55 = 55). */
  priceUsdCents: number;
  /** Primārais ceļš pret One Auto bāzi. */
  path: string;
  /** Ja primārais atbild „API is not available”, mēģina nākamos (parasti bez maksas). */
  pathFallbacks: readonly string[];
};

/**
 * One Auto dashboard nosaukumi: Vehicle History Report Lite (US) / Vehicle History Report (US).
 * Ceļi var atšķirties pēc konta; fallback ķēde paliek serverī.
 */
export const ASV_PRODUCTS: readonly AsvProduct[] = [
  {
    id: "vhr_lite",
    label: "VHR Lite (US)",
    hint: "Skrīnings: karogi, salvage, negadījumu esamība. Bieži pietiek, lai saprastu, kas vispār ir.",
    priceUsdCents: 55,
    path: "/vinaudit/vehiclehistoryreportlitefromvin/",
    pathFallbacks: [
      "/vinaudit/vehiclehistoryreportlitefromvin/v2",
      "/oneauto/vehiclehistoryreportliteusfromvin/",
      "/vinaudit/pullreport/",
    ],
  },
  {
    id: "vhr_full",
    label: "VHR Full (US)",
    hint: "NMVTIS title vēsture ar odometru, izsoles, ķīlas, zādzības. Forenzikai. Ietver Lite saturu.",
    priceUsdCents: 450,
    path: "/vinaudit/vehiclehistoryreportfromvin/",
    pathFallbacks: [
      "/vinaudit/vehiclehistoryreportfromvin/v2",
      "/oneauto/vehiclehistoryreportusfromvin/",
      "/vinaudit/pullreport/",
    ],
  },
] as const;

export function isAsvProductId(v: string): v is AsvProductId {
  return (ASV_PRODUCT_IDS as readonly string[]).includes(v);
}

export function parseAsvProductIds(raw: unknown): AsvProductId[] {
  if (!Array.isArray(raw)) return [];
  const out: AsvProductId[] = [];
  const seen = new Set<AsvProductId>();
  for (const item of raw) {
    if (typeof item !== "string" || !isAsvProductId(item) || seen.has(item)) continue;
    seen.add(item);
    out.push(item);
  }
  return out;
}

export function asvProductsCostUsdCents(ids: readonly AsvProductId[]): number {
  let sum = 0;
  for (const id of ids) {
    const p = ASV_PRODUCTS.find((x) => x.id === id);
    if (p) sum += p.priceUsdCents;
  }
  return sum;
}

export function formatAsvCostUsd(cents: number): string {
  const n = Math.max(0, cents) / 100;
  return `$${n.toFixed(2)}`;
}

export function asvProductPaths(product: AsvProduct, envPath?: string): string[] {
  const extra = envPath?.trim();
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (p: string) => {
    const t = p.trim();
    if (!t || seen.has(t)) return;
    seen.add(t);
    out.push(t);
  };
  if (extra) push(extra);
  push(product.path);
  for (const p of product.pathFallbacks) push(p);
  return out;
}
