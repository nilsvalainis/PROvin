import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import {
  MARKETPLACE_LOADS_DISABLED_REASON,
  marketplaceAutoEnabled,
  marketplaceLoadsEnabled,
  marketplaceWarningAt80,
} from "@/lib/marketplace/cost-caps";
import { previewMarketplaceLoad } from "@/lib/marketplace/load";
import { MARKETPLACE_PLATFORM_LABEL } from "@/lib/marketplace/providers";
import { marketplaceTooBroadSkipReason } from "@/lib/marketplace/query-from-order";
import { isMarketplacePlatform } from "@/lib/marketplace/types";
import { isSafeIrissPasutijumsId, readIrissPasutijums } from "@/lib/iriss-pasutijumi-store";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const orderId = url.searchParams.get("orderId")?.trim() ?? "";
  if (!isSafeIrissPasutijumsId(orderId)) return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  const rec = await readIrissPasutijums(orderId);
  if (!rec) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const platforms = url.searchParams
    .getAll("platform")
    .map((p) => p.trim())
    .filter(isMarketplacePlatform);
  const preview = await previewMarketplaceLoad({
    order: rec,
    ...(platforms.length ? { platforms } : {}),
  });
  return NextResponse.json({
    ok: true,
    queryReady: preview.queryReady,
    missingFields: preview.missingFields,
    needsOneOfExtra: preview.needsOneOfExtra,
    tooBroadReason: preview.queryReady ? "" : marketplaceTooBroadSkipReason(rec),
    estimatedUsd: preview.budget.estimatedUsd,
    monthlyUsedUsd: preview.budget.monthlyUsedUsd,
    monthlyCapUsd: preview.budget.monthlyCapUsd,
    perRunCapUsd: preview.budget.perRunCapUsd,
    remainingMonthlyUsd: preview.budget.remainingMonthlyUsd,
    loadsEnabled: marketplaceLoadsEnabled(),
    autoEnabled: marketplaceAutoEnabled(),
    allowed: preview.budget.allowed && preview.queryReady && marketplaceLoadsEnabled(),
    reason: marketplaceLoadsEnabled() ? preview.budget.reason : MARKETPLACE_LOADS_DISABLED_REASON,
    warning80: marketplaceWarningAt80(preview.budget.monthlyUsedUsd, preview.budget.monthlyCapUsd),
    tokenReady: preview.estimates.some((e) => e.configured),
    providers: preview.estimates.map((e) => ({
      id: e.providerId,
      platform: e.platform,
      label: MARKETPLACE_PLATFORM_LABEL[e.platform],
      maxItems: e.maxItems,
      maxUsd: e.maxUsd,
      configured: e.configured,
      reason: e.reason,
    })),
  });
}
