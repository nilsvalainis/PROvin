import { describe, expect, it } from "vitest";
import { emptyCsddFields } from "@/lib/admin-source-blocks";
import {
  buildUnifiedIncidentsTableHtml,
  buildUnifiedMileageTableHtml,
  type ClientReportPayload,
} from "@/lib/client-report-html";
import { mergePdfVisibility } from "@/lib/pdf-visibility";

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
