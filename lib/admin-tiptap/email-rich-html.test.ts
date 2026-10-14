import { describe, expect, it } from "vitest";
import {
  adminRichHtmlToEmailBodyInner,
  shouldUseRichEmailHtml,
  wrapAdminRichEmailDocument,
} from "@/lib/admin-tiptap/email-rich-html";

describe("admin rich email html", () => {
  it("uses rich path only for structured html bodies", () => {
    expect(shouldUseRichEmailHtml("Plain\n\nText")).toBe(false);
    expect(shouldUseRichEmailHtml("<p>Hi</p>")).toBe(true);
  });

  it("adds inline styles for email clients", () => {
    const inner = adminRichHtmlToEmailBodyInner("<p>Hi</p><ul><li>a</li></ul>");
    expect(inner).toContain('style="margin:0 0 12px');
    expect(inner).toContain("<ul style=");
    const doc = wrapAdminRichEmailDocument(inner);
    expect(doc).toContain("<!DOCTYPE html>");
  });
});
