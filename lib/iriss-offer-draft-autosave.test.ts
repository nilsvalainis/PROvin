import { describe, expect, it } from "vitest";
import { newOfferDraft } from "@/lib/iriss-offer-draft";
import { offerDraftAutosavePayload, offerDraftAutosaveWorthRestoring } from "@/lib/iriss-offer-draft-autosave";

function payload(patch: Partial<ReturnType<typeof newOfferDraft>> = {}) {
  return offerDraftAutosavePayload({ ...newOfferDraft(1), ...patch });
}

describe("offerDraftAutosaveWorthRestoring", () => {
  it("is false for two fresh empty drafts", () => {
    expect(offerDraftAutosaveWorthRestoring(payload(), payload())).toBe(false);
  });

  it("is true when the saved draft has hand-typed text the current draft is missing", () => {
    const saved = payload({ summary: "Auto ir labā stāvoklī, nav bojājumu." });
    const current = payload();
    expect(offerDraftAutosaveWorthRestoring(saved, current)).toBe(true);
  });

  it("is false when the only difference is an empty field vs empty field", () => {
    const saved = payload({ summary: "" });
    const current = payload({ summary: "" });
    expect(offerDraftAutosaveWorthRestoring(saved, current)).toBe(false);
  });

  it("is true when a checkbox the saved draft had checked is unchecked in the current draft", () => {
    const saved = payload({ hasFullServiceHistory: true });
    const current = payload({ hasFullServiceHistory: false });
    expect(offerDraftAutosaveWorthRestoring(saved, current)).toBe(true);
  });

  it("is false when the saved draft matches the current draft exactly", () => {
    const d = payload({ carPrice: "15000", summary: "Labs auto." });
    expect(offerDraftAutosaveWorthRestoring(d, d)).toBe(false);
  });
});
