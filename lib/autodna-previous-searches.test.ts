import fs from "fs";
import { describe, expect, it } from "vitest";

import { mergeSourceBlocksWithDefaults, toPdfManualVendorBlocks } from "@/lib/admin-source-blocks";
import {
  buildAutodnaPreviousSearchesPdfHtml,
  maskAutodnaIp,
  normalizeAutodnaPreviousSearches,
  parseAutodnaPreviousSearchesFromItems,
  parseAutodnaPreviousSearchesFromText,
} from "@/lib/autodna-previous-searches";
import { buildClientReportDocumentHtml, type ClientReportPayload } from "@/lib/client-report-html";

// Izdomāti dati (publisks repo).
const PDF_TEXT = `Pārskata navigācija
Iepriekšējie meklējumi
Ierakstu skaits: 2
Aprīkojums
Ierakstu skaits: 0
Transportlīdzekļa vēsture
Iepriekšējie meklējumi
Datums un laiks
14.03.2026 09:12:44
Pakalpojuma veids
Atskaite autoDNA
IP
163.116.XXX.XXX
Atrašanās vieta
Riga, Latvia
Datums un laiks
02.11.2025 18:40:05
Pakalpojuma veids
Atskaite autoDNA
IP
10.20.30.40
Atrašanās vieta
Vilnius, Lithuania
Aprīkojums
Pārbaudīts, dati nav reģistrēti`;

const MAP = `data:image/jpeg;base64,${Buffer.from("izdomata-karte").toString("base64")}`;

describe("AutoDNA «Iepriekšējie meklējumi»", () => {
  it("IP vienmēr maskēts kā AutoDNA", () => {
    expect(maskAutodnaIp("163.116.12.34")).toBe("163.116.XXX.XXX");
    expect(maskAutodnaIp("80.89.XXX.XXX")).toBe("80.89.XXX.XXX");
    expect(maskAutodnaIp("2a01:4f9:c010:89ad::1")).toBe("2a01:4f9:XXXX:XXXX");
  });

  it("teksts: izlaiž navigāciju, nolasa visas rindas, beidz pie nākamās sadaļas", () => {
    expect(parseAutodnaPreviousSearchesFromText(PDF_TEXT)).toEqual([
      { dateTime: "14.03.2026 09:12:44", service: "Atskaite autoDNA", ip: "163.116.XXX.XXX", location: "Riga, Latvia" },
      { dateTime: "02.11.2025 18:40:05", service: "Atskaite autoDNA", ip: "10.20.XXX.XXX", location: "Vilnius, Lithuania" },
    ]);
    expect(parseAutodnaPreviousSearchesFromText("Iepriekšējie meklējumi\nPārbaudīts, dati nav reģistrēti\nAprīkojums")).toEqual([]);
  });

  it("pozīcijas: 4 kolonnas + karte pa labi no rindas", () => {
    const T = (y: number, x: number, str: string, size = 9) => ({ page: 7, x, y, str, size });
    const { rows, mapIds } = parseAutodnaPreviousSearchesFromItems(
      [
        T(71, 82, "Iepriekšējie meklējumi", 15),
        T(115, 63, "Datums un laiks"),
        T(126, 63, "14.03.2026 09:12:44"),
        T(115, 168, "Pakalpojuma veids"),
        T(126, 168, "Atskaite autoDNA"),
        T(115, 265, "IP"),
        T(126, 265, "163.116.XXX.XXX"),
        T(115, 357, "Atrašanās vieta"),
        T(126, 357, "Riga, Latvia"),
        T(212, 78, "Aprīkojums", 15),
      ],
      [
        { page: 7, x: 52, y: 57, w: 23, h: 17, id: "ikona" },
        { page: 7, x: 438, y: 107, w: 88, h: 21, id: "karte" },
      ],
    );
    expect(rows).toEqual([{ dateTime: "14.03.2026 09:12:44", service: "Atskaite autoDNA", ip: "163.116.XXX.XXX", location: "Riga, Latvia" }]);
    expect(mapIds).toEqual(["karte"]);
  });

  it("melnraksts saglabā rindas (IP maskē arī vecos datus) un klienta PDF rāda kartīti AutoDNA sadaļā", () => {
    const blocks = mergeSourceBlocksWithDefaults({
      autodna: {
        ...mergeSourceBlocksWithDefaults({}).autodna,
        previousSearches: [
          { dateTime: "14.03.2026 09:12:44", service: "Atskaite autoDNA", ip: "163.116.77.12", location: "Riga, Latvia", map: MAP },
          { dateTime: "nav datuma", service: "x", ip: "", location: "" },
        ],
      },
    });
    expect(blocks.autodna.previousSearches).toEqual([
      { dateTime: "14.03.2026 09:12:44", service: "Atskaite autoDNA", ip: "163.116.XXX.XXX", location: "Riga, Latvia", map: MAP },
    ]);
    const vendors = toPdfManualVendorBlocks(blocks);
    const dna = vendors.find((v) => v.title === "AutoDNA");
    expect(dna?.previousSearches).toHaveLength(1);

    const html = buildClientReportDocumentHtml({
      payload: {
        sessionId: "cs_test_dna_searches",
        vin: "WVWZZZ1JZXW000001",
        created: Date.UTC(2026, 10, 25),
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
        manualVendorBlocks: vendors,
      } as unknown as ClientReportPayload,
      portfolio: [],
      pdfInsights: [],
      dateFmt: new Intl.DateTimeFormat("lv-LV"),
      formatBytes: () => "0 B",
    });
    expect(html).toContain('class="pdf-dna-search"');
    expect(html).toContain("163.116.XXX.XXX");
    expect(html).not.toContain("163.116.77.12");
    expect(html).toContain(".pdf-dna-search__row{");
    // Vizuālai pārbaudei (PNG): PROVIN_DNA_SEARCH_HTML_OUT=/ceļš.html
    if (process.env.PROVIN_DNA_SEARCH_HTML_OUT) fs.writeFileSync(process.env.PROVIN_DNA_SEARCH_HTML_OUT, html);
  });

  it("bez rindām - nekas", () => {
    expect(buildAutodnaPreviousSearchesPdfHtml([])).toBe("");
    expect(normalizeAutodnaPreviousSearches("x")).toEqual([]);
  });
});
