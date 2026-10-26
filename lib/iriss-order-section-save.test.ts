import { describe, expect, it } from "vitest";
import {
  irissSectionSaveButtonLabel,
  irissSectionSaveInlineText,
  adoptServerMergedFields,
  pickRecordAfterOrderSave,
} from "@/lib/iriss-order-section-save";

describe("irissSectionSaveButtonLabel", () => {
  it("shows Saglabā… only while this button is saving", () => {
    expect(irissSectionSaveButtonLabel("idle")).toBe("Saglabāt");
    expect(irissSectionSaveButtonLabel("saving")).toBe("Saglabā…");
    expect(irissSectionSaveButtonLabel("saved")).toBe("Saglabāt");
    expect(irissSectionSaveButtonLabel("error")).toBe("Saglabāt");
  });
});

describe("irissSectionSaveInlineText", () => {
  it("maps inline status copy", () => {
    expect(irissSectionSaveInlineText("idle")).toBeNull();
    expect(irissSectionSaveInlineText("saving")).toBe("Saglabā…");
    expect(irissSectionSaveInlineText("saved")).toBe("✓ Saglabāts");
    expect(irissSectionSaveInlineText("error", "Kļūda 500")).toBe("Kļūda 500");
    expect(irissSectionSaveInlineText("error", "  ")).toBe("Kļūda saglabājot.");
    expect(irissSectionSaveInlineText("error", null)).toBe("Kļūda saglabājot.");
  });
});

describe("pickRecordAfterOrderSave", () => {
  it("keeps newer local edits from other sections", () => {
    const payload = { brandModel: "Golf", notes: "A" };
    const current = { brandModel: "Golf", notes: "AB" };
    const server = { brandModel: "Golf", notes: "A", updatedAt: "1" };
    expect(pickRecordAfterOrderSave(current, payload, server)).toEqual(current);
  });

  it("applies the server record when the form was unchanged during save", () => {
    const payload = { brandModel: "Golf", notes: "A" };
    const server = { brandModel: "Golf", notes: "A", updatedAt: "1" };
    expect(pickRecordAfterOrderSave(payload, payload, server)).toEqual(server);
  });

  it("keeps current when the server omitted a record", () => {
    const payload = { brandModel: "Golf" };
    expect(pickRecordAfterOrderSave(payload, payload, null)).toEqual(payload);
  });
});

describe("adoptServerMergedFields (FABLE F3: klienta «Rezervēts» pazuda pēc nākamās saglabāšanas)", () => {
  const approved = { from: "active", to: "reserved", at: "2026-10-26T06:38:36.452Z", by: "Klients (piedāvājuma saite)" };

  it("neaiztiktie lauki un revīzija nāk no servera apvienotā ieraksta", () => {
    const payload = { workspaceRevision: 3, listStatus: "active", statusHistory: [] as unknown[], internalNotes: "FABLE", offers: ["lokāls"] };
    const server = { workspaceRevision: 5, listStatus: "reserved", statusHistory: [approved], internalNotes: "FABLE", offers: ["serveris"] };
    const out = adoptServerMergedFields(payload, payload, server, ["offers"]);
    expect(out.listStatus).toBe("reserved");
    expect(out.statusHistory).toEqual([approved]);
    expect(out.workspaceRevision).toBe(5);
    expect(out.offers).toEqual(["lokāls"]);
  });

  it("lauks, ko operators raksta saglabāšanas laikā, paliek vietējais", () => {
    const payload = { listStatus: "active", internalNotes: "FABLE", brandModel: "To" };
    const current = { ...payload, brandModel: "Toyota" };
    const server = { listStatus: "reserved", internalNotes: "FABLE", brandModel: "To" };
    const out = adoptServerMergedFields(current, payload, server);
    expect(out.brandModel).toBe("Toyota");
    expect(out.listStatus).toBe("reserved");
  });

  it("serveris izdzēsa neaiztiktu lauku → arī lokāli dzēsts; bez servera ieraksta nekas nemainās", () => {
    const payload: { a: string; b?: string } = { a: "1", b: "x" };
    expect(adoptServerMergedFields(payload, payload, { a: "1" })).toEqual({ a: "1" });
    expect(adoptServerMergedFields(payload, payload, null)).toBe(payload);
  });
});
