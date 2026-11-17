import { describe, expect, it } from "vitest";
import { embedReportInterFonts, reportInterFontFaceCss } from "@/lib/report-pdf-fonts";

const HTML = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
<title>x</title></head><body>a</body></html>`;

describe("servera PDF fonti", () => {
  it("Google Fonts saites vietā iegults Inter galvenē", () => {
    const css = reportInterFontFaceCss([{ base64: "QUJD", unicodeRange: "U+0000-00FF" }]);
    const out = embedReportInterFonts(HTML, css);
    expect(out).not.toContain("fonts.googleapis.com");
    expect(out).not.toContain("fonts.gstatic.com");
    expect(out).toContain("font-family:'Inter'");
    expect(out).toContain("data:font/woff2;base64,QUJD");
    expect(out).toContain("font-weight:100 900");
    expect(out.indexOf("data-provin-inter")).toBeLessThan(out.indexOf("</head>"));
    expect(out).toContain("<body>a</body>");
  });
});
