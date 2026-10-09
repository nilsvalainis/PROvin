import { describe, expect, it } from "vitest";
import {
  irissSectionSaveButtonLabel,
  irissSectionSaveInlineText,
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
