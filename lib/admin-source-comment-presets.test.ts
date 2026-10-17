import { describe, expect, it } from "vitest";
import { CSDD_COMMENT_TEMPLATES } from "@/lib/admin-csdd-comment-presets";
import { LTAB_COMMENT_TEMPLATES } from "@/lib/admin-ltab-comment-presets";
import {
  applySourceCommentTemplate,
  SHARED_SOURCE_COMMENT_TEMPLATES,
} from "@/lib/admin-source-comment-presets";

const UNICODE_DASH_RE = /[\u2012\u2013\u2014\u2015\u2212]/;

describe("source comment templates", () => {
  it("uses ASCII hyphen in the shared LV-not-registered button", () => {
    const t = SHARED_SOURCE_COMMENT_TEMPLATES.find((x) => x.id === "not_applicable_lv");
    expect(t?.text).toBe("Nav piemērojams - auto nav reģistrēts LV.");
    expect(t?.text).not.toMatch(UNICODE_DASH_RE);
  });

  it("has no long dashes in shared, CSDD or LTAB template texts", () => {
    const texts = [
      ...SHARED_SOURCE_COMMENT_TEMPLATES,
      ...CSDD_COMMENT_TEMPLATES,
      ...LTAB_COMMENT_TEMPLATES,
    ].map((t) => `${t.label}\n${t.text}`);
    expect(texts.filter((t) => UNICODE_DASH_RE.test(t))).toEqual([]);
  });

  it("appends a template without replacing existing comment", () => {
    const first = applySourceCommentTemplate("", "Nav piemērojams - auto nav reģistrēts LV.");
    expect(first).toContain("Nav piemērojams - auto nav reģistrēts LV.");
    const again = applySourceCommentTemplate(first, "Nav piemērojams - auto nav reģistrēts LV.");
    expect(again).toBe(first);
    const extra = applySourceCommentTemplate(first, "Avots nedeva datus.");
    expect(extra).toContain("Nav piemērojams");
    expect(extra).toContain("Avots nedeva datus.");
  });
});
