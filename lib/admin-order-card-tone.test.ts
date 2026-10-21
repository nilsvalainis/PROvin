import { describe, expect, it } from "vitest";
import { adminOrderCardTone } from "@/lib/admin-order-card-tone";

describe("PRO kartīšu toņi", () => {
  const now = Date.parse("2026-10-21T12:00:00Z");
  const nowS = now / 1000;
  it("colours by type first, then marks fresh audits green for 24 h", () => {
    expect(adminOrderCardTone({ createdUnix: nowS - 3600, nowMs: now, partnerHighlight: true })).toBe("partner");
    expect(adminOrderCardTone({ createdUnix: nowS - 3600, nowMs: now, dealerHighlight: true })).toBe("dealer");
    expect(adminOrderCardTone({ createdUnix: nowS - 3600, nowMs: now, miniHighlight: true })).toBe("mini");
    expect(adminOrderCardTone({ createdUnix: nowS - 3600, nowMs: now })).toBe("new");
    expect(adminOrderCardTone({ createdUnix: nowS - 30 * 3600, nowMs: now })).toBe("");
  });
  it("keeps finished orders neutral and packs separate", () => {
    expect(adminOrderCardTone({ createdUnix: nowS - 3600, nowMs: now, complete: true, miniHighlight: true })).toBe("");
    expect(adminOrderCardTone({ createdUnix: nowS - 3600, nowMs: now, isPack: true })).toBe("pack");
  });
});
