import { describe, expect, it } from "vitest";
import { createDefaultSourceBlocks } from "@/lib/admin-source-blocks";
import { buildCanonicalFacts, CANONICAL_FACTS_HEADER } from "@/lib/canonical-facts-sheet";
import { checkCommentContradictions, extractCanonicalFactsFromPrompt } from "@/lib/comment-contradiction-check";

/** PRO audits 06.11: GLE gadījums - viens notikums AutoDNA un carVertical, AI rakstīja „astoņi bojājumu ieraksti”. */
function sameEventTwoSources() {
  const blocks = createDefaultSourceBlocks();
  blocks.csdd = { ...blocks.csdd, makeModel: "Mercedes-Benz GLE", firstRegistration: "26.03.2019" };
  blocks.autodna = {
    ...blocks.autodna,
    incidents: [{ incidentNo: "Igaunija", csngDate: "14.03.2022", lossAmount: "6 000 - 6 500 €" }],
  };
  blocks.carvertical = {
    ...blocks.carvertical,
    incidents: [{ incidentNo: "Igaunija", csngDate: "14.03.2022", lossAmount: "6 000 - 6 500 €" }],
  };
  return buildCanonicalFacts({ sourceBlocks: blocks, notes: "" });
}

describe("viens negadījumu skaits visai atskaitei", () => {
  it("faktu lapā ir kartītes skaits, ne avotu rindu summa", () => {
    const f = sameEventTwoSources();
    expect(f.incidents.length).toBe(2);
    expect(f.reportIncidentCount).toBe(1);
    expect(f.sheet).toContain("Negadījumi atskaitē (kopsavilkuma kartīte): 1");
    expect(f.sheet).toContain("Negadījumi / zaudējumi pa avotiem: 2 rindas");
  });

  it("kopsavilkumā summētais skaits ir kļūda, avota komentārā - nē", () => {
    const f = sameEventTwoSources();
    const summary = checkCommentContradictions({
      text: "Avotos fiksēti 2 bojājumu ieraksti Igaunijā 2022. gadā.",
      field: "summary",
      facts: f,
    });
    expect(summary.some((x) => x.kind === "incident_count" && x.level === "E")).toBe(true);

    const words = checkCommentContradictions({ text: "Kopā astoņi bojājumu ieraksti.", field: "inspection", facts: f });
    expect(words.some((x) => x.kind === "incident_count")).toBe(true);

    const ok = checkCommentContradictions({ text: "Fiksēts 1 bojājumu ieraksts.", field: "summary", facts: f });
    expect(ok.some((x) => x.kind === "incident_count")).toBe(false);

    const source = checkCommentContradictions({ text: "Avotā 2 bojājumu ieraksti.", field: "autodna", facts: f });
    expect(source.some((x) => x.kind === "incident_count")).toBe(false);
  });

  it("faktu lapu var nolasīt atpakaļ no prompta", () => {
    const f = sameEventTwoSources();
    const prompt = f.sheet.includes(`=== ${CANONICAL_FACTS_HEADER} ===`)
      ? f.sheet
      : `=== ${CANONICAL_FACTS_HEADER} ===\n${f.sheet}\n=== BEIGAS ${CANONICAL_FACTS_HEADER} ===`;
    const parsed = extractCanonicalFactsFromPrompt(prompt);
    expect(parsed).not.toBeNull();
    expect(parsed!.reportIncidentCount).toBe(1);
    expect(parsed!.incidents.length).toBe(2);
  });
});

describe("CSDD un dīlera skaits vienāds avotu sarakstā un sadaļā", () => {
  it("dīlera vizīte skaitās vienreiz, CSDD skaitlis sakrīt abās vietās", async () => {
    const { buildClientReportDocumentHtml } = await import("@/lib/client-report-html");
    const { emptyAutoRecordsBlock, emptyCsddFields, SOURCE_BLOCK_LABELS } = await import("@/lib/admin-source-blocks");
    const csdd = {
      ...emptyCsddFields(),
      makeModel: "Mercedes-Benz GLE",
      technicalInspectionHistory: [{ date: "12.05.2025", inspectionType: "Periodiskā", ratingLabel: "0", defects: [] }],
      ownerRegistrationEvents: [{ date: "01.06.2023", label: "Reģistrācija" }],
      mileageHistory: [{ date: "12.05.2025", odometer: "145254", country: "Latvija" }],
    } as unknown as ReturnType<typeof emptyCsddFields>;
    const visit = (date: string, km: string) => ({ date, odometer: km, location: "Mercedes-Benz Tallinn", works: "Apkope A" });
    const doc = buildClientReportDocumentHtml({
      payload: {
        sessionId: "cs_test",
        vin: "WDC1671191A002835",
        created: Date.now(),
        amountTotal: 9999,
        currency: "eur",
        paymentStatus: "paid",
        listingUrl: null,
        customerEmail: null,
        customerPhone: null,
        customerName: null,
        contactMethod: null,
        notes: null,
        csdd: "",
        ltab: "",
        tirgus: "",
        citi: "",
        iriss: "",
        apskatesPlāns: "",
        tehniskoRiskuAnalize: "",
        csddForm: csdd,
        autoRecordsBlock: {
          ...emptyAutoRecordsBlock(),
          serviceWorks: [visit("01.10.2019", "24539"), visit("01.01.2022", "98756")],
          serviceHistory: [
            { date: "01.10.2019", odometer: "24539", country: "Igaunija" },
            { date: "01.01.2022", odometer: "98756", country: "Igaunija" },
          ],
        },
      } as unknown as Parameters<typeof buildClientReportDocumentHtml>[0]["payload"],
      portfolio: [],
      pdfInsights: [],
      dateFmt: new Intl.DateTimeFormat("lv-LV"),
      formatBytes: () => "0 B",
    });
    const grid = doc.match(/<ul class="pdf-sources-checked-grid">[\s\S]*?<\/ul>/)?.[0] ?? "";
    const gridCount = (label: string) =>
      grid.match(new RegExp(`${label}</span><span class="pdf-sources-checked-count">([^<]+)<`))?.[1];
    expect(gridCount(SOURCE_BLOCK_LABELS.csdd)).toBe("3 ieraksti");
    // dīleris: 2 vizītes, nevis 4 (darbu + nobraukuma rinda katrai vizītei)
    expect(gridCount("OFICIĀLĀ DĪLERA DATI")).toBe("2 ieraksti");
    // sadaļu virsrakstos tie paši skaitļi
    expect((doc.match(/pdf-src-count-badge[^>]*>3 ieraksti</g) ?? []).length).toBeGreaterThanOrEqual(1);
    expect((doc.match(/pdf-src-count-badge[^>]*>2 ieraksti</g) ?? []).length).toBeGreaterThanOrEqual(1);
  });
});
