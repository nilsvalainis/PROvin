import { describe, expect, it } from "vitest";
import {
  analyzeDealerIncidentLinks,
  buildDealerIncidentLinkBrief,
  dealerWorkLooksLikeBodyOrGlassRepair,
  orderHasDealerBodyOrGlassWork,
} from "@/lib/admin-ai-dealer-incident-link";
import { createDefaultSourceBlocks } from "@/lib/admin-source-blocks";
import { orderHasIncidentDataForAi } from "@/lib/admin-ai-data-availability";

describe("dealer incident link", () => {
  it("treats glass and body repairs as linkable, not oil service", () => {
    expect(dealerWorkLooksLikeBodyOrGlassRepair("Stikla maiņa")).toBe(true);
    expect(dealerWorkLooksLikeBodyOrGlassRepair("Priekšējā bampera remonts un pārkrāsošana")).toBe(true);
    expect(dealerWorkLooksLikeBodyOrGlassRepair("Eļļas maiņa, salona filtrs")).toBe(false);
  });

  it("joins a nearby dealer glass job to the claim and keeps oil out", () => {
    const blocks = createDefaultSourceBlocks();
    blocks.autodna.incidents = [{ csngDate: "12.03.2019", lossAmount: "18 400 €", incidentNo: "Vācija" }];
    blocks.auto_records.serviceWorks = [
      { date: "15.03.2019", odometer: "142300", location: "BMW Bonn", works: "Stikla maiņa, priekšējā bampera remonts" },
      { date: "16.03.2019", odometer: "142310", location: "BMW Bonn", works: "Eļļas maiņa" },
    ];
    const analysis = analyzeDealerIncidentLinks(blocks);
    expect(analysis.pairs).toHaveLength(1);
    expect(analysis.pairs[0]?.work.label).toMatch(/Stikla maiņa/);
    expect(analysis.pairs[0]?.incident.label).toMatch(/18 400/);
    expect(analysis.unmatchedWorks).toHaveLength(0);
    const brief = buildDealerIncidentLinkBrief(blocks);
    expect(brief).toMatch(/SASAISTĪTS/);
    expect(brief).toMatch(/Stikla maiņa/);
    expect(brief).toMatch(/12\.03\.2019/);
    expect(brief).not.toMatch(/Eļļas maiņa/);
  });

  it("links a month-only claim to a same-month body repair", () => {
    const blocks = createDefaultSourceBlocks();
    blocks.carvertical.incidents = [{ csngDate: "01.06.2021", lossAmount: "2 500 €", incidentNo: "LV" }];
    blocks.auto_records.serviceWorks = [
      { date: "18.06.2021", odometer: "180000", location: "", works: "Kreisā spārna pārkrāsošana" },
    ];
    expect(analyzeDealerIncidentLinks(blocks).pairs).toHaveLength(1);
  });

  it("lists dealer body work when there is no claim, and claims when there is no body work", () => {
    const onlyDealer = createDefaultSourceBlocks();
    onlyDealer.auto_records.serviceWorks = [
      { date: "01.02.2020", odometer: "90000", location: "", works: "Vējstikla maiņa" },
    ];
    const dealerOnly = analyzeDealerIncidentLinks(onlyDealer);
    expect(dealerOnly.pairs).toHaveLength(0);
    expect(dealerOnly.unmatchedWorks[0]?.label).toMatch(/Vējstikla/);
    expect(orderHasDealerBodyOrGlassWork(onlyDealer)).toBe(true);
    expect(orderHasIncidentDataForAi(onlyDealer)).toBe(true);

    const onlyClaim = createDefaultSourceBlocks();
    onlyClaim.ltab.rows = [{ csngDate: "01.02.2018", lossAmount: "900 €", incidentNo: "LV" }];
    const claimOnly = analyzeDealerIncidentLinks(onlyClaim);
    expect(claimOnly.unmatchedIncidents[0]?.label).toMatch(/900/);
    expect(orderHasDealerBodyOrGlassWork(onlyClaim)).toBe(false);
  });

  it("returns no brief when neither side has linkable rows", () => {
    const blocks = createDefaultSourceBlocks();
    blocks.auto_records.serviceWorks = [
      { date: "01.01.2020", odometer: "50000", location: "", works: "Eļļas maiņa" },
    ];
    expect(buildDealerIncidentLinkBrief(blocks)).toBe("");
  });
});
