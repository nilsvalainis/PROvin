/**
 * @deprecated Izmanto POST /api/admin/outvin/purchase ar atlasītajiem tipiem.
 */
import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/admin-auth";

export const runtime = "nodejs";

export async function POST() {
  const ok = await getAdminSession();
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

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
