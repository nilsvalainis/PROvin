import { describe, expect, it } from "vitest";
import { isCustomsInspection, isFailedMot, estimateDkOwnersFromOcta, mapTjekbilPayload, type TjekbilDmrResponse } from "@/lib/vin-sources/tjekbil-map";

const SHARAN: TjekbilDmrResponse = {
  basic: {
    regNr: "CM53865",
    status: "Afmeldt",
    statusDato: "2026-08-12T15:56:05+02:00",
    foersteRegistreringDato: "2013-12-18T00:00:00+01:00",
    bilLeaset: false,
    leasingHistory: [
      { leasingGyldigFra: "2017-12-18T00:00:00+01:00", leasingGyldigTil: "2018-02-01T00:00:00+01:00" },
      { leasingGyldigFra: "2019-02-01T00:00:00+01:00", leasingGyldigTil: "2019-10-21T00:00:00+02:00" },
    ],
    koeretoejAnvendelseNavn: "Privat personkørsel",
    maerkeTypeNavn: "VOLKSWAGEN",
    modelTypeNavn: "SHARAN",
    koeretoejUdstyrSamling: ["Trinløst gear", "ABS bremser"],
    koeretoejId: 9000000002522614,
  },
  extended: {
    general: { standEfterImport: "Middel", blockedStatus: false, sekundaerStatus: "Afmeldt" },
    insurance: {
      selskab: "GF-FORSIKRING A/S",
      status: "Ophørt",
      historik: [
        { selskab: "GF-FORSIKRING A/S", status: "Ophørt", oprettet: "12-08-2026" },
        { selskab: "KØBSTÆDERNES FORS.", status: "Aktiv", oprettet: "18-12-2017" },
      ],
    },
    inspection: { sidsteSyn: "2026-01-28T00:00:00", sidsteSynResultat: "Godkendt" },
  },
  inspectionData: {
    mistaenkeligtKmStand: false,
    rapporter: [
      {
        firma: "Dekra Bilsyn",
        synstype: "Første syn",
        synsresultat: "Godkendt",
        synsdato: "28-01-2026",
        kategori: "Periodisk syn",
        kmstand: 188528,
        fejl: [],
      },
      {
        firma: "LK Invest, Kolding ApS",
        synstype: "Første syn",
        synsresultat: "Godkendt",
        synsdato: "18-12-2017",
        kategori: "Registreringssyn",
        kmstand: 29000,
        fejl: [],
      },
      {
        firma: "LK Invest, Kolding ApS",
        synstype: "Første syn",
        synsresultat: "Middel",
        synsdato: "18-12-2017",
        kategori: "Toldsyn import",
        kmstand: 29000,
        fejl: [],
      },
    ],
  },
  debtData: { laaneDokumenter: [], konkurs: null },
};

describe("tjekbil-map", () => {
  it("treats Toldsyn Middel as customs grade, not a failed MOT", () => {
    const toldsyn = { kategori: "Toldsyn import", synsresultat: "Middel" };
    expect(isCustomsInspection(toldsyn)).toBe(true);
    expect(isFailedMot(toldsyn)).toBe(false);
    expect(isFailedMot({ kategori: "Periodisk syn", synsresultat: "Kan ikke godkendes" })).toBe(true);
  });

  it("fills timeline, mileage and import without counting insurance as owners", () => {
    const mapped = mapTjekbilPayload({ dmr: SHARAN, mileagelogs: [], wanted: [] });
    expect(mapped.found).toBe(true);
    expect(mapped.incidents).toEqual([]);
    expect(mapped.mileage.map((r) => r.odometer)).toEqual(["188528", "29000"]);
    expect(mapped.timeline.some((r) => /Muitas apskate/.test(r.event))).toBe(true);
    expect(mapped.timeline.some((r) => /reģistrācijas apskate/i.test(r.event))).toBe(true);
    expect(mapped.timeline.some((r) => r.event === "Līzings sākas" && r.date === "2017-12-18")).toBe(true);
    expect(mapped.ownersSummary).toMatch(/Aplēstais īpašnieku skaits: 1/);
    expect(mapped.ownersSummary).not.toMatch(/14 īpašnieki|2 īpašnieki \(pēc OCTA/);
    expect(mapped.ownersSummary).toMatch(/OCTA polišu ieraksti/);
    expect(mapped.ownersSummary).toMatch(/Imports uz Dāniju/);
    expect(mapped.statusRecords).toMatch(/Līzinga periodi/);
    expect(mapped.notes.some((n) => /nav izgāzta/.test(n))).toBe(true);
    expect(mapped.notes.some((n) => /trinløst gear/.test(n))).toBe(true);
    expect(mapped.message).toMatch(/Færdselsstyrelsen synsrapport/);
  });

  it("counts OCTA company takeovers, not same-day renewals or deregistration", () => {
    const periods = estimateDkOwnersFromOcta([
      { selskab: "KØBSTÆDERNES FORS.", status: "Aktiv", oprettet: "18-12-2017" },
      { selskab: "Alm. Brand", status: "Aktiv", oprettet: "01-02-2018" },
      { selskab: "KØBSTÆDERNES FORS.", status: "Ophørt", oprettet: "01-02-2018" },
      { selskab: "Alm. Brand", status: "Aktiv", oprettet: "01-02-2019" },
      { selskab: "Alm. Brand", status: "Ophørt", oprettet: "01-02-2019" },
      { selskab: "Alm. Brand", status: "Ophørt", oprettet: "10-10-2019" },
      { selskab: "GF-FORSIKRING A/S", status: "Aktiv", oprettet: "11-11-2019" },
      { selskab: "Codan Forsikring A/S", status: "Aktiv", oprettet: "16-06-2023" },
      { selskab: "GF-FORSIKRING A/S", status: "Ophørt", oprettet: "16-06-2023" },
      { selskab: "GF-FORSIKRING A/S", status: "Aktiv", oprettet: "11-11-2025" },
      { selskab: "Codan Forsikring A/S", status: "Ophørt", oprettet: "11-11-2025" },
      { selskab: "GF-FORSIKRING A/S", status: "Ophørt", oprettet: "11-11-2025" },
      { selskab: "GF-FORSIKRING A/S", status: "Ophørt", oprettet: "12-08-2026" },
    ]);
    expect(periods.map((p) => `${p.date}:${p.company}`)).toEqual([
      "2017-12-18:KØBSTÆDERNES FORS.",
      "2018-02-01:Alm. Brand",
      "2019-11-11:GF-FORSIKRING A/S",
      "2023-06-16:Codan Forsikring A/S",
      "2025-11-11:GF-FORSIKRING A/S",
    ]);
  });
});
