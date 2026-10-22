import { NextResponse } from "next/server";
import { irissLogisticsScopeHeader, requireIrissLogisticsApi } from "@/lib/iriss-logistics-access";
import { logisticsDrivingDirections } from "@/lib/iriss-logistics-directions-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const gate = await requireIrissLogisticsApi();
  if (!gate.ok) return gate.response;
  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400, headers: irissLogisticsScopeHeader() });
  }
  const points = body && typeof body === "object" && Array.isArray((body as { points?: unknown }).points)
    ? ((body as { points: Array<{ lat?: unknown; lng?: unknown; via?: unknown }> }).points)
        .map((p) => ({ lat: Number(p.lat), lng: Number(p.lng), ...(p.via === true ? { via: true } : {}) }))
        .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
    : [];
  const result = await logisticsDrivingDirections(points);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, limited: Boolean(result.limited), notice: result.notice },
      { status: result.limited ? 429 : 400, headers: irissLogisticsScopeHeader() },
    );
  }
  return NextResponse.json(
    { ok: true, distanceKm: result.distanceKm, durationMin: result.durationMin, path: result.path },
    { headers: irissLogisticsScopeHeader() },
  );
}
