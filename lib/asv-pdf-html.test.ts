import { describe, expect, it } from "vitest";
import { buildAsvPdfInnerHtml } from "@/lib/asv-pdf-html";
import { emptyAsvBlock } from "@/lib/asv-report";

describe("asv-pdf-html overlap", () => {
  it("iekļauj avotu salīdzinājuma tabulu, ja ir overlapCompare", () => {
    const b = emptyAsvBlock();
    b.overlapCompare = [
      {
        field: "Īpašnieku skaits",
        oneauto: "2",
        joj: "3",
        stronger: "oneauto",
        chosen: "oneauto",
      },
    ];
    const html = buildAsvPdfInnerHtml(b);
    expect(html).toContain("Avotu salīdzinājums");
    expect(html).toContain("OneAuto");
    expect(html).toContain("JoJ");
    expect(html).toContain("Spēcīgākais");
  });
});
