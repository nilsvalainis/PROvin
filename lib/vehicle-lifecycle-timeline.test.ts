import { describe, expect, it } from "vitest";
import { SOURCE_BLOCK_LABELS } from "@/lib/admin-source-blocks";
import { buildClientReportDocumentHtml, type ClientReportPayload } from "@/lib/client-report-html";
import {
  buildVehicleLifecycleEvents,
  lifecycleCountryIsSoft,
  lifecycleEventProvidesCountryResidence,
  vendorTimelineIsInformational,
} from "@/lib/vehicle-lifecycle-timeline";
import { simultaneousDeNlPlListingVendorBlock } from "@/lib/vendor-timeline-listing.fixture";

function minimalPayload(overrides: Partial<ClientReportPayload> = {}): ClientReportPayload {
  return {
    sessionId: "cs_test",
    vin: "WVWZZZ1JZXW000001",
    created: Date.now(),
    amountTotal: 7999,
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
    cenasAtbilstiba: "",
    ...overrides,
  } as ClientReportPayload;
}

describe("laikposma sludinājumi nav valstu maiņa", () => {
  it("DE/NL/PL vienlaicīgi sludinājumi nerada importu starp tām valstīm", () => {
    const events = buildVehicleLifecycleEvents({
      manualVendorBlocks: [simultaneousDeNlPlListingVendorBlock()],
    });

    const listed = events.filter((e) => e.kind === "listed");
    expect(listed).toHaveLength(3);
    for (const e of listed) {
      expect(e.title).toBe("Sludinājums");
      expect(e.countryUnverified).toBeFalsy();
      expect(e.timelineInformational).toBe(true);
      expect(lifecycleCountryIsSoft(e)).toBe(true);
      expect(lifecycleEventProvidesCountryResidence(e)).toBe(false);
      expect(e.detail).toMatch(/Pārdošanai piedāvātas/);
    }
    expect(listed.map((e) => e.country).sort()).toEqual(["Nīderlande", "Polija", "Vācija"]);

    const firstReg = events.find((e) => e.kind === "first_registration");
    expect(firstReg?.timelineInformational).toBe(true);
    expect(lifecycleEventProvidesCountryResidence(firstReg!)).toBe(false);

    // Laikposma tabula (t.sk. „Reģistrēts” LV) neģenerē valsts maiņu - tikai nobraukums/negadījumi.
    const imports = events.filter((e) => e.kind === "import");
    expect(imports).toHaveLength(0);
  });

  it("PDF-off sludinājumu valstis uz odometra rindām arī neskaitās kā pārvietošanās", () => {
    const events = buildVehicleLifecycleEvents({
      manualVendorBlocks: [
        {
          title: SOURCE_BLOCK_LABELS.autodna,
          mileageRows: [
            { date: "10.06.2018", odometer: "5000", country: "Vācija" },
            { date: "15.03.2024", odometer: "148200", country: "Vācija" },
            { date: "18.03.2024", odometer: "148350", country: "Nīderlande" },
            { date: "20.03.2024", odometer: "148410", country: "Polija" },
            { date: "01.06.2024", odometer: "149000", country: "Latvija" },
          ],
          incidentRows: [],
          comments: "",
          vehicleHistoryTimeline: [
            {
              date: "01.06.2018",
              country: "Vācija",
              description: "Pirmā reģistrācija",
              includeInPdf: true,
            },
            {
              date: "15.03.2024",
              country: "Vācija",
              description: "Pārdošanai piedāvātas automašīnas",
              odometer: "148200",
              includeInPdf: false,
            },
            {
              date: "18.03.2024",
              country: "Nīderlande",
              description: "Pārdošanai piedāvātas automašīnas",
              odometer: "148350",
              includeInPdf: false,
            },
            {
              date: "20.03.2024",
              country: "Polija",
              description: "Pārdošanai piedāvātas automašīnas",
              odometer: "148410",
              includeInPdf: false,
            },
          ],
          listingCountryHints: [
            { date: "15.03.2024", country: "Vācija", odometer: "148200" },
            { date: "18.03.2024", country: "Nīderlande", odometer: "148350" },
            { date: "20.03.2024", country: "Polija", odometer: "148410" },
          ],
        },
      ],
    });

    const imports = events.filter((e) => e.kind === "import");
    expect(imports).toHaveLength(1);
    expect(imports[0]!.detail).toBe("Vācija → Latvija");
    expect(events.filter((e) => e.kind === "listed")).toHaveLength(0);
  });

  it("PDF vēstures kopsavilkumā nav DE→NL→PL karšu, sludinājumi paliek kā Sludinājums", () => {
    const html = buildClientReportDocumentHtml({
      payload: minimalPayload({
        manualVendorBlocks: [simultaneousDeNlPlListingVendorBlock()],
      }),
      portfolio: [],
      pdfInsights: [],
      dateFmt: new Intl.DateTimeFormat("lv-LV"),
      formatBytes: () => "0 B",
    });
    expect(html).toContain("Sludinājums");
    expect(html).toContain("Pārdošanai piedāvātas");
    expect(html).toContain("pdf-life-country--unverified");
    expect(html).not.toContain("(pēc sludinājuma, nav apstiprināts)");
    expect(html).not.toMatch(/aria-label="Vācija → Latvija"/);
    expect(html).not.toMatch(/aria-label="Vācija → Nīderlande"/);
    expect(html).not.toMatch(/aria-label="Nīderlande → Polija"/);
    expect(html).not.toMatch(/aria-label="Polija → Latvija"/);
    expect((html.match(/pdf-life-item--import/g) ?? []).length).toBe(0);
  });
});

describe("laikposma ieraksti ir informatīvi, nobraukums/negadījumi paliek stipri", () => {
  it("atzīst AutoDNA / CarVertical / Citi avoti un neatzīst reģistra hronoloģiju", () => {
    expect(vendorTimelineIsInformational(SOURCE_BLOCK_LABELS.autodna)).toBe(true);
    expect(vendorTimelineIsInformational(SOURCE_BLOCK_LABELS.carvertical)).toBe(true);
    expect(vendorTimelineIsInformational("CITI AVOTI - Francijas reģistri (HistoVec)")).toBe(true);
    expect(vendorTimelineIsInformational(SOURCE_BLOCK_LABELS.tjekbil)).toBe(false);
    expect(vendorTimelineIsInformational(SOURCE_BLOCK_LABELS.finnik)).toBe(false);
    expect(vendorTimelineIsInformational(SOURCE_BLOCK_LABELS.traficom_fi)).toBe(false);
  });

  it("HistoVec Cesija un citas laikposma rindas nerada Francija↔Vācija maiņas", () => {
    const events = buildVehicleLifecycleEvents({
      manualVendorBlocks: [
        {
          title: "CITI AVOTI - Francijas reģistri (HistoVec)",
          mileageRows: [
            { date: "10.01.2020", odometer: "12000", country: "Vācija" },
            { date: "01.08.2022", odometer: "48000", country: "Vācija" },
          ],
          incidentRows: [],
          comments: "",
          vehicleHistoryTimeline: [
            {
              date: "15.03.2021",
              country: "Francija",
              description: "Reģistrēts",
              includeInPdf: true,
            },
            {
              date: "23.06.2021",
              country: "Francija",
              description: "Cesija",
              includeInPdf: true,
            },
            {
              date: "02.02.2022",
              country: "Vācija",
              description: "Mainītas īpašumtiesības",
              includeInPdf: true,
            },
          ],
        },
      ],
    });

    const cesija = events.find((e) => e.title === "Cesija");
    expect(cesija).toBeTruthy();
    expect(cesija!.country).toBe("Francija");
    expect(cesija!.timelineInformational).toBe(true);
    expect(cesija!.countryUnverified).toBeFalsy();
    expect(cesija!.tone).toBe("info");
    expect(lifecycleEventProvidesCountryResidence(cesija!)).toBe(false);

    expect(events.filter((e) => e.kind === "import")).toHaveLength(0);
    expect(events.some((e) => e.kind === "import" && /Francija/.test(e.detail))).toBe(false);
  });

  it("nobraukuma tabulas valsts maiņa paliek, laikposma rinda to nesajauc", () => {
    const events = buildVehicleLifecycleEvents({
      manualVendorBlocks: [
        {
          title: SOURCE_BLOCK_LABELS.autodna,
          mileageRows: [
            { date: "01.01.2020", odometer: "100000", country: "Vācija" },
            { date: "01.06.2021", odometer: "120000", country: "Latvija" },
          ],
          incidentRows: [],
          comments: "",
          vehicleHistoryTimeline: [
            {
              date: "15.03.2021",
              country: "Francija",
              description: "Cesija",
              includeInPdf: true,
            },
          ],
        },
      ],
    });
    const imports = events.filter((e) => e.kind === "import");
    expect(imports).toHaveLength(1);
    expect(imports[0]!.detail).toBe("Vācija → Latvija");
    expect(events.find((e) => e.title === "Cesija")?.timelineInformational).toBe(true);
  });

  it("negadījumu tabulas valsts joprojām dzen maiņu", () => {
    const events = buildVehicleLifecycleEvents({
      manualVendorBlocks: [
        {
          title: SOURCE_BLOCK_LABELS.carvertical,
          mileageRows: [{ date: "01.01.2020", odometer: "80000", country: "Vācija" }],
          incidentRows: [{ csngDate: "05.06.2021", lossAmount: "1200 €", incidentNo: "Latvija" }],
          comments: "",
          vehicleHistoryTimeline: [
            {
              date: "10.02.2021",
              country: "Francija",
              description: "Cesija",
              includeInPdf: true,
            },
          ],
        },
      ],
    });
    const imports = events.filter((e) => e.kind === "import");
    expect(imports).toHaveLength(1);
    expect(imports[0]!.detail).toBe("Vācija → Latvija");
    expect(events.some((e) => e.kind === "incident")).toBe(true);
  });

  it("reģistra hronoloģija joprojām dzen valsts maiņu", () => {
    const events = buildVehicleLifecycleEvents({
      manualVendorBlocks: [
        {
          title: SOURCE_BLOCK_LABELS.tjekbil,
          mileageRows: [{ date: "18.12.2017", odometer: "29000", country: "Dānija" }],
          incidentRows: [],
          comments: "",
          vehicleHistoryTimeline: [
            { date: "18.12.2013", country: "Vācija", description: "Pirmā reģistrācija", odometer: "17" },
          ],
        },
      ],
    });
    const first = events.find((e) => e.kind === "first_registration");
    expect(first?.timelineInformational).toBeFalsy();
    expect(lifecycleEventProvidesCountryResidence(first!)).toBe(true);
    const imports = events.filter((e) => e.kind === "import");
    expect(imports).toHaveLength(1);
    expect(imports[0]!.detail).toBe("Vācija → Dānija");
  });
});
