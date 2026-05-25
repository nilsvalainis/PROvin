import "server-only";

/**
 * Outvin B2B plūsma (Swagger 1.0.3 — tikai GET):
 *   1. GET /vehicle/{VIN}  — reģistrē / „pasūta” transportu kontā (1 kredīts)
 *   2. GET /history/{VIN}/{type} — serviss (1) vai carfax (2)
 *
 * Swagger nav POST /vehicle vai POST /order — bāzes solis ir GET vehicle.
 */
import type { OutvinDataBundle, OutvinVehicleOrderRecord } from "@/lib/outvin-data-bundle";
import {
  fetchOutvinHistoryResult,
  fetchOutvinVehicleOrderResult,
  logOutvinApiFailure,
} from "@/lib/outvin-api";
import {
  applyOutvinPurchaseToBundle,
  buildOutvinPurchaseUserMessage,
  logOutvinPurchaseHistoryFailure,
  OUTVIN_SEQUENTIAL_PURCHASE_DELAY_MS,
  sleepMs,
  type OutvinPurchaseResult,
  type OutvinPurchaseTypeResult,
} from "@/lib/outvin-purchase-map";
import { mapOutvinVehicleJsonToInfo } from "@/lib/outvin-dealer-map";
import { applyOutvinPrecheckMetadata, buildOutvinCapabilitySlots } from "@/lib/outvin-precheck";
import {
  getOutvinHistoryTypesToProbe,
  isOutvinOfficialHistoryType,
  outvinHistoryTypeLabel,
} from "@/lib/outvin-official-types";
import { normalizeVin } from "@/lib/order-field-validation";

export type { OutvinOfficialHistoryType } from "@/lib/outvin-official-types";
export { isOutvinOfficialHistoryType } from "@/lib/outvin-official-types";

export type OutvinB2bPurchaseResult = OutvinPurchaseResult & {
  vehicleOrderOk: boolean;
  vehicleOrderStatus?: number;
};

function vehicleOrderFromFetch(
  vin: string,
  r: Awaited<ReturnType<typeof fetchOutvinVehicleOrderResult>>,
): OutvinVehicleOrderRecord {
  return {
    orderedAt: new Date().toISOString(),
    httpStatus: r.status,
    ok: r.ok,
    vin,
    ...(r.uuid ? { uuid: r.uuid } : {}),
    ...(r.body != null ? { payload: r.body } : {}),
    ...(r.skipReason ? { error: r.skipReason } : {}),
  };
}

/**
 * 1. solis — GET /vehicle/{VIN}. Bez veiksmīga pasūtījuma history bieži atgriež 402.
 */
export async function ensureOutvinVehicleOrderForVin(
  vin: string,
  bundle: OutvinDataBundle,
  options?: { forceRefresh?: boolean },
): Promise<{ bundle: OutvinDataBundle; vehicleOrder: OutvinVehicleOrderRecord; blocked: boolean }> {
  const normalized = normalizeVin(vin);
  if (!options?.forceRefresh && bundle.vehicleOrder?.ok && bundle.vehicleOrder.vin === normalized) {
    return { bundle, vehicleOrder: bundle.vehicleOrder, blocked: false };
  }

  const r = await fetchOutvinVehicleOrderResult(normalized);
  const vehicleOrder = vehicleOrderFromFetch(normalized, r);

  if (!r.ok) {
    logOutvinApiFailure("outvin/vehicle-order", normalized, "GET", "vehicle/{VIN}", r.status, r.skipReason, r.rawBodyPreview);
  }

  let nextBundle: OutvinDataBundle = { ...bundle, vin: normalized, vehicleOrder };

  if (r.ok && r.body != null) {
    const vehicleInfo = mapOutvinVehicleJsonToInfo(r.body, normalized);
    nextBundle = {
      ...nextBundle,
      vehicleInfo: { ...nextBundle.vehicleInfo, ...vehicleInfo },
    };
  }

  const blocked = !r.ok && (r.status === 402 || r.skipReason === "payment_required");
  return { bundle: nextBundle, vehicleOrder, blocked };
}

/**
 * 2. solis — GET /history/{VIN}/{type} tikai pēc veiksmīga vehicle pasūtījuma.
 */
export async function fetchOutvinOfficialHistoryTypes(
  vin: string,
  types: number[],
  bundle: OutvinDataBundle,
): Promise<OutvinB2bPurchaseResult> {
  const normalized = normalizeVin(vin);
  const unique = [...new Set(types.map((t) => Math.floor(t)).filter((t) => isOutvinOfficialHistoryType(t)))];
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
      logOutvinPurchaseHistoryFailure("outvin/history", normalized, type, r.status, r.skipReason, r.rawBodyPreview);
      paymentRequired = true;
      results.push({ type, ok: false, error: "payment_required", httpStatus: r.status });
      continue;
    }

    if (!r.ok || r.body == null) {
      logOutvinPurchaseHistoryFailure("outvin/history", normalized, type, r.status, r.skipReason, r.rawBodyPreview);
      const errLabel =
        r.skipReason === "rate_limited"
          ? "rate_limited (pārāk daudz pieprasījumu — mēģini vēlreiz pēc brīža)"
          : (r.skipReason ?? `http_${r.status}`);
      results.push({ type, ok: false, error: errLabel, httpStatus: r.status });
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
    vehicleOrderOk: Boolean(bundle.vehicleOrder?.ok),
    vehicleOrderStatus: bundle.vehicleOrder?.httpStatus,
    ...(purchaseMessage ? { purchaseMessage } : {}),
  };
}

/**
 * Pilna B2B pirkšana: vehicle order → history types.
 */
export async function executeOutvinB2bPurchase(
  vin: string,
  types: number[],
  existingBundle?: OutvinDataBundle | null,
): Promise<OutvinB2bPurchaseResult> {
  const normalized = normalizeVin(vin);
  let bundle =
    existingBundle && existingBundle.vin === normalized
      ? { ...existingBundle, vin: normalized }
      : applyOutvinPrecheckMetadata(normalized, existingBundle ?? null);

  const { bundle: withVehicle, vehicleOrder, blocked } = await ensureOutvinVehicleOrderForVin(normalized, bundle);

  if (!vehicleOrder.ok) {
    const is402 = vehicleOrder.httpStatus === 402 || vehicleOrder.error === "payment_required";
    const purchaseMessage = is402
      ? "Outvin: neizdevās reģistrēt transportu (GET /vehicle) — HTTP 402. Pārbaudi kredītus."
      : `Kļūda iegādē: transporta pasūtījums — ${vehicleOrder.error ?? `HTTP ${vehicleOrder.httpStatus}`}`;
    return {
      bundle: withVehicle,
      results: [],
      paymentRequired: is402,
      vehicleOrderOk: false,
      vehicleOrderStatus: vehicleOrder.httpStatus,
      purchaseMessage,
    };
  }

  if (blocked) {
    return {
      bundle: withVehicle,
      results: [],
      paymentRequired: true,
      vehicleOrderOk: false,
      vehicleOrderStatus: vehicleOrder.httpStatus,
      purchaseMessage: "Outvin: transporta pasūtījums bloķēts (402).",
    };
  }

  bundle = withVehicle;

  await sleepMs(OUTVIN_SEQUENTIAL_PURCHASE_DELAY_MS);

  if (types.length === 0) {
    return {
      bundle,
      results: [],
      paymentRequired: false,
      vehicleOrderOk: true,
      vehicleOrderStatus: vehicleOrder.httpStatus,
    };
  }

  const historyResult = await fetchOutvinOfficialHistoryTypes(normalized, types, bundle);
  return {
    ...historyResult,
    vehicleOrderOk: true,
    vehicleOrderStatus: vehicleOrder.httpStatus,
  };
}
