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
import {
  VOLVO_XC90_CLIMATE_DRAIN_NO_FAULT,
  VOLVO_XC90_QB_BLEED_AND_CHARGE_AIR_HOSE,
  VOLVO_XC90_QB_COOLING,
  VOLVO_XC90_QB_FUEL_LINE,
  VOLVO_XC90_RAW_ROWS,
  VOLVO_XC90_SOFTWARE_DOWNLOAD,
  VOLVO_XC90_SUNROOF_MECHANISM,
  VOLVO_XC90_TOTAL_UPGRADE,
  VOLVO_XC90_VCM_UPGRADE,
  VOLVO_XC90_WARRANTY_SEAL_TIMING_BELT,
} from "@/lib/dealer-major-works.volvo-xc90.fixture";

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
    expect(html).not.toMatch(/Sadales ķēde D2|Ātrumkārba D6/);
    expect(html).not.toMatch(/€|EUR/);
  });

  it("ATF/filter change is Apkope, not Lielie darbi (EN/DE/LV/RU, BMW RU D6 case)", () => {
    const bmwRuAtf = "Автоматическая коробка передач: замена масла и фильтра";
    expect(classifyDealerVisitKind(bmwRuAtf)).toBe("maintenance");
    expect(classifyDealerVisitKind("Automatic transmission: oil and filter change")).toBe("maintenance");
    expect(classifyDealerVisitKind("Automatikgetriebe: Öl- und Filterwechsel")).toBe("maintenance");
    expect(classifyDealerVisitKind("Ātrumkārbas eļļas un filtra maiņa")).toBe("maintenance");
    expect(classifyDealerVisitKind("Engine oil service")).toBe("maintenance");
    expect(classifyDealerVisitKind("BMW TwinPower Turbo LL-19FE 0W-30 (83215A65BF8)")).toBe("maintenance");
    expect(classifyDealerVisitKind("Automātiskā pārnesumkārba. Automātiskās transmisijas maiņa.")).toBe("repair");
    expect(classifyDealerVisitKind("Transfer case oil change")).toBe("maintenance");
    expect(classifyDealerVisitKind("Differential oil change")).toBe("maintenance");
    expect(classifyDealerVisitKind("Reduktora eļļas maiņa")).toBe("maintenance");
    expect(classifyDealerVisitKind("Gearbox replaced")).toBe("repair");
    expect(classifyDealerVisitKind("Замена коробки передач")).toBe("repair");
    expect(classifyDealerVisitKind("Engine replaced")).toBe("repair");
    expect(classifyDealerVisitKind("Замена двигателя")).toBe("repair");

    const filler = [
      row("10.01.2018", "20100", "Engine oil service"),
      row("12.06.2018", "35500", "Engine oil service"),
      row("03.03.2019", "52000", "Cabin filter"),
      row("18.11.2019", "71000", "Brake fluid"),
      row("22.08.2020", "89000", "Spark plugs"),
    ];
    const atfRows = [...filler, row("05.08.2022", "122576", bmwRuAtf)];
    const atfFacts = extractDealerFactsFromServiceWorks(atfRows);
    expect(atfFacts.rows.at(-1)?.id).toBe("D6");
    const atfSummary = buildDealerVisitSummary(atfRows, atfFacts);
    expect(atfSummary?.majorWorks.some((w) => w.id === "gearbox")).toBe(false);
    const atfHtml = buildDealerMajorWorksHtml(atfFacts, "ru");
    expect(atfHtml).not.toMatch(/Коробка передач|Ātrumkārba|Getriebe|Transmission/);

    const boxRows = [...filler, row("05.08.2022", "122576", "Gearbox replaced")];
    const boxFacts = extractDealerFactsFromServiceWorks(boxRows);
    const boxSummary = buildDealerVisitSummary(boxRows, boxFacts);
    expect(boxSummary?.majorWorks.some((w) => w.id === "gearbox" && w.factId === "D6")).toBe(true);
    const boxHtml = buildDealerMajorWorksHtml(boxFacts);
    expect(boxHtml).toContain("<b>Ātrumkārba</b>");
    expect(boxHtml).toContain("05.08.2022");
    expect(boxHtml).toContain("122 576 km");
    expect(boxHtml).not.toMatch(/D6/);
    const boxHtmlRu = buildDealerMajorWorksHtml(boxFacts, "ru");
    expect(boxHtmlRu).toContain("<b>Коробка передач</b>");
    expect(boxHtmlRu).not.toMatch(/Коробка передач D6|Коробка передачD6|\(D6\)/);
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

describe("Volvo XC90 RAW visit kinds and Lielie darbi", () => {
  it("categorizes QB, warranty, software, hose repair and checks", () => {
    expect(classifyDealerVisitKind(VOLVO_XC90_QB_COOLING)).toBe("campaign");
    expect(classifyDealerVisitKind(VOLVO_XC90_QB_FUEL_LINE)).toBe("campaign");
    expect(classifyDealerVisitKind(VOLVO_XC90_QB_BLEED_AND_CHARGE_AIR_HOSE)).toBe("repair");
    expect(classifyDealerVisitKind(VOLVO_XC90_WARRANTY_SEAL_TIMING_BELT)).toBe("warranty");
    expect(classifyDealerVisitKind(VOLVO_XC90_SOFTWARE_DOWNLOAD)).toBe("campaign");
    expect(classifyDealerVisitKind(VOLVO_XC90_TOTAL_UPGRADE)).toBe("campaign");
    expect(classifyDealerVisitKind(VOLVO_XC90_VCM_UPGRADE)).toBe("campaign");
    expect(classifyDealerVisitKind(VOLVO_XC90_SUNROOF_MECHANISM)).toBe("repair");
    expect(classifyDealerVisitKind(VOLVO_XC90_CLIMATE_DRAIN_NO_FAULT)).toBe("maintenance");
  });

  it("journal has campaigns but no Lielie darbi and no D-id glued to labels", () => {
    const rows = VOLVO_XC90_RAW_ROWS.map((r) => ({
      date: r.date,
      odometer: r.odometer,
      location: "Volvo Partner",
      works: r.works,
    }));
    const facts = extractDealerFactsFromServiceWorks(rows);
    const summary = buildDealerVisitSummary(rows, facts);
    expect(summary?.campaignsDone).toBe(true);
    expect(summary?.majorWorks).toEqual([]);
    expect(buildDealerMajorWorksHtml(facts)).toBe("");
    const html = buildDealerVisitSummaryHtml(rows, facts, "en");
    expect(html).toMatch(/None recorded|Nav fiksēts|Не зафиксировано|Nicht erfasst/);
    expect(html).not.toMatch(/Engine replacement|Dzinējs|Transmission|Ātrumkārba D\d/);
  });
});
