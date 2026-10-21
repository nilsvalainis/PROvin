/**
 * OneAuto maksas produktu rindas Pārvaldība izmaksām.
 * Tīri: bez store, lai var testēt bez server-only.
 */
import {
  ONEAUTO_PRODUCTS,
  oneautoResultTone,
  type OneautoProductId,
  type OneautoResultLike,
} from "@/lib/oneauto-catalog";

export const DEFAULT_ONEAUTO_EUR_TO_USD = 1.08;

export type OneautoCostEventDraft = {
  sku: OneautoProductId;
  units: number;
  usd: number;
  eur: number;
  ref: string;
};

export function oneautoChargedCostEventDrafts(args: {
  vin: string;
  products: readonly OneautoProductId[];
  results: Partial<Record<OneautoProductId, OneautoResultLike>>;
  eurToUsd?: number;
}): OneautoCostEventDraft[] {
  const rate = args.eurToUsd != null && Number.isFinite(args.eurToUsd) && args.eurToUsd > 0
    ? args.eurToUsd
    : DEFAULT_ONEAUTO_EUR_TO_USD;
  const vin = args.vin.trim().toUpperCase();
  const out: OneautoCostEventDraft[] = [];
  for (const id of args.products) {
    const result = args.results[id];
    if (!result || oneautoResultTone(result) !== "ok") continue;
    const product = ONEAUTO_PRODUCTS.find((p) => p.id === id);
    if (!product) continue;
    const eur = product.priceCents / 100;
    out.push({
      sku: id,
      units: 1,
      eur,
      usd: Math.round(eur * rate * 100) / 100,
      ref: `${vin}:${id}`,
    });
  }
  return out;
}
