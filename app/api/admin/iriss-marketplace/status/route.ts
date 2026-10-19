import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { lastMarketplaceAutoLoadAt, lastMarketplaceLoadAt, nextMarketplaceAutoAt } from "@/lib/marketplace/auto-load";
import { marketplaceAutoIntervalDays } from "@/lib/marketplace/cost-caps";
import { marketplaceItemsForOrder, readMarketplaceListingsState } from "@/lib/marketplace/store";
import { isSafeIrissPasutijumsId } from "@/lib/iriss-pasutijumi-store";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const orderId = new URL(req.url).searchParams.get("orderId")?.trim() ?? "";
  if (!isSafeIrissPasutijumsId(orderId)) return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  const state = await readMarketplaceListingsState();
  const items = marketplaceItemsForOrder(state, orderId);
  const lastRun = [...state.runs].reverse().find((r) => r.orderId === orderId) ?? null;
  const now = new Date();
  const lastLoadAt = lastMarketplaceLoadAt(state.runs, orderId);
  const lastAutoAt = lastMarketplaceAutoLoadAt(state.runs, orderId);
  const intervalDays = marketplaceAutoIntervalDays();
  return NextResponse.json({
    ok: true,
    count: items.length,
    lastRun,
    fetchedAt: items[0]?.fetchedAt ?? lastRun?.finishedAt ?? "",
    lastAutoAt: lastAutoAt ?? "",
    nextAutoAt: nextMarketplaceAutoAt(lastLoadAt, now, intervalDays),
    intervalDays,
  });
}
