import { describe, expect, it } from "vitest";
import { dealerDataJobReadyAt } from "@/lib/dealer-data-job-types";
import {
  dealerNotSentAlert,
  dealerSendRecordFromInput,
  dealerSendStatusLine,
  formatRigaDateTime,
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
    expect(dealerSendStatusLine(null)).toBe("Nav nosūtīts");
    const marks = withDealerSend({}, { at: "2026-11-19T12:32:00.000Z", channel: "email", situation: "ready", offer: true, review: false });
    expect(dealerSendStatusLine(lastDealerSend(marks))).toBe(
      "Nosūtīts klientam: 19.11.2026 14:32 (Atskaite gatava, e-pasts, ar piedāvājumu)",
    );
    const refund = withDealerSend(marks, { at: "2026-07-01T21:05:00.000Z", channel: "whatsapp", situation: "no_data", offer: false, review: false });
    // Vasarā UTC+3; jaunākais ieraksts ir pēdējais.
    expect(dealerSendStatusLine(lastDealerSend(refund))).toBe("Nosūtīts klientam: 02.07.2026 00:05 (Datu nav - atmaksa, whatsapp)");
  });

  it("formats Riga date with full year", () => {
    expect(formatRigaDateTime("2026-12-31T22:30:00.000Z")).toBe("01.01.2027 00:30");
    expect(formatRigaDateTime("nav")).toBe("");
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

describe("server-side dealer send record", () => {
  it("validates input the same way as dealer_send and never stores an email address", () => {
    const at = "2026-11-21T10:00:00.000Z";
    expect(dealerSendRecordFromInput({ situation: "no_data", offer: true }, "email", at, "ready")).toEqual({
      at,
      channel: "email",
      situation: "no_data",
      offer: false,
      review: false,
    });
    expect(dealerSendRecordFromInput({ situation: "bogus" }, "email", at, "ready").situation).toBe("ready");
    // multipart formā vērtības ir teksts
    expect(dealerSendRecordFromInput({ situation: "ready", offer: "true", review: "true" }, "email", at, "no_data")).toMatchObject({
      offer: true,
      // 22.11: atsauksmes lūgums drīkst būt kopā ar piedāvājumu
      review: true,
    });
    expect(dealerSendRecordFromInput({ situation: "ready", review: true }, "email", at, "no_data").review).toBe(true);
    const rec = dealerSendRecordFromInput({ situation: "ready", to: "a@b.lv" } as never, "email", at, "ready");
    expect(JSON.stringify(rec)).not.toContain("@");
  });
});

describe("«Nav nosūtīts» list alert", () => {
  const H = 60 * 60 * 1000;
  const now = Date.parse("2026-11-21T12:00:00.000Z");
  const iso = (msAgo: number) => new Date(now - msAgo).toISOString();

  it("shows only when data has been ready for more than 2 h and nothing was sent", () => {
    expect(dealerNotSentAlert({ readyAt: iso(3 * H), marks: {}, nowMs: now })).toBe(true);
    expect(dealerNotSentAlert({ readyAt: iso(1 * H), marks: {}, nowMs: now })).toBe(false);
    expect(dealerNotSentAlert({ readyAt: null, marks: {}, nowMs: now })).toBe(false);
    const sent = withDealerSend({}, { at: iso(0), channel: "email", situation: "ready", offer: false, review: false });
    expect(dealerNotSentAlert({ readyAt: iso(3 * H), marks: sent, nowMs: now })).toBe(false);
  });

  it("ready time comes from the dealer job only when data is ready", () => {
    const base = { updatedAt: iso(0), finishedAt: iso(H), draftWrittenAt: iso(2 * H) };
    expect(dealerDataJobReadyAt({ ...base, status: "done" })).toBe(iso(2 * H));
    expect(dealerDataJobReadyAt({ updatedAt: iso(0), finishedAt: iso(H), status: "done" })).toBe(iso(H));
    expect(dealerDataJobReadyAt({ ...base, status: "failed", error: "vin_decode:timeout" })).toBe(iso(2 * H));
    expect(dealerDataJobReadyAt({ ...base, status: "running" })).toBeNull();
    expect(dealerDataJobReadyAt({ ...base, status: "no_data" })).toBeNull();
    expect(dealerDataJobReadyAt(null)).toBeNull();
  });
});
