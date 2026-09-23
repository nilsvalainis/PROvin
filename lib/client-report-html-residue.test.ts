import { describe, expect, it } from "vitest";

import {
  applyHtmlTextTranslations,
  collectHtmlTextsNeedingTranslation,
  htmlTextNeedsTranslation,
  maskHtmlProtectedRegions,
  unmaskHtmlProtectedRegions,
} from "@/lib/client-report-html-residue";

describe("htmlTextNeedsTranslation", () => {
  it("flags Latvian diacritics and plain record-count phrases", () => {
    expect(htmlTextNeedsTranslation("1 - Ar pieļaujamiem defektiem")).toBe(true);
    expect(htmlTextNeedsTranslation("18 ieraksti")).toBe(true);
    expect(htmlTextNeedsTranslation("Nav ierakstu.")).toBe(true);
    expect(htmlTextNeedsTranslation("106 diena(s)")).toBe(true);
    expect(htmlTextNeedsTranslation("Benzīns")).toBe(true);
  });

  it("leaves VIN, bare numbers, brands and German workshop lines alone", () => {
    expect(htmlTextNeedsTranslation("W0L0AHL4845218313")).toBe(false);
    expect(htmlTextNeedsTranslation("174 000")).toBe(false);
    expect(htmlTextNeedsTranslation("OPEL ASTRA")).toBe(false);
    expect(htmlTextNeedsTranslation("Diagnose.")).toBe(false);
    expect(htmlTextNeedsTranslation("CSDD")).toBe(false);
  });
});

describe("collect and apply html text translations", () => {
  it("translates visible Latvian nodes and skips script and style", () => {
    const html = `<style>.x{content:"ieraksti"}</style><script>var a = "Nav ierakstu";</script><p>18 ieraksti</p><td>Benzīns</td>`;
    const masked = maskHtmlProtectedRegions(html);
    const texts = collectHtmlTextsNeedingTranslation(masked.html);
    expect(texts).toContain("18 ieraksti");
    expect(texts).toContain("Benzīns");
    expect(texts.join(" ")).not.toContain("var a");

    const applied = applyHtmlTextTranslations(masked.html, {
      "18 ieraksti": "18 records",
      Benzīns: "Petrol",
    });
    const restored = unmaskHtmlProtectedRegions(applied, masked.blocks);
    expect(restored).toContain("<p>18 records</p>");
    expect(restored).toContain("<td>Petrol</td>");
    expect(restored).toContain('var a = "Nav ierakstu"');
    expect(restored).toContain('content:"ieraksti"');
  });

  it("escapes translated text and strips unicode dashes", () => {
    const html = "<p>Tehniskā apskate</p>";
    const out = applyHtmlTextTranslations(html, {
      "Tehniskā apskate": "Inspection — grade <1>",
    });
    expect(out).toContain("Inspection - grade &lt;1&gt;");
    expect(out).not.toContain("\u2014");
  });
});
