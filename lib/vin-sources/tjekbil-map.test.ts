import { describe, expect, it } from "vitest";
import { isCustomsInspection, isFailedMot, extractDkRegistrationSignals, mapTjekbilPayload, type TjekbilDmrResponse } from "@/lib/vin-sources/tjekbil-map";

const SHARAN: TjekbilDmrResponse = {
  basic: {
    regNr: "CM53865",
    status: "Afmeldt",
    statusDato: "2026-08-12T15:56:05+02:00",
    foersteRegistreringDato: "2013-12-18T00:00:00+01:00",
    bilLeaset: false,
    leasingHistory: [
      { leasingGyldigFra: "2017-12-18T00:00:00+01:00", leasingGyldigTil: "2018-02-01T00:00:00+01:00" },
      { leasingGyldigFra: "2018-02-01T00:00:00+01:00", leasingGyldigTil: "2019-02-01T00:00:00+01:00" },
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
    expect(mapped.ownersSummary).toMatch(/Dānijas īpašnieku skaits: 2/);
    expect(mapped.ownersSummary).toMatch(/līzings \+ privāta reģistrācija Dānijā, ne pēc OCTA/);
    expect(mapped.ownersSummary).toMatch(/Līzings Dānijā/);
    expect(mapped.ownersSummary).toMatch(/Privāta reģistrācija Dānijā/);
    expect(mapped.ownersSummary).toMatch(/ārpus Dānijas — nav Dānijas īpašnieks/);
    expect(mapped.ownersSummary).not.toMatch(/pēc \d+ OCTA kompāniju/);
    expect(mapped.ownersSummary).toMatch(/OCTA polišu ieraksti \(nav īpašnieku skaits\)/);
    expect(mapped.ownersSummary).toMatch(/Imports uz Dāniju/);
    expect(mapped.statusRecords).toMatch(/Līzinga periodi/);
    expect(mapped.notes.some((n) => /nav izgāzta/.test(n))).toBe(true);
    expect(mapped.notes.some((n) => /trinløst gear/.test(n))).toBe(true);
    expect(mapped.message).toMatch(/Færdselsstyrelsen synsrapport/);
  });

  it("counts leasing then private as two Danish owners, not the German first registration", () => {
    const signals = extractDkRegistrationSignals(SHARAN, (SHARAN.inspectionData?.rapporter ?? []) as never);
    expect(signals.map((s) => `${s.date}:${s.event}`)).toEqual([
      "2017-12-18:Līzings Dānijā",
      "2019-10-22:Privāta reģistrācija Dānijā",
    ]);
  });

  it("counts first registration when the car started in Denmark", () => {
    const dmr: TjekbilDmrResponse = {
      basic: { foersteRegistreringDato: "2015-03-01T00:00:00+01:00", statusHistory: [] },
      inspectionData: {
        rapporter: [
          {
            kategori: "Periodisk syn",
            synstype: "Periodisk syn",
            synsresultat: "Godkendt",
            synsdato: "01-03-2017",
          },
        ],
      },
    };
    const signals = extractDkRegistrationSignals(dmr, (dmr.inspectionData?.rapporter ?? []) as never);
    expect(signals).toEqual([{ date: "2015-03-01", event: "Pirmā reģistrācija Dānijā" }]);
  });

  it("adds DMR statusHistory owner transfers, not afmelding or periodic syn", () => {
    const dmr: TjekbilDmrResponse = {
      ...SHARAN,
      basic: {
        ...SHARAN.basic,
        statusHistory: [
          { dato: "2019-11-11", type: "Ejerskifte", status: "Registreret" },
          { dato: "2020-01-16", type: "Periodisk syn", status: "Godkendt" },
          { dato: "2026-08-12", type: "Afmeldt", status: "Afmeldt" },
        ],
      },
    };
    const inspections = (SHARAN.inspectionData?.rapporter ?? []) as never;
    const signals = extractDkRegistrationSignals(dmr, inspections);
    expect(new Set(signals.map((s) => s.date)).size).toBe(2);
    expect(signals.some((s) => s.event === "Līzings Dānijā")).toBe(true);
    expect(signals.some((s) => s.event === "Privāta reģistrācija Dānijā")).toBe(true);
    expect(signals.some((s) => s.date === "2019-11-11")).toBe(false);
    expect(mapTjekbilPayload({ dmr, mileagelogs: [], wanted: [] }).ownersSummary).toMatch(
      /Dānijas īpašnieku skaits: 2/,
    );
  });
});
