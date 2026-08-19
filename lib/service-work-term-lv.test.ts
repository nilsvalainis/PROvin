import { describe, expect, it } from "vitest";

import {
  applyServiceWorkTranslations,
  collectUntranslatedServiceWorks,
  looksLikeUntranslatedServiceWork,
  serviceHistoryNeedsLvTranslation,
  serviceWorkTermLv,
  serviceWorkTermsLv,
} from "@/lib/service-work-term-lv";

describe("servisa terminu tulkojums latviski", () => {
  it("tulko angļu apkopes terminus pēc nozīmes", () => {
    expect(serviceWorkTermLv("Set oil-filter element")).toBe("Eļļas filtra komplekts");
    expect(serviceWorkTermLv("Air filter element")).toBe("Gaisa filtrs");
    expect(serviceWorkTermLv("Vehicle check")).toBe("Tehniskā pārbaude servisā");
    expect(serviceWorkTermLv("Statutory vehicle inspection")).toBe("Obligātā tehniskā apskate");
    expect(serviceWorkTermLv("Microfilter/activated Carbon container")).toBe(
      "Salona filtrs (ar aktivēto ogli)",
    );
    expect(serviceWorkTermLv("Vehicle check additional scope")).toBe(
      "Automašīnas pārbaudes papildu apjoms",
    );
    expect(serviceWorkTermLv("Hood gas spring check")).toBe("Motora pārsega gāzes atsperu pārbaude");
    expect(serviceWorkTermLv("Check gas pressure springs for bonnet")).toBe(
      "Motora pārsega gāzes atsperu pārbaude",
    );
    expect(serviceWorkTermLv("Pre-delivery inspection")).toBe("Pirmspiegādes apskate");
    expect(serviceWorkTermLv("Automobiļa pārbaudes papildu apjoms")).toBe(
      "Automašīnas pārbaudes papildu apjoms",
    );
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

  it("BMW ETK rindas tulko pēc nozīmes, nogriež numurus un Order/Set priedēkļus", () => {
    expect(serviceWorkTermLv("BMW cleaning fluid with antifreeze 83125A66D571")).toBe(
      "BMW stiklu mazgāšanas šķidrums ar pretfrostu",
    );
    expect(serviceWorkTermLv("Set, microfilter/carbon canister")).toBe(
      "Salona filtrs (ar aktivēto ogli)",
    );
    expect(serviceWorkTermLv("Order")).toBe("");
    expect(serviceWorkTermLv("Relay, make contact, white green")).toBe(
      "Relejs (slēdzošais, balti zaļš)",
    );
    expect(serviceWorkTermLv("Original BMW AGM-battery")).toBe("Oriģinālais BMW AGM akumulators");
    expect(serviceWorkTermLv("Pipe, Exhaust gas radiator high temperature")).toBe(
      "Izplūdes gāzu radiatora caurule (augsta temperatūra)",
    );
    expect(serviceWorkTermLv("Airbag module, driver's side 32305A66F661")).toBe(
      "Drošības spilvena modulis (vadītāja pusē)",
    );
    expect(serviceWorkTermLv("Skrūve (self tapping)")).toBe("Skrūve (pašvītņojoša)");
    expect(serviceWorkTermLv("Brake fluid LOW VISCOSITY")).toBe("Bremžu šķidrums (zema viskozitāte)");
  });

  it("divvārdu pozīciju precizējumus („front left”) neatstāj daļēji netulkotus", () => {
    // Reāls defekts: „Brake pad wear sensor, front left” pirms tam palika
    // „Bremžu kluču nodiluma sensors, front left” — precizējums netika tulkots.
    expect(serviceWorkTermLv("Brake pad wear sensor, front left")).toBe(
      "Bremžu kluču nodiluma sensors (priekšā kreisajā pusē)",
    );
    expect(serviceWorkTermLv("Airbag module, rear right")).toBe(
      "Drošības spilvena modulis (aizmugurē labajā pusē)",
    );
  });

  it("tulko BMW darbnīcas vācu piezīmes pēc nozīmes", () => {
    expect(serviceWorkTermLv("Ölzuschlag für Service Inclusive")).toBe(
      "Eļļas piemaksa (Service Inclusive)",
    );
    expect(serviceWorkTermLv("Nachrüstung Service-Inclusive")).toBe("Service Inclusive pievienošana");
    expect(serviceWorkTermLv("Kundenloyalisiereung siehe Mail")).toBe(
      "Klienta lojalitātes akcija (sk. e-pastu)",
    );
    expect(serviceWorkTermLv("Serviceväsche Upgrade")).toBe("Servisa mazgāšana (paplašinātā)");
  });
});

describe("netulkotu darbu noteikšana", () => {
  it("atzīmē palikušo angļu / vācu, bet ne zīmolu un latviešu tekstu", () => {
    expect(looksLikeUntranslatedServiceWork("Unknown hex housing bracket")).toBe(true);
    expect(looksLikeUntranslatedServiceWork("Eļļas filtra komplekts")).toBe(false);
    expect(looksLikeUntranslatedServiceWork("Castrol Magnatec Prof. MP 5W-30 LL04")).toBe(false);
    expect(looksLikeUntranslatedServiceWork("Eļļas piemaksa (Service Inclusive)")).toBe(false);
    expect(
      serviceHistoryNeedsLvTranslation([
        { works: ["Eļļas filtra komplekts", "Unknown hex housing bracket"] },
      ]),
    ).toBe(true);
    expect(serviceHistoryNeedsLvTranslation([{ works: ["Gaisa filtrs"] }])).toBe(false);
  });

  it("AI karti uzliek tikai palikušajiem nosaukumiem", () => {
    const entries = [
      {
        works: ["Eļļas filtra komplekts", "Unknown hex housing bracket"],
      },
    ];
    expect(collectUntranslatedServiceWorks(entries)).toEqual(["Unknown hex housing bracket"]);
    expect(
      applyServiceWorkTranslations(entries, {
        "Unknown hex housing bracket": "Korpusa kronšteins",
      })[0]?.works,
    ).toEqual(["Eļļas filtra komplekts", "Korpusa kronšteins"]);
  });
});
