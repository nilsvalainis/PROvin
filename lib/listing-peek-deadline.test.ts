import { describe, expect, it } from "vitest";
import {
  LISTING_PEEK_REPLY_DEADLINE_MS,
  formatListingPeekDeadlineRemaining,
  formatListingPeekSubmittedAt,
} from "@/lib/listing-peek-deadline";

const created = "2026-08-16T10:00:00.000Z";
const t0 = Date.parse(created);

describe("formatListingPeekDeadlineRemaining", () => {
  it("is ok when most of the 24 h remain", () => {
    const r = formatListingPeekDeadlineRemaining(created, t0 + 2 * 60 * 60 * 1000);
    expect(r?.status).toBe("ok");
    expect(r?.label).toMatch(/22 h/);
  });

  it("turns amber in the last 6 hours", () => {
    const r = formatListingPeekDeadlineRemaining(created, t0 + 19 * 60 * 60 * 1000);
    expect(r?.status).toBe("urgent");
    expect(r?.label).toMatch(/5 h/);
  });

  it("turns red after 24 h", () => {
    const r = formatListingPeekDeadlineRemaining(
      created,
      t0 + LISTING_PEEK_REPLY_DEADLINE_MS + 90 * 60 * 1000,
    );
    expect(r?.status).toBe("overdue");
    expect(r?.label).toMatch(/Kavējas/);
  });
});

describe("formatListingPeekSubmittedAt", () => {
  it("formats a valid ISO timestamp", () => {
    expect(formatListingPeekSubmittedAt(created)).toMatch(/\d/);
  });
});
