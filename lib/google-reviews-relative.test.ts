import { describe, expect, it } from "vitest";
import { formatGoogleReviewRelativeDate } from "./google-reviews-relative";

describe("formatGoogleReviewRelativeDate", () => {
  it("uses the page locale, not Latvian copy on EN/DE/RU", () => {
    const rel = { value: 2, unit: "day" as const };
    expect(formatGoogleReviewRelativeDate("lv", rel).toLowerCase()).toContain("dien");
    expect(formatGoogleReviewRelativeDate("en", rel).toLowerCase()).toContain("day");
    expect(formatGoogleReviewRelativeDate("de", rel).toLowerCase()).toContain("tag");
    expect(formatGoogleReviewRelativeDate("ru", rel).toLowerCase()).toMatch(/дн/);
    expect(formatGoogleReviewRelativeDate("en", rel)).not.toMatch(/pirms/i);
  });

  it("formats hours and weeks", () => {
    expect(formatGoogleReviewRelativeDate("en", { value: 19, unit: "hour" }).toLowerCase()).toContain("hour");
    expect(formatGoogleReviewRelativeDate("en", { value: 4, unit: "week" }).toLowerCase()).toContain("week");
  });
});
