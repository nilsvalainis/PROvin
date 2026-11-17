import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseAutodnaDamageDetails, parseAutodnaDamageEvents } from "@/lib/autodna-damage-parse";
import { isAutodnaPageNoiseLine, stripAutodnaPageNoise } from "@/lib/autodna-page-noise";
import { extractGroupListFromBlock, extractZoneListFromBlock } from "@/lib/damage-zones";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "__fixtures__");
const PAGE_BREAK_LV = readFileSync(join(FIXTURES, "autodna-damage-page-break", "autodna-lv.txt"), "utf8");
const GRANDLAND_AUTODNA = readFileSync(join(FIXTURES, "grandland-W0VZCYHZXN6843259", "autodna.txt"), "utf8");

const FOOTER_LEAK_RE = /Pārbaudiet|oriģinalitāti|QR\s*kod|Lapa\s*\d|autoDNA|auto DNA|Atskaite|[0-9a-f]{24}|\d{4}-\d{2}-\d{2}|\d{2}:\d{2}/i;

describe("AutoDNA damage block across a PDF page break", () => {
  const details = parseAutodnaDamageDetails(PAGE_BREAK_LV);
  const byDate = (d: string) => details.find((r) => r.date === d);

  it("does not copy the page footer/header into damage groups", () => {
    const row = byDate("03.2019");
    expect(row?.damageGroups).not.toMatch(FOOTER_LEAK_RE);
    expect(row?.damageGroups).toMatch(/Virsbūves ārējās daļas/);
    expect(row?.damageGroups).toMatch(/Ārējais apgaismojums/);
    expect(row?.damageGroups).toMatch(/Virsbūves konstrukcija/);
    expect(row?.damagedSides).toMatch(/Priekšpuse/);
    expect(row?.damagedSides).toMatch(/Labā sāna priekšpuse/);
    expect(row?.country).toMatch(/Vācij/);
    expect(row?.lossAmount).toMatch(/2 600.*2 800/);
  });

  it("continues the damage zone list on the next page", () => {
    const row = byDate("08.2020");
    expect(row?.damagedSides).not.toMatch(FOOTER_LEAK_RE);
    expect(row?.damagedSides).toMatch(/Aizmugure/);
    expect(row?.damagedSides).toMatch(/Kreisais sāns/);
    expect(row?.country).toMatch(/Latvij/);
  });

  it("keeps every damage event with its own sum and country", () => {
    const events = parseAutodnaDamageEvents(PAGE_BREAK_LV);
    expect(events.map((e) => e.csngDate)).toEqual(["03.2019", "08.2020", "11.2021"]);
    expect(events[0]?.lossAmount).toMatch(/2 600.*2 800/);
    expect(events[1]?.lossAmount).toMatch(/900.*1 000/);
    expect(events[2]?.lossAmount).toMatch(/500.*600/);
    expect(events[2]?.incidentNo).toMatch(/Vācij/);
  });

  it("handles the footer glued onto the last damage line", () => {
    const raw = `
05.2022
Transportlīdzekļa zaudējumu apjoms
Summa 1 300 - 1 400 EUR
Detaļu grupa
- Virsbūves ārējās daļas Pārbaudiet ziņojuma oriģinalitāti - noskenējiet galvenē redzamo QR kodu. 3c7e1f9a0b2d4c6e8f1a3b5c7d9e0f12 2026-11-05 09:14:27 Lapa 6
- Ārējais apgaismojums
Bojājumu zona
- Priekšpuse
Valsts Latvija
`;
    const row = parseAutodnaDamageDetails(raw)[0];
    expect(row?.damageGroups).not.toMatch(FOOTER_LEAK_RE);
    expect(row?.damageGroups).toMatch(/Virsbūves ārējās daļas/);
    expect(row?.damageGroups).toMatch(/Ārējais apgaismojums/);
    expect(row?.damagedSides).toMatch(/Priekšpuse/);
  });
});

describe("AutoDNA page noise lines (LV, EN, LT)", () => {
  it.each([
    "Pārbaudiet ziņojuma oriģinalitāti - noskenējiet galvenē redzamo QR kodu.",
    "noskenējiet galvenē redzamo QR kodu.",
    "Auto Vēstures Atskaite autoDNA WVWZZZ3CZWE123456",
    "WVWZZZ3CZWE123456",
    "Lapa 6",
    "Lapa 1 2026-10-18",
    "9f3b6c1e0a7d4e2b8c5f1a9d3e7b6c40 2026-11-05 09:14:27",
    "2026-11-05 09:14:27 9f3b6c1e0a7d4e2b8c5f1a9d3e7b6c40",
    "Check the authenticity of the report - scan the QR code visible in the header.",
    "Vehicle History Report autoDNA WVWZZZ3CZWE123456",
    "Page 6",
    "Page 2 2026-11-05",
    "Patikrinkite ataskaitos originalumą - nuskenuokite antraštėje matomą QR kodą.",
    "Transporto priemonės istorijos ataskaita autoDNA WVWZZZ3CZWE123456",
    "Puslapis 3",
  ])("treats %j as page noise", (line) => {
    expect(isAutodnaPageNoiseLine(line)).toBe(true);
  });

  it.each([
    "- Virsbūves ārējās daļas",
    "Labā sāna priekšpuse",
    "Valsts Vācija",
    "Summa 2 600 - 2 800 EUR",
    "03.2019",
    "116 500 km",
    "VIRSBŪVES BOJĀJUMS",
    "Ierakstu skaits: 3",
  ])("keeps damage content %j", (line) => {
    expect(isAutodnaPageNoiseLine(line)).toBe(false);
  });

  it("strips EN and LT footers so the list continues across the page", () => {
    const en = stripAutodnaPageNoise(
      "- Outer body parts\nCheck the authenticity of the report - scan the QR code visible in the header.\n0a1b2c3d4e5f60718293a4b5c6d7e8f9 2026-11-05 09:14:27\nPage 6\n- Lighting",
    );
    expect(en.split("\n")).toEqual(["- Outer body parts", "- Lighting"]);
    const lt = stripAutodnaPageNoise(
      "- Kėbulo išorės dalys\nPatikrinkite ataskaitos originalumą - nuskenuokite antraštėje matomą QR kodą.\nPuslapis 6\n- Apšvietimas",
    );
    expect(lt.split("\n")).toEqual(["- Kėbulo išorės dalys", "- Apšvietimas"]);
  });

  it("zone/group extraction stops at an unstripped footer (safety net)", () => {
    const block = `Detaļu grupa
- Virsbūves ārējās daļas
Pārbaudiet ziņojuma oriģinalitāti - noskenējiet galvenē redzamo QR kodu.
Lapa 6
Bojājumu zona
- Priekšpuse
Check the authenticity of the report - scan the QR code.
Page 6`;
    expect(extractGroupListFromBlock(block)).toBe("Virsbūves ārējās daļas");
    expect(extractZoneListFromBlock(block)).toBe("Priekšpuse");
  });
});

describe("AutoDNA damage parse - existing fixtures unchanged", () => {
  it("grandland fixture: same two events and details as before", () => {
    expect(parseAutodnaDamageEvents(GRANDLAND_AUTODNA)).toEqual([
      { csngDate: "07.2026", lossAmount: "1 600 - 1 700 €", incidentNo: "Vācija" },
      { csngDate: "07.2026", lossAmount: "6 000 - 6 500 €", incidentNo: "Vācija" },
    ]);
    expect(parseAutodnaDamageDetails(GRANDLAND_AUTODNA)).toEqual([
      { date: "07.2026", country: "Vācija", lossAmount: "1 600 - 1 700 €", damagedSides: "", damageGroups: "" },
      { date: "07.2026", country: "Vācija", lossAmount: "6 000 - 6 500 €", damagedSides: "", damageGroups: "" },
    ]);
  });
});
