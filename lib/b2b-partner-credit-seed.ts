import {
  b2bCreditExpiresAt,
  emptyB2bCreditRemaining,
  remainingB2bCredits,
  type B2bCreditLot,
  type B2bCreditRemaining,
} from "@/lib/b2b-partner-credits";
import type { B2bPartnerPlanId } from "@/lib/b2b-partner-copy";

/**
 * Until Stripe pack fulfillment writes real credit lots, partners need a seed so the
 * credited home UI (VIN + service checkboxes) can be verified.
 *
 * - unset → dealer:10, business:7 (preview)
 * - `0` → no seed (real empty balance)
 * - `dealer:10,business:7` → explicit counts
 */
export function parseB2bPartnerSeedCredits(
  raw: string | undefined = process.env.B2B_PARTNER_SEED_CREDITS,
): B2bCreditRemaining | null {
  const value = raw?.trim();
  if (value === "0") return null;
  if (!value) return { dealer: 10, business: 7 };

  const out = emptyB2bCreditRemaining();
  let saw = false;
  for (const part of value.split(/[,;\s]+/)) {
    const m = part.trim().match(/^(dealer|business)\s*[:=]\s*(\d+)$/i);
    if (!m) continue;
    const sku = m[1].toLowerCase() as B2bPartnerPlanId;
    out[sku] = Math.max(0, Number.parseInt(m[2], 10) || 0);
    saw = true;
  }
  return saw ? out : { dealer: 10, business: 7 };
}

export function seedLotsFromRemaining(remaining: B2bCreditRemaining, now = new Date()): B2bCreditLot[] {
  const purchasedAt = now.toISOString();
  const expiresAt = b2bCreditExpiresAt(now).toISOString();
  const lots: B2bCreditLot[] = [];
  for (const sku of ["dealer", "business"] as const) {
    const n = remaining[sku];
    if (n < 1) continue;
    lots.push({
      id: `seed_${sku}`,
      sku,
      remaining: n,
      purchasedAt,
      expiresAt,
    });
  }
  return lots;
}

export function resolvePartnerCreditRemaining(
  lots: readonly B2bCreditLot[],
  now = new Date(),
): B2bCreditRemaining {
  if (lots.length > 0) return remainingB2bCredits(lots, now);
  const seed = parseB2bPartnerSeedCredits();
  return seed ?? emptyB2bCreditRemaining();
}
