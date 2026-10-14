import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/admin-auth";
import { isValidVin, normalizeVin } from "@/lib/order-field-validation";
import { fetchSpeckrVehicleSpecs, speckrApiConfigured } from "@/lib/speckr-api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!speckrApiConfigured()) {
    return NextResponse.json({ error: "missing_speckr_credentials" }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const o = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const vin = normalizeVin(String(o.vin ?? ""));
  if (!isValidVin(vin)) {
    return NextResponse.json({ error: "invalid_vin" }, { status: 400 });
  }

  const result = await fetchSpeckrVehicleSpecs(vin);
  if (result.outcome === "needs_payment") {
    return NextResponse.json({ ok: false, error: "insufficient_credits", result }, { status: 402 });
  }
  if (result.outcome === "error" && result.errorCode === "unauthorized") {
    return NextResponse.json({ ok: false, error: "speckr_unauthorized", result }, { status: 502 });
  }
  return NextResponse.json({
    ok: result.outcome === "ok",
    vin,
    fetchedAt: new Date().toISOString(),
    result,
  });
}
