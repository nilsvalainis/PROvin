import { describe, expect, it } from "vitest";
import { emptyAsvBlock } from "@/lib/asv-report";
import {
  buildAsvJojIngest,
  formatJojAsvCostUsd,
  mergeJojParseIntoAsvBlock,
} from "@/lib/joj-asv-merge";
import type { VinScanParse } from "@/lib/vin-scan/types";

const VIN = "WBSAE0C06PCL70372";

describe("joj-asv-merge", () => {
  it("formatē JoJ cenu $0.50", () => {
    expect(formatJojAsvCostUsd()).toBe("$0.50");
  });

  it("apvieno JoJ bez dublēšanas ar esošo OneAuto izsoles rindu", () => {
    const prev = emptyAsvBlock();
    prev.sources = {
      oneauto: {
        reportDate: "",
        attentionMarks: "",
        ownersCount: "",
        checks: [],
        mileage: [],
        damages: [],
        brands: [],
        titles: [],
        sales: [
          {
            date: "25.03.2026",
            venue: "VIN Audit",
            odometer: "1 000 km",
            price: "",
            status: "",
          },
        ],
        liens: [],
        thefts: [],
        notes: [],
      },
    };
    const parse: VinScanParse = {
      status: "found",
      summary: "Copart, 2023",
      jojFacts: {
        vehicleLine: "2023 BMW M8",
        reportDate: "25.03.2026",
        sales: [
          {
            date: "25.03.2026",
            venue: "Copart",
            odometer: "1 000 km",
            price: "56 500 USD",
            status: "Lots: 94166665",
          },
        ],
        damages: [
          {
            date: "25.03.2026",
            region: "Copart",
            amount: "",
            description: "Side",
          },
        ],
        titles: [],
        insurance: [],
        mileage: [{ date: "25.03.2026", odometer: "1 000 km", country: "Copart" }],
        notes: ["Lots: 94166665"],
      },
      auctions: [
        {
          venue: "Copart",
          date: "2026-03-25",
          title: "Side",
          price: "56 500 USD",
          lot: "94166665",
          photoUrls: Array.from({ length: 25 }, (_, i) => `https://cars2.import-motor.com/copart/a-${i}.webp`),
        },
      ],
      media: {
        photoUrl: "https://cars2.import-motor.com/copart/a-0.webp",
        photoUrls: Array.from({ length: 25 }, (_, i) => `https://cars2.import-motor.com/copart/a-${i}.webp`),
      },
    };
    const { block, photoUrls, photoGroups } = mergeJojParseIntoAsvBlock(VIN, parse, prev);
    expect(block.sales.filter((s) => s.venue.trim()).length).toBe(1);
    expect(block.sales[0]?.venue).toBe("VIN Audit");
    expect(block.damages.some((d) => /side/i.test(d.description))).toBe(true);
    expect(photoUrls).toHaveLength(25);
    expect(photoGroups).toHaveLength(1);
    expect(photoGroups[0]?.title).toContain("lots 94166665");
    expect(photoUrls).toContain("https://cars2.import-motor.com/copart/a-0.webp");
    expect(block.sources?.joj).toBeTruthy();
    const ingest = buildAsvJojIngest(VIN, parse, "2026-03-25T12:00:00.000Z");
    expect(ingest.status).toBe("found");
    expect(ingest.lastCostUsd).toBe("$0.50");
  });
});
