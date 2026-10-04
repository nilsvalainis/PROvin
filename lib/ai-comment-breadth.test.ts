import { describe, expect, it } from "vitest";
import {
  commentBreadthMaxChars,
  defaultFlashMaxJobBreadth,
  parseCommentBreadth,
  parseCommentBreadthFromPrompt,
  sourceCommentLengthLineForBreadth,
} from "@/lib/ai-comment-breadth";
import { COMMENT_LENGTH_BUDGET, commentQualityMaxChars } from "@/lib/ai-comment-length-budget";

describe("comment breadth", () => {
  it("parses FLASH MAX tokens", () => {
    expect(parseCommentBreadth("compact")).toBe("compact");
    expect(parseCommentBreadth("Plašs")).toBe("wide");
    expect(parseCommentBreadth("nope")).toBeNull();
  });

  it("reads the breadth marker from the prompt", () => {
    expect(parseCommentBreadthFromPrompt("### Komentāra platums (FLASH MAX): KOMPAKTS\n- x")).toBe(
      "compact",
    );
    expect(parseCommentBreadthFromPrompt("nav platuma")).toBeNull();
  });

  it("keeps summary jobs wide and source jobs compact by default", () => {
    expect(defaultFlashMaxJobBreadth("citi_avoti:1")).toBe("compact");
    expect(defaultFlashMaxJobBreadth("inspection")).toBe("wide");
  });

  it("caps compact source comments below the raised budget", () => {
    const compactPrompt = "### Komentāra platums (FLASH MAX): KOMPAKTS\n- Ikdienas stils";
    expect(commentQualityMaxChars("source", compactPrompt)).toBe(900);
    expect(commentQualityMaxChars("source", compactPrompt)).toBeLessThan(
      COMMENT_LENGTH_BUDGET.source.maxChars,
    );
    expect(commentBreadthMaxChars("source", "wide", 4000)).toBe(4000);
  });

  it("writes a compact length line for FLASH MAX source comments", () => {
    expect(sourceCommentLengthLineForBreadth("compact", false)).toMatch(/KOMPAKTS/);
    expect(sourceCommentLengthLineForBreadth(null, false)).toMatch(/1 rindkopa/);
  });
});
