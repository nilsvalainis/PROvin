import { describe, expect, it } from "vitest";
import { emptyGoogleContactMatchIndex, indexGoogleContactPhonesAndEmails } from "@/lib/google-contact-match";
import {
  decideGoogleContactBackfillRow,
  emptyGoogleContactBackfillCounts,
  formatGoogleContactBackfillConfirmLv,
  formatGoogleContactBackfillDryRunLv,
  formatGoogleContactBackfillResultLv,
  mergeGoogleContactBackfillCounts,
  nextGoogleContactBackfillCursor,
  parseGoogleContactBackfillQuery,
  planGoogleContactBackfillRows,
  tallyGoogleContactBackfillDecision,
} from "@/lib/google-contacts-backfill";

const dashForbidden = /[–—]/;

describe("google contacts backfill counting", () => {
  it("classifies linked, no-contact, match and create", () => {
    expect(
      decideGoogleContactBackfillRow({ googleContactResourceName: "people/1", phone: "20000000", email: "" }, null),
    ).toBe("alreadyLinked");
    expect(decideGoogleContactBackfillRow({ phone: "", email: "" }, null)).toBe("skippedNoContact");
    expect(decideGoogleContactBackfillRow({ phone: "20000000", email: "" }, "people/9")).toBe("match");
    expect(decideGoogleContactBackfillRow({ phone: "20000000", email: "" }, null)).toBe("create");
  });

  it("tallies dry-run would-create vs would-match without writes", () => {
    const dry = emptyGoogleContactBackfillCounts(4);
    tallyGoogleContactBackfillDecision(dry, "alreadyLinked", true);
    tallyGoogleContactBackfillDecision(dry, "skippedNoContact", true);
    tallyGoogleContactBackfillDecision(dry, "match", true);
    tallyGoogleContactBackfillDecision(dry, "create", true);
    expect(dry).toMatchObject({
      alreadyLinked: 1,
      skippedNoContact: 1,
      wouldMatch: 1,
      wouldCreate: 1,
      created: 0,
      matched: 0,
    });

    const live = emptyGoogleContactBackfillCounts(2);
    tallyGoogleContactBackfillDecision(live, "match", false);
    tallyGoogleContactBackfillDecision(live, "create", false);
    expect(live).toMatchObject({ created: 1, matched: 1, wouldCreate: 0, wouldMatch: 0 });
  });

  it("counts a duplicate phone in the same batch as would-match after the first would-create", () => {
    const google = emptyGoogleContactMatchIndex();
    indexGoogleContactPhonesAndEmails(google, "people/existing", { email: "old@example.com" });
    const { counts, decisions } = planGoogleContactBackfillRows(
      [
        { id: "a", googleContactResourceName: "people/1", phone: "20000000", email: "" },
        { id: "b", phone: "", email: "" },
        { id: "c", phone: "", email: "old@example.com" },
        { id: "d", phone: "21111111", email: "" },
        { id: "e", phone: "21111111", email: "copy@example.com" },
      ],
      google,
      true,
    );
    expect(decisions).toEqual(["alreadyLinked", "skippedNoContact", "match", "create", "match"]);
    expect(counts).toMatchObject({
      total: 5,
      alreadyLinked: 1,
      skippedNoContact: 1,
      wouldMatch: 2,
      wouldCreate: 1,
      created: 0,
      matched: 0,
    });
  });

  it("parses cursor/limit/dryRun and advances the batch cursor", () => {
    const url = new URL("https://www.provin.lv/api/admin/iriss-pasutijumi/google-contacts-backfill?dryRun=1&cursor=20&limit=99");
    expect(parseGoogleContactBackfillQuery(url)).toEqual({ dryRun: true, cursor: 20, limit: 40 });
    expect(nextGoogleContactBackfillCursor(0, 20, 45)).toEqual({
      nextCursor: "20",
      done: false,
      processed: 20,
    });
    expect(nextGoogleContactBackfillCursor(40, 5, 45)).toEqual({
      nextCursor: null,
      done: true,
      processed: 5,
    });
  });

  it("merges batch counts and keeps Latvian copy free of long dashes", () => {
    const acc = mergeGoogleContactBackfillCounts(
      { ...emptyGoogleContactBackfillCounts(10), alreadyLinked: 1, wouldCreate: 2, errors: [{ id: "1", error: "x" }] },
      { ...emptyGoogleContactBackfillCounts(10), skippedNoContact: 3, wouldMatch: 4, errors: [{ id: "2", error: "y" }] },
    );
    expect(acc).toMatchObject({
      total: 10,
      alreadyLinked: 1,
      skippedNoContact: 3,
      wouldCreate: 2,
      wouldMatch: 4,
    });
    expect(acc.errors).toHaveLength(2);
    const texts = [
      formatGoogleContactBackfillDryRunLv(acc),
      formatGoogleContactBackfillResultLv(acc),
      formatGoogleContactBackfillConfirmLv(acc),
    ];
    for (const text of texts) {
      expect(text).not.toMatch(dashForbidden);
      expect(text.length).toBeGreaterThan(20);
    }
  });
});
