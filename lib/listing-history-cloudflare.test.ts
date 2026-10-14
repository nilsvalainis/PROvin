import { describe, expect, it } from "vitest";
import { looksLikeListingHistoryCloudflareChallenge } from "@/lib/listing-history-cloudflare";

describe("looksLikeListingHistoryCloudflareChallenge", () => {
  it("detects Just a moment and challenge-platform markers", () => {
    expect(looksLikeListingHistoryCloudflareChallenge("<title>Just a moment...</title>")).toBe(true);
    expect(looksLikeListingHistoryCloudflareChallenge('<div id="challenge-platform"></div>')).toBe(true);
    expect(looksLikeListingHistoryCloudflareChallenge("<html><body>OK history</body></html>")).toBe(false);
  });
});
