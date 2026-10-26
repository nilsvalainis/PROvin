import { NextResponse } from "next/server";
import { loadIrissSaitesView, sendIrissSaitesWhatsApp } from "@/lib/iriss-car-share-resolve";
import { irissLogisticsScopeHeader, requireIrissLogisticsApi } from "@/lib/iriss-logistics-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

function actorName(actor: { kind: string; name?: string; user?: { name?: string; email?: string } }): string {
  if (actor.kind === "admin") return actor.name?.trim() || "admin";
  return actor.user?.name?.trim() || actor.user?.email?.trim() || "";
}

export async function GET(_req: Request, ctx: Ctx) {
  const gate = await requireIrissLogisticsApi();
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;
  const loaded = await loadIrissSaitesView("logistics", id).catch(() => null);
  if (!loaded) return NextResponse.json({ error: "not_found" }, { status: 404, headers: irissLogisticsScopeHeader() });
  return NextResponse.json({ ok: true, ...loaded }, { headers: irissLogisticsScopeHeader() });
}

export async function POST(req: Request, ctx: Ctx) {
  const gate = await requireIrissLogisticsApi();
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;
  let action = "";
  try {
    const body = (await req.json()) as { action?: string };
    action = typeof body.action === "string" ? body.action : "";
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400, headers: irissLogisticsScopeHeader() });
  }
  if (action !== "sent") return NextResponse.json({ error: "invalid_action" }, { status: 400, headers: irissLogisticsScopeHeader() });
  const loaded = await sendIrissSaitesWhatsApp("logistics", id, actorName(gate.actor)).catch(() => null);
  if (!loaded) return NextResponse.json({ error: "not_found" }, { status: 404, headers: irissLogisticsScopeHeader() });
  return NextResponse.json({ ok: true, ...loaded }, { headers: irissLogisticsScopeHeader() });
}
