import { describe, expect, it } from "vitest";
import { computeHeardAboutStats } from "@/lib/admin-heard-about-stats";

const now = 1_800_000_000;
const o = (id: string, daysAgo: number, h: string | null) => ({ id, created: now - daysAgo * 86_400, heardAbout: h, label: id, amountTotal: 1000 });

describe("computeHeardAboutStats", () => {
  const list = [o("a", 1, "TikTok"), o("b", 2, "TikTok"), o("c", 40, "YouTube"), o("d", 3, " "), o("e", 100, "Facebook")];
  it("all period: counts, share, order", () => {
    const r = computeHeardAboutStats(list, "all", now);
    expect(r.rows.map((x) => [x.label, x.count])).toEqual([["TikTok", 2], ["Facebook", 1], ["YouTube", 1]]);
    expect(r.total).toBe(4);
    expect(r.rows[0]!.share).toBe(0.5);
    expect(r.withoutSource).toBe(1);
  });
  it("30 d period filters by created", () => {
    const r = computeHeardAboutStats(list, "30", now);
    expect(r.rows.map((x) => x.label)).toEqual(["TikTok"]);
    expect(r.rows[0]!.orders.map((x) => x.id)).toEqual(["a", "b"]);
  });
});
