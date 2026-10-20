import { NextResponse } from "next/server";
import { requireLogisticsApi } from "@/lib/staff-auth";
import { toLogisticsTripView } from "@/lib/staff-data-filter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Tukšs saraksts, līdz karšu PR pievieno reisus. Cenas un klienti šeit netiek atdoti. */
export async function GET() {
  const gate = await requireLogisticsApi();
  if (!gate.ok) return gate.response;
  return NextResponse.json(
    { ok: true, trips: [] as ReturnType<typeof toLogisticsTripView>[] },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
