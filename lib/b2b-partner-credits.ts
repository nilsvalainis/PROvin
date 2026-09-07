import type { B2bPartnerPlanId } from "@/lib/b2b-partner-copy";

export const B2B_CREDIT_TTL_DAYS = 90;

export type B2bCreditLot = {
  id: string;
  sku: B2bPartnerPlanId;
  remaining: number;
  purchasedAt: string;
  expiresAt: string;
};

export type B2bCreditRemaining = Record<B2bPartnerPlanId, number>;

export function emptyB2bCreditRemaining(): B2bCreditRemaining {
  return { business: 0, dealer: 0 };
}

export function b2bCreditExpiresAt(purchasedAt: Date, ttlDays = B2B_CREDIT_TTL_DAYS): Date {
  const expires = new Date(purchasedAt.getTime());
  expires.setUTCDate(expires.getUTCDate() + ttlDays);
  return expires;
}

export function isLiveB2bCreditLot(lot: B2bCreditLot, now: Date): boolean {
  if (lot.remaining < 1) return false;
  const expires = Date.parse(lot.expiresAt);
  if (!Number.isFinite(expires)) return false;
  return expires > now.getTime();
}

export function remainingB2bCredits(lots: readonly B2bCreditLot[], now: Date): B2bCreditRemaining {
  const out = emptyB2bCreditRemaining();
  for (const lot of lots) {
    if (!isLiveB2bCreditLot(lot, now)) continue;
    out[lot.sku] += lot.remaining;
  }
  return out;
}

export function hasAnyB2bCredit(remaining: B2bCreditRemaining): boolean {
  return remaining.business > 0 || remaining.dealer > 0;
}
