import { describe, expect, it } from "vitest";
import {
  parseCarverticalDamagesFromText,
  parseCarverticalOdometerFromText,
  parseCarverticalPdfText,
  parseCarverticalTimelineFromText,
} from "@/lib/carvertical-pdf-parse";
import {
  BMW_X1_ODOMETER_RAW,
  BMW_X1_TIMELINE_RAW,
  SKODA_DAMAGE_RAW,
  SKODA_ODOMETER_RAW,
  SKODA_TIMELINE_RAW,
} from "@/lib/carvertical-pdf-parse.fixtures";
import { parseCarverticalOdometerPaste } from "@/lib/carvertical-odometer-paste-parse";

describe("parseCarverticalOdometerFromText", () => {
  it("parses BMW X1 fragmented odometer (27 records)", () => {
    const rows = parseCarverticalOdometerFromText(BMW_X1_ODOMETER_RAW);
    expect(rows.length).toBe(27);
    expect(rows.some((r) => r.odometer === "295012")).toBe(true);
    expect(rows.some((r) => r.date === "01.12.2016" && r.odometer === "17")).toBe(true);
    expect(rows.some((r) => r.date === "01.03.2026" && r.odometer === "295012")).toBe(true);
  });

  it("parses Škoda Kodiaq fragmented odometer (12 records)", () => {
    const rows = parseCarverticalOdometerFromText(SKODA_ODOMETER_RAW);
    expect(rows.length).toBe(12);
    expect(rows.some((r) => r.odometer === "156942")).toBe(true);
    expect(rows.some((r) => r.date === "01.10.2017" && r.odometer === "19")).toBe(true);
  });

  it("paste parser delegates to fragmented parser", () => {
    const rows = parseCarverticalOdometerPaste(BMW_X1_ODOMETER_RAW);
    expect(rows.length).toBe(27);
  });
});

describe("parseCarverticalTimelineFromText", () => {
  it("parses BMW X1 vehicle history timeline", () => {
    const rows = parseCarverticalTimelineFromText(BMW_X1_TIMELINE_RAW);
    expect(rows.length).toBeGreaterThanOrEqual(8);
    expect(rows.some((r) => r.description.includes("Ražots"))).toBe(true);
    expect(rows.some((r) => r.country === "Itālija")).toBe(true);
    expect(rows.some((r) => r.country === "Latvija" && r.description.includes("Reģistrēts"))).toBe(true);
  });

  it("parses Škoda timeline with damage assessment event", () => {
    const rows = parseCarverticalTimelineFromText(SKODA_TIMELINE_RAW);
    expect(rows.length).toBe(2);
    expect(rows[0]?.description).toMatch(/Ražots/i);
    expect(rows[1]?.country).toBe("Šveice");
    expect(rows[1]?.description).toMatch(/novērtēj/i);
  });

  it("shortens long timeline descriptions to event titles only", () => {
    const long =
      "Ražots Šī transportlīdzekļa ražošanas gads ir fiksēts. Spēkrats norādītajā valstī var būt ražots vai reģistrēts.";
    const rows = parseCarverticalTimelineFromText(
      `Transportlīdzekļa ierakstu laikposms\n12.2016. Nezināma valsts ${long}`,
    );
    expect(rows[0]?.description).toBe("Ražots");
  });
});

describe("parseCarverticalDamagesFromText", () => {
  it("parses Škoda damage record with sides and groups", () => {
    const { incidents, damageDetails } = parseCarverticalDamagesFromText(SKODA_DAMAGE_RAW);
    expect(incidents.length).toBe(1);
    expect(incidents[0]?.lossAmount).toContain("5001");
    expect(incidents[0]?.incidentNo).toBe("Šveice");
    expect(incidents[0]?.csngDate).toBe("01.06.2024");
    expect(damageDetails[0]?.damagedSides).toMatch(/Kreisā puse/i);
    expect(damageDetails[0]?.damageGroups).toMatch(/Dzesēšanas/i);
  });

  it("parses Bojātās detaļas with MM.YYYY.Country and ignores PDF footer dates", () => {
    const raw = `
VIN numurs: WBAVT11010KW00321 Ģenerēšanas datums: 18.08.2026 Derīguma termiņš beidzas 17.09.2026
07.2012. Vācija
Novērtējums
Šis ieraksts norāda uz to, ka transportlīdzekli pārbaudīja vai apkopa profesionālis.
Bojātās detaļas
Labā priekšējā daļa / Buferis Labā puse / Priekšējās durvis
Aptuvenā iepriekš gūto bojājumu vērtība
2001 € – 2500 €
Remonta izmaksu reitings
Mazs 11 % no transportlīdzekļa vērtības tajā laikā
Bojājumu grupas
Ārējās virsbūves detaļas
"Bojājumu" sadaļas skaidrojums
Aptuvenā iepriekš gūto bojājumu vērtība
Ja transportlīdzeklim ir fiksēti bojājumi, tad remontdarbu izmaksas ir aprēķinātas.
10.2015. Vācija
Novērtējums
Šis ieraksts norāda uz to, ka transportlīdzekli pārbaudīja vai apkopa profesionālis.
Bojātās detaļas
Fiksēti bojājumi, taču nav atzīmētas bojātās detaļas
Aptuvenā iepriekš gūto bojājumu vērtība
1001 € – 1500 €
Remonta izmaksu reitings
Ļoti zems 7 % no transportlīdzekļa vērtības tajā laikā
`;
    const { incidents, damageDetails } = parseCarverticalDamagesFromText(raw);
    expect(incidents).toHaveLength(2);
    expect(damageDetails).toHaveLength(2);
    expect(damageDetails[0]?.date).toBe("01.07.2012");
    expect(damageDetails[0]?.country).toMatch(/Vācij/i);
    expect(damageDetails[0]?.damagedSides).toMatch(/Labā priekšējā daļa/i);
    expect(damageDetails[0]?.damagedSides).toMatch(/Labā puse/i);
    expect(damageDetails[0]?.damagedSides).not.toMatch(/18\.08\.2026/);
    expect(damageDetails[0]?.lossAmount).toMatch(/2001/);
    expect(damageDetails[0]?.damageGroups).toMatch(/Ārējās virsbūves/i);
    expect(damageDetails[0]?.damageGroups).not.toMatch(/VIN/i);
    expect(damageDetails[0]?.damageGroups).not.toMatch(/Ģenerē/i);
    expect(damageDetails[1]?.date).toBe("01.10.2015");
    expect(damageDetails[1]?.lossAmount).toMatch(/1001/);
    expect(damageDetails[1]?.damagedSides).toBe("");
  });

  it("treats unmarked parts as empty even with pdf.js spaces around the comma", () => {
    const raw = `
10.2015. Vācija
Novērtējums
Bojātās detaļas
Fiksēti bojājumi , taču nav atzīmētas bojātās detaļas
Aptuvenā iepriekš gūto bojājumu vērtība
1001 € – 1500 €
`;
    const { damageDetails } = parseCarverticalDamagesFromText(raw);
    expect(damageDetails[0]?.date).toBe("01.10.2015");
    expect(damageDetails[0]?.damagedSides).toBe("");
  });

  it("parses glued MM.YYYY.Country without spaces before Novērtējums", () => {
    const raw = `
VIN 18.08.2026
07.2012.VācijaNovērtējums
Bojātās detaļas
Labā priekšējā daļa / Buferis
Aptuvenā iepriekš gūto bojājumu vērtība
2001 € – 2500 €
Remonta izmaksu reitings
Mazs
`;
    const { damageDetails } = parseCarverticalDamagesFromText(raw);
    expect(damageDetails).toHaveLength(1);
    expect(damageDetails[0]?.date).toBe("01.07.2012");
    expect(damageDetails[0]?.country).toMatch(/Vācij/i);
    expect(damageDetails[0]?.damagedSides).toMatch(/Labā priekšējā daļa/i);
  });

  it("parses Fiksētie bojājumi and Bojātās zonas", () => {
    const raw = `
10.2020 Latvija
Fiksētie bojājumi
Bojātās zonas
Jumts / Virs-virsbūve
Aptuvenā remonta darbu izmaksu vērtība
1501 € – 2000 €
`;
    const { damageDetails } = parseCarverticalDamagesFromText(raw);
    expect(damageDetails.length).toBe(1);
    expect(damageDetails[0]?.damagedSides).toMatch(/Jumts/i);
    expect(damageDetails[0]?.lossAmount).toMatch(/1501/);
  });

  it("copies any Bojātās detaļas list (rear, left, lights) and damage groups", () => {
    const raw = `
03.2021. Latvija
Novērtējums
Bojātās detaļas
Kreisā puse / Aizmugurējās durvis Aizmugure / Buferis Priekšpuse / Lukturi
Aptuvenā iepriekš gūto bojājumu vērtība
1501 € – 2000 €
Bojājumu grupas
Ārējais apgaismojums
Ārējās virsbūves detaļas
`;
    const { damageDetails } = parseCarverticalDamagesFromText(raw);
    expect(damageDetails).toHaveLength(1);
    expect(damageDetails[0]?.damagedSides).toMatch(/Aizmugurējās durvis/i);
    expect(damageDetails[0]?.damagedSides).toMatch(/Aizmugure/i);
    expect(damageDetails[0]?.damagedSides).toMatch(/Lukturi/i);
    expect(damageDetails[0]?.damageGroups).toMatch(/apgaismoj/i);
    expect(damageDetails[0]?.damageGroups).toMatch(/virsbūves/i);
  });

  it("does not glue PDF footer onto Bojājumu grupas", () => {
    const raw = `
07.2012. Vācija
Novērtējums
Bojātās detaļas
Labā priekšējā daļa / Buferis
Aptuvenā iepriekš gūto bojājumu vērtība
2001 € – 2500 €
Bojājumu grupas
Ārējās virsbūves detaļasVIN numurs: WBAVT11010KW00321 Ģenerēšanas datums: 18.08.2026
`;
    const { damageDetails } = parseCarverticalDamagesFromText(raw);
    expect(damageDetails[0]?.damageGroups).toMatch(/Ārējās virsbūves detaļas/i);
    expect(damageDetails[0]?.damageGroups).not.toMatch(/VIN/i);
    expect(damageDetails[0]?.damageGroups).not.toMatch(/WBAVT/i);
    expect(damageDetails[0]?.damageGroups).not.toMatch(/Ģenerē/i);
  });

  it("does not glue CarVertical similar-record or report summary onto Bojājumu grupas", () => {
    const raw = `
05.2022. Latvija
Novērtējums
Bojātās detaļas
Kreisā priekšējā daļa / Buferis Aizmugure / Buferis
Aptuvenā iepriekš gūto bojājumu vērtība
1501 € – 2000 €
Bojājumu grupas
Ārējās virsbūves detaļas
1 līdzīgs ieraksts
NEGADĪJUMU VĒSTURES KOPSAVILKUMS
Fiksētie incidenti un datu saskaņotība AutoDNA un CarVertical
`;
    const { damageDetails } = parseCarverticalDamagesFromText(raw);
    expect(damageDetails[0]?.damageGroups).toMatch(/Ārējās virsbūves detaļas/i);
    expect(damageDetails[0]?.damageGroups).not.toMatch(/līdzīg/i);
    expect(damageDetails[0]?.damageGroups).not.toMatch(/NEGADĪJUMU/i);
    expect(damageDetails[0]?.damageGroups).not.toMatch(/saskaņot/i);
  });
});

describe("parseCarverticalPdfText", () => {
  it("infers odometer country from timeline", () => {
    const raw = `${BMW_X1_ODOMETER_RAW}\n${BMW_X1_TIMELINE_RAW}`;
    const result = parseCarverticalPdfText(raw);
    const lvRows = result.serviceHistory.filter((r) => r.country === "Latvija");
    expect(lvRows.some((r) => r.date.startsWith("01.03.2026"))).toBe(true);
  });
});
