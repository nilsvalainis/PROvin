import { NextResponse } from "next/server";
import { requireIrissSectionApi } from "@/lib/staff-auth";
import {
  MARKETPLACE_LOADS_DISABLED_REASON,
  marketplaceAutoEnabled,
  marketplaceLoadsEnabled,
  marketplaceWarningAt80,
} from "@/lib/marketplace/cost-caps";
import { parseMarketplacePlatforms, resolveMarketplaceAdminTarget } from "@/lib/marketplace/admin-target";
import { previewMarketplaceLoad } from "@/lib/marketplace/load";
import { MARKETPLACE_PLATFORM_LABEL } from "@/lib/marketplace/providers";
import { marketplaceTooBroadSkipReason } from "@/lib/marketplace/query-from-order";
import { marketplaceRadarTooBroadSkipReason } from "@/lib/marketplace/query-from-scan";
import { isMarketplacePlatform } from "@/lib/marketplace/types";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const gate = await requireIrissSectionApi("radars");
  if (!gate.ok) return gate.response;
  const url = new URL(req.url);
  const platforms = [
    ...url.searchParams.getAll("platform").map((p) => p.trim()).filter(isMarketplacePlatform),
    ...(parseMarketplacePlatforms(url.searchParams.getAll("platforms")) ?? []),
  ];
  const target = await resolveMarketplaceAdminTarget({
    orderId: url.searchParams.get("orderId") ?? "",
    scanId: url.searchParams.get("scanId") ?? "",
    requireEnabled: false,
    ...(platforms.length ? { platforms } : {}),
  });
  if (!target.ok) return NextResponse.json({ error: target.error }, { status: target.status });
  const preview = await previewMarketplaceLoad({
    order: target.order,
    ownerKind: target.ownerKind,
    ...(target.ownerKind === "radar" ? { scan: target.scan } : {}),
    ...(target.platforms?.length ? { platforms: target.platforms } : {}),
  });
  const tooBroadReason =
    target.ownerKind === "radar"
      ? preview.queryReady
        ? ""
        : marketplaceRadarTooBroadSkipReason(target.scan)
      : preview.queryReady
        ? ""
        : marketplaceTooBroadSkipReason(target.order);
  return NextResponse.json({
    ok: true,
    ownerKind: target.ownerKind,
    queryReady: preview.queryReady,
    missingFields: preview.missingFields,
    needsOneOfExtra: preview.needsOneOfExtra,
    tooBroadReason,
    estimatedUsd: preview.budget.estimatedUsd,
    monthlyUsedUsd: preview.budget.monthlyUsedUsd,
    monthlyCapUsd: preview.budget.monthlyCapUsd,
    perRunCapUsd: preview.budget.perRunCapUsd,
    remainingMonthlyUsd: preview.budget.remainingMonthlyUsd,
    loadsEnabled: marketplaceLoadsEnabled(),
    autoEnabled: target.ownerKind === "radar" ? false : marketplaceAutoEnabled(),
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
