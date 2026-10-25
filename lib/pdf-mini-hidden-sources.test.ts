/**
 * FABLE 25.10: MINI PDF (AutoDNA / CarVertical / dīleris nav cenā) nobraukuma grafikā tos izslēdza, bet
 * kopsavilkums, «Vēstures kopsavilkums» (laikjosla) un «Negadījumu vēsture» rādīja to datus.
 */
import { describe, expect, it } from "vitest";
import { emptyCsddFields } from "@/lib/admin-source-blocks";
import { buildClientReportDocumentHtml, type ClientReportPayload } from "@/lib/client-report-html";
import { MINI_DEFAULT_PDF_VISIBILITY, mergePdfVisibility } from "@/lib/pdf-visibility";

function payload(overrides: Partial<ClientReportPayload> = {}): ClientReportPayload {
  const csdd = emptyCsddFields();
  csdd.registrationStatus = "Reģistrēts";
  return {
    sessionId: "cs_test_mini",
    vin: "WBA5R1C0XLFH42873",
    created: Date.now(),
    amountTotal: 3999,
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
    csddForm: csdd,
    manualVendorBlocks: [
      {
        title: "AutoDNA",
        mileageRows: [{ date: "13.08.2019", odometer: "189858", country: "Vācija" }],
        incidentRows: [{ csngDate: "10.09.2022", lossAmount: "3400", incidentNo: "Vācija" }],
        comments: "AutoDNA slēptais komentārs",
      },
    ],
    ...overrides,
  } as ClientReportPayload;
}

const build = (p: ClientReportPayload) =>
  buildClientReportDocumentHtml({
    payload: p,
    portfolio: [],
    pdfInsights: [],
    dateFmt: new Intl.DateTimeFormat("lv-LV"),
    formatBytes: () => "0 B",
  });

describe("MINI PDF neietver paslēpto avotu datus", () => {
  it("AutoDNA izslēgts: nav ne laikjoslā, ne negadījumos, ne kopsavilkumā", () => {
    const html = build(payload({ pdfVisibility: { ...MINI_DEFAULT_PDF_VISIBILITY } }));
    expect(html).not.toContain("pdf-src-dot pdf-src-dot--autodna");
    expect(html).not.toContain("3 400");
    expect(html).not.toContain("189 858");
    expect(html).not.toContain("1 bojājumu ieraksts");
    expect(html).not.toContain("AutoDNA slēptais komentārs");
  });

  it("pilnā AUDITS (AutoDNA ieslēgts) - dati paliek kā agrāk", () => {
    const html = build(payload({ pdfVisibility: mergePdfVisibility({}) }));
    expect(html).toContain("pdf-src-dot pdf-src-dot--autodna");
    expect(html).toContain("1 bojājumu ieraksts");
    expect(html).toContain("189 858");
  });
});
