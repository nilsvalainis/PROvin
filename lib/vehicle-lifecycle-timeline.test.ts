import { describe, expect, it } from "vitest";
import { SOURCE_BLOCK_LABELS } from "@/lib/admin-source-blocks";
import { buildClientReportDocumentHtml, type ClientReportPayload } from "@/lib/client-report-html";
import {
  buildVehicleLifecycleEvents,
  lifecycleEventProvidesCountryResidence,
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
      expect(e.countryUnverified).toBe(true);
      expect(lifecycleEventProvidesCountryResidence(e)).toBe(false);
      expect(e.detail).toMatch(/Pārdošanai piedāvātas/);
    }
    expect(listed.map((e) => e.country).sort()).toEqual(["Nīderlande", "Polija", "Vācija"]);

    const imports = events.filter((e) => e.kind === "import");
    expect(imports).toHaveLength(1);
    expect(imports[0]!.detail).toBe("Vācija → Latvija");
    expect(imports.some((e) => /Nīderlande|Polija/.test(e.detail) && !/Latvija/.test(e.detail))).toBe(
      false,
    );
  });

  it("PDF-off sludinājumu valstis uz odometra rindām arī neskaitās kā pārvietošanās", () => {
    const events = buildVehicleLifecycleEvents({
      manualVendorBlocks: [
        {
          title: SOURCE_BLOCK_LABELS.autodna,
          mileageRows: [
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
    expect(html).toMatch(/aria-label="Vācija → Latvija"/);
    expect(html).not.toMatch(/aria-label="Vācija → Nīderlande"/);
    expect(html).not.toMatch(/aria-label="Nīderlande → Polija"/);
    expect(html).not.toMatch(/aria-label="Polija → Latvija"/);
    expect((html.match(/pdf-life-item--import/g) ?? []).length).toBe(1);
  });
});
