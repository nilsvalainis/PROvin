import "server-only";

import { NextResponse } from "next/server";
import {
  cabinetActorCanWrite,
  cabinetRolesFromSections,
  type CabinetAccessQuery,
} from "@/lib/iriss-logistics-cabinet-access";
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

export function logisticsCabinetAccessQuery(
  actor: AdminOrStaffActor,
  carId: string,
): Omit<CabinetAccessQuery, "section" | "docType"> {
  if (actor.kind === "admin") {
    return { userId: ENV_ADMIN_USER_ID, roles: [], carId };
  }
  return { userId: actor.user.id, roles: cabinetRolesFromSections(actor.user.sections), carId };
}

export function logisticsCabinetWriteForbidden(actor: AdminOrStaffActor): NextResponse | null {
  const query = logisticsCabinetAccessQuery(actor, "");
  if (cabinetActorCanWrite(query)) return null;
  return NextResponse.json({ error: "read_only" }, { status: 403, headers: irissLogisticsScopeHeader() });
}

export function irissLogisticsScopeHeader(): Record<string, string> {
  return { "x-provin-access-scope": IRISS_LOGISTICS_ACCESS_SCOPE };
}
