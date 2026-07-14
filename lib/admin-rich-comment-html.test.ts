import { describe, expect, it } from "vitest";
import {
  adminRichHtmlToPdfSafeHtml,
  geminiExpertSourceCommentToRichHtml,
  geminiPlainTextToRichHtml,
  normalizeGeminiClientPlainText,
  normalizeGeminiExpertParagraphText,
  normalizePastedAdminRichHtml,
  promoteInlineStyleSemantics,
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

  it("does not double-space contentEditable div lines with trailing br", () => {
    const html =
      "<div><strong>11.2023</strong><br></div><div>Eļļas un eļļas filtru maiņa;<br></div><div>Ford Eļļas apkope (IOLM).<br></div>";
    const out = adminRichHtmlToPdfSafeHtml(html);
    expect(out).not.toContain("<br /><br />");
    expect(out).toBe(
      "<strong>11.2023</strong><br />Eļļas un eļļas filtru maiņa;<br />Ford Eļļas apkope (IOLM).",
    );
  });

  it("does not double-space paragraph blocks", () => {
    const html = "<p><strong>11.2023</strong></p><p>Eļļas un eļļas filtru maiņa;</p>";
    const out = adminRichHtmlToPdfSafeHtml(html);
    expect(out).not.toContain("<br /><br />");
    expect(out).toBe("<strong>11.2023</strong><br />Eļļas un eļļas filtru maiņa;");
  });

  it("preserves intentional blank line from empty contentEditable block", () => {
    const html = "<div>Pirma rinda</div><div><br></div><div>Otra rinda</div>";
    const out = adminRichHtmlToPdfSafeHtml(html);
    expect(out).toBe("Pirma rinda<br /><br />Otra rinda");
  });

  it("preserves bold from pasted span font-weight styles", () => {
    const html =
      '<span style="font-family:Calibri;font-size:11pt;font-weight:bold">11.2023</span>';
    const out = adminRichHtmlToPdfSafeHtml(html);
    expect(out).toContain("<strong>11.2023</strong>");
  });
});

describe("normalizePastedAdminRichHtml", () => {
  it("strips pasted font family and size but keeps bold", () => {
    const pasted =
      '<p class="MsoNormal"><span style="font-size:14pt;font-family:Arial;font-weight:bold">11.2023</span><span style="font-size:14pt;font-family:Arial"> teksts</span></p>';
    const out = normalizePastedAdminRichHtml(pasted);
    expect(out).not.toContain("font-family");
    expect(out).not.toContain("font-size");
    expect(out).not.toContain("MsoNormal");
    expect(out).toContain("<strong>11.2023</strong>");
  });

  it("keeps allowed text color from paste", () => {
    const pasted = '<span style="color:#ef4444;font-size:16px;font-family:Georgia">Sarkans</span>';
    const out = normalizePastedAdminRichHtml(pasted);
    expect(out).toContain('style="color:#ef4444"');
    expect(out).not.toContain("font-family");
    expect(out).not.toContain("font-size");
  });
});

describe("promoteInlineStyleSemantics", () => {
  it("promotes italic and underline spans", () => {
    const html = '<span style="font-style:italic;text-decoration:underline">Teksts</span>';
    expect(promoteInlineStyleSemantics(html)).toBe("<em><u>Teksts</u></em>");
  });
});

describe("geminiPlainTextToRichHtml", () => {
  it("normalizes then wraps lines", () => {
    expect(geminiPlainTextToRichHtml("* Punkts")).toBe("- Punkts");
  });
});

describe("normalizeGeminiExpertParagraphText", () => {
  it("strips leading hyphen bullets", () => {
    expect(normalizeGeminiExpertParagraphText("- Pirmais\n- Otrais")).toBe("Pirmais\nOtrais");
  });

  it("converts ANOMĀLIJA prefix to bold hook", () => {
    expect(normalizeGeminiExpertParagraphText("ANOMĀLIJA: nobraukums")).toBe("**Anomālija:** nobraukums");
  });
});

describe("geminiExpertSourceCommentToRichHtml", () => {
  it("preserves bold and strips list prefixes at line start", () => {
    const html = geminiExpertSourceCommentToRichHtml("**Nobraukums.**\n\n- Fakts bez saraksta.");
    expect(html).toContain("<strong>Nobraukums.</strong>");
    expect(html).not.toMatch(/<br \/>- Fakts/);
    expect(html).toContain("Fakts bez saraksta.");
  });
});
