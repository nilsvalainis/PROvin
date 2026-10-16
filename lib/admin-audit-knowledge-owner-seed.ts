/**
 * Īpašnieka apstiprinātās KB zināšanas. Nav kandidāti; AI lieto kā faktus.
 * N57 klaņu šāles: apstiprināta tipiska kaite, ne kļūdains fragments.
 */
import { claimsConflict, claimTokenSet } from "@/lib/admin-audit-knowledge-claim-extract";
import type { KnowledgeItem } from "@/lib/admin-audit-knowledge-items-types";

const OWNER_TS = "2026-10-16T00:00:00.000Z";

export const OWNER_VERIFIED_N57_CONROD_CLAIM =
  "N57: klaņu šāles nodilums ir sistēmiska kaite šim dzinējam (avots: īpašnieks).";

export const OWNER_VERIFIED_KNOWLEDGE_ITEMS: KnowledgeItem[] = [
  {
    id: "ki_owner_n57_conrod_bearings",
    aggregate: "N57",
    claim: OWNER_VERIFIED_N57_CONROD_CLAIM,
    horizon: "now",
    status: "approved",
    sources: [{ type: "kb", ref: "owner" }],
    fromOrders: [],
    seenCount: 1,
    reviewedBy: "owner",
    reviewedAt: OWNER_TS,
    createdAt: OWNER_TS,
    updatedAt: OWNER_TS,
    history: [
      {
        at: OWNER_TS,
        by: "owner",
        action: "approve",
        claim: OWNER_VERIFIED_N57_CONROD_CLAIM,
        reason: "avots: īpašnieks",
      },
    ],
  },
];

export function aggregatesMatchOwnerSeed(a: string, b: string): boolean {
  const na = a.replace(/^ENGINE\|/i, "").trim().toUpperCase();
  const nb = b.replace(/^ENGINE\|/i, "").trim().toUpperCase();
  if (!na || !nb) return false;
  return na === nb || na.startsWith(nb) || nb.startsWith(na);
}

export function restatesOwnerVerifiedClaim(claim: string, aggregate: string): boolean {
  for (const seed of OWNER_VERIFIED_KNOWLEDGE_ITEMS) {
    if (!aggregatesMatchOwnerSeed(aggregate, seed.aggregate)) continue;
    if (claimsConflict(claim, seed.claim)) continue;
    const ta = claimTokenSet(claim);
    const tb = claimTokenSet(seed.claim);
    let overlap = 0;
    for (const t of ta) if (tb.has(t)) overlap += 1;
    if (overlap >= 2 && /šāl|klaņ/i.test(claim) && /šāl|klaņ/i.test(seed.claim)) return true;
  }
  return false;
}

/** Ieliek īpašnieka seedus atmiņā. Neraksta Blob. Noraidītu seedu atjauno kā approved. */
export function mergeOwnerVerifiedKnowledge<T extends { items: Record<string, KnowledgeItem> }>(
  doc: T,
): T {
  for (const seed of OWNER_VERIFIED_KNOWLEDGE_ITEMS) {
    const existing = doc.items[seed.id];
    if (!existing) {
      doc.items[seed.id] = {
        ...seed,
        sources: [...seed.sources],
        fromOrders: [...seed.fromOrders],
        history: [...seed.history],
      };
      continue;
    }
    if (existing.status !== "approved") {
      doc.items[seed.id] = {
        ...existing,
        claim: seed.claim,
        aggregate: seed.aggregate,
        status: "approved",
        sources: seed.sources.length > 0 ? [...seed.sources] : existing.sources,
        reviewedBy: seed.reviewedBy,
        reviewedAt: seed.reviewedAt,
        history: [
          ...existing.history,
          {
            at: seed.reviewedAt ?? OWNER_TS,
            by: "owner",
            action: "approve",
            claim: seed.claim,
            reason: "avots: īpašnieks (atjaunots)",
          },
        ].slice(-40),
      };
    }
  }
  return doc;
}
