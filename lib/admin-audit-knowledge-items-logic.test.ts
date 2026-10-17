import { describe, expect, it } from "vitest";
import { claimsToCandidateItems, extractClaimsFromPlain, findConflictClaim } from "@/lib/admin-audit-knowledge-claim-extract";
import {
  applyKnowledgeReview,
  conflictWarningFor,
  emptyKnowledgeItemsDoc,
  formatKnowledgeItemsForAi,
  itemsForAiContext,
  summarizeKnowledgeByAggregate,
  upsertCandidateItem,
} from "@/lib/admin-audit-knowledge-items-logic";
import { dropEurSentences, distillLesson } from "@/lib/admin-audit-learning-extract";

describe("knowledge v2 claims", () => {
  it("drops EUR sentences from candidates", () => {
    const plain =
      "Sadales ķēde aizmugurē; risks pieaug virs 200 000 km. Remonts orientējoši 800 EUR. Turbo aktuators var iesprūst.";
    const claims = extractClaimsFromPlain(plain, "N57D30");
    expect(claims.length).toBeGreaterThan(0);
    expect(claims.every((c) => !/EUR|€/i.test(c.claim))).toBe(true);
    expect(claims.some((c) => /ķēd/i.test(c.claim))).toBe(true);
  });

  it("dropEurSentences removes euro lines", () => {
    expect(dropEurSentences("Ķēde aizmugurē. Tāme 400 €. Turbo var svilpt.")).not.toMatch(/€/);
  });

  it("does not prefer EUR paragraphs when TRAINING_V2 is on", () => {
    const prev = process.env.TRAINING_V2;
    process.env.TRAINING_V2 = "1";
    try {
      const lesson = distillLesson(
        "Hidrotransformators paliek uzturēšanas punkts šajā posmā, un slodzes maiņa to padara jūtamāku.\n\nRemonts 1200 EUR pie neatkarīgā servisa.\n\nEGR dzesētājs šim dzinējam ir tipiska kaite pēc 180 000 km, ja serviss to nav fiksējis.",
        "Tehnika",
      );
      expect(lesson).toBeTruthy();
      expect(lesson).not.toMatch(/EUR|€/i);
    } finally {
      if (prev === undefined) delete process.env.TRAINING_V2;
      else process.env.TRAINING_V2 = prev;
    }
  });

  it("upserts duplicate claims by raising seenCount", () => {
    const doc = emptyKnowledgeItemsDoc();
    const [a] = claimsToCandidateItems({
      aggregate: "N57D30",
      claims: [{ claim: "N57D30: ķēde aizmugurē virs 200000 km", horizon: "now" }],
      sessionId: "cs_1",
    });
    const [b] = claimsToCandidateItems({
      aggregate: "N57D30",
      claims: [{ claim: "N57D30: ķēde aizmugurē virs 200000 km", horizon: "now" }],
      sessionId: "cs_2",
    });
    upsertCandidateItem(doc, a!);
    const saved = upsertCandidateItem(doc, b!);
    expect(Object.keys(doc.items)).toHaveLength(1);
    expect(saved.seenCount).toBe(2);
    expect(saved.fromOrders).toEqual(["cs_1", "cs_2"]);
  });

  it("approve injects as fact and reject as negative list", () => {
    const doc = emptyKnowledgeItemsDoc();
    const [cand] = claimsToCandidateItems({
      aggregate: "N57D30",
      claims: [{ claim: "N57D30: šāles ir kaite", horizon: "now" }],
      sessionId: "cs_1",
    });
    upsertCandidateItem(doc, cand!);
    doc.items[cand!.id] = applyKnowledgeReview(cand!, "approve", { by: "admin" });
    const [bad] = claimsToCandidateItems({
      aggregate: "N57D30",
      claims: [{ claim: "N57D30: šāles nav kaite", horizon: "now" }],
      sessionId: "cs_2",
    });
    const rejected = applyKnowledgeReview(bad!, "reject", { by: "admin", reason: "nav kaite" });
    doc.items[rejected.id] = rejected;
    const { approved, rejected: neg } = itemsForAiContext(doc, ["N57D30"]);
    expect(approved).toHaveLength(1);
    expect(neg).toHaveLength(1);
    const text = formatKnowledgeItemsForAi(approved, neg);
    expect(text).toMatch(/Apstiprinātās/);
    expect(text).toMatch(/Nepareizi apgalvojumi/);
    expect(text).toMatch(/nav kaite/);
  });

  it("flags a conflicting candidate", () => {
    const doc = emptyKnowledgeItemsDoc();
    const [a] = claimsToCandidateItems({
      aggregate: "N57D30",
      claims: [{ claim: "N57D30: šāles ir sistēmiska kaite pie 200000 km", horizon: "now" }],
      sessionId: "cs_1",
    });
    doc.items[a!.id] = applyKnowledgeReview(a!, "approve", { by: "admin" });
    const [c] = claimsToCandidateItems({
      aggregate: "N57D30",
      claims: [{ claim: "N57D30: šāles nav sistēmiska kaite pie 200000 km", horizon: "now" }],
      sessionId: "cs_2",
    });
    expect(conflictWarningFor(doc, c!)).toMatch(/pretrunā/);
    expect(findConflictClaim(c!.claim, [a!.claim])).toBeTruthy();
  });

  it("soft-deletes with history", () => {
    const [a] = claimsToCandidateItems({
      aggregate: "EA288",
      claims: [{ claim: "EA288: eļļas sūknis pie 180000 km", horizon: "now" }],
      sessionId: "cs_9",
    });
    const deleted = applyKnowledgeReview(a!, "delete", { by: "admin" });
    expect(deleted.status).toBe("deleted");
    expect(deleted.history.some((h) => h.action === "delete")).toBe(true);
    const doc = emptyKnowledgeItemsDoc();
    doc.items[deleted.id] = deleted;
    expect(summarizeKnowledgeByAggregate(doc)[0]?.deleted).toBe(1);
  });
});
