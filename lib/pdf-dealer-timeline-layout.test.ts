import { describe, expect, it } from "vitest";
import { getClientReportPrintCss } from "@/lib/client-report-html";
import { buildDealerServiceVisitsHtml } from "@/lib/pdf-dealer-service-visits";
import { classifyDealerVisitKind } from "@/lib/pdf-dealer-timeline";

function cssRulesFor(css: string, selector: string): string[] {
  const out: string[] = [];
  const re = new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?::[\\w-]+)?\\s*\\{([^}]*)\\}`, "g");
  for (const m of css.matchAll(re)) out.push(m[1]!.replace(/\s+/g, " ").trim());
  return out;
}

const NIL_VISIT = {
  date: "31.03.2026",
  odometer: "214259",
  location: "Forchheim",
  works: "Serviss",
};

describe("dealer PDF timeline mileage layout", () => {
  it("keeps the km chip in the visit header, not stacked under the date", () => {
    const html = buildDealerServiceVisitsHtml([NIL_VISIT], { omitSpan: true });
    expect(html).not.toMatch(/pdf-svc-when/);
    expect(html).toMatch(/<time class="pdf-svc-date">31\.03\.2026<\/time>/);
    expect(html).toMatch(
      /<div class="pdf-svc-box-top">[\s\S]*<span class="pdf-svc-km">214 259 km<\/span>/,
    );
    const dateIdx = html.indexOf('class="pdf-svc-date"');
    const kmIdx = html.indexOf('class="pdf-svc-km"');
    const boxTopIdx = html.indexOf('class="pdf-svc-box-top"');
    expect(dateIdx).toBeGreaterThanOrEqual(0);
    expect(kmIdx).toBeGreaterThan(dateIdx);
    expect(boxTopIdx).toBeGreaterThan(dateIdx);
    expect(kmIdx).toBeGreaterThan(boxTopIdx);
    expect(html).toMatchSnapshot();
  });

  it("print CSS matches the pre-#268 date column: 78px, date not block, km flex chip", () => {
    const css = getClientReportPrintCss();
    const visit = cssRulesFor(css, ".pdf-svc-visit").find((r) => r.includes("grid-template-columns")) ?? "";
    const date = cssRulesFor(css, ".pdf-svc-date").find((r) => r.includes("padding:9px 0")) ?? "";
    const km = cssRulesFor(css, ".pdf-svc-km")[0] ?? "";
    expect(visit).toMatch(/grid-template-columns:\s*78px 18px minmax\(0,1fr\)/);
    expect(date).not.toMatch(/display:\s*block/);
    expect(date).toMatch(/text-align:\s*right/);
    expect(km).toMatch(/flex:\s*none/);
    expect(km).toMatch(/margin-left:\s*auto/);
    expect(km).not.toMatch(/margin-top:\s*4px/);
    expect(km).toMatch(/background:#F1F5F9/);
    expect({ visit, date, km }).toMatchSnapshot();
  });

  it("tags a bare Serviss line as Apkope", () => {
    expect(classifyDealerVisitKind("Serviss")).toBe("maintenance");
    const html = buildDealerServiceVisitsHtml([NIL_VISIT], { omitSpan: true });
    expect(html).toContain("pdf-svc-tag--maintenance");
    expect(html).toContain("Apkope");
    expect(html).not.toContain("pdf-svc-tag--repair");
  });
});
