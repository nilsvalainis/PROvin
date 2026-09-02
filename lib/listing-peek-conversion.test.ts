import { describe, expect, it } from "vitest";
import { buildListingPeekConversionStats } from "@/lib/listing-peek-conversion";

const peek = (over: Partial<{ id: string; email: string; phone: string; createdAt: string; commentSentAt: string }>) => ({
  id: "p1",
  email: "a@provin.lv",
  phone: "+37126111111",
  createdAt: "2026-08-01T10:00:00.000Z",
  commentSentAt: "2026-08-01T12:00:00.000Z",
  ...over,
});

const paid = (over: Partial<{
  id: string;
  created: number;
  amountTotal: number | null;
  checkoutLine: string | null;
  isDemo: boolean;
  emails: Array<string | null>;
  phones: Array<string | null>;
}>) => ({
  id: "cs_1",
  created: Date.parse("2026-08-02T10:00:00.000Z") / 1000,
  amountTotal: 7999,
  checkoutLine: "premium" as string | null,
  isDemo: false,
  emails: ["a@provin.lv"] as Array<string | null>,
  phones: [] as Array<string | null>,
  ...over,
});

describe("buildListingPeekConversionStats", () => {
  it("returns empty stats when there are no peeks", () => {
    const stats = buildListingPeekConversionStats([], [paid({})]);
    expect(stats.uniquePeople).toBe(0);
    expect(stats.convertedPeople).toBe(0);
    expect(stats.conversionRatePct).toBeNull();
  });

  it("ignores unanswered peeks even if they later paid", () => {
    const stats = buildListingPeekConversionStats(
      [peek({ commentSentAt: undefined })],
      [paid({})],
    );
    expect(stats.peekCount).toBe(0);
    expect(stats.skippedPeeks).toBe(1);
    expect(stats.uniquePeople).toBe(0);
    expect(stats.convertedPeople).toBe(0);
  });

  it("counts a later paid order on the same email as conversion", () => {
    const stats = buildListingPeekConversionStats([peek({})], [paid({})]);
    expect(stats.peekCount).toBe(1);
    expect(stats.commentSentPeeks).toBe(1);
    expect(stats.uniquePeople).toBe(1);
    expect(stats.convertedPeople).toBe(1);
    expect(stats.conversionRatePct).toBe(100);
    expect(stats.orderCount).toBe(1);
    expect(stats.revenueCents).toBe(7999);
    expect(stats.byProduct).toEqual([{ label: "PROVIN AUDITS", people: 1 }]);
  });

  it("matches on phone when emails differ", () => {
    const stats = buildListingPeekConversionStats(
      [peek({ email: "peek@provin.lv", phone: "+371 26 111 111" })],
      [paid({ emails: ["order@provin.lv"], phones: ["26111111"], checkoutLine: "mini", amountTotal: 3999 })],
    );
    expect(stats.convertedPeople).toBe(1);
    expect(stats.byProduct[0]?.label).toBe("PROVIN MINI");
  });

  it("does not count a payment that happened before the reply", () => {
    const stats = buildListingPeekConversionStats(
      [peek({ commentSentAt: "2026-08-10T10:00:00.000Z" })],
      [paid({ created: Date.parse("2026-08-01T10:00:00.000Z") / 1000 })],
    );
    expect(stats.uniquePeople).toBe(1);
    expect(stats.convertedPeople).toBe(0);
    expect(stats.conversionRatePct).toBe(0);
  });

  it("treats two answered peeks with the same email as one person", () => {
    const stats = buildListingPeekConversionStats(
      [
        peek({ id: "p1", createdAt: "2026-08-01T10:00:00.000Z", commentSentAt: "2026-08-01T12:00:00.000Z" }),
        peek({ id: "p2", createdAt: "2026-08-03T10:00:00.000Z", commentSentAt: "2026-08-03T12:00:00.000Z" }),
      ],
      [paid({})],
    );
    expect(stats.peekCount).toBe(2);
    expect(stats.uniquePeople).toBe(1);
    expect(stats.convertedPeople).toBe(1);
  });

  it("skips demo orders and skipped peeks", () => {
    const stats = buildListingPeekConversionStats(
      [
        peek({ id: "keep" }),
        peek({ id: "skip", email: "nils.valainis@gmail.com" }),
      ],
      [paid({ isDemo: true }), paid({ id: "cs_live" })],
      { skipPeek: (p) => p.email === "nils.valainis@gmail.com" },
    );
    expect(stats.skippedPeeks).toBe(1);
    expect(stats.peekCount).toBe(1);
    expect(stats.convertedPeople).toBe(1);
  });

  it("counts telegram as a paid product in the breakdown", () => {
    const stats = buildListingPeekConversionStats(
      [peek({})],
      [paid({ amountTotal: 999, checkoutLine: "audit" })],
    );
    expect(stats.convertedPeople).toBe(1);
    expect(stats.byProduct[0]?.label).toBe("Telegram grupa (9,99 €)");
  });
});
