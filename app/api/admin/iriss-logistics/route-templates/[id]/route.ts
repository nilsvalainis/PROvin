import { NextResponse } from "next/server";
import { irissLogisticsScopeHeader, requireIrissLogisticsApi } from "@/lib/iriss-logistics-access";
import { isRouteTemplateType } from "@/lib/iriss-logistics-cargo-plan";
import { deleteRouteTemplate, listRouteTemplates, upsertRouteTemplate } from "@/lib/iriss-logistics-cargo-store";
import { geocodeLogisticsAddress } from "@/lib/iriss-logistics-geocode-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const gate = await requireIrissLogisticsApi();
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;
  const existing = (await listRouteTemplates()).find((t) => t.id === id);
  if (!existing) return NextResponse.json({ error: "not_found" }, { status: 404, headers: irissLogisticsScopeHeader() });
  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400, headers: irissLogisticsScopeHeader() });
  }
  const row = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const name = typeof row.name === "string" ? row.name.trim() : existing.name;
  const address = typeof row.address === "string" ? row.address.trim() : existing.address;
  let lat = typeof row.lat === "number" && Number.isFinite(row.lat) ? row.lat : existing.lat;
  let lng = typeof row.lng === "number" && Number.isFinite(row.lng) ? row.lng : existing.lng;
  if (typeof row.address === "string" && row.lat == null && row.lng == null && address !== existing.address) {
    const geo = await geocodeLogisticsAddress(address);
    if (!geo.ok) {
      return NextResponse.json(
        { ok: false, limited: Boolean(geo.limited), notice: geo.notice },
        { status: geo.limited ? 429 : 400, headers: irissLogisticsScopeHeader() },
      );
    }
    lat = geo.entry.lat;
    lng = geo.entry.lng;
  }
  const template = await upsertRouteTemplate({
    id,
    name,
    address,
    lat,
    lng,
    type: isRouteTemplateType(row.type) ? row.type : existing.type,
  });
  return NextResponse.json({ ok: true, template }, { headers: irissLogisticsScopeHeader() });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const gate = await requireIrissLogisticsApi();
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;
  const ok = await deleteRouteTemplate(id);
  if (!ok) return NextResponse.json({ error: "not_found" }, { status: 404, headers: irissLogisticsScopeHeader() });
  return NextResponse.json({ ok: true }, { headers: irissLogisticsScopeHeader() });
}
