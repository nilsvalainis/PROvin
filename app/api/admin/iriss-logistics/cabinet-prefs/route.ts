import { NextResponse } from "next/server";
import { irissLogisticsScopeHeader, logisticsCabinetActorId, requireIrissLogisticsApi } from "@/lib/iriss-logistics-access";
import { cabinetPrefKey, isCabinetPhase, isCabinetSectionId } from "@/lib/iriss-logistics-cabinet";
import { cabinetPrefsMap, upsertCabinetUserPreference } from "@/lib/iriss-logistics-cabinet-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireIrissLogisticsApi();
  if (!gate.ok) return gate.response;
  const prefs = await cabinetPrefsMap(logisticsCabinetActorId(gate.actor));
  return NextResponse.json({ ok: true, prefs }, { headers: irissLogisticsScopeHeader() });
}

export async function PATCH(req: Request) {
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
  const section = row.section;
  const phase = row.phase;
  const value = row.value === "open" || row.value === "closed" ? row.value : "";
  if (!isCabinetSectionId(section) || !isCabinetPhase(phase) || !value) {
    return NextResponse.json({ error: "invalid_pref" }, { status: 400, headers: irissLogisticsScopeHeader() });
  }
  const userId = logisticsCabinetActorId(gate.actor);
  await upsertCabinetUserPreference({ userId, key: cabinetPrefKey(section, phase), value });
  const prefs = await cabinetPrefsMap(userId);
  return NextResponse.json({ ok: true, prefs }, { headers: irissLogisticsScopeHeader() });
}
