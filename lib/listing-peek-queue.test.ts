import { describe, expect, it } from "vitest";
import {
  LISTING_PEEK_QUEUE_LIMIT_DEFAULT,
  countOpenListingPeeks,
  getListingPeekQueueLimit,
  isListingPeekQueuePaused,
  isOpenListingPeekWork,
} from "@/lib/listing-peek-queue";

describe("listing-peek-queue", () => {
  it("treats new and in_progress as open work", () => {
    expect(isOpenListingPeekWork({ status: "new" })).toBe(true);
    expect(isOpenListingPeekWork({ status: "in_progress" })).toBe(true);
    expect(isOpenListingPeekWork({ status: "completed" })).toBe(false);
    expect(isOpenListingPeekWork({ status: "rejected" })).toBe(false);
  });

  it("counts open peeks like the admin pending list", () => {
    expect(
      countOpenListingPeeks([
        { status: "new" },
        { status: "in_progress" },
        { status: "completed" },
        { status: "rejected" },
        { status: "new" },
      ]),
    ).toBe(3);
  });

  it("defaults queue limit to 10 and pauses at the threshold", () => {
    expect(getListingPeekQueueLimit(undefined)).toBe(LISTING_PEEK_QUEUE_LIMIT_DEFAULT);
    expect(getListingPeekQueueLimit("")).toBe(10);
    expect(getListingPeekQueueLimit("8")).toBe(8);
    expect(getListingPeekQueueLimit("0")).toBe(10);
    expect(getListingPeekQueueLimit("abc")).toBe(10);
    expect(isListingPeekQueuePaused(9, 10)).toBe(false);
    expect(isListingPeekQueuePaused(10, 10)).toBe(true);
    expect(isListingPeekQueuePaused(11, 10)).toBe(true);
  });
});
