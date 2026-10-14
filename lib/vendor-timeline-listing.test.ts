import { describe, expect, it } from "vitest";
import { SOURCE_BLOCK_LABELS, createDefaultSourceBlocks } from "@/lib/admin-source-blocks";
import { buildListingNotCountryChangeBrief } from "@/lib/admin-ai-listing-country";
import { vendorAvotuBlockToPlainText } from "@/lib/admin-source-blocks";
import {
  isVendorTimelineListingRecord,
  VENDOR_TIMELINE_LISTING_AI_NOTE,
} from "@/lib/vendor-timeline-listing";

describe("isVendorTimelineListingRecord", () => {
  it("atzīst AutoDNA sludinājuma, izsoles un vēsturiskās cenas virsrakstus", () => {
    expect(isVendorTimelineListingRecord("Pārdošanai piedāvātas automašīnas (12 500 EUR)")).toBe(true);
    expect(isVendorTimelineListingRecord("Vēsturiskā cena")).toBe(true);
    expect(isVendorTimelineListingRecord("Listed for sale")).toBe(true);
    expect(isVendorTimelineListingRecord("Izsole Autobid")).toBe(true);
  });

  it("neatstāj reģistrāciju un apskati kā sludinājumu", () => {
    expect(isVendorTimelineListingRecord("Pirmā reģistrācija")).toBe(false);
    expect(isVendorTimelineListingRecord("Reģistrēts")).toBe(false);
    expect(isVendorTimelineListingRecord("Veikta tehniskā apskate")).toBe(false);
    expect(isVendorTimelineListingRecord("Mainītas īpašumtiesības")).toBe(false);
  });
});

describe("AI konteksts laikposma sludinājumiem", () => {
  it("piezīmē, ka sludinājuma rinda nav fiziska valsts maiņa", () => {
    const text = vendorAvotuBlockToPlainText({
      serviceHistory: [],
      incidents: [],
      comments: "",
      vehicleHistoryTimeline: [
        {
          date: "15.03.2024",
          country: "Vācija",
          description: "Pārdošanai piedāvātas automašīnas",
        },
        {
          date: "01.06.2018",
          country: "Vācija",
          description: "Pirmā reģistrācija",
        },
      ],
    });
    expect(text).toContain(VENDOR_TIMELINE_LISTING_AI_NOTE);
    expect(text).toMatch(/Pārdošanai piedāvātas[\s\S]*NAV reģistrācija/);
    expect(text).not.toMatch(/Pirmā reģistrācija[\s\S]*NAV reģistrācija/);
  });

  it("veido brief, kad laikposmā ir DE/NL/PL sludinājumi", () => {
    const blocks = createDefaultSourceBlocks();
    blocks.autodna.vehicleHistoryTimeline = [
      {
        date: "15.03.2024",
        country: "Vācija",
        description: "Pārdošanai piedāvātas automašīnas",
        includeInPdf: false,
      },
      {
        date: "18.03.2024",
        country: "Nīderlande",
        description: "Pārdošanai piedāvātas automašīnas",
        includeInPdf: false,
      },
      {
        date: "20.03.2024",
        country: "Polija",
        description: "Pārdošanai piedāvātas automašīnas",
        includeInPdf: false,
      },
    ];
    const brief = buildListingNotCountryChangeBrief(blocks);
    expect(brief).toMatch(/Vācija/);
    expect(brief).toMatch(/Nīderlande/);
    expect(brief).toMatch(/Polija/);
    expect(brief).toMatch(/NAV reģistrācijas/);
    expect(SOURCE_BLOCK_LABELS.autodna).toBeTruthy();
  });
});
