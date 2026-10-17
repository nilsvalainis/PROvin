import { describe, expect, it } from "vitest";
import {
  claimsConflict,
  claimsToCandidateItems,
  findConflictClaim,
} from "@/lib/admin-audit-knowledge-claim-extract";
import {
  conflictWarningFor,
  emptyKnowledgeItemsDoc,
  itemsForAiContext,
  normalizeKnowledgeItemsDoc,
} from "@/lib/admin-audit-knowledge-items-logic";
import {
  OWNER_VERIFIED_KNOWLEDGE_ITEMS,
  OWNER_VERIFIED_N57_CONROD_CLAIM,
  mergeOwnerVerifiedKnowledge,
  restatesOwnerVerifiedClaim,
} from "@/lib/admin-audit-knowledge-owner-seed";

describe("owner-verified N57 klaņu šāles", () => {
  it("keeps the owner seed as approved after merge and normalize", () => {
    const doc = mergeOwnerVerifiedKnowledge(emptyKnowledgeItemsDoc());
    expect(doc.items.ki_owner_n57_conrod_bearings?.status).toBe("approved");
    expect(doc.items.ki_owner_n57_conrod_bearings?.claim).toBe(OWNER_VERIFIED_N57_CONROD_CLAIM);
    expect(doc.items.ki_owner_n57_conrod_bearings?.sources.some((s) => s.ref === "owner")).toBe(
      true,
    );

    const normalized = normalizeKnowledgeItemsDoc({ version: 1, items: {}, usageBySession: {} });
    expect(normalized.items.ki_owner_n57_conrod_bearings?.status).toBe("approved");
  });

  it("restores a rejected owner seed back to approved without writing extra ids", () => {
    const doc = emptyKnowledgeItemsDoc();
    const seed = OWNER_VERIFIED_KNOWLEDGE_ITEMS[0]!;
    doc.items[seed.id] = { ...seed, status: "rejected", rejectReason: "false positive" };
    mergeOwnerVerifiedKnowledge(doc);
    expect(doc.items[seed.id]?.status).toBe("approved");
    expect(Object.keys(doc.items)).toHaveLength(1);
  });

  it("does not flag a restatement of klaņu šāles wear", () => {
    expect(restatesOwnerVerifiedClaim("N57D30: šāles ir sistēmiska kaite pie 200000 km", "N57D30")).toBe(
      true,
    );
    expect(restatesOwnerVerifiedClaim("N57: klaņu šāles nodilums ir kaite", "ENGINE|N57")).toBe(true);

    const doc = mergeOwnerVerifiedKnowledge(emptyKnowledgeItemsDoc());
    const [cand] = claimsToCandidateItems({
      aggregate: "N57D30",
      claims: [{ claim: "N57D30: šāles ir sistēmiska kaite pie 200000 km", horizon: "now" }],
      sessionId: "cs_owner",
    });
    expect(conflictWarningFor(doc, cand!)).toBeNull();
    expect(findConflictClaim(cand!.claim, [OWNER_VERIFIED_N57_CONROD_CLAIM])).toBeNull();
  });

  it("does flag the opposite polarity (šāles nav kaite)", () => {
    expect(restatesOwnerVerifiedClaim("N57D30: šāles nav sistēmiska kaite", "N57D30")).toBe(false);
    expect(claimsConflict("N57D30: šāles nav sistēmiska kaite", OWNER_VERIFIED_N57_CONROD_CLAIM)).toBe(
      true,
    );

    const doc = mergeOwnerVerifiedKnowledge(emptyKnowledgeItemsDoc());
    const [cand] = claimsToCandidateItems({
      aggregate: "N57D30",
      claims: [{ claim: "N57D30: šāles nav sistēmiska kaite pie 200000 km", horizon: "now" }],
      sessionId: "cs_neg",
    });
    expect(conflictWarningFor(doc, cand!)).toMatch(/pretrunā/);
  });

  it("injects the owner fact into AI context for N57D30", () => {
    const doc = mergeOwnerVerifiedKnowledge(emptyKnowledgeItemsDoc());
    const { approved } = itemsForAiContext(doc, ["N57D30"]);
    expect(approved.some((i) => i.id === "ki_owner_n57_conrod_bearings")).toBe(true);
  });

  it("same-polarity restatements are not conflicts", () => {
    expect(
      claimsConflict(
        "N57D30: šāles ir sistēmiska kaite pie 200000 km",
        "N57: klaņu šāles nodilums ir sistēmiska kaite šim dzinējam",
      ),
    ).toBe(false);
  });
});
