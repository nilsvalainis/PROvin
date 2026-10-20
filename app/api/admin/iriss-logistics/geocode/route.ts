import { NextResponse } from "next/server";
import { requireIrissLogisticsApi, irissLogisticsScopeHeader } from "@/lib/iriss-logistics-access";
import { geocodeLogisticsAddress } from "@/lib/iriss-logistics-geocode-server";

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
  const address = body && typeof body === "object" && "address" in body ? String((body as { address?: unknown }).address ?? "") : "";
  const result = await geocodeLogisticsAddress(address);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, limited: Boolean(result.limited), notice: result.notice },
      { status: result.limited ? 429 : 400, headers: irissLogisticsScopeHeader() },
    );
  }
  return NextResponse.json(
    { ok: true, cached: result.cached, ...result.entry },
    { headers: irissLogisticsScopeHeader() },
  );
}
