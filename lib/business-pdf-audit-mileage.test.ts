/**
 * Business PDF audits 23.11.2026 (Opel Vivaro furgons) - nobraukuma un kopsavilkuma labojumi.
 * A1 servisa ierakstu skaits, A6/A7 izsoles km nav «sludinājums», A8 odometra notikums pie dīlera vizītes,
 * A15/A17 rādījumu un avotu skaiti, A16 piegādes km grafikā, A18 mēneša datumi, D42 izsoles valsts.
 */
import { describe, expect, it } from "vitest";
import { emptyAutoRecordsBlock, type ClientManualVendorBlockPdf } from "@/lib/admin-source-blocks";
import { emptyCcVinBlock } from "@/lib/cc-vin-report";
import { buildPdfReportSummaryTiles } from "@/lib/pdf-report-summary";
import {
  collectUnifiedMileageRows,
  formatMileageRowDateLabel,
  isListingMileageSource,
  parseChartOdometerKm,
  prepareUnifiedMileageDisplayRows,
} from "@/lib/unified-mileage";
import { selectNewestChartMileageRow } from "@/lib/odometer-anomaly-classify";
import { buildUnifiedMileageTableHtml } from "@/lib/client-report-html";
import { buildVehicleLifecycleEvents } from "@/lib/vehicle-lifecycle-timeline";

function dealerBlock() {
  const ar = emptyAutoRecordsBlock();
  ar.serviceHistory = [
    { date: "16.09.2026", odometer: "210481", country: "Vācija" },
    { date: "04.05.2026", odometer: "201149", country: "Vācija" },
    { date: "28.02.2023", odometer: "86314", country: "Vācija" },
    { date: "17.12.2020", odometer: "5", country: "Vācija" },
  ];
  ar.serviceWorks = [
    { date: "16.09.2026", odometer: "210481", location: "Germany", works: "Ģeneratora maiņa." },
    { date: "04.05.2026", odometer: "201149", location: "Germany", works: "Gaisa kondicioniera uzpilde." },
    { date: "17.12.2020", odometer: "5", location: "Germany", works: "Pirmspārdošanas sagatavošana." },
  ];
  return ar;
}

const autodna: ClientManualVendorBlockPdf = {
  title: "AutoDNA",
  mileageRows: [
    { date: "30.09.2026", odometer: "210648", country: "Vācija" },
    { date: "01.04.2026", odometer: "200500", country: "Vācija" },
  ],
  incidentRows: [],
  comments: "",
  listingCountryHints: [{ date: "30.09.2026", country: "Vācija", odometer: "210648" }],
} as ClientManualVendorBlockPdf;

const carvertical: ClientManualVendorBlockPdf = {
  title: "CarVertical",
  mileageRows: [
    { date: "01.04.2026", odometer: "200500", country: "Vācija" },
    { date: "01.12.2020", odometer: "17", country: "Vācija" },
  ],
  incidentRows: [],
  comments: "",
} as ClientManualVendorBlockPdf;

function auctionBlock() {
  const cc = emptyCcVinBlock();
  cc.mileage = [{ date: "01.10.2026", odometer: "210 648 km", country: "EU" }];
  cc.thecarapiRecords = [
    {
      site: "openlane",
      id: "1",
      date: "2026-10-01",
      venue: "Openlane",
      fields: [{ key: "car_country_extended", label: "car_country_extended", value: "DE" }],
      photos: [],
    } as unknown as NonNullable<typeof cc.thecarapiRecords>[number],
  ];
  return cc;
}

function input() {
  return {
    autoRecordsBlock: dealerBlock(),
    ccVinBlock: auctionBlock(),
    manualVendorBlocks: [autodna, carvertical],
  };
}

describe("Business PDF audits 23.11 - nobraukums un kopsavilkums", () => {
  it("A1: servisa vēsture skaita vizītes, nevis darbu + nobraukuma rindas kopā", () => {
    const tile = buildPdfReportSummaryTiles(input()).find((t) => t.id === "service")!;
    expect(tile.value).toBe("3 ieraksti");
  });

  it("A7/A6: izsoles km (apstiprināts) ir galvenais nobraukums, nevis «sludinājumā»", () => {
    const tile = buildPdfReportSummaryTiles(input()).find((t) => t.id === "mileage")!;
    expect(tile.value).toBe("210 648 km");
    expect(tile.noteSegments ?? []).toEqual([]);
    expect(tile.note).toMatch(/rādījumi bez pretrunām$/);
  });

  it("A7: izsoles + AutoDNA sludinājuma rinda nav «sludinājums», valsts no izsoles ieraksta (D42)", () => {
    const rows = prepareUnifiedMileageDisplayRows(collectUnifiedMileageRows(input()));
    const auction = rows.find((r) => r.odometer.replace(/\D/g, "") === "210648")!;
    expect(isListingMileageSource(auction)).toBe(false);
    expect(auction.country).toBe("Vācija");
    expect(selectNewestChartMileageRow(rows)?.odometer.replace(/\D/g, "")).toBe("210648");
  });

  it("A18: AutoDNA «01.04.2026» kopā ar CarVertical mēnesi drukājas «04.2026»", () => {
    const rows = prepareUnifiedMileageDisplayRows(collectUnifiedMileageRows(input()));
    const april = rows.find((r) => r.odometer.replace(/\D/g, "") === "200500")!;
    expect(april.datePrecision).toBe("month");
    expect(formatMileageRowDateLabel(april)).toBe("04.2026");
    expect(formatMileageRowDateLabel({ date: "16.09.2026", datePrecision: "day" })).toBe("16.09.2026");
  });

  it("A18: dīlera vizīte mēneša 1. datumā paliek ar dienu", () => {
    const ar = emptyAutoRecordsBlock();
    ar.serviceHistory = [{ date: "01.06.2019", odometer: "145287", country: "Francija" }];
    const cv = { ...carvertical, mileageRows: [{ date: "01.06.2019", odometer: "145287", country: "Francija" }] };
    const rows = prepareUnifiedMileageDisplayRows(
      collectUnifiedMileageRows({ autoRecordsBlock: ar, manualVendorBlocks: [cv] }),
    );
    expect(rows[0]!.datePrecision).toBe("day");
  });

  it("A16: piegādes rādījumi (5 / 17 km) tiek zīmēti grafikā", () => {
    expect(parseChartOdometerKm("5")).toBe(5);
    expect(parseChartOdometerKm("17")).toBe(17);
    expect(parseChartOdometerKm("210 648")).toBe(210648);
    expect(parseChartOdometerKm("")).toBeNull();
  });

  it("A15/A16/A17: grafiks sākas ar 2020, punkti ir «rādījumi», avotu skaits = leģenda", () => {
    const html = buildUnifiedMileageTableHtml(input());
    expect(html).toContain(">2020<");
    expect(html).toMatch(/\d+ rādījumi/);
    const legendItems = (html.match(/pdf-src-legend__item/g) ?? []).length;
    expect(html).toContain(`avotu skaits: ${legendItems}<`);
    expect(html).toContain("04.2026");
    expect(html).not.toContain("01.04.2026");
  });

  it("A8: dīlera km, ko CarVertical rāda kā sludinājumu, nav atsevišķs «pēc sludinājuma» notikums", () => {
    const cvListing = {
      ...carvertical,
      mileageRows: [...carvertical.mileageRows, { date: "16.09.2026", odometer: "210481", country: "Vācija" }],
      listingCountryHints: [{ date: "16.09.2026", country: "Vācija", odometer: "210481" }],
    } as ClientManualVendorBlockPdf;
    const events = buildVehicleLifecycleEvents({
      autoRecordsBlock: dealerBlock(),
      manualVendorBlocks: [autodna, cvListing],
    });
    const sameDay = events.filter((e) => e.date === "16.09.2026");
    expect(sameDay.some((e) => e.kind === "odometer")).toBe(false);
    expect(sameDay.every((e) => !e.countryUnverified)).toBe(true);
  });
});
