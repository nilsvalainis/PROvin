/**
 * 26.11 regresijas pārbaude uz īstiem pasūtījumiem: odometra kartīte 1. lapā, negadījumu skaits AI tekstā,
 * rādījuma avota nosaukums un dīlera flīze. Testos tikai izdomāti dati.
 */
import { describe, expect, it } from "vitest";
import { createDefaultSourceBlocks, toPdfManualVendorBlocks } from "@/lib/admin-source-blocks";
import { buildCanonicalFacts, formatCanonicalFactsSheet } from "@/lib/canonical-facts-sheet";
import { resolvePdfLatestOdometerReading, resolvePdfListingOdometer } from "@/lib/pdf-report-summary";
import {
  buildPdfTopSectionHtml,
  pdfTopDealerSourceName,
  pdfTopListingOdometerNote,
  pdfTopOdometerSourceName,
  type PdfTopModel,
} from "@/lib/pdf-report-top";
import { checkSourceConsistency } from "@/lib/source-consistency";

function topModel(odometer: PdfTopModel["odometer"]): PdfTopModel {
  return {
    lang: "lv",
    logoSvg: "<svg></svg>",
    kindTitle: "AUDITS",
    dateLabel: "26.11.2026",
    makeModel: "VW Touran",
    vin: "",
    specLine: "",
    photo: null,
    odometer,
    age: "",
    firstReg: null,
    cards: [],
    sources: [],
    totals: { paid: 0, pub: 0, other: 0 },
    wordmarkHtml: "PROVIN",
  };
}

describe("1. odometra kartīte: tikai apstiprināts rādījums", () => {
  it("tikai sludinājuma km (ss.lv) - nav rādījuma, sludinājums atsevišķi; faktu lapā arī «nav»", () => {
    const blocks = createDefaultSourceBlocks();
    blocks.tirgus = { ...blocks.tirgus, listingMileageOdometer: "196000", listingMileageDate: "14.08.2026" };
    const input = { csddForm: blocks.csdd, tirgusForm: blocks.tirgus };
    expect(resolvePdfLatestOdometerReading(input)).toBeNull();
    const listing = resolvePdfListingOdometer(input);
    expect(listing?.odometer).toMatch(/196\s?000/);
    expect(listing?.date).toBe("14.08.2026");

    const sheet = formatCanonicalFactsSheet(buildCanonicalFacts({ sourceBlocks: blocks }));
    expect(sheet).toMatch(/Jaunākais rādījums: nav/);
  });

  it("kartītē mierīgs «Nav datu», sludinājuma km tikai ar atzīmi «sludinājumā»", () => {
    const note = pdfTopListingOdometerNote("196 000 km", "14.08.2026", "lv");
    expect(note).toBe("sludinājumā 196 000 km · 14.08.2026");
    const html = buildPdfTopSectionHtml(topModel({ value: "Nav datu", sub: note, none: true }));
    expect(html).toContain("Pēdējais odometra rādījums");
    expect(html).toMatch(/pdf-top6__big--none s-none[^>]*>Nav datu</);
    expect(html).toContain("sludinājumā 196 000 km · 14.08.2026");
    expect(html).not.toMatch(/>196 000<small>/);
  });

  it("ja ir apstiprināts CSDD rādījums, kartītē tas, nevis jaunāks sludinājuma km", () => {
    const blocks = createDefaultSourceBlocks();
    blocks.csdd = {
      ...blocks.csdd,
      mileageHistory: [{ date: "10.07.2025", odometer: "181500", country: "Latvija" }],
    };
    blocks.tirgus = { ...blocks.tirgus, listingMileageOdometer: "196000", listingMileageDate: "14.08.2026" };
    const latest = resolvePdfLatestOdometerReading({ csddForm: blocks.csdd, tirgusForm: blocks.tirgus });
    expect(latest?.odometer).toMatch(/181\s?500/);
    expect(latest?.date).toBe("10.07.2025");
    const facts = buildCanonicalFacts({ sourceBlocks: blocks });
    expect(facts.latestKm).toBe(181500);
  });
});

describe("5a. rādījuma avots faktu lapā = PDF 1. lapā", () => {
  it("viens ieraksts no CSDD un autoDNA - abās vietās tas pats avota nosaukums", () => {
    const blocks = createDefaultSourceBlocks();
    blocks.csdd = {
      ...blocks.csdd,
      mileageHistory: [
        { date: "12.03.2024", odometer: "150000", country: "Latvija" },
        { date: "10.07.2025", odometer: "181500", country: "Latvija" },
      ],
    };
    blocks.autodna = {
      ...blocks.autodna,
      serviceHistory: [{ date: "10.07.2025", odometer: "181500", country: "Latvija" }],
    };
    const facts = buildCanonicalFacts({ sourceBlocks: blocks });
    const latest = resolvePdfLatestOdometerReading({
      csddForm: blocks.csdd,
      manualVendorBlocks: toPdfManualVendorBlocks(blocks),
    })!;
    expect(latest).not.toBeNull();
    expect(facts.latestKm).toBe(181500);
    expect(facts.latestKmDate).toBe(latest.date);
    const pdfName = pdfTopOdometerSourceName(latest.sourceLabel, latest.date, null, "lv");
    expect(facts.latestKmSource).toBe(pdfName);
    expect(formatCanonicalFactsSheet(facts)).toContain(`(apstiprināts: 10.07.2025, ${pdfName})`);
  });
});

describe("5b. dīlera avota flīze pēc markas", () => {
  it("bez markas - «Dīleris», nevis modelis", () => {
    expect(pdfTopDealerSourceName("Touran", "", "lv").name).toBe("Dīleris");
    expect(pdfTopDealerSourceName("", "", "en").name).toBe("Dealer");
  });

  it("marka no teksta vai VIN", () => {
    expect(pdfTopDealerSourceName("BMW 530d", "", "lv").name).toBe("BMW");
    expect(pdfTopDealerSourceName("Touran", "WVGZZZ1TZBW000000", "lv").name).toBe("Volkswagen");
  });
});

describe("2. AI tekstā negadījumu skaits pret kartīti", () => {
  function fiveLtab() {
    const blocks = createDefaultSourceBlocks();
    blocks.ltab = {
      ...blocks.ltab,
      rows: [
        { incidentNo: "1", csngDate: "18.04.2016", lossAmount: "420 €" },
        { incidentNo: "2", csngDate: "19.08.2017", lossAmount: "380 €" },
        { incidentNo: "3", csngDate: "11.02.2018", lossAmount: "900 €" },
        { incidentNo: "4", csngDate: "03.06.2020", lossAmount: "1 200 €" },
        { incidentNo: "5", csngDate: "21.09.2022", lossAmount: "650 €" },
      ],
    };
    return blocks;
  }

  it("tekstā 7, kartītē 5 - brīdinājums", () => {
    const issues = checkSourceConsistency({
      sourceBlocks: fiveLtab(),
      texts: [{ label: "Kopsavilkums", text: "Auto vēsturē fiksēti 7 negadījumi, jaunākais 2022. gadā." }],
    });
    const hit = issues.find((i) => i.kind === "ai_incident_count");
    expect(hit?.severity).toBe("warn");
    expect(hit?.values).toEqual([
      { source: "1. lapas kartīte", value: "5 negadījumi" },
      { source: "Kopsavilkums", value: "7 negadījumi" },
    ]);
  });

  it("tekstā tas pats skaits (arī «5 incidents») - nav brīdinājuma", () => {
    const issues = checkSourceConsistency({
      sourceBlocks: fiveLtab(),
      texts: [
        { label: "Kopsavilkums", text: "Fiksēti 5 negadījumi." },
        { label: "Komentārs EN", text: "There are 5 incidents on record." },
      ],
    });
    expect(issues.some((i) => i.kind === "ai_incident_count")).toBe(false);
  });
});
