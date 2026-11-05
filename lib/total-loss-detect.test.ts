import { describe, expect, it } from "vitest";
import {
  detectTotalLossFromPdfInput,
  headerMentionsTotalLoss,
  textIndicatesTotalLoss,
} from "@/lib/total-loss-detect";
import { emptyCsddFields, SOURCE_BLOCK_LABELS } from "@/lib/admin-source-blocks";
import { buildPdfReportSummaryTiles } from "@/lib/pdf-report-summary";
import { checkPrePdfContradictions } from "@/lib/pre-pdf-contradiction-check";
import { emptyAsvBlock } from "@/lib/asv-report";
import { emptyCcVinBlock } from "@/lib/cc-vin-report";

function timeline(description: string) {
  return {
    manualVendorBlocks: [
      {
        title: SOURCE_BLOCK_LABELS.carvertical,
        vehicleHistoryTimeline: [{ date: "2019", description, country: "DE" }],
      },
    ],
  };
}

describe("detectTotalLossFromPdfInput", () => {
  it("finds totaled / salvage title in structured CC VIN titles", () => {
    const hit = detectTotalLossFromPdfInput({
      ccVinBlock: { titles: [{ date: "2018", note: "Record of totaled vehicle, salvage title", region: "US" }] },
    });
    expect(hit.found).toBe(true);
    expect(hit.evidence).toMatch(/totaled|salvage/i);
  });

  it("puts Pilnīgs zaudējums on the incidents tile from a structured row", () => {
    const tiles = buildPdfReportSummaryTiles({
      csddForm: emptyCsddFields(),
      manualVendorBlocks: [
        {
          title: SOURCE_BLOCK_LABELS.autodna,
          mileageRows: [],
          incidentRows: [],
          comments: "",
          vehicleHistoryTimeline: [{ date: "2020", description: "Ziņots par pilnīgu zaudējumu", country: "PL" }],
        },
      ],
    });
    const incidents = tiles.find((t) => t.id === "incidents");
    expect(incidents?.value).toBe("Pilnīgs zaudējums");
    expect(incidents?.note).toMatch(/pilnīgs zaudējums/i);
    expect(headerMentionsTotalLoss(`${incidents?.value} ${incidents?.note}`)).toBe(true);
    expect(incidents?.tone).toBe("alert");
  });

  it("free-text / AI comments never set the total-loss tile on their own", () => {
    const input = {
      csddForm: emptyCsddFields(),
      manualVendorBlocks: [
        {
          title: SOURCE_BLOCK_LABELS.autodna,
          mileageRows: [],
          incidentRows: [],
          comments: "Ziņots par pilnīgu zaudējumu. Record of totaled vehicle, salvage title 2018.",
        },
      ],
      ccVinBlock: { ...emptyCcVinBlock(), comments: "Apdrošināšanas total loss 2017" },
      asvBlock: { ...emptyAsvBlock(), comments: "Totaled" },
    };
    expect(detectTotalLossFromPdfInput(input).found).toBe(false);
    const incidents = buildPdfReportSummaryTiles(input).find((t) => t.id === "incidents");
    expect(incidents?.value).not.toBe("Pilnīgs zaudējums");
    expect(checkPrePdfContradictions({ summaryInput: input }).some((f) => f.id === "c8_total_loss")).toBe(false);
  });

  it.each([
    "Pilnīga zaudējuma ieraksts netika konstatēts",
    "Total loss: No",
    "Total loss: Nē",
    "Salvage auction records: 0",
    "Serviss pārbaudīja total loss reģistrus, ierakstu nav",
    "Pilnīgs zaudējums nav fiksēts",
    "Pilnīgs zaudējums nav reģistrēts",
    "Bojājumi Nav pilnīguzaudējumu",
    "Pilnīgs zaudējums - transportlīdzeklis atzīts par norakstāmu, ja remonts nav ekonomiski pamatots",
    "Pilnīgs zaudējums. Vai tas ir norakstīts?",
    "Vai automašīna ir total loss?",
    "Copart salvage izsole",
    "Total loss not found",
    "Totalschaden: nein",
  ])("structured false positive is ignored: %s", (text) => {
    expect(textIndicatesTotalLoss(text)).toBe(false);
    expect(detectTotalLossFromPdfInput(timeline(text)).found).toBe(false);
  });

  it.each([
    "Majanduslikus mõttes hävinenud",
    "Totalschaden",
    "Statut: VGE (véhicule gravement endommagé)",
    "Épave",
    "Salvage title issued",
    "Total loss 2019 (insurance)",
    "Bojājumi: pilnīgs zaudējums",
  ])("structured positive is found: %s", (text) => {
    expect(detectTotalLossFromPdfInput(timeline(text)).found).toBe(true);
  });

  it("finds Estonian MNT economic write-off in registry statusRecords", () => {
    const hit = detectTotalLossFromPdfInput({
      manualVendorBlocks: [
        {
          title: SOURCE_BLOCK_LABELS.mnt_ee,
          statusRecords: "Registreeritud 2015\nMajanduslikus mõttes hävinenud 12.03.2021",
        },
      ],
    });
    expect(hit.found).toBe(true);
    expect(hit.evidence).toMatch(/hävinenud/);
  });

  it("negation on one structured row does not leak to the next row", () => {
    const hit = detectTotalLossFromPdfInput({
      ccVinBlock: {
        brands: [
          { date: "", label: "Flood", detail: "Nav" },
          { date: "2018", label: "Salvage", detail: "Title brand" },
        ],
      },
    });
    expect(hit.found).toBe(true);
  });

  it("lowercase vge is not a French status", () => {
    expect(textIndicatesTotalLoss("vge")).toBe(false);
  });
});
