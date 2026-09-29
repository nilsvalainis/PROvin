import { describe, expect, it } from "vitest";
import { userscriptVersionAllowsListingHistoryFetch } from "@/lib/admin-listing-history-client";

describe("userscriptVersionAllowsListingHistoryFetch", () => {
  it("requires 1.8+", () => {
    expect(userscriptVersionAllowsListingHistoryFetch("")).toBe(false);
    expect(userscriptVersionAllowsListingHistoryFetch("1.7.4")).toBe(false);
    expect(userscriptVersionAllowsListingHistoryFetch("1.8.0")).toBe(true);
    expect(userscriptVersionAllowsListingHistoryFetch("1.9.1")).toBe(true);
    expect(userscriptVersionAllowsListingHistoryFetch("2.0.0")).toBe(true);
  });
});
