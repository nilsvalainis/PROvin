import { NextResponse } from "next/server";
import { requireIrissLogisticsApi, irissLogisticsScopeHeader } from "@/lib/iriss-logistics-access";
import { isLogisticsAuction } from "@/lib/iriss-logistics-types";
import { listLogisticsOrders, listLogisticsPoints, upsertLogisticsPoint } from "@/lib/iriss-logistics-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireIrissLogisticsApi();
  if (!gate.ok) return gate.response;
  const [points, orders] = await Promise.all([listLogisticsPoints(), listLogisticsOrders()]);
  const used: Record<string, number> = {};
  for (const o of orders) {
    if (o.pickupPointId) used[o.pickupPointId] = (used[o.pickupPointId] ?? 0) + 1;
  }
  return NextResponse.json(
    { ok: true, points, used },
    { headers: irissLogisticsScopeHeader() },
  );
}

export async function POST(req: Request) {
  const gate = await requireIrissLogisticsApi();
  if (!gate.ok) return gate.response;
  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400, headers: irissLogisticsScopeHeader() });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid_json" }, { status: 400, headers: irissLogisticsScopeHeader() });
  }
  const row = body as Record<string, unknown>;
  const name = typeof row.name === "string" ? row.name.trim() : "";
  const auction = isLogisticsAuction(row.auction) ? row.auction : "cits";
  if (!name) {
    return NextResponse.json({ error: "name_required" }, { status: 400, headers: irissLogisticsScopeHeader() });
  }
  const point = await upsertLogisticsPoint({ ...(row as object), name, auction });
  return NextResponse.json({ ok: true, point }, { headers: irissLogisticsScopeHeader() });
}
