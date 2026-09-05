import { describe, expect, it } from "vitest";
import {
  buildDealerServiceVisitsHtml,
  formatDealerServicePlace,
  serviceWorkYear,
} from "@/lib/pdf-dealer-service-visits";

describe("PDF dīlera servisa vizītes", () => {
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
});
