import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LegalReveal, companyLegalLine } from "@/components/LegalReveal";

const legal = { legalName: "Vārds Uzvārds", regNo: "01010112345", legalAddress: "Iela 1, Pilsēta", isComplete: true };

describe("pakalpojuma sniedzēja rekvizīti", () => {
  it("ir paslēpti zem neuzkrītošas pogas «PROVIN»", () => {
    const html = renderToStaticMarkup(<LegalReveal line={companyLegalLine(legal)} />);
    expect(html).toMatch(/^<details/);
    expect(html).toContain("<summary");
    expect(html).toContain(">PROVIN</summary>");
    expect(html).not.toContain("open");
  });

  it("bez pilniem rekvizītiem poga netiek rādīta", () => {
    expect(renderToStaticMarkup(<LegalReveal line={companyLegalLine({ ...legal, isComplete: false })} />)).toBe("");
  });
});
