/**
 * 24.11 atskaites audits #1, #2, #12, #13: odometra loģika - «jaunākais rādījums» tikai apstiprināts avots,
 * sludinājuma km atsevišķi; fiziski neiespējams rādījums = ievades kļūda (nevis kritums) visos blokos.
 * Testos tikai izdomāti dati.
 */
import { describe, expect, it } from "vitest";
import { createDefaultSourceBlocks } from "@/lib/admin-source-blocks";
import { buildCanonicalFacts, formatCanonicalFactsSheet } from "@/lib/canonical-facts-sheet";
import { checkCommentContradictions, extractCanonicalFactsFromPrompt } from "@/lib/comment-contradiction-check";
import {
  collectImplausibleMileageReadings,
  collectUnifiedMileageRows,
  isImpossibleReadingSinceStart,
} from "@/lib/unified-mileage";
import { checkSourceConsistency } from "@/lib/source-consistency";

function listingCase() {
  const blocks = createDefaultSourceBlocks();
  blocks.csdd = {
    ...blocks.csdd,
    makeModel: "VOLVO V70",
    firstRegistration: "15.03.2008",
    mileageHistory: [
      { date: "10.07.2024", odometer: "241000", country: "Latvija" },
      { date: "08.07.2026", odometer: "270099", country: "Latvija" },
    ],
  };
  blocks.tirgus = { ...blocks.tirgus, listingMileageOdometer: "330000", listingMileageDate: "29.10.2026" };
  return blocks;
}

describe("audits #2: jaunākais rādījums = apstiprināts, sludinājums atsevišķi", () => {
  it("jaunākais ir CSDD 270 099 km, sludinājuma 330 000 km - atsevišķa rinda ar brīdinājumu", () => {
    const facts = buildCanonicalFacts({ sourceBlocks: listingCase() });
    expect(facts.latestKm).toBe(270099);
    expect(facts.latestKmDate).toBe("08.07.2026");
    expect(facts.listingMileage?.km).toBe(330000);
    expect(facts.listingMileage?.diffFromConfirmedKm).toBe(59901);
    const sheet = formatCanonicalFactsSheet(facts);
    expect(sheet).toMatch(/Jaunākais rādījums: 270 099 km \(apstiprināts: 08\.07\.2026/);
    expect(sheet).toMatch(/Sludinājumā norādīts: 330 000 km/);
    expect(sheet).toMatch(/BRĪDINĀJUMS: sludinājuma km atšķiras no jaunākā apstiprinātā par 59 901 km/);
  });

  it("faktu pārbaude: sludinājuma km nosaukts par jaunāko CSDD rādījumu -> brīdinājums", () => {
    const sheet = formatCanonicalFactsSheet(buildCanonicalFacts({ sourceBlocks: listingCase() }));
    const facts = extractCanonicalFactsFromPrompt(sheet)!;
    expect(facts.latestKm).toBe(270099);
    expect(facts.listingMileage?.km).toBe(330000);
    const bad = checkCommentContradictions({
      text: "Rādījums 330 000 km atbilst jaunākajam CSDD tehniskās apskates ierakstam.",
      field: "mileage",
      facts,
    });
    expect(bad.some((f) => f.id === "listing_km_as_latest")).toBe(true);
    const ok = checkCommentContradictions({
      text: "Sludinājumā norādīts 330 000 km, bet jaunākais apstiprinātais rādījums ir 270 099 km (08.07.2026).",
      field: "mileage",
      facts,
    });
    expect(ok.some((f) => f.id === "listing_km_as_latest")).toBe(false);
  });

  it("bez sludinājuma - nekādu sludinājuma rindu", () => {
    const blocks = listingCase();
    blocks.tirgus = { ...blocks.tirgus, listingMileageOdometer: "", listingMileageDate: "" };
    const facts = buildCanonicalFacts({ sourceBlocks: blocks });
    expect(facts.listingMileage).toBeNull();
    expect(formatCanonicalFactsSheet(facts)).not.toMatch(/Sludinājumā norādīts/);
  });
});

function impossibleCase() {
  const blocks = createDefaultSourceBlocks();
  blocks.csdd = {
    ...blocks.csdd,
    makeModel: "BMW 320D",
    firstRegistration: "28.11.2012",
    mileageHistory: [
      { date: "20.11.2012", odometer: "90000", country: "Vācija" },
      { date: "15.01.2013", odometer: "2954", country: "Vācija" },
      { date: "20.02.2015", odometer: "61000", country: "Dānija" },
      { date: "10.03.2019", odometer: "190000", country: "Dānija" },
    ],
  };
  return blocks;
}

describe("audits #13: fiziski neiespējams rādījums = ievades kļūda, nevis kritums", () => {
  it("slieksnis: 300 km dienā kopš 1. reģistrācijas, ne mazāk par 5 000 km", () => {
    const start = Date.UTC(2012, 10, 28);
    expect(isImpossibleReadingSinceStart(90_000, Date.UTC(2012, 10, 20), start)).toBe(true);
    expect(isImpossibleReadingSinceStart(4_000, Date.UTC(2012, 10, 20), start)).toBe(false);
    expect(isImpossibleReadingSinceStart(90_000, Date.UTC(2014, 0, 1), start)).toBe(false);
    expect(isImpossibleReadingSinceStart(90_000, Date.UTC(2012, 10, 20), 0)).toBe(false);
  });

  it("90 000 km pirms reģistrācijas izlaists no tabulas un AI faktiem; krituma nav", () => {
    const blocks = impossibleCase();
    const payload = { csddForm: blocks.csdd };
    expect(collectImplausibleMileageReadings(payload).map((r) => r.odometer.replace(/\D/g, ""))).toEqual(["90000"]);
    expect(collectUnifiedMileageRows(payload).some((r) => r.odometer.replace(/\D/g, "") === "90000")).toBe(false);
    const facts = buildCanonicalFacts({ sourceBlocks: blocks });
    expect(facts.rollbacks).toHaveLength(0);
    expect(facts.implausibleReadings).toHaveLength(1);
    expect(formatCanonicalFactsSheet(facts)).toMatch(/Izlaists neticams rādījums[^\n]*90000 km/);
    // Pretrunu josla: nav kritiska «nobraukuma krituma».
    const issues = checkSourceConsistency({ sourceBlocks: blocks, nowMs: Date.UTC(2026, 10, 25) });
    expect(issues.some((i) => i.kind === "mileage_drop")).toBe(false);
  });

  it("imports (CSDD datums = Latvijas reģistrācija) ar augošu ārvalstu secību netiek izmests", () => {
    const blocks = createDefaultSourceBlocks();
    blocks.csdd = {
      ...blocks.csdd,
      firstRegistration: "10.05.2021",
      mileageHistory: [
        { date: "01.03.2019", odometer: "150000", country: "Vācija" },
        { date: "01.03.2021", odometer: "180000", country: "Vācija" },
        { date: "10.05.2022", odometer: "200000", country: "Latvija" },
      ],
    };
    expect(collectImplausibleMileageReadings({ csddForm: blocks.csdd })).toHaveLength(0);
  });
});
