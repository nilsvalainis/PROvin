import { describe, expect, it } from "vitest";
import { capitalizeServiceField, formatServiceWorksLines } from "@/lib/service-works-lines";

describe("service works lines", () => {
  it("vietas pirmajam burtam liek lielo", () => {
    expect(
      capitalizeServiceField("d.velop AG - Office Space, Sutthauser Straße 287, 49080 Osnabrück, Germany"),
    ).toBe("D.velop AG - Office Space, Sutthauser Straße 287, 49080 Osnabrück, Germany");
  });

  it("sadalā apkopi pa rindām, noņem ikonas un kārto pēc konteksta", () => {
    expect(
      formatServiceWorksLines(
        "Regulārā apkope: 💧 motoreļļas maiņa, salona mikrofiltra maiņa, degvielas filtra maiņa, gaisa filtra ieliktņa maiņa",
      ),
    ).toBe(
      [
        "Regulārā apkope",
        "Motoreļļas maiņa",
        "Salona mikrofiltra maiņa",
        "Degvielas filtra maiņa",
        "Gaisa filtra ieliktņa maiņa",
      ].join("\n"),
    );
  });

  it("OEM kvalificētāju sarakstu tur kopā, bet atsevišķu darbu atdala", () => {
    expect(
      formatServiceWorksLines(
        "Channel cover, exterior, door, front left, Cap, Aizmugurējo riteņu balansēšana",
      ),
    ).toBe("Aizmugurējo riteņu balansēšana\nChannel cover, exterior, door, front left, Cap");
  });

  it("OEM pozīcijas ar detaļu kodu katra savā rindā", () => {
    expect(
      formatServiceWorksLines(
        "GEWICHTE (FT99990111)., ENTSORGUNG REIFEN (FT999900005)., SCHEIBENKLAR (FT999904074)., Rubber valve (36121116326).",
      ),
    ).toBe(
      [
        "SCHEIBENKLAR (FT999904074)",
        "GEWICHTE (FT99990111)",
        "ENTSORGUNG REIFEN (FT999900005)",
        "Rubber valve (36121116326)",
      ].join("\n"),
    );
  });

  it("semikola darbus sadala, parakstu pēc komata neturpina kā jaunu darbu", () => {
    expect(formatServiceWorksLines("End fitting 2 sides install acc.; Actie uitgevoerd. Mvg, Inge.")).toBe(
      "End fitting 2 sides install acc.\nActie uitgevoerd. Mvg, Inge.",
    );
  });

  it("kategorijā pēc kolona arī darbam liek lielo burtu", () => {
    expect(formatServiceWorksLines("Regulārā apkope: eļļas maiņa")).toBe("Regulārā apkope: Eļļas maiņa");
  });

  it("ir idempotents", () => {
    const once = formatServiceWorksLines(
      "Regulārā apkope: eļļas maiņa, salona mikrofiltra maiņa",
    );
    expect(formatServiceWorksLines(once)).toBe(once);
  });
});
