import { describe, expect, it } from "vitest";
import { emptyCsddFields, emptyCitiAvotiSection, SOURCE_BLOCK_LABELS } from "@/lib/admin-source-blocks";
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

  it("merges same km from multiple sources into one row with multiple stripes", () => {
    const csdd = emptyCsddFields();
    csdd.mileageHistory.push({ date: "2020-06-01", odometer: "120000", country: "LV" });
    const html = buildUnifiedMileageTableHtml({
      csddForm: csdd,
      manualVendorBlocks: [
        {
          title: "AutoDNA",
          mileageRows: [{ date: "2020-07-01", odometer: "120000", country: "DE" }],
          incidentRows: [],
          comments: "",
        },
      ],
    });
    const rowMatches = html.match(/pdf-mileage-history-row/g) ?? [];
    expect(rowMatches.length).toBe(1);
    expect(html).toContain("pdf-mileage-source-stripes");
    expect(html).toContain("pdf-mileage-source-stripe--csdd");
    expect(html).toContain("pdf-mileage-source-stripe--autodna");
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
    expect(html).toContain("pdf-mileage-cell-src");
    expect(html).toContain("pdf-mileage-source-stripe");
    expect(html).toContain("pdf-mileage-legend-terms-row");
    expect(html).toContain("pdf-mileage-source-count-abbrevs");
  });

  it("embeds CarVertical damage detail under matching incident row", () => {
    const p = {
      internalComment: "Kopsavilkums",
      manualVendorBlocks: [
        {
          title: SOURCE_BLOCK_LABELS.carvertical,
          mileageRows: [],
          incidentRows: [{ csngDate: "00.06.2024", lossAmount: "5001 € – 10 000 €", incidentNo: "Šveice" }],
          comments: "",
          damageDetails: [
            {
              date: "00.06.2024",
              country: "Šveice",
              lossAmount: "5001 € – 10 000 €",
              damagedSides: "Kreisā puse Priekšpuse",
              damageGroups: "Ārējās virsbūves detaļas",
            },
          ],
        },
      ],
    } as ClientReportPayload;
    const vis = mergePdfVisibility({ unifiedIncidents: true });
    const html = buildUnifiedIncidentsTableHtml(p, vis);
    expect(html).toContain("pdf-cv-damage-sub");
    expect(html).toContain("Kreisā puse Priekšpuse");
    expect(html).not.toContain("pdf-cv-damage-chart");
    expect(html.indexOf("Kreisā puse Priekšpuse")).toBeGreaterThan(html.indexOf("00.06.2024"));
    expect(html.indexOf("Kopsavilkums")).toBeGreaterThan(html.indexOf("Kreisā puse Priekšpuse"));
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

  it("PDF footer includes bold confidentiality notice under SVARĪGA INFORMĀCIJA", () => {
    const doc = buildClientReportDocumentHtml({
      payload: minimalPayload(),
      dateFmt: new Intl.DateTimeFormat("lv-LV"),
      formatBytes: () => "0 B",
    });
    expect(doc).toContain("SVARĪGA INFORMĀCIJA");
    expect(doc).toContain("digitāls datu apkopojums");
    expect(doc).toContain('class="pdf-site-footer__confidentiality"');
    expect(doc).toContain("kategoriski aizliegts pavairot");
    expect(doc).toContain(`© ${new Date().getFullYear()} PROVIN.LV`);
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
