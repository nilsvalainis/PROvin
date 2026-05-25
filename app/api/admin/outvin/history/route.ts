/**
 * Admin: Outvin nobraukuma vēsture → AUTO RECORDS tabulas rindas.
 * GET /history/{VIN}/{type} (type 1 + 2), HTTP Basic (OUTVIN_EMAIL / OUTVIN_PASSWORD).
 */
import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/admin-auth";
import { fetchOutvinMileageServiceRows, getOutvinConfig } from "@/lib/outvin-api";
import { isOutvinApiVin, normalizeVin } from "@/lib/order-field-validation";

export const maxDuration = 60;
export const runtime = "nodejs";

export async function POST(req: Request) {
  const ok = await getAdminSession();
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  if (!getOutvinConfig()) {
    return NextResponse.json({ error: "missing_outvin_credentials" }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const vinRaw =
    typeof body === "object" && body && "vin" in body ? String((body as { vin: unknown }).vin).trim() : "";
  const vin = normalizeVin(vinRaw);
  if (!isOutvinApiVin(vin)) {
    return NextResponse.json({ error: "invalid_vin" }, { status: 400 });
  }

  try {
    const { rows, typesFetched } = await fetchOutvinMileageServiceRows(vin);
    return NextResponse.json({ rows, typesFetched, vin });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    console.error("[admin/outvin/history]", msg);
    if (msg === "missing_outvin_credentials") {
      return NextResponse.json({ error: "missing_outvin_credentials" }, { status: 503 });
    }
    if (msg === "invalid_vin") {
      return NextResponse.json({ error: "invalid_vin" }, { status: 400 });
    }
    if (msg === "outvin_unauthorized") {
      return NextResponse.json({ error: "outvin_unauthorized" }, { status: 502 });
    }
    if (msg === "outvin_payment_required") {
      return NextResponse.json({ error: "outvin_payment_required" }, { status: 402 });
    }
    if (msg === "outvin_not_found") {
      return NextResponse.json({ error: "outvin_not_found" }, { status: 404 });
    }
    if (msg === "empty_mileage_history") {
      return NextResponse.json({ error: "empty_mileage_history" }, { status: 404 });
    }
    if (msg.startsWith("outvin_fetch_failed:")) {
      return NextResponse.json(
        { error: "outvin_fetch_failed", detail: msg.slice("outvin_fetch_failed:".length) },
        { status: 502 },
      );
    }
    return NextResponse.json({ error: "outvin_fetch_failed", detail: msg }, { status: 502 });
  }
}
