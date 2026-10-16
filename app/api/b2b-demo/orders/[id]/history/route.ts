import { NextResponse } from "next/server";
import { b2bOrderPatchFromSnapshot, isSafeAdminChangeEntryId } from "@/lib/admin-change-history";
import { listAdminChangeHistory, loadAdminChangeSnapshot } from "@/lib/admin-change-history-store";
import { b2bDemoErrorResponse, requireB2bDemoActor } from "@/lib/b2b-demo-api";
import { isSafeB2bDemoOrderId } from "@/lib/b2b-demo-ids";
import { getB2bDemoTenantOrder, patchB2bDemoTenantOrder } from "@/lib/b2b-demo-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const gate = await requireB2bDemoActor();
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;
  if (!isSafeB2bDemoOrderId(id)) return NextResponse.json({ error: "Nederīgs pasūtījums." }, { status: 400 });
  const tenantId = gate.actor.session.tenantId;
  const order = await getB2bDemoTenantOrder(tenantId, id);
  if (!order) return NextResponse.json({ error: "Pasūtījums nav atrasts." }, { status: 404 });
  const entries = await listAdminChangeHistory("b2b-order", id, { kind: "tenant", tenantId });
  return NextResponse.json({ entries }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(req: Request, ctx: Ctx) {
  const gate = await requireB2bDemoActor();
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;
  if (!isSafeB2bDemoOrderId(id)) return NextResponse.json({ error: "Nederīgs pasūtījums." }, { status: 400 });
  let body: { entryId?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Nederīgs JSON." }, { status: 400 });
  }
  const entryId = typeof body.entryId === "string" ? body.entryId : "";
  if (!isSafeAdminChangeEntryId(entryId)) return NextResponse.json({ error: "Nederīgs ieraksts." }, { status: 400 });
  const tenantId = gate.actor.session.tenantId;
  const order = await getB2bDemoTenantOrder(tenantId, id);
  if (!order) return NextResponse.json({ error: "Pasūtījums nav atrasts." }, { status: 404 });
  const snapshot = await loadAdminChangeSnapshot("b2b-order", id, entryId, { kind: "tenant", tenantId });
  if (!snapshot) return NextResponse.json({ error: "Ieraksts nav atrasts." }, { status: 404 });
  try {
    const restored = await patchB2bDemoTenantOrder(tenantId, id, b2bOrderPatchFromSnapshot(snapshot), undefined, {
      by: gate.actor.user.name || gate.actor.user.email,
      action: "restore",
    });
    return NextResponse.json({ ok: true, record: restored });
  } catch (e) {
    return b2bDemoErrorResponse(e);
  }
}
