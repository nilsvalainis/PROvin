import { describe, expect, it } from "vitest";
import { eachIsoDateInclusive, parseAdSpendCsv } from "@/lib/admin-ad-spend";

describe("parseAdSpendCsv", () => {
  it("imports Google Ads style columns and a date range", () => {
    const csv = [
      "date,channel,campaign,spend,clicks,impressions",
      "2026-10-01,google,vin-audit,45.00,120,4000",
      "2026-10-02,Meta,reels,30,80,2500",
    ].join("\n");
    const parsed = parseAdSpendCsv(csv);
    expect(parsed.errors).toEqual([]);
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[0]?.channel).toBe("google");
    expect(parsed.rows[0]?.impressions).toBe(4000);
    expect(parsed.rows[1]?.channel).toBe("meta");
  });

  it("accepts Latvian headers and semicolon separators", () => {
    const csv = "datums;kanāls;kampaņa;izdevumi\n2026-10-03;tiktok;q4;12,5";
    const parsed = parseAdSpendCsv(csv);
    expect(parsed.rows[0]?.spendEur).toBe(12.5);
    expect(parsed.rows[0]?.channel).toBe("tiktok");
  });
});

describe("eachIsoDateInclusive", () => {
  it("lists each day in a spend range", () => {
    expect(eachIsoDateInclusive("2026-10-01", "2026-10-03")).toEqual([
      "2026-10-01",
      "2026-10-02",
      "2026-10-03",
    ]);
  });
});
