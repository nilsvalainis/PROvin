import { describe, expect, it } from "vitest";
import {
  capitalizeServiceField,
  formatServiceWorksLines,
  looksLikeNarrativeServiceWorkLine,
  mergeOverlappingServiceWorkLines,
} from "@/lib/service-works-lines";

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

  it("pārklājošos apkopes darbus atstāj vienu reizi pēc nozīmes", () => {
    expect(
      mergeOverlappingServiceWorkLines([
        "Apkope ar eļļas maiņu",
        "Regulārā apkope/Eļļas maiņa",
        "Ātrumkārbas eļļa",
        "Gaisa filtra elements",
        "Degvielas filtra maiņa",
      ]),
    ).toEqual([
      "Apkope ar eļļas maiņu",
      "Ātrumkārbas eļļa",
      "Gaisa filtra elements",
      "Degvielas filtra maiņa",
    ]);
  });

  it("īsā AutoDNA rindkopa ar km/mēnešu birku ir narratīvs", () => {
    expect(
      looksLikeNarrativeServiceWorkLine(
        "Gaisa filtra maiņa. Bremžu šķidruma maiņa. 760000 km / 36 mēnešu apkope. Salona filtra maiņa.",
      ),
    ).toBe(true);
    expect(
      looksLikeNarrativeServiceWorkLine(
        "Eļļas un eļļas filtra maiņa. Elektroniskā transportlīdzekļa veselības pārbaude (eVHCE). 1200000 km / 60 mēnešu apkope. Salona filtra maiņa.",
      ),
    ).toBe(true);
  });

  it("visās vizītēs API saraksts uzvar īso AutoDNA rindkopu un angļu paliekas", () => {
    expect(
      formatServiceWorksLines(
        [
          "Gaisa filtra maiņa. Bremžu šķidruma maiņa. 760000 km / 36 mēnešu apkope. Salona filtra maiņa.",
          "Gaisa filtra maiņa",
          "Bremžu šķidruma maiņa",
          "Salona filtra maiņa",
        ].join("\n"),
      ),
    ).toBe(["Gaisa filtra maiņa", "Salona filtra maiņa", "Bremžu šķidruma maiņa"].join("\n"));

    expect(
      formatServiceWorksLines(
        [
          "Eļļas un eļļas filtra maiņa. 520000 km / 24 mēnešu apkope. Salona filtra maiņa.",
          "Eļļas un eļļas filtra maiņa",
          "Eļļas filtru maiņa",
        ].join("\n"),
      ),
    ).not.toMatch(/520000|24 mēnešu/);

    expect(
      formatServiceWorksLines(
        ["Eļļas filtru maiņa", "Papildu piedziņas siksnas nomaiņa", "Renewal of ancillary drive belt"].join("\n"),
      ),
    ).toBe("Eļļas filtru maiņa\nPapildu piedziņas siksnas nomaiņa");
  });

  it("neapvieno atšķirīgus filtrus tikai tāpēc, ka tekstā ir „filtra maiņa”", () => {
    expect(
      mergeOverlappingServiceWorkLines([
        "Eļļas filtra maiņa",
        "Gaisa filtra maiņa",
        "Degvielas filtra maiņa",
      ]),
    ).toEqual(["Eļļas filtra maiņa", "Gaisa filtra maiņa", "Degvielas filtra maiņa"]);
  });
});
