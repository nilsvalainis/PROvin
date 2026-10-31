import { isSafeIrissPasutijumsId, readIrissPasutijums } from "@/lib/iriss-pasutijumi-store";
import { isSafeIrissScanId, readIrissScan } from "@/lib/iriss-scan-store";
import type { IrissScanRecord } from "@/lib/iriss-scan-types";
import type { MarketplaceOrderCriteria } from "@/lib/marketplace/query-from-order";
import {
  irissScanApifyPlatforms,
  irissScanMarketplaceOwnerId,
  marketplaceOrderCriteriaFromScan,
} from "@/lib/marketplace/query-from-scan";
import { isMarketplacePlatform, type MarketplaceOwnerKind, type MarketplacePlatform } from "@/lib/marketplace/types";

export const MARKETPLACE_RADAR_APIFY_DISABLED = "Ieslēdz mobile.de vai AutoScout24 Apify šajā radarā.";
import { MARKETPLACE_RADAR_LOADS_ENABLED, MARKETPLACE_RADAR_PAUSED } from "@/lib/marketplace/radar-pause";
export { MARKETPLACE_RADAR_LOADS_ENABLED, MARKETPLACE_RADAR_PAUSED };

export type MarketplaceAdminTarget =
  | {
      ok: true;
      ownerKind: "order";
      orderId: string;
      order: MarketplaceOrderCriteria;
      platforms?: MarketplacePlatform[];
    }
  | {
      ok: true;
      ownerKind: "radar";
      orderId: string;
      order: MarketplaceOrderCriteria;
      scan: IrissScanRecord;
      platforms?: MarketplacePlatform[];
    }
  | { ok: false; status: number; error: string };

export function parseMarketplacePlatforms(raw: unknown): MarketplacePlatform[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const platforms = raw.filter((p): p is string => typeof p === "string").filter(isMarketplacePlatform);
  return platforms.length ? platforms : undefined;
}

export async function resolveMarketplaceAdminTarget(input: {
  orderId?: string;
  scanId?: string;
  platforms?: MarketplacePlatform[];
  requireEnabled?: boolean;
}): Promise<MarketplaceAdminTarget> {
  const scanId = input.scanId?.trim() ?? "";
  const orderId = input.orderId?.trim() ?? "";
  const requireEnabled = input.requireEnabled !== false;
  if (scanId) {
    if (!isSafeIrissScanId(scanId)) return { ok: false, status: 400, error: "invalid_id" };
    const rec = await readIrissScan(scanId);
    if (!rec) return { ok: false, status: 404, error: "not_found" };
    if (requireEnabled && !MARKETPLACE_RADAR_LOADS_ENABLED) return { ok: false, status: 409, error: MARKETPLACE_RADAR_PAUSED };
    const enabled = irissScanApifyPlatforms(rec);
    if (requireEnabled && !enabled.length) return { ok: false, status: 409, error: MARKETPLACE_RADAR_APIFY_DISABLED };
    const wanted = (input.platforms?.length ? input.platforms : enabled.length ? enabled : undefined)?.filter(
      (p) => !enabled.length || enabled.includes(p),
    );
    if (requireEnabled && !wanted?.length) return { ok: false, status: 409, error: MARKETPLACE_RADAR_APIFY_DISABLED };
    return {
      ok: true,
      ownerKind: "radar",
      orderId: irissScanMarketplaceOwnerId(scanId),
      order: marketplaceOrderCriteriaFromScan(rec),
      scan: rec,
      ...(wanted?.length ? { platforms: wanted } : {}),
    };
  }
  if (!isSafeIrissPasutijumsId(orderId)) return { ok: false, status: 400, error: "invalid_id" };
  const rec = await readIrissPasutijums(orderId);
  if (!rec) return { ok: false, status: 404, error: "not_found" };
  return {
    ok: true,
    ownerKind: "order",
    orderId,
    order: rec,
    ...(input.platforms?.length ? { platforms: input.platforms } : {}),
  };
}

export function marketplaceOwnerKindOf(target: Extract<MarketplaceAdminTarget, { ok: true }>): MarketplaceOwnerKind {
  return target.ownerKind;
}
