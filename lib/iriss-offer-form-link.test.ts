import { describe, expect, it } from "vitest";
import { offerClientLinkDeadlineReady, pickReusableOfferClientLink } from "@/lib/iriss-offer-form-link";

describe("iriss-offer-form-link", () => {
  it("reuses the active link for this offer and skips revoked/expired or other offers", () => {
    const links = [
      { offerId: "o1", status: "revoked" as const, path: "/p/old" },
      { offerId: "o2", status: "sent" as const, path: "/p/other" },
      { offerId: "o1", status: "viewed" as const, path: "/p/live" },
    ];
    expect(pickReusableOfferClientLink(links, "o1")?.path).toBe("/p/live");
    expect(pickReusableOfferClientLink([{ offerId: "o1", status: "expired" as const, path: "/p/x" }], "o1")).toBeNull();
    expect(pickReusableOfferClientLink([], "o1")).toBeNull();
  });

  it("requires a deadline at least 5 minutes ahead before creating a new link", () => {
    const now = Date.parse("2026-10-25T10:00:00.000Z");
    expect(offerClientLinkDeadlineReady("", now)).toBe(false);
    expect(offerClientLinkDeadlineReady(undefined, now)).toBe(false);
    expect(offerClientLinkDeadlineReady("2026-10-25T10:02:00.000Z", now)).toBe(false);
    expect(offerClientLinkDeadlineReady("2026-10-27T10:00:00.000Z", now)).toBe(true);
  });
});
