/**
 * Admin: manuāli iegādāties atlasītos Outvin history tipus (1 kredīts / veiksmīgs tips).
 */
import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/admin-auth";
import { getOutvinConfig } from "@/lib/outvin-api";
import { purchaseOutvinHistoryTypesSequential } from "@/lib/outvin-purchase-sequential";
import { parseOutvinDataBundleRaw } from "@/lib/outvin-data-bundle";
import { isOutvinOfficialHistoryType } from "@/lib/outvin-history-probe";
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
    .filter((t) => Number.isFinite(t) && isOutvinOfficialHistoryType(t));

  if (types.length === 0) {
    return NextResponse.json(
      { error: "invalid_history_types", message: "Outvin atbalsta tikai history type 1 (serviss) un 2 (carfax)." },
      { status: 400 },
    );
  }

  const existing = parseOutvinDataBundleRaw(o.existingBundle, vin);

  try {
    const { bundle, results, paymentRequired, purchaseMessage } = await purchaseOutvinHistoryTypesSequential(
      vin,
      types,
      existing ?? null,
    );

    const failed = results.filter((r) => !r.ok);
    if (failed.length > 0) {
      console.error("[admin/outvin/purchase] purchase finished with failures", {
        vin,
        typesRequested: types,
        paymentRequired,
        results,
        purchasesSaved: bundle.purchases.map((p) => p.historyType),
      });
    }

    const anyOk = results.some((r) => r.ok);
    if (!anyOk && failed.length > 0) {
      return NextResponse.json(
        {
          error: "outvin_purchase_failed",
          bundle,
          results,
          paymentRequired,
          purchaseMessage: purchaseMessage ?? "Kļūda iegādē",
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      bundle,
      results,
      paymentRequired,
      vin,
      ...(purchaseMessage ? { purchaseMessage } : {}),
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
