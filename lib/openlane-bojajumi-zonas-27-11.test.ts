/**
 * 27.11.2026 (WVWZZZ3CZNE054721, Openlane x10): klienta PDF drukāja jēlas atslēgas
 * «Damage kind: Šķemba; Damage kind id: 1; Damage location: 1; …» un «Area code: 3; Code: 1; Nosaukums: Chip»,
 * bet 5 bojājumi saplūda 1 rindā. Jābūt: «Zona 3» + «Šķemba» / «Iespiedums», katrs veids sava rinda, bez dublikātiem.
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

const EXPECTED = ["Zona 1|Šķemba|", "Zona 3|Šķemba|", "Zona 3|Iespiedums|", "Zona 13|Šķemba|", "Zona 16|Šķemba|", "Zona 16|Iespiedums|"];

describe("Openlane bojājumi ar numurētām zonām", () => {
  it("`Damages` (DamageKind / DamageLocation) - 6 rindas, bez tehniskajām atslēgām", () => {
    expect(pairs(rec({ car_identification: { Damages: DAMAGES_A } }))).toEqual(EXPECTED);
  });
  it("`damages` (areaCode + types[]) - katrs veids sava rinda", () => {
    expect(pairs(rec({ vehicle_details: { damages: DAMAGES_B } }))).toEqual(EXPECTED);
  });
  it("abi formāti vienā ierakstā - nedublējas", () => {
    const got = pairs(rec({ car_identification: { Damages: DAMAGES_A, DamagesDetailed: DAMAGES_B }, vehicle_details: { damages: DAMAGES_B } }));
    expect([...got].sort()).toEqual([...EXPECTED].sort());
  });
  it("PDF kartītē nav «Area code», «Damage kind», «id» un ir zona klienta valodā", () => {
    const dmg = buildThecarapiPdfModel(rec({ vehicle_details: { damages: DAMAGES_B } })).damages;
    const lv = auctionArchiveDamageBlockHtml(dmg, [], "lv");
    expect(lv).not.toMatch(/Area code|Damage kind|Damage location|Code:|Nosaukums|Is for broken/i);
    expect(lv).toContain("Zona 16");
    expect(lv).toContain("6 bojājumi");
    const en = auctionArchiveDamageBlockHtml(dmg, [], "en");
    expect(en).toContain("Zone 16");
    expect(en).not.toContain("Zona");
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
