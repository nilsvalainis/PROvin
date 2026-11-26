import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { auctionArchiveEquipment, auctionArchiveVehicleRows } from "@/lib/auction-archive-facts";
import { buildAuctionArchiveSummary } from "@/lib/auction-archive-offer";
import { auctionArchiveTextsToTranslate } from "@/lib/auction-archive-pdf-html";
import { auctionArchiveDescriptions, buildAuctionLotsHtml } from "@/lib/auction-lot-cards-html";
import { translateClientReportLvTerms } from "@/lib/client-report-lv-terms-i18n";
import { buildPaintMapSvg, PAINT_MAP_SVG_SIDE_LABEL_Y } from "@/lib/paint-map-svg";
import { PAINT_MAP_IMG_TOP, PAINT_MAP_SIDE, PAINT_MAP_ZONES } from "@/lib/paint-map-geometry";
import { thecarapiFreeText } from "@/lib/thecarapi-i18n-lv";
import { buildThecarapiAdminRecords } from "@/lib/vin-scan/parse-thecarapi";
import type { ThecarapiAdminRecord } from "@/lib/vin-scan/thecarapi-fields";

function auto1Record(): ThecarapiAdminRecord {
  const file = path.join(process.cwd(), "lib/vin-scan/__fixtures__/thecarapi/detail-auto1-full-anon.json");
  const [row] = buildThecarapiAdminRecords({
    historyJson: {
      auctions: [
        { site_name: "auto1", auction_id: "1326383403", detail_path: "/api/auction/auto1/1326383403", mileage: 226760, first_seen: "2026-10-07" },
      ],
    },
    detailJson: JSON.parse(readFileSync(file, "utf8")) as unknown,
  });
  return row!;
}

function lotsHtml(record: ThecarapiAdminRecord) {
  const summary = buildAuctionArchiveSummary({ vin: "TESTVIN", title: "", block: { thecarapiRecords: [record], photoGroups: [] } });
  return buildAuctionLotsHtml({ summary, records: [record], photos: [], dataUrls: new Map() });
}

function textOf(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
}

describe("izsoles kartīte: AUTO1 pilnā forma (detail-auto1-full-anon.json)", () => {
  const record = auto1Record();
  const parts = lotsHtml(record);

  it("«Virsbūve» satur tikai virsbūves tipu - ne aprīkojumu, ne durvis / sēdvietas", () => {
    const rows = auctionArchiveVehicleRows([record]);
    const body = rows.find((r) => r.k === "Virsbūve")?.v ?? "";
    expect(body).toBe("Furgons");
    expect(body).not.toMatch(/seat|sēdviet|durvis|,/i);
    expect(rows.find((r) => r.k === "Durvis")?.v).toBe("5");
    expect(rows.find((r) => r.k === "Sēdvietas")?.v).toBe("5");
    const vehicle = textOf(parts.vehicle);
    expect(vehicle).not.toContain("Sport seats");
    expect(vehicle).not.toContain("Seat heating");
  });

  it("aprīkojuma grupas (Seats u.c.) nonāk aprīkojuma sarakstā, bez dublikātiem", () => {
    const eq = auctionArchiveEquipment([record]);
    const items = eq.groups.flatMap((g) => g.items);
    expect(items).toContain("Sporta sēdekļi");
    expect(items).toContain("Seat heating front");
    expect(items).toContain("Cruise control with braking function");
    // «Navigation system Professional» ir gan DatEquipmentGroupsTranslated, gan EquipmentGroupsTranslated.
    expect(items.filter((x) => x === "Navigation system Professional")).toHaveLength(1);
    expect(new Set(items.map((x) => x.toLowerCase())).size).toBe(items.length);
    expect(parts.equipment).toContain("Sporta sēdekļi");
    expect(parts.equipment).toContain("Seat heating front");
  });

  it("apraksts bez i18n atslēgām: deep-to-primer -> «Dziļš, līdz gruntij»", () => {
    expect(auctionArchiveDescriptions(record)).toEqual(["Dziļš, līdz gruntij"]);
    const html = parts.lots.join("");
    expect(html).toContain("Dziļš, līdz gruntij");
    expect(html).not.toContain("global.");
    expect(html).not.toContain("damages-v3");
    // Jau LV teksts - AI tulkošanai nesūta.
    expect(auctionArchiveTextsToTranslate([record])).not.toContain("Dziļš, līdz gruntij");
  });
});

describe("thecarapiFreeText: i18n atslēga brīvā teksta laukā", () => {
  it("zināmie dziļumi", () => {
    expect(thecarapiFreeText("global.damages-v3.description.depth.deep-to-primer")).toBe("Dziļš, līdz gruntij");
    expect(thecarapiFreeText("global.damages-v3.description.depth.to-primer")).toBe("Līdz gruntij");
    expect(thecarapiFreeText("global.damages-v3.description.depth.deep-to-metal")).toBe("Dziļš, līdz metālam");
    expect(thecarapiFreeText("global.damages-v3.description.depth.superficial")).toBe("Virspusējs");
    expect(thecarapiFreeText("global.damages-v3.description.depth.clear-coat")).toBe("Tikai lakas slānī");
    expect(thecarapiFreeText("global.damages-v3.description.with-paint-damage")).toBe("Ar lakas bojājumu");
  });

  it("nezināma atslēga -> lasāms teksts no pēdējās daļas, nekad pati atslēga", () => {
    const out = thecarapiFreeText("global.damages-v3.description.depth.very-strange-new-depth");
    expect(out).toBe("Very strange new depth");
    for (const raw of ["global.something.totally-unknown", "global.x.y.z.last-part"]) {
      const shown = thecarapiFreeText(raw);
      expect(shown).not.toMatch(/global\.|\w\.\w/);
      expect(shown.length).toBeGreaterThan(0);
    }
    expect(thecarapiFreeText("Parasts apraksts bez atslēgas")).toBe("Parasts apraksts bez atslēgas");
  });

  it("EN / RU / DE kartītē tulko arī dziļuma tekstu", () => {
    expect(translateClientReportLvTerms("Dziļš, līdz gruntij", "en")).toBe("Deep, down to primer");
    expect(translateClientReportLvTerms("Dziļš, līdz gruntij", "ru")).toBe("Глубокое, до грунта");
    expect(translateClientReportLvTerms("Dziļš, līdz gruntij", "de")).toBe("Tief, bis zur Grundierung");
    expect(translateClientReportLvTerms("Dziļš, līdz metālam", "en")).toBe("Deep, down to bare metal");
  });
});

describe("bojājumu / lakas shēma: sānu etiķetes pie silueta", () => {
  /** Silueta robežas bildē (damage-car-top-east.jpg, y 94-429) shēmas koordinātēs. */
  const CAR_TOP = PAINT_MAP_IMG_TOP + 94;
  const CAR_BOTTOM = PAINT_MAP_IMG_TOP + 429;

  /** Etiķetes centrs (teksta bāzes līnija ir centrs + 0,36 × 16 px). */
  function labelY(svg: string, text: string): number {
    const m = new RegExp(`<text x="[\\d.]+" y="([\\d.]+)"[^>]*>${text}</text>`).exec(svg);
    expect(m, text).not.toBeNull();
    return Number(m![1]) - 16 * 0.36;
  }

  it("ar mērījumiem: etiķete tieši virs / zem µm rindas, ≤ 70 px no auto (agrāk ~130 px)", () => {
    const svg = buildPaintMapSvg(
      [
        { slot: { zone: "right", slot: 1 }, text: "110 µm", tone: "ok" },
        { slot: { zone: "left", slot: 1 }, text: "120 µm", tone: "ok" },
      ],
      { carHref: "car.jpg" },
    );
    const right = labelY(svg, "Labā puse");
    const left = labelY(svg, "Kreisā puse");
    expect(CAR_TOP - right).toBeLessThanOrEqual(70);
    expect(left - CAR_BOTTOM).toBeLessThanOrEqual(70);
    // Nepārklājas ar µm etiķešu rindu (pill 25 px, µm etiķete 26 px augsta).
    expect(PAINT_MAP_SIDE.right.chip - PAINT_MAP_SVG_SIDE_LABEL_Y.right).toBeGreaterThanOrEqual(26);
    expect(PAINT_MAP_SVG_SIDE_LABEL_Y.left - PAINT_MAP_SIDE.left.chip).toBeGreaterThanOrEqual(26);
    // Vecās maketa pozīcijas (y 28 / 612) vairs netiek lietotas.
    expect(svg).not.toContain(`y="${PAINT_MAP_ZONES.right.label[1] - 12.5}"`);
    expect(svg).not.toContain(`y="${PAINT_MAP_ZONES.left.label[1] - 12.5}"`);
  });

  it("bez mērījumiem sānā: etiķete µm rindas vietā, vēl tuvāk", () => {
    const svg = buildPaintMapSvg([], { carHref: "car.jpg" });
    expect(CAR_TOP - labelY(svg, "Labā puse")).toBeLessThanOrEqual(40);
    expect(labelY(svg, "Kreisā puse") - CAR_BOTTOM).toBeLessThanOrEqual(40);
  });
});
