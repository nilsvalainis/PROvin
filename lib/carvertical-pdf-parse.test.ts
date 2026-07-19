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

  it("returns empty for no-damage BMW section", () => {
    const raw = "Bojājumi\nNav atrasti bojājumu vai novērtējumu ieraksti.\nDabas stihiju";
    const { incidents, damageDetails } = parseCarverticalDamagesFromText(raw);
    expect(incidents.length).toBe(0);
    expect(damageDetails.length).toBe(0);
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
