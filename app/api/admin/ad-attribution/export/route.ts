import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { adsAttributionExportCsv, computeAdsAttributionStats } from "@/lib/admin-ad-attribution-stats";
import { filterAdminOrdersForDashboard } from "@/lib/admin-order-amount-filter";
import { listAdminOrders } from "@/lib/admin-orders";
import { readAdSpendRows } from "@/lib/admin-ad-spend-store";
import { readAdVisitDoc } from "@/lib/admin-ad-visit-store";
import type { HeardAboutPeriod } from "@/lib/admin-heard-about-stats";
import type { AdSpendProduct } from "@/lib/admin-ad-spend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function period(raw: string | null): HeardAboutPeriod {
  if (raw === "7" || raw === "30" || raw === "90" || raw === "all") return raw;
  return "30";
}

export async function GET(req: Request) {
  const ok = await getAdminSession();
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const product = (url.searchParams.get("product") === "iriss" ? "iriss" : "provin") as AdSpendProduct;
  const p = period(url.searchParams.get("period"));
  const [{ rows }, spend, visits] = await Promise.all([listAdminOrders(), readAdSpendRows(), readAdVisitDoc()]);
  const orders = filterAdminOrdersForDashboard(rows, false);
  const stats = computeAdsAttributionStats({
    orders,
    spend,
    visits,
    period: p,
    nowSec: Math.floor(Date.now() / 1000),
    product,
  });
  const csv = adsAttributionExportCsv(stats, spend.filter((s) => s.product === product));
  const filename = `provin-reklamas-${product}-${p}.csv`;
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
