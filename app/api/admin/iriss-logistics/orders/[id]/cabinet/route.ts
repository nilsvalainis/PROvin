import { NextResponse } from "next/server";
import { irissLogisticsScopeHeader, logisticsCabinetAccessQuery, requireIrissLogisticsApi } from "@/lib/iriss-logistics-access";
import { filterDocumentsByCabinetAccess } from "@/lib/iriss-logistics-cabinet-access";
import { defaultPickupStageFromOrderStatus } from "@/lib/iriss-logistics-cabinet";
import { appendCabinetAudit, getCabinetPickup, listCabinetAccessRules, listLiveCabinetDocuments } from "@/lib/iriss-logistics-cabinet-store";
import { getLogisticsOrder } from "@/lib/iriss-logistics-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const gate = await requireIrissLogisticsApi();
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;
  const order = await getLogisticsOrder(id);
  if (!order) return NextResponse.json({ error: "not_found" }, { status: 404, headers: irissLogisticsScopeHeader() });
  const [documents, pickup, rules] = await Promise.all([
    listLiveCabinetDocuments(id),
    getCabinetPickup(id),
    listCabinetAccessRules(),
  ]);
  const query = logisticsCabinetAccessQuery(gate.actor, id);
  const visible = filterDocumentsByCabinetAccess(documents, query, rules);
  if (visible.length) {
    await appendCabinetAudit({
      actorId: query.userId,
      action: "view",
      carId: id,
      documentId: "",
      section: "",
      docType: "",
      detail: `${visible.length} docs`,
    });
  }
  return NextResponse.json(
    {
      ok: true,
      documents: visible,
      pickup: pickup ?? {
        carId: id,
        stage: defaultPickupStageFromOrderStatus(order.status),
        pickupCode: order.pickupRef,
        pickupDate: order.pickupDate,
        arrivedAt: "",
        notes: "",
        updatedAt: order.updatedAt,
        updatedBy: "",
      },
    },
    { headers: irissLogisticsScopeHeader() },
  );
}
