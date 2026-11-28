import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { buildThecarapiAdminRecords } from "@/lib/vin-scan/parse-thecarapi";

import { mergeSourceBlocksWithDefaults, type WorkspaceSourceBlocks } from "@/lib/admin-source-blocks";
import type { CanonicalFacts } from "@/lib/canonical-facts-sheet";
import { checkExtraFacts, extractGearboxCodes, parsePowerKw } from "@/lib/fact-check-extra-facts";
import { emptyOutvinVehicleInfo } from "@/lib/outvin-dealer-types";

function blocks(patch: (b: WorkspaceSourceBlocks) => void = () => {}): WorkspaceSourceBlocks {
  const b = mergeSourceBlocksWithDefaults({} as unknown);
  patch(b);
  return b;
}

function withDealer(b: WorkspaceSourceBlocks, vi: Partial<ReturnType<typeof emptyOutvinVehicleInfo>>) {
  b.auto_records.outvinReport = {
    vehicleInfo: { ...emptyOutvinVehicleInfo(), ...vi },
    accidentCheck: "",
    stolenCheck: "",
    equipment: [],
  } as unknown as NonNullable<WorkspaceSourceBlocks["auto_records"]["outvinReport"]>;
}

const FACTS = {
  mileageReadings: [
    { date: "15.03.2020", km: 120_400, source: "CSDD" },
    { date: "02.06.2022", km: 151_000, source: "Dīleris" },
  ],
  damageEvidence: { rows: [], total: 0, withoutAmountCount: 0, hasDealerBodyOrGlassWork: false },
} as unknown as CanonicalFacts;

const run = (text: string, sourceBlocks: WorkspaceSourceBlocks = blocks(), facts: CanonicalFacts = FACTS) =>
  checkExtraFacts({ text, facts, sourceBlocks });

describe("kārbas kods", () => {
  it("atpazīst kodus", () => {
    expect(extractGearboxCodes("DSG DQ250 un ZF 8HP50, kā arī 0AM")).toEqual(["DQ250", "ZF8HP50", "0AM"]);
  });
  const b = blocks((x) => withDealer(x, { transmission: "7-pakāpju DSG DQ381" }));
  it("cits kods teikumā par kārbu - W", () => {
    const f = run("Auto ir aprīkots ar DSG kārbu DQ250.", b);
    expect(f.map((x) => x.kind)).toContain("powertrain_gearbox");
  });
  it("tas pats kods - nav atzīmes", () => {
    expect(run("Ātrumkārba DQ381 prasa eļļas maiņu ik pēc 60 000 km.", b).filter((x) => x.id === "powertrain_gearbox_code")).toEqual([]);
  });
  it("salīdzinājums ar citu versiju - nav atzīmes", () => {
    expect(run("Atšķirībā no vecākās versijas ar DQ250 kārbu, šeit ir cita.", b).filter((x) => x.id === "powertrain_gearbox_code")).toEqual([]);
  });
  it("bez ielādēta koda - nav atzīmes", () => {
    expect(run("Kārba DQ250.", blocks()).filter((x) => x.id === "powertrain_gearbox_code")).toEqual([]);
  });
});

describe("jauda", () => {
  it("parsē avota jaudu", () => {
    expect(parsePowerKw("140")).toBe(140);
    expect(parsePowerKw("190 PS", false)).toBe(140);
    expect(parsePowerKw("140 kW", false)).toBe(140);
    expect(parsePowerKw("140", false)).toBeNull();
  });
  const b = blocks((x) => {
    x.csdd.enginePowerKw = "140";
  });
  it("cita jauda - W", () => {
    const f = run("Dzinēja jauda ir 110 kW.", b);
    expect(f).toHaveLength(1);
    expect(f[0]!.kind).toBe("power_output");
  });
  it("tā pati jauda kW un ZS - nav atzīmes", () => {
    expect(run("Dzinēja jauda 140 kW (190 ZS).", b)).toEqual([]);
  });
  it("diapazons / versijas - nav atzīmes", () => {
    expect(run("Šis dzinējs ražots versijās no 100 līdz 140 kW.", b)).toEqual([]);
    expect(run("Jaudīgākā versija ar 180 kW nav šis auto.", b)).toEqual([]);
  });
  it("avoti nesakrīt - nav atzīmes", () => {
    const c = blocks((x) => {
      x.csdd.enginePowerKw = "140";
      withDealer(x, { power: "110 kW" });
    });
    expect(run("Jauda 110 kW.", c)).toEqual([]);
  });
  it("bez avota jaudas - nav atzīmes", () => {
    expect(run("Jauda 110 kW.", blocks())).toEqual([]);
  });
});

describe("nobraukums pie datuma", () => {
  it("cits km tajā datumā - E", () => {
    const f = run("15.03.2020 tehniskajā apskatē odometrs rādīja 98 000 km.");
    expect(f).toHaveLength(1);
    expect(f[0]!.kind).toBe("km_at_date");
    expect(f[0]!.level).toBe("E");
  });
  it("sakrīt ar avotu (noapaļots) - nav atzīmes", () => {
    expect(run("15.03.2020 nobraukums bija 120 000 km.")).toEqual([]);
  });
  it("datums nav avotos - nav atzīmes (to dara unsourced_date)", () => {
    expect(run("01.01.2019 nobraukums bija 90 000 km.")).toEqual([]);
  });
  it("nobraukts attālums / periods - nav atzīmes", () => {
    expect(run("Kopš 15.03.2020 auto nobraucis 30 000 km.")).toEqual([]);
  });
  it("divi datumi, viens km - neviennozīmīgi, nav atzīmes", () => {
    expect(run("No 15.03.2020 līdz 02.06.2022 nobraukums 151 000 km.")).toEqual([]);
  });
  it("hipotētisks teikums - nav atzīmes", () => {
    expect(run("Tas nenozīmē, ka 15.03.2020 odometrs rādīja 98 000 km.")).toEqual([]);
  });
  it("obligātā eļļas piebilde - nekad nav kļūda", () => {
    expect(
      run(
        "Kopš pēdējās fiksētās eļļas maiņas (15.03.2020, 98 000 km) līdz pēdējam dīlera ierakstam (02.06.2022, 151 000 km) pagājuši 2 gadi - tas pārsniedz ražotāja intervālu.",
      ),
    ).toEqual([]);
  });
});

describe("servisa ierakstu skaits", () => {
  const b = blocks((x) => {
    x.auto_records.serviceWorks = [
      { date: "01.02.2019", odometer: "60000", location: "BMW Bonn", works: "Apkope" },
      { date: "01.02.2019", odometer: "60000", location: "BMW Bonn", works: "Bremzes" },
      { date: "10.05.2021", odometer: "110000", location: "BMW Bonn", works: "Apkope" },
    ];
  });
  it("cits skaits - W", () => {
    const f = run("Dīlera datos ir 5 servisa ieraksti.", b);
    expect(f.map((x) => x.kind)).toEqual(["service_count"]);
  });
  it("rindu vai apmeklējumu skaits - nav atzīmes", () => {
    expect(run("Ir 2 servisa ieraksti.", b)).toEqual([]);
    expect(run("Ir divi servisa apmeklējumi.", b)).toEqual([]);
  });
  it("periods vai cits avots - nav atzīmes", () => {
    expect(run("Kopš 2020 ir 1 servisa ieraksts.", b)).toEqual([]);
    expect(run("AutoDNA rāda 7 servisa ierakstus.", b)).toEqual([]);
  });
  it("bez dīlera rindām - nav atzīmes", () => {
    expect(run("Ir 5 servisa ieraksti.", blocks())).toEqual([]);
  });
});

describe("izsoļu bojājumi", () => {
  const withAuction = blocks((x) => {
    const file = path.join(process.cwd(), "lib/vin-scan/__fixtures__/thecarapi", "detail-bca-synth.json");
    x.cc_vin.thecarapiRecords = buildThecarapiAdminRecords({
      historyJson: null,
      detailJson: JSON.parse(readFileSync(file, "utf8")) as unknown,
    });
  });
  it("pozitīvi: «izsolē bojājumu nav» - E; vispārīgs «bojājumu nav» - W", () => {
    const a = run("Izsolē bojājumu nav.", withAuction).filter((f) => f.kind === "auction_damage");
    expect(a.map((f) => f.level)).toEqual(["E"]);
    const b = run("Auto ir bez bojājumiem.", withAuction).filter((f) => f.kind === "auction_damage");
    expect(b.map((f) => f.level)).toEqual(["W"]);
  });
  it("negatīvi: bez izsoles bojājumiem nav atzīmes", () => {
    expect(run("Bojājumu nav.")).toEqual([]);
  });
  it("negatīvi: neziņa, nosacījums, cits avots", () => {
    const own = (t: string) => run(t, withAuction).filter((f) => f.kind === "auction_damage");
    expect(own("Nav zināms, vai bojājumi ir novērsti.")).toEqual([]);
    expect(own("Ja bojājumu nav, krāsas biezums būs vienmērīgs.")).toEqual([]);
    expect(own("LTAB atlīdzību un bojājumu nav.")).toEqual([]);
    expect(own("Konstruktīvu bojājumu pazīmju nav.")).toEqual([]);
  });
});
