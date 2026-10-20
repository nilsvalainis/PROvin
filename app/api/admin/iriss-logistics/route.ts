import { NextResponse } from "next/server";
import { cabinetActorCanWrite, cabinetActorHidesSums, cabinetCarVisibleToActor } from "@/lib/iriss-logistics-cabinet-access";
import { listCabinetAccessRules } from "@/lib/iriss-logistics-cabinet-store";
import { logisticsCabinetAccessQuery, requireIrissLogisticsApi, irissLogisticsScopeHeader } from "@/lib/iriss-logistics-access";
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
    const [points, orders, rules] = await Promise.all([
      listLogisticsPoints(),
      listLogisticsOrders(),
      listCabinetAccessRules(),
    ]);
    const actorQuery = logisticsCabinetAccessQuery(gate.actor, "");
    const hideSums = cabinetActorHidesSums(actorQuery);
    const scoped = orders.filter((order) =>
      cabinetCarVisibleToActor({ ...actorQuery, carId: order.id }, rules),
    );
    const visible = hideSums ? scoped.map((order) => ({ ...order, priceEur: null })) : scoped;
    const filtered = filterLogisticsOrdersByView(visible, view);
    const previous = includePrevious ? await listPreviousLogisticsPoints() : [];
    return NextResponse.json(
      {
        ok: true,
        view,
        points,
        orders: filtered,
        allOrderCount: scoped.length,
        activeCount: scoped.filter(isLogisticsOrderActive).length,
        archivedCount: scoped.length - scoped.filter(isLogisticsOrderActive).length,
        access: { hideSums, write: cabinetActorCanWrite(actorQuery) },
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
