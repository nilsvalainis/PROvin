/**
 * Stripe var atkārtoti nosūtīt notikumu. Lēmums ir tīrs; Blob krātuve ir
 * `stripe-webhook-dedupe-store.ts` (serverless instances dala to pašu stāvokli).
 */

export const STRIPE_DEDUPE_DONE_MAX_AGE_MS = 72 * 60 * 60 * 1000;
export const STRIPE_DEDUPE_STALE_CLAIM_MS = 15 * 60 * 1000;

export type StripeDedupeStatus = "claimed" | "done";

export type StripeDedupeRecord = {
  status: StripeDedupeStatus;
  claimedAt: number;
  eventId: string;
};

export type StripeDedupeDecision = "begin" | "duplicate" | "reclaim";

export function parseStripeDedupeRecord(raw: unknown): StripeDedupeRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const status = o.status === "claimed" || o.status === "done" ? o.status : null;
  const eventId = typeof o.eventId === "string" ? o.eventId.trim() : "";
  const claimedAt =
    typeof o.claimedAt === "number"
      ? o.claimedAt
      : typeof o.claimedAt === "string"
        ? Date.parse(o.claimedAt)
        : NaN;
  if (!status || !eventId || !Number.isFinite(claimedAt)) return null;
  return { status, claimedAt, eventId };
}

export function stripeDedupeBlobKey(eventId: string): string {
  const cleaned = eventId.trim().replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 200);
  return cleaned || "invalid";
}

export function isSafeStripeDedupeKey(key: string): boolean {
  return /^[a-zA-Z0-9._-]{1,200}$/.test(key);
}

export function stripeDedupeDecision(
  existing: StripeDedupeRecord | null,
  now: number,
  opts?: { doneMaxAgeMs?: number; staleClaimMs?: number },
): StripeDedupeDecision {
  if (!existing) return "begin";
  const doneMax = opts?.doneMaxAgeMs ?? STRIPE_DEDUPE_DONE_MAX_AGE_MS;
  const staleMs = opts?.staleClaimMs ?? STRIPE_DEDUPE_STALE_CLAIM_MS;
  const age = now - existing.claimedAt;
  if (existing.status === "done") {
    return age > doneMax ? "begin" : "duplicate";
  }
  if (age > staleMs) return "reclaim";
  return "duplicate";
}

export function newStripeDedupeClaim(eventId: string, now: number, status: StripeDedupeStatus = "claimed"): StripeDedupeRecord {
  return { status, claimedAt: now, eventId };
}

/** Meta Purchase tikai pēc veiksmīgas sesijas dedupe (ne pirms tās). */
export function stripeShouldSendMetaPurchase(args: {
  paymentStatus: string | null | undefined;
  sessionDedupeAcquired: boolean;
}): boolean {
  return args.paymentStatus === "paid" && args.sessionDedupeAcquired;
}
