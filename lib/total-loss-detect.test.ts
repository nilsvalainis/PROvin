import { describe, expect, it } from "vitest";
import {
  detectTotalLossFromPdfInput,
  findTotalLossCommentMentions,
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
    const flags = checkPrePdfContradictions({ summaryInput: input });
    expect(flags.some((f) => f.id === "c8_total_loss")).toBe(false);
    // Bet operators redz brīdinājumu pirms PDF.
    expect(flags.some((f) => f.id === "c8_total_loss_comment")).toBe(true);
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

describe("c8_total_loss_comment (comment-only mention warning)", () => {
  const tileWithoutLoss = [
    { id: "incidents" as const, label: "Negadījumi un bojājumi", value: "Nav ierakstu", note: "", tone: "ok" as const },
  ];

  it("warns with field name and quote when only a comment mentions a write-off", () => {
    const flags = checkPrePdfContradictions({
      summaryInput: { csddForm: emptyCsddFields() },
      clientTextFields: [
        { label: "Tehnisko risku analīze", text: "Automašīna 2019. gadā norakstīta pēc avārijas." },
        { label: "AutoDNA", text: "Ziņots par pilnīgu zaudējumu." },
      ],
    });
    const warn = flags.filter((f) => f.id === "c8_total_loss_comment");
    expect(warn).toHaveLength(2);
    expect(warn.every((f) => f.level === "E")).toBe(true);
    expect(warn[0].message).toContain("„Tehnisko risku analīze”");
    expect(warn[0].message).toContain("norakstīta");
    expect(warn[0].message).toMatch(/avotu datos tas nav - pārbaudi/);
    expect(warn[0].message).not.toMatch(/[\u2014\u2013]/);
    expect(warn[1].message).toContain("pilnīgu zaudējumu");
  });

  it("does not set the tile from comments", () => {
    const tiles = buildPdfReportSummaryTiles({
      csddForm: emptyCsddFields(),
      ccVinBlock: { ...emptyCcVinBlock(), comments: "Automašīna norakstīta 2018. gadā." },
    });
    expect(tiles.find((t) => t.id === "incidents")?.value).not.toBe("Pilnīgs zaudējums");
  });

  it("falls back to source comments when printed fields are not passed", () => {
    const flags = checkPrePdfContradictions({
      summaryInput: {
        csddForm: emptyCsddFields(),
        ccVinBlock: { ...emptyCcVinBlock(), comments: "Apdrošināšanas total loss 2017" },
      },
      tiles: tileWithoutLoss,
    });
    expect(flags.some((f) => f.id === "c8_total_loss_comment")).toBe(true);
  });

  it.each([
    "Pilnīgs zaudējums nav fiksēts.",
    "Pilnīga zaudējuma ieraksts netika konstatēts.",
    "Total loss: No",
    "Bojājumi Nav pilnīguzaudējumu",
    "Vai tas ir norakstīts?",
    "Pilnīgs zaudējums - transportlīdzeklis atzīts par norakstāmu, ja remonts nav pamatots.",
    "Copart salvage izsole",
    "Automašīna nav norakstīta.",
    "Kad remonta izmaksas tuvojas vērtībai, tas var norādīt uz potenciālu pilnīgu zaudējumu.",
  ])("does not warn for negated / question / glossary text: %s", (text) => {
    expect(findTotalLossCommentMentions([{ label: "X", text }])).toEqual([]);
  });

  it("no comment warning when a structured source already has the total loss", () => {
    const flags = checkPrePdfContradictions({
      summaryInput: {
        csddForm: emptyCsddFields(),
        ccVinBlock: {
          ...emptyCcVinBlock(),
          comments: "Ziņots par pilnīgu zaudējumu",
          titles: [{ date: "2018", note: "Salvage title", region: "US", odometer: "" }],
        },
      },
    });
    expect(flags.some((f) => f.id === "c8_total_loss_comment")).toBe(false);
  });
});
