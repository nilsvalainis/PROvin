import { describe, expect, it } from "vitest";
import {
  buildPdfRunningFooterLine,
  buildPdfRunningHeaderLine,
  clientReportRunningPageCss,
  cssContentString,
} from "@/lib/pdf-running-page";

describe("PDF running header and footer", () => {
  it("builds PROVIN.LV · auto · VIN header and VIN · date · Sagatavots footer", () => {
    expect(buildPdfRunningHeaderLine("BMW 525d", "WBAPX51050CU09550")).toBe(
      "PROVIN.LV · BMW 525d · VIN WBAPX51050CU09550",
    );
    expect(
      buildPdfRunningFooterLine({
        vin: "WBAPX51050CU09550",
        dateLabel: "30.09.2026",
        preparedBy: "Jānis B.",
      }),
    ).toBe("WBAPX51050CU09550 · 30.09.2026 · Sagatavots klientam: Jānis B.");
  });

  it("puts page numbers only on the right and nothing in the middle", () => {
    const css = clientReportRunningPageCss({
      header: "PROVIN.LV · BMW 525d · VIN WBAPX51050CU09550",
      footer: "WBAPX51050CU09550 · 30.09.2026 · Sagatavots klientam: Jānis B.",
    });
    expect(css).toContain("margin:16mm 12mm 18mm 12mm");
    expect(css).toContain('@bottom-center{content:none;}');
    expect(css).toContain('content:"Lapa " counter(page) " / " counter(pages)');
    expect(css).toContain("@top-right{content:none;}");
  });

  it("localizes the page counter and prepared-for prefix", () => {
    expect(
      buildPdfRunningFooterLine({
        vin: "WBAPX51050CU09550",
        dateLabel: "30.09.2026",
        preparedBy: "Jānis B.",
        lang: "en",
      }),
    ).toBe("WBAPX51050CU09550 · 30.09.2026 · Prepared for: Jānis B.");
    expect(
      buildPdfRunningFooterLine({
        vin: "WBAPX51050CU09550",
        dateLabel: "30.09.2026",
        preparedBy: "Jānis B.",
        lang: "ru",
      }),
    ).toBe("WBAPX51050CU09550 · 30.09.2026 · Подготовлено для: Jānis B.");
    expect(
      buildPdfRunningFooterLine({
        vin: "WBAPX51050CU09550",
        dateLabel: "30.09.2026",
        preparedBy: "Jānis B.",
        lang: "de",
      }),
    ).toBe("WBAPX51050CU09550 · 30.09.2026 · Erstellt für: Jānis B.");
    expect(clientReportRunningPageCss({ lang: "en" })).toContain('content:"Page " counter(page)');
    expect(clientReportRunningPageCss({ lang: "ru" })).toContain('content:"Страница " counter(page)');
    expect(clientReportRunningPageCss({ lang: "de" })).toContain('content:"Seite " counter(page)');
    expect(clientReportRunningPageCss({ lang: "en" })).not.toContain("Lapa ");
    expect(
      buildPdfRunningFooterLine({
        vin: "WBAPX51050CU09550",
        dateLabel: "18.10.2026",
        preparedBy: "Jānis B.",
        lang: "de",
      }),
    ).toContain("für");
  });
});

describe("cssContentString", () => {
  it("parasts teksts paliek nemainīts", () => {
    const line = "PROVIN.LV · BMW 525d · VIN WBAPX51050CU09550 · 30.09.2026 · Sagatavots klientam: Jānis B.";
    expect(cssContentString(line)).toBe(line);
    expect(cssContentString("Страница Ünïcödé (2020) 100%")).toBe("Страница Ünïcödé (2020) 100%");
  });

  it("īpašās zīmes pieraksta kā heksadecimālu kodu", () => {
    expect(cssContentString('a"b')).toBe("a\\22 b");
    expect(cssContentString("a\\b")).toBe("a\\5c b");
    expect(cssContentString("O'Nīls & Co / SIA")).toBe("O\\27 Nīls \\26  Co \\2f  SIA");
  });

  it("rezultātā nav zīmju, kas var izbeigt virkni vai stila bloku", () => {
    const inputs = [
      '</style><script src="//x.tld/a.js"></script>',
      '";}</style><img src=x>',
      "a\nb\r\nc d\u0000e\fz",
      "x\\",
      "*/ } @import url(x); {",
      "<!-- --> ]]> &lt; &#60;",
      "`${1}` 'a' =",
    ];
    for (const input of inputs) {
      const out = cssContentString(input);
      expect(out, input).toMatch(/^(?:[\p{L}\p{N} .,\-·:()+_#!?%]|\\[0-9a-f]{1,6} )*$/u);
      const css = clientReportRunningPageCss({ header: input, footer: input });
      expect(css, input).not.toMatch(/<|>|&/);
      expect(css.match(/"/g)?.length, input).toBe(8);
      expect(css).not.toMatch(/[\n\r]\S*[\n\r]{2,}/);
    }
  });

  it("rindu pārtraukumi kļūst par atstarpi", () => {
    expect(cssContentString("a\nb")).toBe("a b");
  });
});
