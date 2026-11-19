import { describe, expect, it } from "vitest";
import {
  dealerSendStatusLine,
  isAwaitingReviewRequest,
  lastDealerSend,
  parseOrderClientMarks,
  withDealerSend,
  withReviewRequested,
} from "@/lib/order-client-marks";

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse("2026-11-19T12:00:00.000Z");
const ago = (d: number) => new Date(NOW - d * DAY).toISOString();

describe("review request queue", () => {
  it("waits for orders delivered at least 2 days ago that were not asked yet", () => {
    expect(isAwaitingReviewRequest({ completedAt: ago(2), nowMs: NOW })).toBe(true);
    expect(isAwaitingReviewRequest({ completedAt: ago(10), nowMs: NOW })).toBe(true);
  });

  it("skips fresh, very old, unfinished, already asked and B2B orders", () => {
    expect(isAwaitingReviewRequest({ completedAt: ago(1), nowMs: NOW })).toBe(false);
    expect(isAwaitingReviewRequest({ completedAt: ago(45), nowMs: NOW })).toBe(false);
    expect(isAwaitingReviewRequest({ completedAt: null, nowMs: NOW })).toBe(false);
    expect(isAwaitingReviewRequest({ completedAt: ago(3), reviewRequestedAt: ago(1), nowMs: NOW })).toBe(false);
    expect(isAwaitingReviewRequest({ completedAt: ago(3), b2b: true, nowMs: NOW })).toBe(false);
  });

  it("a dealer message with a review request marks the order so it is not asked twice", () => {
    const marks = withDealerSend({}, { at: ago(0), channel: "whatsapp", situation: "ready", offer: false, review: true });
    expect(marks.reviewRequestedAt).toBe(ago(0));
    expect(isAwaitingReviewRequest({ completedAt: ago(3), reviewRequestedAt: marks.reviewRequestedAt, nowMs: NOW })).toBe(false);
    const again = withReviewRequested(marks, "email", ago(-1));
    expect(again.reviewRequestChannel).toBe("email");
  });
});

describe("dealer send log", () => {
  it("shows the last send under the button", () => {
    expect(dealerSendStatusLine(null)).toBe("Nav sūtīts");
    const marks = withDealerSend({}, { at: "2026-11-19T12:32:00.000Z", channel: "email", situation: "ready", offer: true, review: false });
    expect(dealerSendStatusLine(lastDealerSend(marks))).toBe("E-pasts · 19.11 14:32 · ar piedāvājumu");
  });

  it("parses stored marks defensively", () => {
    expect(parseOrderClientMarks(null)).toEqual({});
    const parsed = parseOrderClientMarks({
      dealerSends: [{ at: "x", channel: "fax", situation: "ready" }, { at: "2026-11-19T10:00:00Z", channel: "email", situation: "no_data" }],
      reviewRequestedAt: "2026-11-19T10:00:00Z",
    });
    expect(parsed.dealerSends).toEqual([{ at: "2026-11-19T10:00:00Z", channel: "email", situation: "no_data", offer: false, review: false }]);
    expect(parsed.reviewRequestedAt).toBe("2026-11-19T10:00:00Z");
  });
});
