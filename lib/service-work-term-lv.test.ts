import { describe, expect, it } from "vitest";

import { serviceWorkTermLv, serviceWorkTermsLv } from "@/lib/service-work-term-lv";

describe("servisa terminu tulkojums latviski", () => {
  it("tulko angļu apkopes terminus pēc nozīmes", () => {
    expect(serviceWorkTermLv("Set oil-filter element")).toBe("Eļļas filtra komplekts");
    expect(serviceWorkTermLv("Air filter element")).toBe("Gaisa filtrs");
    expect(serviceWorkTermLv("Vehicle check")).toBe("Tehniskā pārbaude servisā");
    expect(serviceWorkTermLv("Statutory vehicle inspection")).toBe("Obligātā tehniskā apskate");
    expect(serviceWorkTermLv("Microfilter/activated Carbon container")).toBe(
      "Salona filtrs (ar aktivēto ogli)",
    );
    expect(serviceWorkTermLv("Oil service")).toBe("Eļļas maiņa");
  });

  it("tulko vācu terminus", () => {
    expect(serviceWorkTermLv("BREMSFLÜSSIGKEIT")).toBe("Bremžu šķidrums");
    expect(serviceWorkTermLv("Beide Vorderräder auswuchten")).toBe("Priekšējo riteņu balansēšana");
    expect(serviceWorkTermLv("Kleinteile")).toBe("Sīkdetaļas");
    expect(serviceWorkTermLv("Luftfilter")).toBe("Gaisa filtrs");
  });

  it("precizējumus liek iekavās, nevis tulko vārds vārdā", () => {
    expect(serviceWorkTermLv("Brake disc, ventilated")).toBe("Bremžu disks (ventilēts)");
    expect(serviceWorkTermLv("Brake pad set, front")).toBe("Bremžu kluču komplekts (priekšā)");
    expect(serviceWorkTermLv("Bremsbeläge hinten")).toBe("Bremžu kluču komplekts (aizmugurē)");
  });

  it("zīmolus un eļļas specifikācijas atstāj kā izdrukā", () => {
    expect(serviceWorkTermLv("Castrol Magnatec Prof. MP 5W-30 LL04")).toBe(
      "Castrol Magnatec Prof. MP 5W-30 LL04",
    );
    expect(serviceWorkTermLv("MOTOROEL 5W-30 LL04")).toBe("Motoreļļa 5W-30 LL04");
  });

  it("latviešu tekstu neaiztiek", () => {
    expect(serviceWorkTermLv("Salona gaisa filtra maiņa")).toBe("Salona gaisa filtra maiņa");
  });

  it("sarakstā izmet tukšos un dublikātus", () => {
    expect(serviceWorkTermsLv(["Air filter element", "Luftfilter", "", "  "])).toEqual([
      "Gaisa filtrs",
    ]);
  });
});
