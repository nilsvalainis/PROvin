import { describe, expect, it } from "vitest";
import { emptyIrissOfferRecord, emptyIrissPasutijums } from "@/lib/iriss-pasutijumi-types";

describe("IRISS optional mockup fields stay absent on empty records", () => {
  it("does not invent advance, events, albums or offer blocks", () => {
    const rec = emptyIrissPasutijums("empty-1", "2026-10-17T10:00:00.000Z");
    const offer = emptyIrissOfferRecord("o1", rec.createdAt);
    expect(rec.advance).toBeUndefined();
    expect(rec.communicationEvents).toBeUndefined();
    expect(rec.inspectionPhotos).toBeUndefined();
    expect(rec.documentPhotos).toBeUndefined();
    expect(offer.blocks).toBeUndefined();
    expect(JSON.stringify(rec)).not.toContain("\"advance\"");
    expect(JSON.stringify(offer)).not.toContain("\"blocks\"");
  });
});
