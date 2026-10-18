import { describe, expect, it } from "vitest";
import { getClientReportPrintCss } from "@/lib/client-report-html";
import { buildDealerServiceVisitsHtml } from "@/lib/pdf-dealer-service-visits";

const FORCED_BREAK_RE = /(?:page-)?break-(?:before|after)\s*:\s*(?:page|always|left|right)/i;

function cssRulesFor(css: string, selector: string): string[] {
  const out: string[] = [];
  const re = new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?::[\\w-]+)?\\s*\\{([^}]*)\\}`, "g");
  for (const m of css.matchAll(re)) out.push(m[1]!);
  return out;
}

describe("klienta PDF lapu plūsma", () => {
  it("dīlera ieraksti plūst nepārtraukti: gada bloki nesāk jaunu lapu", () => {
    const css = getClientReportPrintCss();
    const yearRules = cssRulesFor(css, ".pdf-svc-year-block");
    expect(yearRules.length).toBeGreaterThan(0);
    for (const rule of yearRules) expect(rule).not.toMatch(FORCED_BREAK_RE);
  });

  it("neviena klienta PDF sadaļa neliek piespiedu lapas pārrāvumu", () => {
    expect(getClientReportPrintCss()).not.toMatch(FORCED_BREAK_RE);
  });

  it("vizīte paliek nesadalīta, bet gadi grupējas secīgi vienā plūsmā", () => {
    const css = getClientReportPrintCss();
    expect(cssRulesFor(css, ".pdf-svc-visit").join(" ")).toMatch(/break-inside:\s*avoid/);
    const html = buildDealerServiceVisitsHtml([
      { date: "14.03.2023", odometer: "41200", location: "Opel Wien", works: "Periodiskā drošības pārbaude" },
      { date: "02.11.2022", odometer: "36500", location: "Opel Wien", works: "Dzinēja eļļas maiņa" },
      { date: "05.04.2021", odometer: "30100", location: "Opel Wien", works: "Riteņu maiņa" },
    ]);
    const years = [...html.matchAll(/<p class="pdf-svc-year">(\d{4})<\/p>/g)].map((m) => m[1]);
    expect(years).toEqual(["2023", "2022", "2021"]);
    expect(html.match(/pdf-svc-year-block/g)?.length).toBe(3);
    expect(html).not.toMatch(FORCED_BREAK_RE);
  });
});
