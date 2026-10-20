import { NextResponse } from "next/server";
import { requireIrissLogisticsApi, irissLogisticsScopeHeader } from "@/lib/iriss-logistics-access";
import {
  listLogisticsAuctionSources,
  removeLogisticsAuctionSource,
  setLogisticsAuctionSourceEnabled,
  upsertLogisticsAuctionSource,
} from "@/lib/iriss-logistics-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const gate = await requireIrissLogisticsApi();
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;
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
  if (typeof row.enabled === "boolean" && Object.keys(row).length === 1) {
    const source = await setLogisticsAuctionSourceEnabled(id, row.enabled);
    if (!source) return NextResponse.json({ error: "not_found" }, { status: 404, headers: irissLogisticsScopeHeader() });
    return NextResponse.json({ ok: true, source }, { headers: irissLogisticsScopeHeader() });
  }
  const existing = (await listLogisticsAuctionSources()).find((p) => p.id === id);
  if (!existing) return NextResponse.json({ error: "not_found" }, { status: 404, headers: irissLogisticsScopeHeader() });
  const source = await upsertLogisticsAuctionSource({
    ...existing,
    ...row,
    id,
    name: typeof row.name === "string" && row.name.trim() ? row.name : existing.name,
  });
  return NextResponse.json({ ok: true, source }, { headers: irissLogisticsScopeHeader() });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const gate = await requireIrissLogisticsApi();
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;
  const ok = await removeLogisticsAuctionSource(id);
  if (!ok) {
    return NextResponse.json({ error: "not_removable" }, { status: 400, headers: irissLogisticsScopeHeader() });
  }
  return NextResponse.json({ ok: true }, { headers: irissLogisticsScopeHeader() });
}
