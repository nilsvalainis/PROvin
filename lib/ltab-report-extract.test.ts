import { describe, expect, it } from "vitest";
import {
  extractLtabCertificate,
  formatLtabCertificateAmountEur,
  looksLikeLtabCertificate,
  ltabCertificateToIncidentRows,
} from "@/lib/ltab-report-extract";
import { applyCopilotActions } from "@/lib/admin-copilot-apply";
import { createDefaultSourceBlocks } from "@/lib/admin-source-blocks";
import { buildClientReportDocumentHtml, type ClientReportPayload } from "@/lib/client-report-html";
import { mergePdfVisibility } from "@/lib/pdf-visibility";

const LTAB_TEXT = `
Transportlīdzekļa zaudējumu dati uz 13.08.2026 20:06:02

Transportlīdzeklis AUDI A6 AVANT, izlaiduma gads 2016. Valsts numura zīme OB5401.

Negadījumu skaits: 2

Laikā no 31.07.2019 līdz 31.01.2027 apdrošināts 2216 dienas.

Zaudējumu dati:

CSNg

Datums

Statuss
 
Zaudējumu summa, ja transportlīdzeklis cietis vai norakstāms

16.06.2021

07:40
 
Cietušais
 
2778.22

20.10.2020

20:30
 
Cietušais
 
1599.00

Izziņa ir sagatavota automātiski no OCTA informācijas sistēmas.
`.trim();

describe("LTAB izziņas parseris", () => {
  it("atpazīst OCTA izziņu", () => {
    expect(looksLikeLtabCertificate(LTAB_TEXT)).toBe(true);
    expect(looksLikeLtabCertificate("AutoDNA vehicle history")).toBe(false);
  });

  it("izvelk galveni, periodu un CSNg rindas ar statusu", () => {
    const cert = extractLtabCertificate(LTAB_TEXT);
    expect(cert).not.toBeNull();
    expect(cert!.issuedAt).toBe("13.08.2026 20:06:02");
    expect(cert!.makeModel).toBe("AUDI A6 AVANT");
    expect(cert!.year).toBe("2016");
    expect(cert!.plate).toBe("OB5401");
    expect(cert!.accidentCount).toBe("2");
    expect(cert!.insuredFrom).toBe("31.07.2019");
    expect(cert!.insuredTo).toBe("31.01.2027");
    expect(cert!.insuredDays).toBe("2216");
    expect(cert!.claims).toHaveLength(2);
    expect(cert!.claims[0]).toEqual({
      date: "16.06.2021",
      time: "07:40",
      status: "Cietušais",
      amount: "2778.22",
    });
    expect(cert!.claims[1]?.amount).toBe("1599.00");
    expect(cert!.footerNote).toContain("OCTA");
  });

  it("aizpilda LTAB tabulu: datums + summa ar centiem + Latvija", () => {
    const cert = extractLtabCertificate(LTAB_TEXT)!;
    const rows = ltabCertificateToIncidentRows(cert);
    expect(rows).toEqual([
      { csngDate: "16.06.2021", lossAmount: "2 778.22 €", incidentNo: "Latvija" },
      { csngDate: "20.10.2020", lossAmount: "1 599.00 €", incidentNo: "Latvija" },
    ]);
    expect(formatLtabCertificateAmountEur("2778.22")).toBe("2 778.22 €");
  });

  it("Copilot darbība ieliek izziņu un rindas LTAB blokā", () => {
    const cert = extractLtabCertificate(LTAB_TEXT)!;
    const result = applyCopilotActions(createDefaultSourceBlocks(), [
      { type: "set_ltab_certificate", source: "ltab", certificate: cert, confidence: "high" },
    ]);
    expect(result.changedKeys).toEqual(["ltab"]);
    const ltab = result.sourceBlocks.ltab;
    expect(ltab.certificate?.plate).toBe("OB5401");
    expect(ltab.rows.filter((r) => r.csngDate.trim())).toHaveLength(2);
    expect(ltab.rows[0]?.incidentNo).toBe("Latvija");
    expect(ltab.rows[0]?.lossAmount).toContain("778.22");
    expect(ltab.rows[0]?.csngDate).toBe("16.06.2021");
  });

  it("izziņas kopija parādās klienta PDF", () => {
    const cert = extractLtabCertificate(LTAB_TEXT)!;
    const html = buildClientReportDocumentHtml({
      payload: {
        sessionId: "cs_test",
        vin: "WAUZZZ4G5GN185536",
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
        manualLtabBlock: { rows: ltabCertificateToIncidentRows(cert), comments: "", certificate: cert },
        pdfVisibility: mergePdfVisibility({ ltab: true, unifiedIncidents: false }),
      } as ClientReportPayload,
      dateFmt: new Intl.DateTimeFormat("lv-LV"),
      formatBytes: () => "0 B",
    });
    expect(html).toContain("pdf-ltab-izzi");
    expect(html).toContain("AUDI A6 AVANT");
    expect(html).toContain("Cietušais");
    expect(html).toContain("2 778.22 €");
    expect(html).toContain("16.06.2021 07:40");
    expect(html).toContain("OCTA informācijas sistēmas");
  });
});
