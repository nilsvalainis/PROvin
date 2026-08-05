import { describe, expect, it } from "vitest";
import {
  LTAB_COMMENT_NO_OCTA_CLAIM,
  applyLtabCommentTemplate,
} from "@/lib/admin-ltab-comment-presets";
import { adminRichHtmlToPlainText } from "@/lib/admin-rich-comment-html";

describe("applyLtabCommentTemplate", () => {
  it("inserts template into empty comment", () => {
    const html = applyLtabCommentTemplate("", LTAB_COMMENT_NO_OCTA_CLAIM);
    expect(adminRichHtmlToPlainText(html)).toBe(LTAB_COMMENT_NO_OCTA_CLAIM);
  });

  it("appends template when comment already has text", () => {
    const html = applyLtabCommentTemplate("Esošs teksts.", LTAB_COMMENT_NO_OCTA_CLAIM);
    expect(adminRichHtmlToPlainText(html)).toContain("Esošs teksts.");
    expect(adminRichHtmlToPlainText(html)).toContain(LTAB_COMMENT_NO_OCTA_CLAIM);
  });

  it("does not duplicate identical template", () => {
    const once = applyLtabCommentTemplate("", LTAB_COMMENT_NO_OCTA_CLAIM);
    const twice = applyLtabCommentTemplate(once, LTAB_COMMENT_NO_OCTA_CLAIM);
    expect(twice).toBe(once);
  });
});
