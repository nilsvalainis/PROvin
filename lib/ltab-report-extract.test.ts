import { describe, expect, it } from "vitest";
import {
  extractLtabCertificate,
  formatLtabCentsAsEur,
  formatLtabCertificateAmountEur,
  looksLikeLtabCertificate,
  ltabCertificateToIncidentRows,
  sumLtabCertificateAmountCents,
  unglueLtabOctaText,
} from "@/lib/ltab-report-extract";
import { applyCopilotActions } from "@/lib/admin-copilot-apply";
import { createDefaultSourceBlocks } from "@/lib/admin-source-blocks";
import { buildClientReportDocumentHtml, type ClientReportPayload } from "@/lib/client-report-html";
import { mergePdfVisibility } from "@/lib/pdf-visibility";
import { normalizePdfExtractedText } from "@/lib/pdf-text-normalize";

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

  it("nolasa izziņu bez negadījumiem (0 CSNg rindas)", () => {
    const clean = `Transportlīdzekļa zaudējumu dati uz 14.08.2026 11:22:45
Transportlīdzeklis FORD GALAXY, izlaiduma gads 2013. Valsts numura zīme OP4122.
Negadījumu skaits: 0
Laikā no 15.07.2026 līdz 14.08.2026 apdrošināts 31 dienas.
Zaudējumu dati:
Uz 14.08.2026 11:22:45 automašīnai ar valsts numura zīmi OP4122 nav reģistrēts neviens negadījums
Izziņa ir sagatavota automātiski no OCTA informācijas sistēmas.`;
    for (const text of [clean, normalizePdfExtractedText(clean)]) {
      const cert = extractLtabCertificate(text);
      expect(cert).not.toBeNull();
      expect(cert!.issuedAt).toBe("14.08.2026 11:22:45");
      expect(cert!.plate).toBe("OP4122");
      expect(cert!.accidentCount).toBe("0");
      expect(cert!.insuredDays).toBe("31");
      expect(cert!.claims).toHaveLength(0);
    }
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
    expect(html).toContain("pdf-ltab-loss-history");
    expect(html).toContain("pdf-listing-price-history-foot");
    expect(html).toContain("AUDI A6 AVANT");
    expect(html).toContain("Cietušais");
    expect(html).toContain("2 778.22 €");
    expect(html).toContain("16.06.2021 07:40");
    expect(html).toContain("Kopā:");
    expect(html).toContain("4 377.22 €");
    expect(html).toContain("Negadījumi:");
    expect(html).toContain("OCTA informācijas sistēmas");
  });
});

const AUDI_A6_PDF_RAW = `
Transportlīdzekļa zaudējumu dati uz 13.08.2026 20:06:02
Transportlīdzeklis AUDI A6 AVANT, izlaiduma gads 2016. Valsts numura zīme OB5401.
Negadījumu skaits: 2
Laikā no 31.07.2019 līdz 31.01.2027 apdrošināts 2216 dienas.
Zaudējumu dati:
CSNg
Datums
StatussZaudējumu summa, ja transportlīdzeklis cietis vai norakstāms
16.06.2021
07:40
Cietušais2778.22
20.10.2020
20:30
Cietušais1599.00
Izziņa ir sagatavota automātiski no OCTA informācijas sistēmas.
`.trim();

const ATBILDIGS_RAW = `
Transportlīdzekļa zaudējumu dati uz 21.04.2026 01:41:05
Transportlīdzeklis AUDI Q5, izlaiduma gads 2010. Valsts numura zīme RX73.
Negadījumu skaits: 1
Laikā no 21.08.2020 līdz 01.11.2026 apdrošināts 2191 dienas.
Zaudējumu dati:
CSNg
Datums
StatussZaudējumu summa, ja transportlīdzeklis cietis vai norakstāms
27.05.2022
13:00
Atbildīgs
Izziņa ir sagatavota automātiski no OCTA informācijas sistēmas.
`.trim();

describe("LTAB izziņa — reāls pdf-parse teksts", () => {
  it("atlimē datumu no laika un statusu no summas pēc ciparu salīmēšanas", () => {
    const glued = normalizePdfExtractedText(AUDI_A6_PDF_RAW);
    expect(glued).toContain("16.06.202107:40");
    expect(glued).toContain("Cietušais2778.22");
    const fixed = unglueLtabOctaText(glued);
    expect(fixed).toContain("16.06.2021 07:40");
    expect(fixed).toContain("Cietušais 2778.22");
  });

  it("aizpilda Zaudējumu dati rindas no salīmēta servera teksta", () => {
    const cert = extractLtabCertificate(normalizePdfExtractedText(AUDI_A6_PDF_RAW));
    expect(cert).not.toBeNull();
    expect(cert!.issuedAt).toBe("13.08.2026 20:06:02");
    expect(cert!.claims).toHaveLength(2);
    expect(cert!.claims[0]).toEqual({
      date: "16.06.2021",
      time: "07:40",
      status: "Cietušais",
      amount: "2778.22",
    });
    expect(cert!.claims[1]).toEqual({
      date: "20.10.2020",
      time: "20:30",
      status: "Cietušais",
      amount: "1599.00",
    });
    expect(sumLtabCertificateAmountCents(cert!.claims)).toBe(437722);
    expect(formatLtabCentsAsEur(437722)).toBe("4 377.22 €");
  });

  it("saglabā Atbildīgs rindu bez summas", () => {
    const cert = extractLtabCertificate(normalizePdfExtractedText(ATBILDIGS_RAW));
    expect(cert!.claims).toEqual([
      { date: "27.05.2022", time: "13:00", status: "Atbildīgs", amount: "" },
    ]);
  });
});
