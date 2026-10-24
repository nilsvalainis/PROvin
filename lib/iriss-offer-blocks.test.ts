import { describe, expect, it } from "vitest";
import { emptyIrissOfferRecord } from "@/lib/iriss-pasutijumi-types";
import {
  addIrissOfferBlock,
  addIrissOfferBlockRow,
  applyIrissOfferBlocksToRecord,
  applyIrissOfferPriceStep,
  defaultIrissOfferBlocks,
  moveIrissOfferBlock,
  normalizeIrissOfferBlocks,
  resolveIrissOfferBlocks,
  toggleIrissOfferBlockVisible,
  irissOfferCustomPdfBlocks,
  irissOfferPdfShows,
  visibleIrissOfferBlocks,
} from "@/lib/iriss-offer-blocks";

describe("iriss-offer-blocks", () => {
  it("synthesizes default blocks from existing offer fields without requiring stored blocks", () => {
    const offer = emptyIrissOfferRecord("o1", "2026-10-17T10:00:00.000Z");
    offer.brandModel = "Volvo S60 D5";
    offer.odometerReading = "154000";
    offer.carPrice = "13900";
    expect(offer.blocks).toBeUndefined();
    const blocks = defaultIrissOfferBlocks(offer);
    expect(blocks[0]?.kind).toBe("vehicle");
    expect(blocks[0]?.rows?.some((r) => r.value === "Volvo S60 D5")).toBe(true);
    expect(visibleIrissOfferBlocks(offer).some((b) => b.kind === "pricing")).toBe(true);
  });

  it("reorders, hides and adds rows without dropping existing values", () => {
    const offer = emptyIrissOfferRecord("o1", "2026-10-17T10:00:00.000Z");
    offer.brandModel = "Volvo S60";
    let blocks = resolveIrissOfferBlocks(offer);
    const firstId = blocks[0]!.id;
    blocks = moveIrissOfferBlock(blocks, firstId, 1);
    expect(blocks[1]?.id).toBe(firstId);
    blocks = toggleIrissOfferBlockVisible(blocks, firstId);
    expect(blocks.find((b) => b.id === firstId)?.visible).toBe(false);
    blocks = addIrissOfferBlock(blocks, "text");
    expect(blocks.some((b) => b.kind === "text")).toBe(true);
    const vehicleId = blocks.find((b) => b.kind === "vehicle")!.id;
    blocks = addIrissOfferBlockRow(blocks, vehicleId);
    const applied = applyIrissOfferBlocksToRecord(offer, blocks);
    expect(applied.brandModel).toBe("Volvo S60");
    expect(applied.blocks?.length).toBeGreaterThan(0);
  });

  it("adjusts price with short hyphen labels and ignores empty JSON", () => {
    expect(applyIrissOfferPriceStep("15990", 400)).toBe("16390");
    expect(applyIrissOfferPriceStep("15990", -500)).toBe("15490");
    expect(normalizeIrissOfferBlocks(undefined)).toBeUndefined();
    expect(normalizeIrissOfferBlocks([])).toBeUndefined();
  });

  it("hides stored PDF sections and keeps custom text blocks", () => {
    const offer = emptyIrissOfferRecord("o1", "2026-10-17T10:00:00.000Z");
    expect(irissOfferPdfShows(offer, "photos")).toBe(true);
    offer.blocks = [
      { id: "photos", kind: "photos", title: "Bildes", visible: false },
      { id: "text-1", kind: "text", title: "Piezīme", visible: true, html: "Papildu teksts" },
    ];
    expect(irissOfferPdfShows(offer, "photos")).toBe(false);
    expect(irissOfferCustomPdfBlocks(offer).map((b) => b.html)).toEqual(["Papildu teksts"]);
  });

  it("j50 correction: Īpašas atzīmes/Vizuālais/Tehniskais novērtējums each get their own block, enabled by default, right after Transportlīdzeklis", () => {
    const offer = emptyIrissOfferRecord("o1", "2026-10-17T10:00:00.000Z");
    offer.specialNotes = "Garantija";
    const blocks = resolveIrissOfferBlocks(offer);
    expect(blocks.slice(1, 4).map((b) => b.kind)).toEqual(["specialNotes", "visualAssessment", "technicalAssessment"]);
    expect(blocks.slice(1, 4).map((b) => b.title)).toEqual(["Īpašas atzīmes", "Vizuālais novērtējums", "Tehniskais novērtējums"]);
    expect(blocks.slice(1, 4).every((b) => b.visible)).toBe(true);
  });

  it("j50 correction: backfills the three missing per-section blocks for offers saved before they existed, without touching stored blocks, defaulting to visible", () => {
    const offer = emptyIrissOfferRecord("o1", "2026-10-17T10:00:00.000Z");
    offer.visualAssessment = "Labs stāvoklis";
    offer.blocks = [
      { id: "vehicle", kind: "vehicle", title: "Transportlīdzeklis", visible: true },
      { id: "pricing", kind: "pricing", title: "Cenas", visible: true },
    ];
    const blocks = resolveIrissOfferBlocks(offer);
    expect(blocks.map((b) => b.kind)).toEqual([
      "vehicle",
      "specialNotes",
      "visualAssessment",
      "technicalAssessment",
      "pricing",
    ]);
    expect(blocks.filter((b) => b.kind !== "vehicle" && b.kind !== "pricing").every((b) => b.visible)).toBe(true);
    // Pats piedāvājuma ieraksts netiek mainīts - tikai rādīšanas brīža izvads.
    expect(offer.blocks).toEqual([
      { id: "vehicle", kind: "vehicle", title: "Transportlīdzeklis", visible: true },
      { id: "pricing", kind: "pricing", title: "Cenas", visible: true },
    ]);
  });

  it("j50 correction: respects an already-saved per-section toggle instead of recomputing it", () => {
    const offer = emptyIrissOfferRecord("o1", "2026-10-17T10:00:00.000Z");
    offer.specialNotes = "Teksts, kas tomēr paliek slēpts";
    offer.blocks = [
      { id: "specialNotes", kind: "specialNotes", title: "Īpašas atzīmes", visible: false },
      { id: "visualAssessment", kind: "visualAssessment", title: "Vizuālais novērtējums", visible: true },
    ];
    const blocks = resolveIrissOfferBlocks(offer);
    expect(blocks.find((b) => b.kind === "specialNotes")?.visible).toBe(false);
    expect(blocks.find((b) => b.kind === "visualAssessment")?.visible).toBe(true);
    // Trūkstošais tehniskā novērtējuma slēdzis tiek pievienots kā redzams pēc noklusējuma.
    expect(blocks.find((b) => b.kind === "technicalAssessment")?.visible).toBe(true);
  });

  it("j50 correction: migrates a legacy combined 'apraksti' toggle into the three per-section toggles without mutating stored blocks", () => {
    const offer = emptyIrissOfferRecord("o1", "2026-10-17T10:00:00.000Z");
    offer.specialNotes = "Teksts, kas tomēr paliek slēpts";
    offer.blocks = [{ id: "apraksti", kind: "apraksti" as never, title: "Apraksti", visible: false }];
    const blocks = resolveIrissOfferBlocks(offer);
    expect(blocks.some((b) => (b.kind as string) === "apraksti")).toBe(false);
    expect(blocks.map((b) => b.kind)).toEqual(["specialNotes", "visualAssessment", "technicalAssessment"]);
    expect(blocks.every((b) => b.visible === false)).toBe(true);
    expect(offer.blocks).toEqual([{ id: "apraksti", kind: "apraksti", title: "Apraksti", visible: false }]);
  });
});
