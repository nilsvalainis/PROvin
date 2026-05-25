/**
 * Admin: manuāli iegādāties atlasītos Outvin history tipus (1 kredīts / veiksmīgs tips).
 */
import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/admin-auth";
import { getOutvinConfig, purchaseOutvinHistoryTypes } from "@/lib/outvin-api";
import { parseOutvinDataBundleRaw } from "@/lib/outvin-data-bundle";
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

  const o = typeof body === "object" && body ? (body as Record<string, unknown>) : {};
  const vin = normalizeVin(String(o.vin ?? "").trim());
  if (!isOutvinApiVin(vin)) {
    return NextResponse.json({ error: "invalid_vin" }, { status: 400 });
  }

  const typesRaw = Array.isArray(o.types) ? o.types : [];
  const types = typesRaw
    .map((t) => (typeof t === "number" ? t : Number(t)))
    .filter((t) => Number.isFinite(t) && t > 0);

  if (types.length === 0) {
    return NextResponse.json({ error: "no_types_selected" }, { status: 400 });
  }

  const existing = parseOutvinDataBundleRaw(o.existingBundle, vin);

  try {
    const { bundle, results, paymentRequired, paymentWarning } = await purchaseOutvinHistoryTypes(
      vin,
      types,
      existing ?? null,
    );
    return NextResponse.json({
      bundle,
      results,
      paymentRequired,
      vin,
      ...(paymentWarning ? { paymentWarning } : {}),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    console.error("[admin/outvin/purchase]", msg);
    if (msg === "missing_outvin_credentials") {
      return NextResponse.json({ error: "missing_outvin_credentials" }, { status: 503 });
    }
    if (msg === "invalid_vin") {
      return NextResponse.json({ error: "invalid_vin" }, { status: 400 });
    }
    if (msg === "outvin_unauthorized") {
      return NextResponse.json({ error: "outvin_unauthorized" }, { status: 502 });
    }
    return NextResponse.json({ error: "outvin_purchase_failed", detail: msg }, { status: 502 });
  }
}
