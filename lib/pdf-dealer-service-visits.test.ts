import { describe, expect, it } from "vitest";
import { KEY_READ_HISTORY_LABEL } from "@/lib/vendor-service-history";
import {
  buildDealerServiceVisitsHtml,
  buildPdfFirstLastReadingSpanHtml,
  formatDealerServicePlace,
  serviceWorkYear,
} from "@/lib/pdf-dealer-service-visits";
import { shouldCondenseDealerPdfRecords } from "@/lib/dealer-product-scope";

describe("PDF dīlera servisa vizītes", () => {
  it("apvieno tās pašas dienas vizītes, ja odometrs atšķiras līdz 150 km", () => {
    const html = buildDealerServiceVisitsHtml([
      { date: "02.06.2018", odometer: "88200", location: "Baton Rouge, LA", works: "Eļļas maiņa" },
      { date: "02.06.2018", odometer: "88310", location: "Baton Rouge, LA", works: "Bremžu pārbaude" },
    ]);
    expect(html.match(/pdf-svc-visit/g)?.length ?? 0).toBe(1);
    expect(html).toContain("Eļļas maiņa");
    expect(html).toContain("Bremžu pārbaude");
  });

  it("does not print km nav when a chart reading is missing", () => {
    const html = buildPdfFirstLastReadingSpanHtml({
      firstKm: "",
      lastKm: "47 521 km",
      firstMeta: "2016",
      lastMeta: "2023",
    });
    expect(html).not.toContain("km nav");
    expect(html).toContain("47 521 km");
    expect(buildPdfFirstLastReadingSpanHtml({ firstKm: "", lastKm: "", firstMeta: "", lastMeta: "" })).toBe("");
  });

  it("puts the type tag at the far right of the header, km immediately to its left", () => {
    const html = buildDealerServiceVisitsHtml(
      [{ date: "12.10.2024", odometer: "201149", location: "", works: "Eļļas maiņa" }],
      { omitSpan: true, lang: "en" },
    );
    const chips = html.match(/<div class="pdf-svc-chips">[\s\S]*?<\/div>/)?.[0] ?? "";
    expect(chips).toContain("201 149 km");
    expect(chips).toMatch(/pdf-svc-tag--maintenance">Service</);
    expect(chips.indexOf("pdf-svc-km")).toBeLessThan(chips.indexOf("pdf-svc-tag"));
    expect(chips.indexOf("201 149 km")).toBeLessThan(chips.indexOf("Service"));
  });

  it("ņem gadu no DD.MM.YYYY", () => {
    expect(serviceWorkYear("01.12.2023")).toBe("2023");
    expect(serviceWorkYear("")).toBe("");
  });

  it("atdala valsti no vietas, ja tā ir adrese beigās", () => {
    expect(formatDealerServicePlace("Niederlassung Bonn BMW AG, Bonn")).toMatchObject({
      place: "Niederlassung Bonn BMW AG, Bonn",
    });
    const uk = formatDealerServicePlace("Premier Service Centre, Leicester, United Kingdom");
    expect(uk.place).toBe("Premier Service Centre, Leicester");
    expect(uk.country).toBe("Apvienotā Karaliste");
  });

  it("PDF visās vizītēs neatstāj īso AutoDNA rindkopu blakus API sarakstam", () => {
    const html = buildDealerServiceVisitsHtml([
      {
        date: "26.10.2021",
        odometer: "122090",
        location: "British Motor Group",
        works: [
          "Eļļas un eļļas filtra maiņa. Elektroniskā transportlīdzekļa veselības pārbaude (eVHCE). 1200000 km / 60 mēnešu apkope. Salona filtra maiņa.",
          "Eļļas un eļļas filtra maiņa",
          "Salona filtra maiņa",
        ].join("\n"),
      },
      {
        date: "24.10.2019",
        odometer: "97576",
        location: "British Motor Group",
        works: [
          "Gaisa filtra maiņa. Bremžu šķidruma maiņa. 760000 km / 36 mēnešu apkope. Salona filtra maiņa.",
          "Gaisa filtra maiņa",
          "Bremžu šķidruma maiņa",
        ].join("\n"),
      },
      {
        date: "12.12.2017",
        odometer: "60364",
        location: "British Motor Group",
        works: [
          "Eļļas un eļļas filtra maiņa. 200000 km / 12 mēnešu apkope. Salona filtra maiņa.",
          "Eļļas un eļļas filtra maiņa",
          "Eļļas filtru maiņa",
        ].join("\n"),
      },
    ]);
    expect(html.match(/pdf-svc-visit/g)?.length ?? 0).toBe(3);
    expect(html).not.toMatch(/eVHCE|1200000 km|760000|200000 km|36 mēnešu|60 mēnešu|12 mēnešu/i);
    expect(html).toContain("Eļļas un eļļas filtra maiņa");
    expect(html).toContain("Gaisa filtra maiņa");
    expect(html).toContain("Bremžu šķidruma maiņa");
  });

  it("PDF vizītē neatstāj AutoDNA rindkopu blakus API sarakstam", () => {
    const html = buildDealerServiceVisitsHtml([
      {
        date: "16.08.2023",
        odometer: "179144",
        location: "British Motor Group Land Rover København A/S, Dynamovej 12A, 2860 Søborg, Dānija",
        works: [
          "Eļļas un eļļas filtra maiņa. Dzesēšanas šķidruma maiņa. Bremžu šķidruma maiņa. Bremžu šķidruma maiņa. Aizmugurējo bremžu maiņa. Zobsiksnas maiņa. Papildierīču piedziņas siksnas maiņa. Elektroniskā transportlīdzekļa veselības pārbaude (eVHCE). 1820000 Km / 84 mēnešu apkope. Salona filtra maiņa. AdBlue papildiņāšana.",
          "Eļļas filtru maiņa",
          "Bremžu šķidruma maiņa",
          "Aizmugurējo bremžu nomaiņa",
        ].join("\n"),
      },
    ]);
    expect(html).toContain("Eļļas filtru maiņa");
    expect(html).toContain("Aizmugurējo bremžu nomaiņa");
    expect(html).not.toMatch(/eVHCE|1820000 Km|Eļļas un eļļas filtra maiņa/);
  });

  it("vienāda nobraukuma vizītes rāda kā vienu kartīti", () => {
    const html = buildDealerServiceVisitsHtml([
      {
        date: "05.02.2025",
        odometer: "199228",
        location: "Zenter Autohaus Bernau GmbH",
        works: "Ātrumkārbas eļļa\nSveces",
      },
      {
        date: "01.02.2025",
        odometer: "199228",
        location: "",
        works: "Apkope ar eļļas maiņu\nDegvielas filtra maiņa",
      },
      {
        date: "01.06.2023",
        odometer: "26276",
        location: "",
        works: "Eļļas maiņa",
      },
    ]);
    expect(html.match(/pdf-svc-visit/g)?.length ?? 0).toBe(2);
    expect(html).toContain("05.02.2025");
    expect(html).not.toContain("01.02.2025");
    expect(html).toContain("199 228 km");
    expect(html).toContain("Ātrumkārbas eļļa");
    expect(html).toContain("Apkope ar eļļas maiņu");
    expect(html).toContain("26 276 km");
  });

  it("grupē pēc gada, jaunāko augšā, darbus kā punktus", () => {
    const html = buildDealerServiceVisitsHtml([
      {
        date: "01.06.2023",
        odometer: "26276",
        location: "",
        works: "Regulārā apkope: Eļļas maiņa",
      },
      {
        date: "01.12.2023",
        odometer: "47521",
        location: "Niederlassung Bonn BMW AG, Bonn",
        works: "Regulārā apkope: Salona gaisa filtra maiņa, Eļļas maiņa",
      },
    ]);
    expect(html).toContain("pdf-svc-year");
    expect(html).toContain("pdf-keep-head");
    expect(html).toContain(">2023<");
    const visits = html.slice(html.indexOf("pdf-svc-year"));
    expect(visits.indexOf("01.12.2023")).toBeLessThan(visits.indexOf("01.06.2023"));
    expect(html).toContain("47 521 km");
    expect(html).toContain("Niederlassung Bonn BMW AG, Bonn");
    expect(html).toContain("pdf-svc-work");
    expect(html).toContain("Salona gaisa filtra maiņa");
    expect(html).toContain("Pirmais ieraksts");
    expect(html).not.toContain("pdf-svc-span__bar");
    expect(html).not.toContain("pdf-mileage-history-table--service");
  });

  it("vākā joslu no vizītēm var izlaist", () => {
    const rows = [
      {
        date: "01.06.2023",
        odometer: "26276",
        location: "",
        works: "Eļļas maiņa",
      },
      {
        date: "01.12.2023",
        odometer: "47521",
        location: "Bonn",
        works: "Eļļas maiņa",
      },
    ];
    const html = buildDealerServiceVisitsHtml(rows, { omitSpan: true });
    expect(html).toContain("pdf-svc-year");
    expect(html).not.toContain("pdf-svc-span");
    expect(html).not.toContain("Pirmais ieraksts");
  });

  it("dīlera vārdu atstāj vietā, ne darbos", () => {
    const html = buildDealerServiceVisitsHtml([
      {
        date: "05.09.2019",
        odometer: "198833",
        location: "",
        works: "B&K Deutschland GmbH, Osnabrück: detalizēts darbu saraksts atskaitē nav pieejams",
      },
    ]);
    expect(html).toContain("B&amp;K Deutschland GmbH, Osnabrück");
    expect(html).toContain("pdf-svc-empty");
    expect(html).not.toMatch(/pdf-svc-work[^>]*>B&amp;K Deutschland GmbH/);
  });

  it("garu darbu tekstu neapgriež", () => {
    const html = buildDealerServiceVisitsHtml([
      {
        date: "21.06.2018",
        odometer: "181383",
        location: "B&K Deutschland GmbH, Osnabrück",
        works: "Navigācijas karšu atjaunināšana (DVD Road Map Europe Professional)",
      },
    ]);
    expect(html).toContain("Navigācijas karšu atjaunināšana (DVD Road Map Europe Professional)");
  });

  it("dīlera-only atstāj Key Read un tukšo km punktu, AUDITS slēpj", () => {
    const rows = [
      { date: "01.04.2025", odometer: "88000", location: "BMW Bonn", works: KEY_READ_HISTORY_LABEL },
      { date: "01.06.2023", odometer: "60000", location: "BMW Bonn", works: "Eļļas maiņa" },
      { date: "01.02.2020", odometer: "12000", location: "", works: "" },
    ];
    const dealerOnly = buildDealerServiceVisitsHtml(rows, {
      condenseRecords: shouldCondenseDealerPdfRecords({ checkoutLine: "dealer" }),
    });
    expect(dealerOnly).toContain(KEY_READ_HISTORY_LABEL);
    expect(dealerOnly).toContain("12 000 km");
    expect(dealerOnly).toContain("pdf-svc-tag--key_read");
    expect(dealerOnly).toContain("pdf-svc-year-block");

    const audit = buildDealerServiceVisitsHtml(rows, {
      condenseRecords: shouldCondenseDealerPdfRecords({
        checkoutLine: "audits",
        amountTotalCents: 9999,
      }),
    });
    expect(audit).not.toContain(KEY_READ_HISTORY_LABEL);
    expect(audit).not.toContain("12 000 km");
    expect(audit).toContain("Eļļas maiņa");
  });

  it("noņem detaļu kodus no darbu saraksta", () => {
    const html = buildDealerServiceVisitsHtml([
      {
        date: "01.06.2023",
        odometer: "26276",
        location: "Bonn",
        works: "Eļļas filtrs (11427508969)",
      },
    ]);
    expect(html).toContain("Eļļas filtrs");
    expect(html).not.toContain("11427508969");
  });

  it("tukšu kategoriju „Apkope” rāda kā darbu iztrūkumu, ne kā darbu rindu", () => {
    const html = buildDealerServiceVisitsHtml([
      { date: "23.12.2011", odometer: "63595", location: "Itālija", works: "Apkope" },
    ]);
    expect(html).toContain("pdf-svc-empty");
    expect(html).toContain("Detalizēts darbu saraksts atskaitē nav pieejams.");
    expect(html).not.toMatch(/pdf-svc-work[^>]*>Apkope/);
  });
});
