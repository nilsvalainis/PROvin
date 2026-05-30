import { describe, expect, it } from "vitest";
import {
  adminRichHtmlToPdfSafeHtml,
  geminiPlainTextToRichHtml,
  normalizeGeminiClientPlainText,
} from "@/lib/admin-rich-comment-html";

describe("normalizeGeminiClientPlainText", () => {
  it("converts asterisk bullets to hyphens", () => {
    expect(normalizeGeminiClientPlainText("* Pirmais\n* Otrais")).toBe("- Pirmais\n- Otrais");
  });

  it("strips markdown bold markers", () => {
    expect(normalizeGeminiClientPlainText("**Bīstams** risks")).toBe("Bīstams risks");
  });
});

describe("adminRichHtmlToPdfSafeHtml", () => {
  it("preserves bold, italic, underline", () => {
    const html = "<p><strong>Trekns</strong> <em>kursīvs</em> <u>pasv.</u></p>";
    const out = adminRichHtmlToPdfSafeHtml(html);
    expect(out).toContain("<strong>Trekns</strong>");
    expect(out).toContain("<em>kursīvs</em>");
    expect(out).toContain("<u>pasv.</u>");
  });

  it("preserves span color and font-size", () => {
    const html = '<span style="color:#ef4444;font-size:14px">Sarkans</span>';
    const out = adminRichHtmlToPdfSafeHtml(html);
    expect(out).toContain('style="color:#ef4444;font-size:14px"');
    expect(out).toContain("Sarkans");
  });
});

describe("geminiPlainTextToRichHtml", () => {
  it("normalizes then wraps lines", () => {
    expect(geminiPlainTextToRichHtml("* Punkts")).toBe("- Punkts");
  });
});
