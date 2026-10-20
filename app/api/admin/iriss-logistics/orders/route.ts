import { NextResponse } from "next/server";
import { logisticsCabinetWriteForbidden, requireIrissLogisticsApi, irissLogisticsScopeHeader } from "@/lib/iriss-logistics-access";
import { upsertLogisticsOrder } from "@/lib/iriss-logistics-store";
import type { LogisticsOrder } from "@/lib/iriss-logistics-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const gate = await requireIrissLogisticsApi();
  if (!gate.ok) return gate.response;
  const denied = logisticsCabinetWriteForbidden(gate.actor);
  if (denied) return denied;
  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400, headers: irissLogisticsScopeHeader() });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid_json" }, { status: 400, headers: irissLogisticsScopeHeader() });
  }
  const order = await upsertLogisticsOrder(body as Partial<LogisticsOrder>);
  return NextResponse.json({ ok: true, order }, { headers: irissLogisticsScopeHeader() });
}
