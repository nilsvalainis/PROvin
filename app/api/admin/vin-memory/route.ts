import { NextResponse } from "next/server";

import { requireIrissSectionApi } from "@/lib/staff-auth";
import { isValidVin, normalizeVin } from "@/lib/order-field-validation";
import { kmRollback, latestKm } from "@/lib/vin-memory";
import { readVinMemory } from "@/lib/vin-memory-store";

export const runtime = "nodejs";
export const maxDuration = 15;

/** Admin: mūsu VIN atmiņa par konkrētu VIN (visi novērojumi, pēdējais km, nobraukuma pretruna). */
export async function GET(req: Request) {
  const gate = await requireIrissSectionApi("vin");
  if (!gate.ok) return gate.response;
  const vin = normalizeVin(new URL(req.url).searchParams.get("vin") ?? "");
  if (!isValidVin(vin)) return NextResponse.json({ error: "invalid_vin" }, { status: 400 });
  const entry = await readVinMemory(vin);
  return NextResponse.json(
    { vin, observations: entry?.observations ?? [], latest: latestKm(entry ?? undefined), rollback: kmRollback(entry ?? undefined) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
