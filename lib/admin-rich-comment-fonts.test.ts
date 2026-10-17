import { describe, expect, it } from "vitest";
import {
  ADMIN_RICH_COMMENT_SIMPLE_SIZE_OPTIONS,
  ADMIN_RICH_COMMENT_SIZE_OPTIONS,
  adminRichCommentCssOrInherit,
} from "@/lib/admin-rich-comment-fonts";

describe("admin rich comment fonts", () => {
  it("maps empty Noklusējums css to inherit so the editor can reset", () => {
    expect(adminRichCommentCssOrInherit("")).toBe("inherit");
    expect(adminRichCommentCssOrInherit("  ")).toBe("inherit");
    expect(adminRichCommentCssOrInherit("Arial, Helvetica, sans-serif")).toBe("Arial, Helvetica, sans-serif");
  });

  it("keeps a working default size option and simple small/normal/large sizes", () => {
    expect(ADMIN_RICH_COMMENT_SIZE_OPTIONS[0]).toMatchObject({ id: "default", css: "" });
    expect(ADMIN_RICH_COMMENT_SIMPLE_SIZE_OPTIONS.map((s) => s.id)).toEqual(["small", "normal", "large"]);
    expect(ADMIN_RICH_COMMENT_SIMPLE_SIZE_OPTIONS.every((s) => /^\d+px$/.test(s.css))).toBe(true);
  });
});
