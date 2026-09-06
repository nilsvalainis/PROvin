import { describe, expect, it } from "vitest";
import {
  LISTING_PHOTO_NO_DEFECTS_TEXT,
  applyListingPhotoNoDefectsTemplate,
} from "@/lib/admin-listing-photo-comment-presets";
import { adminRichHtmlToPlainText } from "@/lib/admin-rich-comment-html";

describe("Sludinājuma foto sagatave", () => {
  it("ieliek sagatavi tukšā laukā", () => {
    const html = applyListingPhotoNoDefectsTemplate("");
    expect(adminRichHtmlToPlainText(html)).toBe(LISTING_PHOTO_NO_DEFECTS_TEXT);
  });

  it("neieliek sagatavi automātiski, tikai pēc pogas, un nedublē", () => {
    const once = applyListingPhotoNoDefectsTemplate("");
    const twice = applyListingPhotoNoDefectsTemplate(once);
    expect(twice).toBe(once);
  });
});
