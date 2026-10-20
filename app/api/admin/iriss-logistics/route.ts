import { NextResponse } from "next/server";
import { requireIrissLogisticsApi, irissLogisticsScopeHeader } from "@/lib/iriss-logistics-access";
import { filterLogisticsOrdersByView, isLogisticsOrderActive } from "@/lib/iriss-logistics-archive";
import { isLogisticsListView, LOGISTICS_DEFAULT_LIST_VIEW } from "@/lib/iriss-logistics-types";
import {
  getIrissLogisticsStorageState,
  listLogisticsOrders,
  listLogisticsPoints,
  listPreviousLogisticsPoints,
} from "@/lib/iriss-logistics-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const gate = await requireIrissLogisticsApi();
  if (!gate.ok) return gate.response;
  const storage = getIrissLogisticsStorageState();
  if (!storage.enabled) {
    return NextResponse.json(
      { error: "store_disabled", reason: storage.reason, points: [], orders: [] },
      { status: 503, headers: irissLogisticsScopeHeader() },
    );
  }
  const url = new URL(req.url);
  const viewRaw = url.searchParams.get("view") ?? LOGISTICS_DEFAULT_LIST_VIEW;
  const view = isLogisticsListView(viewRaw) ? viewRaw : LOGISTICS_DEFAULT_LIST_VIEW;
  const includePrevious = url.searchParams.get("previous") === "1";
  try {
    const [points, orders] = await Promise.all([listLogisticsPoints(), listLogisticsOrders()]);
    const filtered = filterLogisticsOrdersByView(orders, view);
    const previous = includePrevious ? await listPreviousLogisticsPoints() : [];
    return NextResponse.json(
      {
        ok: true,
        view,
        points,
        orders: filtered,
        allOrderCount: orders.length,
        activeCount: orders.filter(isLogisticsOrderActive).length,
        archivedCount: orders.length - orders.filter(isLogisticsOrderActive).length,
        previous,
      },
      { headers: irissLogisticsScopeHeader() },
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "load_failed" },
      { status: 500, headers: irissLogisticsScopeHeader() },
    );
  }
}
