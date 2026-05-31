import { describe, expect, it } from "vitest";
import { auditCompletedEmailHtml } from "@/lib/email/html-templates";
import {
  buildClientReportLegalFooterPlainText,
  getClientReportLegalFooterBlocks,
} from "@/lib/report-pdf-standards";

describe("client report legal footer", () => {
  it("blocks match PDF footer constants", () => {
    const b = getClientReportLegalFooterBlocks();
    expect(b.importantTitle).toBe("SVARĪGA INFORMĀCIJA");
    expect(b.disclaimer).toContain("digitāls datu apkopojums");
    expect(b.confidentiality).toContain("kategoriski aizliegts pavairot");
  });

  it("plain text includes key legal phrases", () => {
    const text = buildClientReportLegalFooterPlainText();
    expect(text).toContain("SVARĪGA INFORMĀCIJA");
    expect(text).toContain("digitāls datu apkopojums");
    expect(text).toContain("kategoriski aizliegts pavairot");
  });

  it("audit completed email HTML includes shared legal footer", () => {
    const html = auditCompletedEmailHtml({
      carVin: "WVWZZZ1JZXW000001",
      attachmentLines: ["PROVIN_atskaite.pdf"],
      siteOrigin: "https://provin.lv",
    });
    expect(html).toContain("SVARĪGA INFORMĀCIJA");
    expect(html).toContain("digitāls datu apkopojums");
    expect(html).toContain("kategoriski aizliegts pavairot");
    expect(html).toContain("lietosanas-noteikumi");
    expect(html).toContain("privatuma-politika");
  });
});
