import { describe, expect, it } from "vitest";
import { emptyAsvBlock } from "@/lib/asv-report";
import {
  buildAsvJojIngest,
  formatJojAsvCostUsd,
  formatJojFetchedAtRiga,
  jojAsvCostUsd,
  jojCacheHitLabel,
  jojCacheNoneConfirmMessage,
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
    const ingest = buildAsvJojIngest(VIN, parse, "2026-03-25T12:00:00.000Z", { httpStatus: 200 });
    expect(ingest.status).toBe("found");
    expect(ingest.lastCostUsd).toBe("$0.50");
    expect(ingest.fromCache).toBeUndefined();
    expect(ingest.httpStatus).toBe(200);
  });

  it("rēķina tikai reālu HTTP 200/404, kešs ir $0.00", () => {
    expect(jojAsvCostUsd({ fromCache: true, httpStatus: 200 })).toBe("$0.00");
    expect(jojAsvCostUsd({ fromCache: true, httpStatus: 404 })).toBe("$0.00");
    expect(jojAsvCostUsd({ fromCache: false, httpStatus: 200 })).toBe("$0.50");
    expect(jojAsvCostUsd({ fromCache: false, httpStatus: 404 })).toBe("$0.50");
    expect(jojAsvCostUsd({ fromCache: false, httpStatus: 429 })).toBe("$0.00");
    expect(jojAsvCostUsd({ fromCache: false, httpStatus: 502 })).toBe("$0.00");
    expect(jojAsvCostUsd({ fromCache: false, httpStatus: null })).toBe("$0.00");
  });

  it("keša none ingest un Rīgas pulkstenis", () => {
    const ingest = buildAsvJojIngest(
      VIN,
      { status: "none", summary: "nav ierakstu" },
      "2026-03-25T12:00:00.000Z",
      { fromCache: true, cachedAt: "2026-03-25T12:00:00.000Z", httpStatus: 404 },
    );
    expect(ingest.lastCostUsd).toBe("$0.00");
    expect(ingest.fromCache).toBe(true);
    expect(ingest.cachedAt).toBe("2026-03-25T12:00:00.000Z");
    expect(formatJojFetchedAtRiga("2026-03-25T12:00:00.000Z")).toBe("25.03.2026 14:00");
    expect(jojCacheHitLabel("2026-03-25T12:00:00.000Z")).toBe("no keša (25.03.2026 14:00)");
    expect(jojCacheNoneConfirmMessage("2026-03-25T12:00:00.000Z")).toBe(
      "Kešā: nav ierakstu (25.03.2026 14:00). Pieprasīt vēlreiz par 0,50 $?",
    );
  });
});
