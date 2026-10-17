import { describe, expect, it } from "vitest";
import { extractDealerFactsFromServiceWorks } from "@/lib/admin-ai-dealer-facts";
import { KEY_READ_HISTORY_LABEL } from "@/lib/vendor-service-history";
import {
  buildDealerMajorWorksHtml,
  buildDealerVisitSummary,
  buildDealerVisitSummaryHtml,
  classifyDealerVisitKind,
  dealerPdfWorkLines,
  filterDealerPdfVisitRows,
  isDealerServiceGap,
  visitGapBetween,
} from "@/lib/pdf-dealer-timeline";
import { shouldCondenseDealerPdfRecords } from "@/lib/dealer-product-scope";

const row = (
  date: string,
  odometer: string,
  works: string,
  location = "BMW Bonn",
) => ({ date, odometer, location, works });

describe("dealer visit kind and gaps", () => {
  it("iekrāso apkopi, remontu, kampaņu un garantiju", () => {
    expect(classifyDealerVisitKind("Regulārā apkope: eļļas maiņa")).toBe("maintenance");
    expect(classifyDealerVisitKind("Sadales ķēdes komplekta maiņa")).toBe("repair");
    expect(classifyDealerVisitKind("Technische Aktion 001234 software update")).toBe("campaign");
    expect(classifyDealerVisitKind("Warranty repair: water pump")).toBe("warranty");
    expect(classifyDealerVisitKind(KEY_READ_HISTORY_LABEL)).toBe("key_read");
  });

  it("robs virs 24 mēn. vai 30 000 km ir fakts, ne verdikts", () => {
    const gap = visitGapBetween(
      row("01.01.2018", "40000", "Eļļa"),
      row("01.08.2021", "95000", "Eļļa"),
    );
    expect(gap?.months).toBeGreaterThan(24);
    expect(gap?.km).toBeGreaterThan(30000);
    expect(isDealerServiceGap(gap)).toBe(true);
    const summaryHtml = buildDealerVisitSummaryHtml([
      row("01.01.2018", "40000", "Eļļa"),
      row("01.08.2021", "95000", "Eļļa"),
    ]);
    expect(summaryHtml).toContain("Garākais robs");
    expect(summaryHtml).not.toMatch(/izlaist|kavēt|risk/i);
  });
});

describe("product-type Key Read / tukšie nobraukuma punkti", () => {
  const rows = [
    row("01.04.2025", "88000", KEY_READ_HISTORY_LABEL),
    row("01.06.2023", "60000", "Eļļas maiņa"),
    { date: "01.02.2020", odometer: "12000", location: "", works: "" },
  ];

  it("dīlera-only atstāj Key Read un tukšo km punktu", () => {
    const condense = shouldCondenseDealerPdfRecords({ checkoutLine: "dealer" });
    const kept = filterDealerPdfVisitRows(rows, condense);
    expect(kept).toHaveLength(3);
    expect(kept.some((r) => r.works === KEY_READ_HISTORY_LABEL)).toBe(true);
  });

  it("AUDITS / MINI slēpj Key Read un tukšo km punktu no darbu līnijas", () => {
    const condense = shouldCondenseDealerPdfRecords({ checkoutLine: "audits", amountTotalCents: 9999 });
    const kept = filterDealerPdfVisitRows(rows, condense);
    expect(kept).toHaveLength(1);
    expect(kept[0]!.works).toContain("Eļļas maiņa");
  });
});

describe("kopsavilkums un lielie darbi", () => {
  it("rāda vizīšu skaitu, pirmās/pēdējās vizītes un D-ID mezgliem", () => {
    const rows = [
      row("10.08.2021", "121000", "Timing chain kit replaced (Steuerkette)"),
      row("02.05.2019", "60120", "Engine oil service"),
      row("15.01.2022", "140500", "Technische Aktion 001234 software update"),
    ];
    const facts = extractDealerFactsFromServiceWorks(rows);
    const summary = buildDealerVisitSummary(rows, facts);
    expect(summary?.visitCount).toBe(3);
    expect(summary?.firstDate).toBe("02.05.2019");
    expect(summary?.lastDate).toBe("15.01.2022");
    expect(summary?.lastKm).toContain("140");
    expect(summary?.campaignsDone).toBe(true);
    expect(summary?.majorWorks.some((w) => w.id === "timing_chain" && w.factId === "D2")).toBe(true);
    const html = buildDealerVisitSummaryHtml(rows, facts) + buildDealerMajorWorksHtml(facts);
    expect(html).toContain("Vizītes");
    expect(html).toContain("Kampaņas veiktas");
    expect(html).toContain("Sadales ķēde");
    expect(html).toContain("D2");
    expect(html).not.toMatch(/€|EUR/);
  });

  it("no darbu saraksta noņem detaļu kodus, bet atstāj darba nosaukumu", () => {
    expect(dealerPdfWorkLines("Eļļas filtrs (11427508969)\nSet oil-filter 11427508969")).toEqual([
      "Eļļas filtrs",
      "Set oil-filter",
    ]);
    expect(dealerPdfWorkLines(KEY_READ_HISTORY_LABEL, { hideKeyReadLines: true })).toEqual([]);
    expect(dealerPdfWorkLines(KEY_READ_HISTORY_LABEL)).toEqual([KEY_READ_HISTORY_LABEL]);
  });
});
