import { describe, expect, it } from "vitest";
import { applyClientReportDynamicTranslations } from "@/lib/client-report-dynamic-i18n";
import { buildUnifiedMileageTableHtml } from "@/lib/client-report-html";
import { buildCanonicalFacts } from "@/lib/canonical-facts-sheet";
import { createDefaultSourceBlocks } from "@/lib/admin-source-blocks";
import {
  activeListingBelowAnomalies,
  classifyOdometerAnomalies,
  odometerAnomalyKey,
  type OdometerAnomalyOverride,
} from "@/lib/odometer-anomaly-classify";
import { buildPdfReportSummaryTiles } from "@/lib/pdf-report-summary";
import { checkPrePdfContradictions } from "@/lib/pre-pdf-contradiction-check";
import {
  analyzeUnifiedMileageAnomalies,
  collectUnifiedMileageRows,
  isListingBelowRecorded,
  prepareUnifiedMileageDisplayRows,
} from "@/lib/unified-mileage";

/** 24.11 (Nils A): anonimizēts gadījums - dīleris, sludinājums Vācijā par 13 880 km mazāk, dīleris. */
function payload(listingKm = "90000", beforeKm = "103880") {
  return {
    manualVendorBlocks: [
      {
        title: "AutoDNA",
        mileageRows: [
          { date: "18.08.2015", odometer: beforeKm, country: "Vācija" },
          { date: "27.09.2015", odometer: listingKm, country: "Vācija" },
          { date: "12.10.2015", odometer: "107993", country: "Vācija" },
        ],
        listingCountryHints: [{ date: "27.09.2015", country: "Vācija", odometer: listingKm }],
        incidentRows: [],
      },
    ],
  } as never;
}

function rowsOf(p: ReturnType<typeof payload>) {
  return prepareUnifiedMileageDisplayRows(collectUnifiedMileageRows(p));
}

function dismissAll(p: ReturnType<typeof payload>): OdometerAnomalyOverride[] {
  return classifyOdometerAnomalies(rowsOf(p))
    .filter((a) => a.class === "listing_below")
    .map((a) => ({ key: a.key, action: "dismiss" as const }));
}

describe("24.11 (Nils A): sludinājumā mazāks nobraukums nekā agrāk fiksēts", () => {
  it("slieksnis: > 1 000 km un > 2 %; noapaļošana nav pretruna", () => {
    expect(isListingBelowRecorded(90_000, 103_880)).toBe(true);
    expect(isListingBelowRecorded(90_000, 90_450)).toBe(false);
    expect(isListingBelowRecorded(98_500, 100_000)).toBe(false); // 1 500 km, bet 1,5 %
    expect(isListingBelowRecorded(20_000, 21_100)).toBe(true); // 1 100 km un 5,2 %
  });

  it("klase listing_below ar abiem skaitļiem un datumiem; nav odometra korekcija", () => {
    const rows = rowsOf(payload());
    const cls = classifyOdometerAnomalies(rows).filter((a) => a.class === "listing_below");
    expect(cls).toHaveLength(1);
    expect(cls[0]).toMatchObject({
      fromDate: "18.08.2015",
      fromKm: 103_880,
      toDate: "27.09.2015",
      toKm: 90_000,
      dropKm: 13_880,
      labelLv: "Sludinājumā mazāks nobraukums",
    });
    const a = analyzeUnifiedMileageAnomalies(rows);
    expect([...a.anomalyBySourceOrder.values()].some(Boolean)).toBe(false);
    expect(classifyOdometerAnomalies(rows).some((c) => c.class === "rollback")).toBe(false);
  });

  it("noapaļots sludinājums (90 000 pret 90 450) - nav klases, nav sarkanas rindas", () => {
    const p = payload("90000", "90450");
    expect(classifyOdometerAnomalies(rowsOf(p)).filter((a) => a.class === "listing_below")).toEqual([]);
    const html = buildUnifiedMileageTableHtml(p);
    expect(html).not.toContain("pdf-mileage-history-row--anomaly");
    expect(html).not.toContain("pdf-mileage-chart-marker");
  });

  it("PDF: sarkana rinda, sarkans marķieris grafikā, piezīme ar abiem skaitļiem", () => {
    const html = buildUnifiedMileageTableHtml(payload());
    expect(html).toContain("pdf-mileage-history-row--anomaly");
    expect(html).toContain("pdf-mileage-chart-marker");
    expect(html).toContain(
      "Sludinājumā (27.09.2015) norādīts 90 000 km - par 13 880 km mazāk nekā iepriekš fiksētais 103 880 km (18.08.2015).",
    );
    expect(html).not.toContain("Sludinājumā pārdevēja norādītais nobraukums ir mazāks par iepriekš fiksēto");
  });

  it("kopsavilkums: nav „bez pretrunām”, bet fakts brīdinājuma tonī", () => {
    const tile = buildPdfReportSummaryTiles(payload()).find((t) => t.id === "mileage")!;
    expect(tile.note).toBe("sludinājumā par 13 880 km mazāk nekā fiksēts");
    expect(tile.note).not.toMatch(/bez pretrunām/);
    expect(tile.tone).toBe("warn");
  });

  it("pre-PDF pārbaude rāda sludinājuma karogu", () => {
    const flags = checkPrePdfContradictions({ summaryInput: payload() });
    const f = flags.find((x) => x.id.startsWith("odo_listing_below_"));
    expect(f?.level).toBe("W");
    expect(f?.message).toContain("par 13 880 km mazāk");
  });

  it("operators atceļ karogu - kā līdz šim (dzeltena piezīme, grafikā nav, „bez pretrunām”)", () => {
    const p = payload();
    const overrides = dismissAll(p);
    expect(overrides).toHaveLength(1);
    expect(activeListingBelowAnomalies(rowsOf(p), overrides)).toEqual([]);

    const html = buildUnifiedMileageTableHtml({ ...(p as object), odometerAnomalyOverrides: overrides } as never);
    expect(html).not.toContain("pdf-mileage-history-row--anomaly");
    expect(html).not.toContain("pdf-mileage-chart-marker");
    expect(html).toContain("Sludinājumā pārdevēja norādītais nobraukums ir mazāks par iepriekš fiksēto");

    const tile = buildPdfReportSummaryTiles({ ...(p as object), odometerAnomalyOverrides: overrides } as never).find(
      (t) => t.id === "mileage",
    )!;
    expect(tile.tone).toBe("ok");
    expect(tile.note).not.toMatch(/mazāk nekā fiksēts/);

    const flags = checkPrePdfContradictions({ summaryInput: p, overrides });
    expect(flags.some((x) => x.id.startsWith("odo_listing_below_") || x.id === "c2_listing_below_clean_header")).toBe(
      false,
    );
  });

  it("atcelšana der arī PDF ar izslēgtu avotu (cits sourceOrder)", () => {
    const rows = rowsOf(payload());
    const listing = classifyOdometerAnomalies(rows).find((a) => a.class === "listing_below")!;
    const row = rows.find((r) => r.sourceOrder === listing.sourceOrder)!;
    const shifted = [{ key: odometerAnomalyKey({ ...row, sourceOrder: row.sourceOrder + 7 }), action: "dismiss" as const }];
    expect(activeListingBelowAnomalies(rows, shifted)).toEqual([]);
  });

  it("AI fakti: abi skaitļi un datumi", () => {
    const blocks = createDefaultSourceBlocks();
    blocks.autodna = {
      ...blocks.autodna,
      serviceHistory: [
        { date: "18.08.2015", odometer: "103880", country: "Vācija" },
        { date: "27.09.2015", odometer: "90000", country: "Vācija" },
        { date: "12.10.2015", odometer: "107993", country: "Vācija" },
      ],
      vehicleHistoryTimeline: [
        { date: "27.09.2015", country: "Vācija", description: "Pārdošanai piedāvātas automašīnas", odometer: "90000" },
      ],
    } as typeof blocks.autodna;
    const facts = buildCanonicalFacts({ sourceBlocks: blocks });
    expect(facts.listingBelowRecorded).toHaveLength(1);
    expect(facts.listingBelowRecorded![0]).toMatchObject({ fromKm: 103_880, km: 90_000, dropKm: 13_880 });
    expect(facts.sheet).toMatch(/sludinājumā 27\.09\.2015 90.000 km .*agrāk fiksēts 18\.08\.2015 103.880 km .*par 13.880 km mazāk/);
    expect(facts.rollbacks).toEqual([]);
  });

  it("4 valodas: piezīme un kopsavilkuma teksts tulkoti", () => {
    const note =
      "Sludinājumā (27.09.2015) norādīts 90 000 km - par 13 880 km mazāk nekā iepriekš fiksētais 103 880 km (18.08.2015).";
    const html = `<html><body><p>${note}</p><p>sludinājumā par 13 880 km mazāk nekā fiksēts</p></body></html>`;
    expect(applyClientReportDynamicTranslations(html, "lv")).toBe(html);
    const en = applyClientReportDynamicTranslations(html, "en");
    expect(en).toContain("The listing (27.09.2015) states 90 000 km - 13 880 km less than the previously recorded 103 880 km (18.08.2015).");
    expect(en).toContain("listing shows 13 880 km less than recorded");
    expect(applyClientReportDynamicTranslations(html, "ru")).toContain("на 13 880 км меньше, чем зафиксировано");
    expect(applyClientReportDynamicTranslations(html, "de")).toContain("im Inserat 13 880 km weniger als erfasst");
  });
});
