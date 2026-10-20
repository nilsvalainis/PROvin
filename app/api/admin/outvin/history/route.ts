/**
 * @deprecated Izmanto POST /api/admin/outvin/purchase ar atlasītajiem tipiem.
 */
import { NextResponse } from "next/server";

import { requireIrissSectionApi } from "@/lib/staff-auth";

export const runtime = "nodejs";

export async function POST() {
  const gate = await requireIrissSectionApi("vin");
  if (!gate.ok) return gate.response;

  return NextResponse.json(
    {
      error: "deprecated_use_outvin_purchase",
      message:
        "Automātiskā Outvin ielāde ir atslēgta. Izmanto „Pārbaudīt Outvin iespējas” un „Pirkt atlasītos datus”.",
      capabilitiesUrl: "/api/admin/outvin/capabilities",
      purchaseUrl: "/api/admin/outvin/purchase",
    },
    { status: 410 },
  );
}
