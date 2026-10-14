/**
 * Sānjoslas žetoni vienā pieprasījumā (agrāk 3 atsevišķi pollingi).
 * Izmanto tos pašus maršrutus, lai skaitīšanas loģika nedivkāršotos.
 */
import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/admin-auth";
import { GET as peeksCount } from "@/app/api/admin/listing-peeks/open-count/route";
import { GET as ordersCount } from "@/app/api/admin/orders/active-count/route";
import { GET as partnersCount } from "@/app/api/admin/partners/unseen-count/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function read(fn: () => Promise<Response>): Promise<Record<string, unknown>> {
  try {
    const res = await fn();
    if (!res.ok) return {};
    return ((await res.json()) as Record<string, unknown>) ?? {};
  } catch {
    return {};
  }
}

export async function GET() {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const [p, o, u] = await Promise.all([read(peeksCount), read(ordersCount), read(partnersCount)]);
  const out: Record<string, number> = {};
  for (const src of [p, o, u]) {
    for (const k of ["openCount", "activeCount", "overdueCount", "urgentCount", "unseenCount"]) {
      const v = src[k];
      if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
    }
  }
  return NextResponse.json({ ok: true, ...out });
}
