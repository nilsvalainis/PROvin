import { describe, expect, it } from "vitest";
import {
  CSDD_COMMENT_EUCARIS_BODY_AVAILABILITY,
  CSDD_COMMENT_EUCARIS_BODY_DOCS,
  CSDD_COMMENT_EUCARIS_HEADING_AVAILABILITY,
  CSDD_COMMENT_EUCARIS_HEADING_DOCS,
  CSDD_COMMENT_EUCARIS_PLAIN,
  applyCsddCommentTemplate,
  csddEucarisCommentHtml,
} from "@/lib/admin-csdd-comment-presets";
import { adminRichHtmlToPlainText } from "@/lib/admin-rich-comment-html";

describe("applyCsddCommentTemplate", () => {
  it("inserts the EUCARIS roles as heading-then-paragraph HTML", () => {
    const html = applyCsddCommentTemplate("", CSDD_COMMENT_EUCARIS_PLAIN);
    expect(html).toContain(`<strong>${CSDD_COMMENT_EUCARIS_HEADING_AVAILABILITY}</strong>`);
    expect(html).toContain(`<strong>${CSDD_COMMENT_EUCARIS_HEADING_DOCS}</strong>`);
    expect(html).toContain(CSDD_COMMENT_EUCARIS_BODY_AVAILABILITY);
    expect(html).toContain(CSDD_COMMENT_EUCARIS_BODY_DOCS);
    expect(html).toContain("<br /><br />");
  });

  it("appends template when comment already has text", () => {
    const html = applyCsddCommentTemplate("Esošs CSDD fakts.", CSDD_COMMENT_EUCARIS_PLAIN);
    const plain = adminRichHtmlToPlainText(html);
    expect(plain).toContain("Esošs CSDD fakts.");
    expect(plain).toContain(CSDD_COMMENT_EUCARIS_HEADING_AVAILABILITY);
  });

  it("does not duplicate identical template", () => {
    const once = csddEucarisCommentHtml();
    const twice = applyCsddCommentTemplate(once, CSDD_COMMENT_EUCARIS_PLAIN);
    expect(twice).toBe(once);
  });
});
