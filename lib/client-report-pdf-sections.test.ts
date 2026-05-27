import { describe, expect, it } from "vitest";
import { emptyCsddFields, emptyCitiAvotiSection } from "@/lib/admin-source-blocks";
import {
  buildUnifiedIncidentsTableHtml,
  buildUnifiedMileageTableHtml,
  buildClientReportDocumentHtml,
  type ClientReportPayload,
} from "@/lib/client-report-html";
import { buildOutvinDealerReportPdfInnerHtml } from "@/lib/outvin-dealer-pdf-html";
import { emptyOutvinDealerReport } from "@/lib/outvin-dealer-types";
import { mergePdfVisibility } from "@/lib/pdf-visibility";

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
    cenasAtbilstiba: "",
    ...overrides,
  } as ClientReportPayload;
}

describe("unified PDF sections single block", () => {
  it("mileage zone is one card: chart, table, source count, comment", () => {
    const csdd = emptyCsddFields();
    csdd.mileageHistory.push({ date: "2020-06-01", odometer: "120000", country: "LV" });
    const html = buildUnifiedMileageTableHtml({
      csddForm: csdd,
      mileageComment: "Nobraukuma komentārs",
    });
    expect(html).toContain("pdf-unified-mileage-zone__body");
    expect(html).not.toContain("pdf-unified-mileage-zone--continued");
    expect(html.indexOf("NOBRAUKUMA VĒSTURE")).toBeLessThan(html.indexOf("Nobraukuma komentārs"));
    expect(html.indexOf("Grafika ģenerēšanā izmantotais avotu skaits:")).toBeLessThan(
      html.indexOf("Nobraukuma komentārs"),
    );
  });

  it("incidents zone is one card: table, source count, kopsavilkums", () => {
    const p = {
      internalComment: "Kopsavilkuma teksts",
      manualVendorBlocks: [
        {
          title: "AutoDNA",
          mileageRows: [],
          incidentRows: [{ csngDate: "2021-06-01", lossAmount: "1200", incidentNo: "LV" }],
          comments: "",
          pdfChecklist: { incidents: false, mileageHistory: false, mileageLine: false },
        },
      ],
    } as ClientReportPayload;
    const vis = mergePdfVisibility({ unifiedIncidents: true });
    const html = buildUnifiedIncidentsTableHtml(p, vis);
    expect(html).toContain("pdf-unified-incidents-zone__body");
    expect(html).not.toContain("pdf-unified-incidents-zone--continued");
    expect(html).toContain("NEGADĪJUMU VĒSTURES KOPSAVILKUMS");
    expect(html.indexOf("Grafika ģenerēšanā izmantotais avotu skaits:")).toBeLessThan(
      html.indexOf("Kopsavilkuma teksts"),
    );
  });
});

describe("CITI AVOTI and Outvin PDF labels", () => {
  it("citi avoti subheads use manual label only, without CITI AVOTI prefix", () => {
    const p = {
      citiAvoti: {
        sections: [
          { ...emptyCitiAvotiSection(), label: "Mans avots", comments: "Teksts" },
        ],
      },
    } as ClientReportPayload;
    const vis = mergePdfVisibility({ citi_avoti: true, unifiedMileage: false, unifiedIncidents: false });
    const doc = buildClientReportDocumentHtml({
      payload: minimalPayload({
        citiAvoti: p.citiAvoti,
        pdfVisibility: vis,
      }),
      portfolio: [],
      pdfInsights: [],
      dateFmt: new Intl.DateTimeFormat("lv-LV"),
      formatBytes: () => "0 B",
    });
    expect(doc).toContain("Mans avots");
    expect(doc).not.toContain("CITI AVOTI — Mans avots");
  });

  it("outvin vehicle info uses single-column pdf-v1-kv", () => {
    const report = emptyOutvinDealerReport();
    report.vehicleInfo.vinCode = "WVWZZZ";
    report.vehicleInfo.model = "Golf";
    const html = buildOutvinDealerReportPdfInnerHtml(report);
    expect(html).toContain("pdf-v1-kv");
    expect(html).not.toContain("mirror-table--outvin-vehicle");
    expect(html).not.toContain("pdf-outvin-equipment-grid");
  });
});
