import "server-only";

import { NextResponse } from "next/server";
import { IRISS_LOGISTICS_ACCESS_SCOPE } from "@/lib/iriss-logistics-types";
import { requireLogisticsApi } from "@/lib/staff-auth";

/**
 * Vienīgā vārteja Loģistikas API: administrators vai Loģistika loma (#347).
 */
export async function requireIrissLogisticsApi(): Promise<{ ok: true } | { ok: false; response: NextResponse }> {
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
  return { ok: true };
}

export function irissLogisticsScopeHeader(): Record<string, string> {
  return { "x-provin-access-scope": IRISS_LOGISTICS_ACCESS_SCOPE };
}
