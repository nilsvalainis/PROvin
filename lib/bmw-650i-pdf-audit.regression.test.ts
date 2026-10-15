/**
 * BMW 650i WBAYM9C55DDW20079 - Copart USA / Luiziāna.
 * CarVertical kļūdaini raksta „Kanāda”. PDF ģenerācijas regresija, ne dizains.
 */
import { describe, expect, it } from "vitest";
import { emptyAutoRecordsBlock, emptyCsddFields, emptyTirgusFields, SOURCE_BLOCK_LABELS } from "@/lib/admin-source-blocks";
import { emptyAsvBlock } from "@/lib/asv-report";
import { countryLabelToIso2, normalizeCountryNameLv } from "@/lib/country-names-lv";
import { pdfCountryCodeLetters, pdfCountryFlagEmoji, PDF_COUNTRY_FLAG_EU } from "@/lib/pdf-country-flags";
import { printableDealerServiceWorks } from "@/lib/pdf-dealer-service-visits";
import { buildPdfReportSummaryTiles } from "@/lib/pdf-report-summary";
import { aggregateUnifiedIncidents, collectUnifiedIncidentRows } from "@/lib/unified-incidents";
import {
  analyzeUnifiedMileageAnomalies,
  collectUnifiedMileageRows,
  MILES_TO_KM,
  prepareUnifiedMileageDisplayRows,
} from "@/lib/unified-mileage";
import { buildVehicleLifecycleEvents } from "@/lib/vehicle-lifecycle-timeline";
import { synthesizeOwnerCountsFromPdfInput } from "@/lib/owner-count-synthesis";

const VIN = "WBAYM9C55DDW20079";

function bmw650iShape() {
  const csdd = emptyCsddFields();
  const dealer = {
    ...emptyAutoRecordsBlock(),
    serviceHistory: [
      { date: "15.12.2013", odometer: "42150", country: "ASV" },
      { date: "02.06.2018", odometer: "88200", country: "ASV" },
      { date: "02.06.2018", odometer: "88310", country: "ASV" },
    ],
    serviceWorks: [
      { date: "02.06.2018", odometer: "88200", location: "Baton Rouge, LA", works: "Eļļas maiņa" },
      { date: "02.06.2018", odometer: "88310", location: "Baton Rouge, LA", works: "Bremžu pārbaude" },
    ],
  };
  const asv = {
    ...emptyAsvBlock(),
    reportDate: "15.01.2024 20:00",
    damages: [
      {
        date: "10.03.2023",
        description: "Front end",
        amount: "4 200 €",
        region: "Luiziāna (LA)",
      },
    ],
    sales: [
      {
        date: "12.03.2023",
        venue: "Copart, Baton Rouge, LA",
        odometer: "91000",
        price: "6 500 €",
        status: "Pārdots",
      },
    ],
    mileage: [{ date: "12.03.2023", odometer: "91200", country: "Baton Rouge, LA" }],
  };
  const carvertical = {
    title: SOURCE_BLOCK_LABELS.carvertical,
    mileageRows: [
      { date: "12.2013", odometer: "42080", country: "Kanāda" },
      { date: "01.06.2016", odometer: "12000", country: "Kanāda" },
      { date: "01.08.2016", odometer: "61000", country: "Kanāda" },
      { date: "12.03.2023", odometer: "90900", country: "Kanāda" },
    ],
    incidentRows: [
      { csngDate: "18.03.2023", lossAmount: "4 200 €", incidentNo: "Kanāda" },
    ],
    comments: "",
    vehicleHistoryTimeline: [
      { date: "01.06.2014", country: "Kanāda", description: "Mainītas īpašumtiesības", includeInPdf: true },
      { date: "15.09.2017", country: "Kanāda", description: "Mainītas īpašumtiesības", includeInPdf: true },
      { date: "10.03.2023", country: "Kanāda", description: "Mainītas īpašumtiesības", includeInPdf: true },
      { date: "10.03.2023", country: "Kanāda", description: "Fiksēts novērtējums", includeInPdf: true },
    ],
    damageDetails: [],
  };
  const tirgus = {
    ...emptyTirgusFields(),
    listingCreated: "01.04.2024",
    listingMileageDate: "01.04.2024",
    listingMileageOdometer: "87000",
    listingMileageCountry: "Latvija",
  };
  return {
    vin: VIN,
    csddForm: csdd,
    autoRecordsBlock: dealer,
    asvBlock: asv,
    manualVendorBlocks: [carvertical],
    tirgusForm: tirgus,
    listingUrl: "https://www.copart.com/lot/650i-louisiana",
  };
}

describe("BMW 650i WBAYM9C55DDW20079 PDF audit regression", () => {
  it("maps Copart Louisiana to US and does not show an EU flag", () => {
    expect(countryLabelToIso2("Baton Rouge, LA")).toBe("US");
    expect(normalizeCountryNameLv("Luiziāna (LA)")).toBe("ASV");
    expect(pdfCountryFlagEmoji("Baton Rouge, LA")).toBe("🇺🇸");
    expect(pdfCountryCodeLetters("Nezināma ostas pilsēta")).toBe("");
    expect(pdfCountryFlagEmoji("Nezināma ostas pilsēta")).not.toBe(PDF_COUNTRY_FLAG_EU);
  });

  it("does not treat CarVertical Kanāda vs Copart US as a border crossing on the same event", () => {
    const input = bmw650iShape();
    const events = buildVehicleLifecycleEvents(input);
    const imports = events.filter((e) => e.kind === "import");
    expect(imports.every((e) => countryLabelToIso2(e.fromCountry ?? "") && countryLabelToIso2(e.country))).toBe(true);
    expect(imports.some((e) => /Kanāda/.test(e.detail) && /ASV/.test(e.detail))).toBe(false);
    const merged = events.find((e) => /Avoti atšķiras valstī/.test(e.detail));
    expect(merged).toBeTruthy();
  });

  it("keeps stale / isolated-drop readings out of the lifecycle as normal odometer rows", () => {
    const input = bmw650iShape();
    const rows = prepareUnifiedMileageDisplayRows(collectUnifiedMileageRows(input));
    const { anomalyBySourceOrder, dataEntryErrorSourceOrders, staleDocumentSourceOrders } =
      analyzeUnifiedMileageAnomalies(rows);
    expect(dataEntryErrorSourceOrders.size).toBeGreaterThan(0);
    expect([...anomalyBySourceOrder.entries()].some(([order, anom]) => anom && dataEntryErrorSourceOrders.has(order))).toBe(
      false,
    );
    const events = buildVehicleLifecycleEvents(input);
    const odo = events.filter((e) => e.kind === "odometer" || e.kind === "anomaly");
    for (const order of dataEntryErrorSourceOrders) {
      const row = rows.find((r) => r.sourceOrder === order);
      expect(odo.some((e) => e.odometer === row?.odometer && e.kind === "odometer")).toBe(false);
    }
    expect(staleDocumentSourceOrders.size).toBeGreaterThanOrEqual(0);
  });

  it("treats CarVertical month-only 12.2013 as the same month as the dealer reading", () => {
    const input = bmw650iShape();
    const rows = prepareUnifiedMileageDisplayRows(collectUnifiedMileageRows(input));
    const dec2013 = rows.filter((r) => r.date.includes("2013") && r.date.includes("12"));
    expect(dec2013.length).toBe(1);
    expect(dec2013[0]?.sourceLabels.join(" ")).toMatch(/CarVertical/i);
    expect(dec2013[0]?.sourceLabels.join(" ")).toMatch(/DĪLER|DEALER|OFICIĀL/i);
    const { anomalyBySourceOrder } = analyzeUnifiedMileageAnomalies(rows);
    expect(anomalyBySourceOrder.get(dec2013[0]!.sourceOrder)).toBe(false);
  });

  it("does not flag listing km below the newest dealer reading as a contradiction", () => {
    const input = bmw650iShape();
    const rows = prepareUnifiedMileageDisplayRows(collectUnifiedMileageRows(input));
    const listing = rows.find((r) => r.sourceLabels.some((l) => /ss\.lv|sludin|copart/i.test(l)) || r.countryUnverified);
    expect(listing).toBeTruthy();
    const { anomalyBySourceOrder } = analyzeUnifiedMileageAnomalies(rows);
    if (listing) expect(anomalyBySourceOrder.get(listing.sourceOrder)).toBe(false);
  });

  it("converts miles with unit mi × 1.609344 and fills Avots", () => {
    const rows = collectUnifiedMileageRows({
      manualVendorBlocks: [
        {
          title: SOURCE_BLOCK_LABELS.carvertical,
          mileageRows: [{ date: "01.01.2015", odometer: "10000", country: "ASV", unit: "mi" }],
          incidentRows: [],
          comments: "",
        },
      ],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.odometer).toBe(String(Math.round(10000 * MILES_TO_KM)));
    expect(rows[0]?.sourceLabel).toBe(SOURCE_BLOCK_LABELS.carvertical);
    const display = prepareUnifiedMileageDisplayRows(rows);
    expect(display[0]?.sourceLabels).toEqual([SOURCE_BLOCK_LABELS.carvertical]);
  });

  it("takes the mileage tile from dealer, not the listing", () => {
    const tiles = buildPdfReportSummaryTiles(bmw650iShape());
    const mileage = tiles.find((t) => t.id === "mileage");
    expect(mileage?.value).toMatch(/88\s*310|88310/);
    expect(mileage?.value).not.toMatch(/90000/);
  });

  it("dedupes same-day dealer visits within 150 km", () => {
    const visits = printableDealerServiceWorks(bmw650iShape().autoRecordsBlock.serviceWorks);
    expect(visits).toHaveLength(1);
    expect(visits[0]?.date).toBe("02.06.2018");
  });

  it("dedupes accidents within 1 month with the same amount (Kanāda vs Luiziāna)", () => {
    const input = bmw650iShape();
    const agg = aggregateUnifiedIncidents(
      collectUnifiedIncidentRows({
        manualVendorBlocks: input.manualVendorBlocks,
        asvBlock: input.asvBlock,
      }),
      input.manualVendorBlocks[0]!.damageDetails,
    );
    expect(agg.uniqueCount).toBe(1);
    expect(agg.clusters[0]?.sourceValuations.length).toBeGreaterThan(1);
  });

  it("shows owner count from CarVertical ownership changes instead of Nav ierakstu", () => {
    const syn = synthesizeOwnerCountsFromPdfInput(bmw650iShape());
    expect(syn.totalCount).toBe(3);
    const tiles = buildPdfReportSummaryTiles(bmw650iShape());
    const owners = tiles.find((t) => t.id === "owners");
    expect(owners?.value).not.toBe("Nav ierakstu");
    expect(owners?.value).toMatch(/3/);
  });
});
