import "server-only";

import type { OutvinDataBundle } from "@/lib/outvin-data-bundle";
import { fetchOutvinHistoryResult } from "@/lib/outvin-api";
import type { OutvinPurchaseResult } from "@/lib/outvin-purchase-map";
import { applyOutvinPrecheckMetadata, buildOutvinCapabilitySlots } from "@/lib/outvin-precheck";
import {
  applyOutvinPurchaseToBundle,
  buildOutvinPurchaseUserMessage,
  logOutvinPurchaseHistoryFailure,
  OUTVIN_SEQUENTIAL_PURCHASE_DELAY_MS,
  sleepMs,
  type OutvinPurchaseTypeResult,
} from "@/lib/outvin-purchase-map";
import { normalizeVin } from "@/lib/order-field-validation";

/**
 * Secīga Outvin pirkšana ar pauzi, diagnostiku un turpināšanu pēc ne-402 kļūdām.
 */
export async function purchaseOutvinHistoryTypesSequential(
  vin: string,
  types: number[],
  existingBundle?: OutvinDataBundle | null,
): Promise<OutvinPurchaseResult> {
  const normalized = normalizeVin(vin);
  let bundle =
    existingBundle && existingBundle.vin === normalized
      ? { ...existingBundle, vin: normalized }
      : applyOutvinPrecheckMetadata(normalized, existingBundle ?? null);

  const unique = [...new Set(types.map((t) => Math.floor(t)).filter((t) => t > 0))];
  const results: OutvinPurchaseTypeResult[] = [];
  let paymentRequired = false;
  let purchaseIndex = 0;

  for (const type of unique) {
    if (bundle.purchases.some((p) => p.historyType === type)) {
      results.push({ type, ok: true });
      continue;
    }

    if (purchaseIndex > 0) {
      await sleepMs(OUTVIN_SEQUENTIAL_PURCHASE_DELAY_MS);
    }
    purchaseIndex += 1;

    const r = await fetchOutvinHistoryResult(normalized, type);

    if (r.status === 402 && r.skipReason === "payment_required") {
      logOutvinPurchaseHistoryFailure(
        "outvin/purchase",
        normalized,
        type,
        r.status,
        r.skipReason,
        r.rawBodyPreview,
      );
      paymentRequired = true;
      results.push({
        type,
        ok: false,
        error: "payment_required",
        httpStatus: r.status,
      });
      continue;
    }

    if (!r.ok || r.body == null) {
      logOutvinPurchaseHistoryFailure(
        "outvin/purchase",
        normalized,
        type,
        r.status,
        r.skipReason,
        r.rawBodyPreview,
      );
      const errLabel =
        r.skipReason === "rate_limited"
          ? "rate_limited (pārāk daudz pieprasījumu — mēģini vēlreiz pēc brīža)"
          : (r.skipReason ?? `http_${r.status}`);
      results.push({
        type,
        ok: false,
        error: errLabel,
        httpStatus: r.status,
      });
      continue;
    }

    bundle = applyOutvinPurchaseToBundle(bundle, type, r.body);
    results.push({ type, ok: true, httpStatus: r.status });
  }

  bundle.capabilitySlots = buildOutvinCapabilitySlots(normalized, bundle);

  const purchaseMessage = buildOutvinPurchaseUserMessage(results, paymentRequired);

  return {
    bundle,
    results,
    paymentRequired,
    ...(purchaseMessage ? { purchaseMessage } : {}),
  };
}
