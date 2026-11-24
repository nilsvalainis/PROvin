/**
 * 24.11 pretrunu audits (zurnals/pretrunu-audits-2026-11-24.md): viltus brīdinājumi pazūd, patiesie paliek.
 */
import { describe, expect, it } from "vitest";
import { createDefaultSourceBlocks } from "@/lib/admin-source-blocks";
import { buildCanonicalFacts, type CanonicalFacts } from "@/lib/canonical-facts-sheet";
import { checkCommentContradictions } from "@/lib/comment-contradiction-check";
import { engineCodeMatchesLoaded, findPowertrainContradictions } from "@/lib/comment-powertrain-guard";
import {
  applyOdometerAnomalyOverrides,
  classifyOdometerAnomalies,
  findOdometerAnomalyOverride,
  odometerAnomalyKey,
} from "@/lib/odometer-anomaly-classify";
import type { UnifiedMileageRow } from "@/lib/unified-mileage";

function facts(over: Partial<CanonicalFacts> = {}): CanonicalFacts {
  return { ...buildCanonicalFacts({ sourceBlocks: createDefaultSourceBlocks() }), ...over };
}

const flagsOf = (text: string, f: CanonicalFacts, field = "summary", focusSourceLabel?: string) =>
  checkCommentContradictions({ text, field, facts: f, focusSourceLabel });

describe("km_mismatch (audits 4.3)", () => {
  const f = facts({ latestKm: 210_400, mileageKms: [98_310, 154_020, 210_400], mileageDates: ["12.05.2016", "03.04.2019", "02.10.2025"] });

  it("vēsturisks rādījums, kas sakrīt ar kādu rindu (±1 500 km / ±2 %), nav pretruna", () => {
    expect(flagsOf("2019. gada apkopē nobraukums bija 154 900 km.", f).filter((x) => x.id === "km_mismatch")).toEqual([]);
  });

  it("«km gadā» un diapazoni nav rādījumi", () => {
    expect(flagsOf("Nobraukums vidēji 18 000 km gadā, kopā 120 000 - 140 000 km.", f).filter((x) => x.id === "km_mismatch")).toEqual([]);
  });

  it("neatbilstošs skaitlis bez «pašreizējais» - info, ar «pašreizējais» - jāpārbauda", () => {
    const info = flagsOf("Pie 61 000 km nomainīts zobsiksnas komplekts.", f).filter((x) => x.id === "km_mismatch");
    expect(info.map((x) => x.level)).toEqual(["I"]);
    const warn = flagsOf("Pašreizējais nobraukums ir 61 000 km.", f).filter((x) => x.id === "km_mismatch");
    expect(warn.map((x) => x.level)).toEqual(["W"]);
  });
});

describe("negācijas ar avota tvērumu (audits 4.3)", () => {
  const rows = [{ date: "05.2021", lossAmount: "2 300 EUR", country: "Vācija", sortableTime: 1, sourceOrder: 1, sourceLabel: "CarVertical" }];
  const f = facts({
    incidents: rows,
    damageEvidence: {
      rows: rows.map((r) => ({ date: r.date, descriptionLv: "Bojājums", amount: r.lossAmount, sourceLabel: r.sourceLabel })),
      total: 1,
      withoutAmountCount: 0,
      hasDealerBodyOrGlassWork: false,
    },
  } as Partial<CanonicalFacts>);
  const ids = (t: string, field = "summary", focus?: string) => flagsOf(t, f, field, focus).map((x) => x.id);

  it("«AutoDNA bojājumu nav», ja bojājums ir tikai CarVertical - nav kļūda", () => {
    expect(ids("AutoDNA pārskatā bojājumu ierakstu nav.")).not.toContain("no_damage_claim");
  });
  it("«šajā avotā nav» avota komentārā ar citu avotu bojājumiem - nav kļūda", () => {
    expect(ids("Šajā avotā negadījumu nav.", "autodna", "AutoDNA")).not.toContain("no_accidents_claim");
  });
  it("īpašības negācija un nosacījums - nav kļūda", () => {
    expect(ids("Bojājums nav kosmētisks, bet nav arī kritisks.")).not.toContain("no_damage_claim");
    expect(ids("Ja apstiprinās, ka negadījumos nav cietusi virsbūve, auto ir labs.")).not.toContain("no_accidents_claim");
  });
  it("vispārīgs «negadījumu nav» un CarVertical «nav» joprojām ir kļūda", () => {
    expect(ids("Negadījumu nav fiksētu.")).toContain("no_accidents_claim");
    expect(ids("CarVertical bojājumu nav.")).toContain("no_damage_claim");
  });
});

describe("eļļa un periodi (negated_fact)", () => {
  const f = facts({ dealerComponentCounts: [{ label: "Dzinēja eļļas maiņas", dates: ["12.03.2017", "20.04.2018"] }] });
  const ids = (t: string) => flagsOf(t, f).map((x) => x.id);
  it("kārbas eļļa nav dzinēja eļļa", () => {
    expect(ids("Kārbas eļļas maiņa dīlera datos nav fiksēta.")).not.toContain("negated_fact");
  });
  it("«pēc 2019. gada nav» - patiess, ja visas maiņas pirms 2019", () => {
    expect(ids("Pēc 2019. gada dzinēja eļļas maiņas nav fiksētas.")).not.toContain("negated_fact");
  });
  it("vispārīgs «dzinēja eļļas maiņu nav» joprojām ir kļūda", () => {
    expect(ids("Dzinēja eļļas maiņas nav fiksētas.")).toContain("negated_fact");
  });
});

describe("first_reg_country: virsraksti nav apgalvojumi", () => {
  const base = facts();
  const f = facts({ firstReg: { ...base.firstReg, countryLv: "Vācija", countryIso: "DE", date: "01.03.2016" } });
  it("virsraksts bez darbības vārda", () => {
    expect(flagsOf("Pirmā reģistrācija Latvijā un tehniskā apskate", f).map((x) => x.id)).not.toContain("first_reg_country");
  });
  it("apgalvojums joprojām ir kļūda", () => {
    expect(flagsOf("Auto pirmo reizi reģistrēts Latvijā 2016. gadā.", f).map((x) => x.id)).toContain("first_reg_country");
  });
});

describe("dzinēja koda saime (audits 4.3)", () => {
  const id = (engineCode: string) => ({ engineCode, fuelKind: "diesel" as const, fuelRaw: "Diesel", source: "dealer" as const });
  const engine = (text: string, code: string) => findPowertrainContradictions(text, id(code)).filter((h) => h.id === "powertrain_engine");
  it("OM654 = «OM 654.920», OM651 = «651.950», «M651 R4-DIESEL»", () => {
    expect(engine("Dzinējs OM654 ir uzticams.", "OM 654.920")).toEqual([]);
    expect(engine("Dzinējs OM651 prasa uzmanību.", "651.950")).toEqual([]);
    expect(engineCodeMatchesLoaded("OM651", "M651 R4-DIESEL")).toBe(true);
  });
  it("«TDCI» nav kods - nav ar ko salīdzināt", () => {
    expect(engine("Dzinējs DW10 ir izplatīts.", "TDCI")).toEqual([]);
  });
  it("cita saime joprojām ir kļūda", () => {
    expect(engine("Dzinējs OM642 prasa uzmanību.", "OM 654.920")).toHaveLength(1);
  });
});

describe("odometra anomāliju stabilā atslēga (audits 3.1)", () => {
  const r = (date: string, km: number, sourceLabel: string, sourceOrder: number, t: number): UnifiedMileageRow => ({
    date,
    odometer: String(km),
    country: "LV",
    sortableTime: t,
    sourceOrder,
    sourceLabel,
  });
  const rows = [
    r("01.01.2020", 180_000, "CSDD", 0, Date.UTC(2020, 0, 1)),
    r("01.06.2024", 120_000, "CSDD", 1, Date.UTC(2024, 5, 1)),
  ];
  it("atslēga nesatur sourceOrder - pievienojot avotu, lēmums paliek", () => {
    const a = classifyOdometerAnomalies(rows)[0]!;
    const shifted = classifyOdometerAnomalies([r("01.03.2010", 20_000, "AutoDNA", 0, Date.UTC(2010, 2, 1)), ...rows.map((x) => ({ ...x, sourceOrder: x.sourceOrder + 1 }))]);
    expect(shifted.find((x) => x.class === "rollback")!.key).toBe(a.key);
  });
  it("vecā atslēga (datums|km|avots|sourceOrder) tiek atpazīta pēc datuma + km", () => {
    const legacy = [{ key: odometerAnomalyKey({ ...rows[1]!, sourceOrder: 9 }), action: "dismiss" as const }];
    const a = classifyOdometerAnomalies(rows)[0]!;
    expect(findOdometerAnomalyOverride(a, legacy)?.action).toBe("dismiss");
    expect(applyOdometerAnomalyOverrides(classifyOdometerAnomalies(rows), legacy)).toEqual([]);
  });
  it("999 999 un «01.00.2018» nav rādījumi", () => {
    const out = classifyOdometerAnomalies([
      ...rows.slice(0, 1),
      r("01.00.2018", 10_000, "CarVertical", 5, Date.UTC(2018, 0, 1)),
      r("02.02.2021", 999_999, "AutoDNA", 6, Date.UTC(2021, 1, 2)),
      r("01.03.2021", 190_000, "CSDD", 7, Date.UTC(2021, 2, 1)),
    ]);
    expect(out).toEqual([]);
  });
});

describe("negācijas - papildu (prod paraugi pēc pirmās palaišanas)", () => {
  const rows = [{ date: "05.2021", lossAmount: "2 300 EUR", country: "Vācija", sortableTime: 1, sourceOrder: 1, sourceLabel: "CarVertical" }];
  const f = facts({
    incidents: rows,
    damageEvidence: {
      rows: rows.map((r) => ({ date: r.date, descriptionLv: "Bojājums", amount: r.lossAmount, sourceLabel: r.sourceLabel })),
      total: 1,
      withoutAmountCount: 0,
      hasDealerBodyOrGlassWork: false,
    },
  } as Partial<CanonicalFacts>);
  const ids = (t: string) => flagsOf(t, f).map((x) => x.id);
  it("īpašības, neziņa, pārbaudes norādes un avoti pirms negācijas - nav kļūda", () => {
    for (const t of [
      "Konstruktīvu virsbūves bojājumu pazīmju datos nav.",
      "Tāpat nav zināms DPF filtra bojājuma cēlonis.",
      "Jāpārbauda arī radiatoru stāvoklis, vai nav redzamas noplūdes vai bojājumi.",
      "Reģistrētais negadījums nav bijis kritisks.",
      "Kamēr CSDD un AutoDNA reģistros nav fiksēts neviens negadījums, CarVertical uzrāda apdrošināšanas gadījumu.",
    ]) {
      expect(ids(t), t).not.toContain("no_damage_claim");
      expect(ids(t), t).not.toContain("no_accidents_claim");
    }
  });
  it("«visos avotos, tostarp CarVertical, negadījumu nav» joprojām kļūda", () => {
    expect(ids("Visos avotos, tostarp CarVertical, nav fiksēts neviens negadījums.")).toContain("no_accidents_claim");
  });
});
