import { describe, expect, it } from "vitest";
import { isCustomsInspection, isFailedMot, extractDkRegistrationSignals, mapTjekbilPayload, tjekbilFaultLv, type TjekbilDmrResponse } from "@/lib/vin-sources/tjekbil-map";

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
    expect(isFailedMot({ kategori: "Periodisk syn", synsresultat: "Ikke godkendt" })).toBe(true);
    expect(isFailedMot({ kategori: "Periodisk syn", synsresultat: "Godkendt" })).toBe(false);
    expect(isFailedMot({ kategori: "Periodisk syn", synsresultat: "Betinget godkendt" })).toBe(false);
  });

  it("fills timeline, mileage and import without counting insurance as owners", () => {
    const mapped = mapTjekbilPayload({ dmr: SHARAN, mileagelogs: [], wanted: [] });
    expect(mapped.found).toBe(true);
    expect(mapped.incidents).toEqual([]);
    expect(mapped.mileage.map((r) => r.odometer)).toEqual(["188528", "29000"]);
    expect(mapped.timeline.some((r) => /Muitas apskate/.test(r.event))).toBe(true);
    expect(mapped.timeline.some((r) => /reģistrācijas apskate/i.test(r.event))).toBe(true);
    expect(mapped.timeline.some((r) => r.event === "Līzings sākas" && r.date === "2017-12-18")).toBe(true);
    expect(mapped.ownersSummary).toBe("Īpašnieku skaits Dānijā: 2.");
    expect(mapped.ownersSummary).not.toMatch(/OCTA|pēc reģistrācijas darbībām/);
    expect(mapped.statusRecords).toMatch(/Izmantošanas veids: Privāti/);
    expect(mapped.statusRecords).toMatch(/Līzings: 18\.12\.2017 - 21\.10\.2019 \(3 periodi\)/);
    expect(mapped.statusRecords).toMatch(/Reģistrācijas statuss: Noņemts no uzskaites/);
    expect(mapped.statusRecords).not.toMatch(/Sekundārais statuss/);
    expect(mapped.statusRecords).toMatch(/Pēdējā apskate: 28\.01\.2026, Izturēta/);
    expect(mapped.statusRecords).toMatch(/Pašreizējā OCTA: GF-FORSIKRING A\/S \(Beigusies\)/);
    expect(mapped.timeline.some((r) => /Periodiskā apskate: Izturēta/.test(r.event))).toBe(true);
    expect(mapped.notes).toEqual([]);
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
      /Īpašnieku skaits Dānijā: 2/,
    );
  });
});

describe("tjekbilFaultLv - apskates trūkums klienta atskaitei", () => {
  it("viss zināms: grupa vienreiz un latvisks apraksts bez liekiem komatiem", () => {
    expect(
      tjekbilFaultLv({
        title: "Aksler, og affjedring",
        description:
          "Aksler, og affjedring, Fjedre og stabilisator, Aksler, og affjedring, Fjederkomponent er beskadiget eller har brud.,  , højre, 1. aksel, Væsentlig fejl",
      }),
    ).toBe(
      "Asis un balstiekārta: atsperes un stabilizators, atsperes detaļa ir bojāta vai lūzusi, labā puse, 1. ass, būtisks trūkums",
    );
    expect(
      tjekbilFaultLv({
        title: "Gener, udstødning",
        description:
          "Gener, udstødning, Motor med kompressionstænding, Emissionskontroludstyr monteret af fabrikanten mangler eller er tydeligvis defekt. - Væsentlig fejl",
      }),
    ).toBe(
      "Ietekme uz vidi, izplūdes gāzes: kompresijas aizdedzes motors (dīzelis), ražotāja uzstādītā izmešu kontroles iekārta trūkst vai ir acīmredzami bojāta, būtisks trūkums",
    );
    expect(tjekbilFaultLv({ title: "Bremser", description: "bremserør, tæret, bag, venstre" })).toBe(
      "Bremzes: bremžu caurule, korozija, aizmugurē, kreisā puse",
    );
  });

  it("apraksts nav pilnībā tulkojams: latviska grupa + dāņu oriģināls iekavās, bez valodu jaukuma", () => {
    expect(tjekbilFaultLv({ title: "Bremser", description: "Bremserør er meget tæret ved bagaksel." })).toBe(
      'Bremzes (da: "Bremserør er meget tæret ved bagaksel.")',
    );
    expect(
      tjekbilFaultLv({ title: "Styretøj", description: "Styretøj, Tandstang utæt ved manchet, venstre" }),
    ).toBe('Stūres iekārta (da: "Tandstang utæt ved manchet, venstre")');
  });

  it("nezināma grupa: viss teksts paliek dāniski ar atzīmi", () => {
    expect(tjekbilFaultLv({ title: "Ukendt gruppe", description: "noget helt andet" })).toBe(
      'da: "Ukendt gruppe: noget helt andet"',
    );
  });

  it("tikai virsraksts vai tikai apraksts", () => {
    expect(tjekbilFaultLv({ title: "Bremser" })).toBe("Bremzes");
    expect(tjekbilFaultLv({ title: "Bremser", description: "Bremser" })).toBe("Bremzes");
    expect(tjekbilFaultLv({ description: "slør, for stor, højre" })).toBe("Brīvkustība, pārāk liela, labā puse");
    expect(tjekbilFaultLv({ description: "noget andet" })).toBe('da: "noget andet"');
    expect(tjekbilFaultLv({})).toBe("");
  });
});

describe("neizturētas apskates piezīme", () => {
  const withInspection = (synsresultat: string, fejl: unknown[] = []): TjekbilDmrResponse => ({
    inspectionData: {
      rapporter: [{ synsdato: "10-10-2023", kategori: "Periodisk syn", synstype: "Første syn", synsresultat, fejl }],
    },
  });

  it("„Kan godkendes efter omsyn” un „Kan ikke godkendes” - bez dubulta „nav izturēta”", () => {
    expect(mapTjekbilPayload({ dmr: withInspection("Kan godkendes efter omsyn hos (om)synsvirksomhed") }).incidents).toEqual([
      { date: "2023-10-10", amount: "", country: "Dānija", note: "Apskate nav izturēta, jāveic atkārtota apskate" },
    ]);
    expect(mapTjekbilPayload({ dmr: withInspection("Kan ikke godkendes") }).incidents[0]?.note).toBe(
      "Apskate nav izturēta",
    );
  });

  it("jaukts saraksts: tulkojamais trūkums latviski, netulkojamais ar oriģinālu", () => {
    const dmr = withInspection("Kan godkendes efter omsyn", [
      { title: "Bremser", description: "bremseslange, defekt, for, højre" },
      { title: "Karrosseri", description: "Karrosseri, dørtrin gennemtæret i højre side" },
    ]);
    expect(mapTjekbilPayload({ dmr }).incidents[0]?.note).toBe(
      'Apskate nav izturēta, jāveic atkārtota apskate - Bremzes: bremžu šļūtene, defekts, priekšā, labā puse | Virsbūve (da: "dørtrin gennemtæret i højre side")',
    );
  });
});
