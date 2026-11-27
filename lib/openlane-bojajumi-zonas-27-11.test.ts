/**
 * 27.11.2026 (WVWZZZ3CZNE054721, Openlane x10): klienta PDF drukāja jēlas atslēgas
 * «Damage kind: Šķemba; Damage kind id: 1; Damage location: 1; …» un «Area code: 3; Code: 1; Nosaukums: Chip»,
 * bet 5 bojājumi saplūda 1 rindā. Jābūt: katrs veids sava rinda, bez dublikātiem.
 * Nils 27.11 vakarā: «Zona 13» klientam neko neizsaka - numurs → vieta (Openlane vārdnīca, openlane-damage-locations).
 */
import { describe, expect, it } from "vitest";
import { auctionArchiveDamageBlockHtml } from "@/lib/auction-archive-pdf-html";
import { buildThecarapiPdfModel } from "@/lib/thecarapi-pdf-model";
import type { ThecarapiAdminRecord } from "@/lib/vin-scan/thecarapi-fields";

const kind = (k: string, id: number, loc: number) => ({
  DamageKind: k,
  DamageKindId: id,
  DamageLocation: String(loc),
  DamageLocationCategoryId: 1,
  DamageLocationId: loc,
  IsForBrokenCars: false,
});
const area = (code: string, ...names: string[]) => ({
  areaCode: code,
  areaName: code,
  comment: "",
  types: names.map((name, i) => ({ code: String(i + 1), comment: null, name })),
});

const DAMAGES_A = [kind("Chip", 1, 1), kind("Chip", 1, 3), kind("Dent", 3, 3), kind("Chip", 1, 13), kind("Chip", 1, 16), kind("Dent", 3, 16)];
const DAMAGES_B = [area("1", "Chip"), area("3", "Chip", "Dent"), area("13", "Chip"), area("16", "Chip", "Dent")];

function rec(detail: Record<string, unknown>): ThecarapiAdminRecord {
  return {
    site: "openlane",
    id: "11835156",
    date: "2026-11-12",
    venue: "Openlane",
    photoDate: "2026-11-12",
    fields: [],
    photoUrls: [],
    raw: null,
    rawHistory: null,
    rawDetail: detail,
    rawImages: null,
    photos: [],
  } as unknown as ThecarapiAdminRecord;
}

const pairs = (r: ThecarapiAdminRecord) => buildThecarapiPdfModel(r).damages.map((d) => `${d.zone}|${d.type}|${d.notes}`);

// Openlane vietas (openlane-damage-locations): 1 priekšējais buferis, 3 motora pārsegs, 13 aizmugurējais buferis, 16 jumts.
const pairs3 = (r: ThecarapiAdminRecord) => buildThecarapiPdfModel(r).damages.map((d) => `${d.zone}|${d.part}|${d.type}`);
const EXPECTED = ["Priekša|Akmens šķemba|", "Priekša|Akmens šķemba|", "Priekša|Iespiedums|", "Aizmugure|Akmens šķemba|", "Jumts|Akmens šķemba|", "Jumts|Iespiedums|"];
const EXPECTED3 = [
  "Priekša|Priekšējais buferis|Akmens šķemba",
  "Priekša|Motora pārsegs|Akmens šķemba",
  "Priekša|Motora pārsegs|Iespiedums",
  "Aizmugure|Aizmugurējais buferis|Akmens šķemba",
  "Jumts||Akmens šķemba",
  "Jumts||Iespiedums",
];

describe("Openlane bojājumi ar numurētām zonām", () => {
  it("`Damages` (DamageKind / DamageLocation) - 6 rindas, bez tehniskajām atslēgām", () => {
    expect(pairs(rec({ car_identification: { Damages: DAMAGES_A } }))).toEqual(EXPECTED);
    expect(pairs3(rec({ car_identification: { Damages: DAMAGES_A } }))).toEqual(EXPECTED3);
  });
  it("`damages` (areaCode + types[]) - katrs veids sava rinda", () => {
    expect(pairs3(rec({ vehicle_details: { damages: DAMAGES_B } }))).toEqual(EXPECTED3);
  });
  it("abi formāti vienā ierakstā - nedublējas", () => {
    const got = pairs3(rec({ car_identification: { Damages: DAMAGES_A, DamagesDetailed: DAMAGES_B }, vehicle_details: { damages: DAMAGES_B } }));
    expect([...got].sort()).toEqual([...EXPECTED3].sort());
  });
  it("nezināms Openlane numurs paliek «Zona N» (nekādu minējumu)", () => {
    expect(pairs3(rec({ car_identification: { Damages: [kind("Dent", 3, 99)] } }))).toEqual(["Zona 99||Iespiedums"]);
  });
  it("citas platformas numurētu zonu Openlane vārdnīcā nekarto", () => {
    const r = { ...rec({ vehicle_details: { damages: [area("13", "Dent")] } }), site: "bca", venue: "BCA" } as ThecarapiAdminRecord;
    expect(pairs3(r)).toEqual(["Zona 13||Iespiedums"]);
  });
  it("PDF kartītē nav «Area code», «Damage kind», «id» un ir zona klienta valodā", () => {
    const dmg = buildThecarapiPdfModel(rec({ vehicle_details: { damages: DAMAGES_B } })).damages;
    const lv = auctionArchiveDamageBlockHtml(dmg, [], "lv");
    expect(lv).not.toMatch(/Area code|Damage kind|Damage location|Code:|Nosaukums|Is for broken/i);
    expect(lv).not.toMatch(/Zona \d/);
    expect(lv).toContain("Priekša, Motora pārsegs");
    expect(lv).toContain("Aizmugure, Aizmugurējais buferis");
    expect(lv).toContain("Jumts");
    expect(lv).toContain("Akmens šķemba");
    expect(lv).toContain("6 bojājumi");
    const en = auctionArchiveDamageBlockHtml(dmg, [], "en");
    expect(en).toContain("Front, Hood / bonnet");
    expect(en).toContain("Rear, Rear bumper");
    expect(en).toContain("Chip");
    expect(en).not.toMatch(/Zona|Zone \d|šķemba|Iespiedums|Priekša/);
    const ru = auctionArchiveDamageBlockHtml(dmg, [], "ru");
    expect(ru).toContain("Спереди, Капот");
    expect(ru).toContain("Сзади, Задний бампер");
    expect(ru).toContain("Вмятина");
    const de = auctionArchiveDamageBlockHtml(dmg, [], "de");
    expect(de).toContain("Vorne, Motorhaube");
    expect(de).toContain("Hinten, Heckstoßstange");
    expect(de).toContain("Delle");
  });
});

describe("galvenie fakti atkārtotās izsolēs (11 izsoles, viens auto)", () => {
  it("atslēgas - katrs portāla un skaita pāris vienreiz; bojājumi - lielākais skaits vienā izsolē, ne summa", async () => {
    const { auctionArchiveKeyFindings } = await import("@/lib/auction-archive-facts");
    const lot = (platform: string, date: string, keys: number, damageCount: number) => ({
      platform,
      date,
      km: 151255,
      damageCount,
      facts: { country: "", location: "", lotNo: "", sale: [], condition: [], prices: [], keys, damagesDeclared: true, lastServiceKm: null },
    });
    const lots = [
      ...["2026-09-28", "2026-10-02", "2026-10-09", "2026-10-12"].map((d) => lot("Openlane", d, 2, 1)),
      lot("Autorola", "2026-10-13", 1, 1),
      ...["2026-10-19", "2026-10-26", "2026-11-02", "2026-11-06", "2026-11-10", "2026-11-12"].map((d) => lot("Openlane", d, 2, 6)),
    ];
    const texts = auctionArchiveKeyFindings(lots as never).map((x) => x.text);
    expect(texts).toContain("Atslēgu skaits izsolēs atšķiras: Openlane - 2, Autorola - 1.");
    expect(texts).toContain("Izsolēs norādīti 6 bojājumi.");
    expect(texts.join(" ")).not.toMatch(/4[0-9] bojājumi|30 bojājumi/);
  });
});
