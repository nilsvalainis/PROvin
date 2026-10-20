import type { LogisticsAuctionSource, LogisticsAuctionSourceFilters } from "@/lib/iriss-logistics-types";

function slugAuctionSourceId(name: string): string {
  const body = name
    .normalize("NFKD")
    .replace(/[^\w]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 56);
  return `as-${body || "jauns"}`;
}

export const LOGISTICS_AUCTION_SOURCES_FILE = "auction-sources.json";

/** Sākotnējie avoti no izsoļu sesijām. Copart.de pēc noklusējuma izslēgts. */
export const LOGISTICS_DEFAULT_AUCTION_SOURCE_SEEDS: readonly {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
}[] = [
  { id: "as-auto1", name: "AUTO1", url: "https://www.auto1.com/en/app/inventory/my-orders/all/1", enabled: true },
  { id: "as-autobid", name: "Autobid", url: "https://autobid.de/en/search-results", enabled: true },
  { id: "as-openlane", name: "Openlane", url: "https://www.openlane.eu/en/findcar", enabled: true },
  { id: "as-caronsale", name: "CarOnSale", url: "https://www.caronsale.de/", enabled: true },
  { id: "as-copart-de", name: "Copart.de", url: "https://www.copart.de/", enabled: false },
  { id: "as-ecarstrade", name: "eCarsTrade", url: "https://ecarstrade.com/search", enabled: true },
  { id: "as-troostwijk", name: "Troostwijk", url: "https://www.troostwijkauctions.com/", enabled: true },
  { id: "as-mobile-de", name: "mobile.de", url: "https://suchen.mobile.de/", enabled: true },
] as const;

export const LOGISTICS_COPART_DE_SOURCE_NAME = "Copart.de";

export function emptyLogisticsAuctionSourceFilters(): LogisticsAuctionSourceFilters {
  return { account: "", status: "", keywords: "" };
}

export function sanitizeLogisticsAuctionSourceUrl(raw: string, max = 500): string {
  const v = raw.trim().slice(0, max);
  if (!v) return "";
  if (/^(javascript|data|vbscript|file):/i.test(v)) return "";
  try {
    const u = new URL(v.includes("://") ? v : `https://${v}`);
    if (u.protocol !== "http:" && u.protocol !== "https:") return "";
    if (u.username || u.password) return "";
    if (u.protocol === "http:") u.protocol = "https:";
    return u.toString();
  } catch {
    return "";
  }
}

export function normalizeLogisticsAuctionSourceFilters(raw: unknown): LogisticsAuctionSourceFilters {
  const row = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  return {
    account: text(row.account, 120),
    status: text(row.status, 120),
    keywords: text(row.keywords, 240),
  };
}

export function defaultLogisticsAuctionSources(now = "2026-10-20T11:00:00.000Z"): LogisticsAuctionSource[] {
  return LOGISTICS_DEFAULT_AUCTION_SOURCE_SEEDS.map((row) => ({
    id: row.id,
    name: row.name,
    url: row.url,
    filters: emptyLogisticsAuctionSourceFilters(),
    enabled: row.enabled,
    builtin: true,
    createdAt: now,
    updatedAt: now,
  }));
}

export function normalizeLogisticsAuctionSource(raw: unknown, now = new Date().toISOString()): LogisticsAuctionSource | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  const name = typeof row.name === "string" ? row.name.trim().slice(0, 80) : "";
  if (!name) return null;
  const id =
    typeof row.id === "string" && row.id.trim()
      ? row.id.trim().slice(0, 80)
      : slugAuctionSourceId(name);
  return {
    id,
    name,
    url: sanitizeLogisticsAuctionSourceUrl(typeof row.url === "string" ? row.url : ""),
    filters: normalizeLogisticsAuctionSourceFilters(row.filters),
    enabled: row.enabled !== false,
    builtin: row.builtin === true,
    createdAt: typeof row.createdAt === "string" && row.createdAt.trim() ? row.createdAt.trim().slice(0, 40) : now,
    updatedAt: typeof row.updatedAt === "string" && row.updatedAt.trim() ? row.updatedAt.trim().slice(0, 40) : now,
  };
}

export function isLogisticsCopartDeSource(source: Pick<LogisticsAuctionSource, "name" | "id">): boolean {
  return source.id === "as-copart-de" || source.name.trim().toLowerCase() === LOGISTICS_COPART_DE_SOURCE_NAME.toLowerCase();
}

/** Esošie labojumi paliek. Trūkstošie iebūvētie avoti (t.sk. Copart.de izslēgts) tiek pievienoti. */
export function mergeLogisticsAuctionSources(
  existing: readonly LogisticsAuctionSource[],
  defaults = defaultLogisticsAuctionSources(),
): LogisticsAuctionSource[] {
  const byKey = new Map<string, LogisticsAuctionSource>();
  for (const row of existing) {
    byKey.set(row.id, row);
    byKey.set(row.name.trim().toLowerCase(), row);
  }
  const out = [...existing];
  for (const seed of defaults) {
    if (byKey.has(seed.id) || byKey.has(seed.name.trim().toLowerCase())) continue;
    out.push(seed);
  }
  return out;
}

export function logisticsAuctionSourceEnabledCount(sources: readonly Pick<LogisticsAuctionSource, "enabled">[]): number {
  return sources.filter((s) => s.enabled).length;
}

export function createLogisticsAuctionSource(
  patch: { name: string; url?: string; filters?: Partial<LogisticsAuctionSourceFilters>; enabled?: boolean },
  now = new Date().toISOString(),
): LogisticsAuctionSource {
  const name = patch.name.trim().slice(0, 80);
  return {
    id: slugAuctionSourceId(name || "jauns"),
    name: name || "Jauns avots",
    url: sanitizeLogisticsAuctionSourceUrl(patch.url ?? ""),
    filters: {
      ...emptyLogisticsAuctionSourceFilters(),
      ...normalizeLogisticsAuctionSourceFilters(patch.filters),
    },
    enabled: patch.enabled !== false,
    builtin: false,
    createdAt: now,
    updatedAt: now,
  };
}
