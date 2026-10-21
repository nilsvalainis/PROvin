import { NextResponse } from "next/server";
import { irissLogisticsScopeHeader, logisticsCabinetWriteForbidden, requireIrissLogisticsApi } from "@/lib/iriss-logistics-access";
import { isRouteTemplateType } from "@/lib/iriss-logistics-cargo-plan";
import { listRouteTemplates, upsertRouteTemplate } from "@/lib/iriss-logistics-cargo-store";
import { geocodeLogisticsAddress } from "@/lib/iriss-logistics-geocode-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireIrissLogisticsApi();
  if (!gate.ok) return gate.response;
  const templates = await listRouteTemplates();
  return NextResponse.json({ ok: true, templates }, { headers: irissLogisticsScopeHeader() });
}

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
  const row = body as Record<string, unknown>;
  const name = typeof row.name === "string" ? row.name.trim() : "";
  const address = typeof row.address === "string" ? row.address.trim() : "";
  let lat = typeof row.lat === "number" && Number.isFinite(row.lat) ? row.lat : null;
  let lng = typeof row.lng === "number" && Number.isFinite(row.lng) ? row.lng : null;
  if (!name || !address) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400, headers: irissLogisticsScopeHeader() });
  }
  if (lat == null || lng == null) {
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
    id: typeof row.id === "string" ? row.id : undefined,
    name,
    address,
    lat,
    lng,
    type: isRouteTemplateType(row.type) ? row.type : "other",
  });
  return NextResponse.json({ ok: true, template }, { headers: irissLogisticsScopeHeader() });
}
