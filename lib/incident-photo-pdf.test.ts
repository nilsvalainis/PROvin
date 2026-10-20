import { describe, expect, it } from "vitest";
import { buildUnifiedIncidentsTableHtml, type ClientReportPayload } from "@/lib/client-report-html";
import { mergePdfVisibility } from "@/lib/pdf-visibility";

describe("incident photo groups in client report", () => {
  it("renders each incident photo group with its own heading", () => {
    const photoA = "inc_ph_aabbccddeeff001122334455";
    const photoB = "inc_ph_112233445566778899aabbcc";
    const p = {
      internalComment: "Kopsavilkuma teksts",
      incidentPhotos: [{ id: photoA }, { id: photoB }],
      incidentPhotoGroups: [
        {
          id: "inc_phg_aabbccddeeff001122334455",
          title: "Arhīva fotogrāfijas 2021-06-01",
          photos: [{ id: photoA }],
        },
        {
          id: "inc_phg_112233445566778899aabbcc",
          title: "Arhīva fotogrāfijas 2024-03-12",
          photos: [{ id: photoB }],
        },
      ],
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
    const urls = new Map<string, string>([
      [photoA, "data:image/jpeg;base64,/9j/AAAA"],
      [photoB, "data:image/jpeg;base64,/9j/BBBB"],
    ]);
    const html = buildUnifiedIncidentsTableHtml(p, vis, urls);
    expect(html).toContain("pdf-incident-photos");
    expect((html.match(/class="pdf-listing-photo-group"/g) ?? []).length).toBe(2);
    expect((html.match(/pdf-subhead--photo/g) ?? []).length).toBe(2);
    expect(html).toContain("Arhīva fotogrāfijas 2021-06-01");
    expect(html).toContain("Arhīva fotogrāfijas 2024-03-12");
    expect(html.indexOf("Arhīva fotogrāfijas 2021-06-01")).toBeLessThan(
      html.indexOf("Arhīva fotogrāfijas 2024-03-12"),
    );
    expect((html.match(/class="pdf-listing-photo-img"/g) ?? []).length).toBe(2);
  });
});
