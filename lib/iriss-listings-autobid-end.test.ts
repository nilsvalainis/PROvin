import { describe, expect, it } from "vitest";
import { listingAuctionEndLabel } from "@/lib/iriss-listings-card";
import {
  autobidAuctionEndAt,
  parseAutobidWallClock,
  wallClockInZoneToUtcIso,
} from "@/lib/iriss-listings-autobid-end";

describe("autobid auction end wall clock", () => {
  it("strips Autobid +00:00 and treats the shown clock as Europe/Berlin", () => {
    const clock = parseAutobidWallClock("2026-10-08T14:00:00+00:00");
    expect(clock).toEqual({ year: 2026, month: 10, day: 8, hour: 14, minute: 0 });
    const iso = wallClockInZoneToUtcIso(clock!);
    expect(iso).toBe("2026-10-08T12:00:00.000Z");
    expect(listingAuctionEndLabel(iso)).toBe("beidzas 08.10. 15:00");
  });

  it("parses the date+time Autobid shows on the card", () => {
    const clock = parseAutobidWallClock("08.10.2026 14:00");
    expect(clock).toEqual({ year: 2026, month: 10, day: 8, hour: 14, minute: 0 });
    expect(autobidAuctionEndAt({ auctionEndDate: "08.10.2026 14:00" })).toBe("2026-10-08T12:00:00.000Z");
  });

  it("reads auctionEndDate from the vehicle object and additionalInformation", () => {
    expect(autobidAuctionEndAt({ auctionEndDate: ["Date", "2026-10-15T16:30:00+00:00"] })).toBe(
      "2026-10-15T14:30:00.000Z",
    );
    expect(
      autobidAuctionEndAt({
        additionalInformation: { auctionEndDate: "15.10.2026, 16:30" },
      }),
    ).toBe("2026-10-15T14:30:00.000Z");
  });

  it("returns empty when Autobid does not show an end date", () => {
    expect(autobidAuctionEndAt({ auctionStartDate: "2026-10-08T08:00:00+00:00" })).toBe("");
    expect(autobidAuctionEndAt({})).toBe("");
  });
});
