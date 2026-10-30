import { NextResponse } from "next/server";
import { requireIrissSectionApi } from "@/lib/staff-auth";
import { lastMarketplaceAutoLoadAt, lastMarketplaceLoadAt, nextMarketplaceAutoAt } from "@/lib/marketplace/auto-load";
import { marketplaceAutoIntervalDays } from "@/lib/marketplace/cost-caps";
import { resolveMarketplaceAdminTarget } from "@/lib/marketplace/admin-target";
import { marketplaceItemsForOrder, readMarketplaceListingsState } from "@/lib/marketplace/store";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const gate = await requireIrissSectionApi("radars");
  if (!gate.ok) return gate.response;
  const url = new URL(req.url);
  const target = await resolveMarketplaceAdminTarget({
    orderId: url.searchParams.get("orderId") ?? "",
    scanId: url.searchParams.get("scanId") ?? "",
    requireEnabled: false,
  });
  if (!target.ok) return NextResponse.json({ error: target.error }, { status: target.status });
  const orderId = target.orderId;
  const state = await readMarketplaceListingsState();
  const items = marketplaceItemsForOrder(state, orderId);
  const lastRun = [...state.runs].reverse().find((r) => r.orderId === orderId) ?? null;
  const now = new Date();
  const lastLoadAt = lastMarketplaceLoadAt(state.runs, orderId);
  const lastAutoAt = target.ownerKind === "radar" ? null : lastMarketplaceAutoLoadAt(state.runs, orderId);
  const intervalDays = marketplaceAutoIntervalDays();
  return NextResponse.json({
    ok: true,
    ownerKind: target.ownerKind,
    count: items.length,
    lastRun,
    fetchedAt: items[0]?.fetchedAt ?? lastRun?.finishedAt ?? "",
    lastAutoAt: lastAutoAt ?? "",
    lastLoadAt: lastLoadAt ?? "",
    nextAutoAt: target.ownerKind === "radar" ? "" : nextMarketplaceAutoAt(lastLoadAt, now, intervalDays),
    intervalDays,
  });
}
