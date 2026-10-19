import { describe, expect, it } from "vitest";
import { getClientReportPrintCss } from "@/lib/client-report-html";
import { buildDealerServiceVisitsHtml } from "@/lib/pdf-dealer-service-visits";

function cssRulesFor(css: string, selector: string): string[] {
  const out: string[] = [];
  const re = new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?::[\\w-]+)?\\s*\\{([^}]*)\\}`, "g");
  for (const m of css.matchAll(re)) out.push(m[1]!.replace(/\s+/g, " ").trim());
  return out;
}

const SAMPLE_VISIT = {
  date: "31.03.2026",
  odometer: "214259",
  location: "Forchheim",
  works: "Serviss",
};

describe("dealer PDF timeline mileage layout", () => {
  it("keeps the km chip in the visit header, not stacked under the date", () => {
    const html = buildDealerServiceVisitsHtml([SAMPLE_VISIT], { omitSpan: true });
    expect(html).not.toMatch(/pdf-svc-when/);
    expect(html).toMatch(/<time class="pdf-svc-date">31\.03\.2026<\/time>/);
    expect(html).toMatch(
      /<div class="pdf-svc-chips"><span class="pdf-svc-tag pdf-svc-tag--repair">Remonts<\/span><span class="pdf-svc-km">214 259 km<\/span>/,
    );
    const dateIdx = html.indexOf('class="pdf-svc-date"');
    const kmIdx = html.indexOf('class="pdf-svc-km"');
    const tagIdx = html.indexOf('class="pdf-svc-tag');
    const chipsIdx = html.indexOf('class="pdf-svc-chips"');
    const boxTopIdx = html.indexOf('class="pdf-svc-box-top"');
    expect(dateIdx).toBeGreaterThanOrEqual(0);
    expect(kmIdx).toBeGreaterThan(dateIdx);
    expect(boxTopIdx).toBeGreaterThan(dateIdx);
    expect(chipsIdx).toBeGreaterThan(boxTopIdx);
    expect(tagIdx).toBeGreaterThan(chipsIdx);
    expect(kmIdx).toBeGreaterThan(tagIdx);
    expect(html).toMatchSnapshot();
  });

  it("print CSS right-aligns km+tag chips on one 22px row", () => {
    const css = getClientReportPrintCss();
    const visit = cssRulesFor(css, ".pdf-svc-visit").find((r) => r.includes("grid-template-columns")) ?? "";
    const date = cssRulesFor(css, ".pdf-svc-date").find((r) => r.includes("padding:9px 0")) ?? "";
    const top = cssRulesFor(css, ".pdf-svc-box-top")[0] ?? "";
    const chips = cssRulesFor(css, ".pdf-svc-chips")[0] ?? "";
    const km = cssRulesFor(css, ".pdf-svc-km").find((r) => r.includes("background:#F1F5F9")) ?? "";
    const tag = cssRulesFor(css, ".pdf-svc-tag").find((r) => r.includes("text-transform")) ?? "";
    const shared = cssRulesFor(css, ".pdf-svc-km,.pdf-svc-tag")[0] ?? "";
    expect(visit).toMatch(/grid-template-columns:\s*78px 18px minmax\(0,1fr\)/);
    expect(date).not.toMatch(/display:\s*block/);
    expect(date).toMatch(/text-align:\s*right/);
    expect(top).toMatch(/align-items:\s*center/);
    expect(chips).toMatch(/margin-left:\s*auto/);
    expect(chips).toMatch(/align-items:\s*center/);
    expect(chips).toMatch(/height:\s*22px/);
    expect(shared).toMatch(/height:\s*22px/);
    expect(shared).toMatch(/align-items:\s*center/);
    expect(km).not.toMatch(/margin-left:\s*auto/);
    expect(km).not.toMatch(/margin-top:\s*4px/);
    expect(km).toMatch(/background:#F1F5F9/);
    expect(tag).toMatch(/text-transform:\s*uppercase/);
    expect({ visit, date, top, chips, km, tag, shared }).toMatchSnapshot();
  });
});
