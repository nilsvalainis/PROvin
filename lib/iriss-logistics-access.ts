import "server-only";

import { NextResponse } from "next/server";
import { ENV_ADMIN_USER_ID } from "@/lib/staff-roles";
import { IRISS_LOGISTICS_ACCESS_SCOPE } from "@/lib/iriss-logistics-types";
import { requireLogisticsApi, type AdminOrStaffActor } from "@/lib/staff-auth";

/**
 * Vienīgā vārteja Loģistikas API: administrators vai Loģistika loma (#347).
 */
export async function requireIrissLogisticsApi(): Promise<
  { ok: true; actor: AdminOrStaffActor } | { ok: false; response: NextResponse }
> {
  const gate = await requireLogisticsApi();
  if (!gate.ok) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: gate.response.status === 403 ? "forbidden" : "unauthorized", scope: IRISS_LOGISTICS_ACCESS_SCOPE },
        { status: gate.response.status, headers: irissLogisticsScopeHeader() },
      ),
    };
  }
  return { ok: true, actor: gate.actor };
}

export function logisticsCabinetActorId(actor: AdminOrStaffActor): string {
  return actor.kind === "admin" ? ENV_ADMIN_USER_ID : actor.user.id;
}

export function irissLogisticsScopeHeader(): Record<string, string> {
  return { "x-provin-access-scope": IRISS_LOGISTICS_ACCESS_SCOPE };
}
