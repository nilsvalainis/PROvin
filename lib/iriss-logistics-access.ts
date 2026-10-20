import "server-only";

import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { IRISS_LOGISTICS_ACCESS_SCOPE } from "@/lib/iriss-logistics-types";

/**
 * Vienīgā vārteja Loģistikas API. Šobrīd = admin sesija.
 * Lomu pārbaude (`iriss.logistics`) nāk atsevišķā PR - ievietot šeit, nevis katrā maršrutā.
 */
export async function requireIrissLogisticsApi(): Promise<{ ok: true } | { ok: false; response: NextResponse }> {
  if (!(await getAdminSession())) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "unauthorized", scope: IRISS_LOGISTICS_ACCESS_SCOPE },
        { status: 401 },
      ),
    };
  }
  return { ok: true };
}

export function irissLogisticsScopeHeader(): Record<string, string> {
  return { "x-provin-access-scope": IRISS_LOGISTICS_ACCESS_SCOPE };
}
