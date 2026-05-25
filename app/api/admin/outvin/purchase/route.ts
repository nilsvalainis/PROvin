/**
 * Admin: Outvin B2B pirkšana (Swagger 1.0.3):
 *   1. GET /vehicle/{VIN} — transporta pasūtījums
 *   2. GET /history/{VIN}/{type} — type 1 (serviss) vai 2 (carfax)
 */
import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/admin-auth";
import { getOutvinConfig } from "@/lib/outvin-api";
import { executeOutvinB2bPurchase } from "@/lib/outvin-history-probe";
import { parseOutvinDataBundleRaw } from "@/lib/outvin-data-bundle";
import { isOutvinOfficialHistoryType } from "@/lib/outvin-official-types";
import { isOutvinApiVin, normalizeVin } from "@/lib/order-field-validation";

export const maxDuration = 90;
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
    .filter((t) => Number.isFinite(t) && isOutvinOfficialHistoryType(t));

  if (types.length === 0) {
    return NextResponse.json(
      {
        error: "invalid_history_types",
        message: "Outvin atbalsta tikai history type 1 (serviss) un 2 (carfax).",
      },
      { status: 400 },
    );
  }

  const existing = parseOutvinDataBundleRaw(o.existingBundle, vin);
  const forceVehicleOrder = o.forceVehicleOrder === true;

  try {
    let bundle =
      existing && existing.vin === vin
        ? { ...existing, vin }
        : undefined;

    if (forceVehicleOrder && bundle) {
      bundle = { ...bundle, vehicleOrder: undefined };
    }

    const result = await executeOutvinB2bPurchase(vin, types, bundle ?? null);

    const failed = result.results.filter((r) => !r.ok);
    if (!result.vehicleOrderOk || failed.length > 0) {
      console.error("[admin/outvin/purchase] B2B flow finished with issues", {
        vin,
        typesRequested: types,
        vehicleOrderOk: result.vehicleOrderOk,
        vehicleOrderStatus: result.vehicleOrderStatus,
        vehicleUuid: result.bundle.vehicleOrder?.uuid,
        paymentRequired: result.paymentRequired,
        results: result.results,
        purchasesSaved: result.bundle.purchases.map((p) => p.historyType),
      });
    }

    const anyHistoryOk = result.results.some((r) => r.ok);
    if (!result.vehicleOrderOk) {
      return NextResponse.json(
        {
          error: "outvin_vehicle_order_failed",
          bundle: result.bundle,
          results: result.results,
          vehicleOrderOk: false,
          vehicleOrderStatus: result.vehicleOrderStatus,
          paymentRequired: result.paymentRequired,
          purchaseMessage: result.purchaseMessage ?? "Kļūda iegādē: transporta pasūtījums",
        },
        { status: result.paymentRequired ? 402 : 502 },
      );
    }

    if (!anyHistoryOk && failed.length > 0) {
      return NextResponse.json(
        {
          error: "outvin_purchase_failed",
          bundle: result.bundle,
          results: result.results,
          vehicleOrderOk: true,
          paymentRequired: result.paymentRequired,
          purchaseMessage: result.purchaseMessage ?? "Kļūda iegādē",
        },
        { status: result.paymentRequired ? 402 : 502 },
      );
    }

    return NextResponse.json({
      bundle: result.bundle,
      results: result.results,
      paymentRequired: result.paymentRequired,
      vehicleOrderOk: result.vehicleOrderOk,
      vehicleOrderStatus: result.vehicleOrderStatus,
      vin,
      ...(result.purchaseMessage ? { purchaseMessage: result.purchaseMessage } : {}),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    console.error("[admin/outvin/purchase] unhandled exception", { vin, types, message: msg, error: e });
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
