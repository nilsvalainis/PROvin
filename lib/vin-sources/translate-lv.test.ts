import { describe, expect, it } from "vitest";
import {
  capitalizeFactValue,
  capitalizeRegistryEvent,
  translateTermLv,
  translateTextLv,
  translateTextLvChecked,
} from "@/lib/vin-sources/translate-lv";

describe("capitalizeRegistryEvent", () => {
  it("paceļ pirmo burtu un tekstu pēc kolona", () => {
    expect(capitalizeRegistryEvent("periodiskā apskate: izturēta · FDM Test & Bilsyn")).toBe(
      "Periodiskā apskate: Izturēta · FDM Test & Bilsyn",
    );
    expect(capitalizeRegistryEvent("Apdrošināšana: GF-FORSIKRING A/S, beigusies")).toBe(
      "Apdrošināšana: GF-FORSIKRING A/S, beigusies",
    );
    expect(capitalizeRegistryEvent("Pirmā reģistrācija")).toBe("Pirmā reģistrācija");
  });
});

describe("capitalizeFactValue", () => {
  it("paceļ pirmo burtu, pēc komata un iekavās", () => {
    expect(capitalizeFactValue("dīzelis")).toBe("Dīzelis");
    expect(capitalizeFactValue("16.10.2024, izturēta")).toBe("16.10.2024, Izturēta");
    expect(capitalizeFactValue("GF-FORSIKRING A/S (beigusies)")).toBe("GF-FORSIKRING A/S (Beigusies)");
    expect(capitalizeFactValue("300 HK (221 kW) · pilnpiedziņa")).toBe("300 HK (221 kW) · Pilnpiedziņa");
  });
});

describe("translateTextLv", () => {
  it("tulko Dānijas piedziņas apzīmējumu", () => {
    expect(translateTextLv("300 HK (221 kW) · Firehjulstrukket", "da")).toMatch(/pilnpiedziņa/);
  });
});

describe("translateTextLv igauņu frāzes", () => {
  it("frāze uzvar pār atsevišķu vārdu („korras”)", () => {
    expect(translateTextLv("OK - Tehniliselt korras", "et")).toBe("OK - tehniski kārtībā");
    expect(translateTextLv("korras", "et")).toBe("izturēta");
  });

  it("tulko vārdus ar õ / ü / ä (\\b tur nestrādāja)", () => {
    expect(translateTextLv("Võõrandamisest teatamine", "et")).toBe("paziņojums par atsavināšanu");
    expect(translateTextLv("Majanduslikus mõttes hävinenud", "et")).toBe(
      "ekonomiski iznīcināts (norakstīts)",
    );
    expect(translateTextLv("12.03.2021 Liiklusõnnetus", "et")).toBe("12.03.2021 ceļu satiksmes negadījums");
    expect(translateTextLv("Kontroll: ülevaatus puudustega", "et")).toBe("Kontroll: tehniskā apskate ar trūkumiem");
  });

  it("nemaina vārda daļu un jau tulkotu tekstu", () => {
    expect(translateTextLv("korrastatud", "et")).toBe("korrastatud");
    expect(translateTextLv("300 HK · Firehjulstrukket", "da")).toBe("300 HK · pilnpiedziņa");
  });
});

describe("dāņu apskates trūkumu vārdnīca", () => {
  it("tulko trūkumu grupu virsrakstus neatkarīgi no burtu lieluma", () => {
    expect(translateTermLv("Bremser", "da")).toBe("bremzes");
    expect(translateTermLv("STYRETØJ", "da")).toBe("stūres iekārta");
    expect(translateTermLv("Aksler, hjul og affjedring", "da")).toBe("asis, riteņi un balstiekārta");
    expect(translateTermLv("aksler, og affjedring", "da")).toBe("asis un balstiekārta");
    expect(translateTermLv("Lygter, reflekser og elektrisk udstyr", "da")).toBe(
      "lukturi, atstarotāji un elektroiekārta",
    );
    expect(translateTermLv("Bremseudstyr, parkeringsbremse", "da")).toBe("bremžu iekārta, stāvbremze");
    expect(translateTermLv("Bærende elementer", "da")).toBe("nesošie elementi");
  });

  it("saliktu vārdu tulko kopumā, nevis tā daļu", () => {
    expect(translateTextLv("Bremserør og bremseslange", "da")).toBe("bremžu caurule og bremžu šļūtene");
    expect(translateTextLv("Støddæmper, Hjulleje, NÆRLYS", "da")).toBe("amortizators, riteņa gultnis, tuvās gaismas");
    // „bremser” nav jāizgriež no „bremserørene” (nezināma locījuma forma paliek neskarta)
    expect(translateTextLv("bremserørene", "da")).toBe("bremserørene");
  });

  it("frāze uzvar pār atsevišķu vārdu un ignorē liekas atstarpes", () => {
    expect(translateTextLv("Ujævn  bremsevirkning, 2. aksel", "da")).toBe("nevienmērīga bremzēšanas iedarbība, 2. ass");
    expect(translateTextLv("Væsentlig fejl", "da")).toBe("būtisks trūkums");
  });

  it("apskates rezultāts „Kan godkendes efter omsyn” saskan ar esyn „nav izturēta”", () => {
    for (const da of [
      "Kan godkendes efter omsyn hos (om)synsvirksomhed",
      "Kan godkendes efter omsyn",
    ]) {
      expect(translateTermLv(da, "da")).toBe("nav izturēta, jāveic atkārtota apskate");
    }
    expect(translateTermLv("Kan ikke godkendes", "da")).toBe("nav izturēta");
    expect(translateTermLv("Betinget godkendt", "da")).toBe("nosacīti izturēta");
  });

  it("īsie novietojuma vārdi „for”/„bag” vispārīgā tekstā netiek tulkoti", () => {
    expect(translateTextLv("for", "da")).toBe("for");
    expect(translateTextLv("Afgift for 2024, bag", "da")).toBe("Afgift for 2024, bag");
  });

  it("dāņu trūkumu termini neietekmē igauņu vārdnīcu, un otrādi", () => {
    expect(translateTermLv("Bremser", "et")).toBe("Bremser");
    expect(translateTextLv("Venstre defekt, slør", "et")).toBe("Venstre defekt, slør");
    expect(translateTextLvChecked("bremserør, bag", "et")).toEqual({ text: "bremserør, bag", complete: false });
    expect(translateTextLv("ülevaatus puudustega", "da")).toBe("ülevaatus puudustega");
    expect(translateTextLv("korras", "et")).toBe("izturēta");
  });
});

describe("translateTextLvChecked", () => {
  it("complete, ja ārpus terminiem paliek tikai cipari un pieturzīmes", () => {
    expect(translateTextLvChecked("Bremserør, tæret, 2. aksel, venstre, bag", "da")).toEqual({
      text: "bremžu caurule, korozija, 2. ass, kreisā puse, aizmugurē",
      complete: true,
    });
    expect(translateTextLvChecked("slør, for stor, højre", "da")).toEqual({
      text: "brīvkustība, pārāk liela, labā puse",
      complete: true,
    });
  });

  it("nav complete, ja paliek kaut viens netulkots vārds", () => {
    const r = translateTextLvChecked("Bremserør er meget tæret ved bagaksel.", "da");
    expect(r.complete).toBe(false);
    expect(r.text).toBe("bremžu caurule er meget korozija ved aizmugurējā ass.");
    expect(translateTextLvChecked("noget helt andet", "da")).toEqual({ text: "noget helt andet", complete: false });
  });

  it("tukšs teksts ir complete", () => {
    expect(translateTextLvChecked("  ", "da")).toEqual({ text: "", complete: true });
  });
});
