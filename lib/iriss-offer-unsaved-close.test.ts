import { describe, expect, it } from "vitest";
import { newOfferDraft, OFFER_UNSAVED_CLOSE_CONFIRM, offerDraftHasOperatorInput } from "@/lib/iriss-offer-draft";

/** FABLE v3 F6: jauna piedāvājuma «×» ar ievadītām cenām klusi zaudēja datus. */
describe("piedāvājuma aizvēršana ar nesaglabātu ievadi", () => {
  it("tukšs jauns piedāvājums (tikai nosaukums + termiņš) - nejautā", () => {
    expect(offerDraftHasOperatorInput(newOfferDraft(1))).toBe(false);
  });
  it("ievadīta cena, komentārs vai bilde - jautā", () => {
    expect(offerDraftHasOperatorInput({ ...newOfferDraft(1), carPrice: "12 500,50" })).toBe(true);
    expect(offerDraftHasOperatorInput({ ...newOfferDraft(1), comment: "x" })).toBe(true);
    expect(offerDraftHasOperatorInput({ ...newOfferDraft(1), brandModel: "  " })).toBe(false);
    expect(
      offerDraftHasOperatorInput({ ...newOfferDraft(1), attachments: [{ id: "a" } as never] }),
    ).toBe(true);
  });
  it("teksts latviski, bez garās domuzīmes", () => {
    expect(OFFER_UNSAVED_CLOSE_CONFIRM).toMatch(/nav saglabāts/);
    expect(OFFER_UNSAVED_CLOSE_CONFIRM).not.toMatch(/[–—]/);
  });
});
