import { describe, expect, it } from "vitest";
import {
  applyProvinReportCopyVocabulary,
  stripAiOpeningAndOperatorInstructions,
} from "@/lib/source-summary-comment-format";

describe("stripAiOpeningAndOperatorInstructions", () => {
  it("drops a greeting line and a first-person status sentence at the start", () => {
    expect(
      stripAiOpeningAndOperatorInstructions("Sveiki,\nEsmu pabeidzis rūpīgu analīzi.\n\nAutomašīnai ir 2 īpašnieki."),
    ).toBe("Automašīnai ir 2 īpašnieki.");
  });

  it("keeps the fact after a same-sentence greeting, capitalised", () => {
    expect(stripAiOpeningAndOperatorInstructions("Labdien, automašīnai ir 2 īpašnieki.")).toBe(
      "Automašīnai ir 2 īpašnieki.",
    );
  });

  it.each(["Esmu rūpīgi izvērtējis visus avotus.", "Esmu izskatījis CSDD datus:"])(
    "drops the opening sentence %j",
    (opener) => {
      expect(stripAiOpeningAndOperatorInstructions(`${opener} Nobraukums ir loģisks.`)).toBe("Nobraukums ir loģisks.");
    },
  );

  it("keeps LV ordinal dates inside the dropped opener sentence", () => {
    expect(
      stripAiOpeningAndOperatorInstructions("Esmu izskatījis 2019. gada datus. Nobraukums ir loģisks."),
    ).toBe("Nobraukums ir loģisks.");
  });

  it("drops operator instruction lines and bracketed notes", () => {
    const out = stripAiOpeningAndOperatorInstructions(
      "CSDD dati sakrīt (ignorēt carVertical).\nIgnorēt AutoDNA, nav pirkts.\nTODO pārbaudīt\nBojājumi nav fiksēti.",
    );
    expect(out).toBe("CSDD dati sakrīt.\nBojājumi nav fiksēti.");
  });

  it("leaves legit text untouched", () => {
    const legit =
      "Šo brīdinājumu nevajadzētu ignorēt.\nVadības blokā ir ignorēts kļūdas kods. Esmu pārliecināts nav lietots.";
    expect(stripAiOpeningAndOperatorInstructions(legit)).toBe(legit);
    expect(stripAiOpeningAndOperatorInstructions("Labdien teica pārdevējs.")).toBe("Labdien teica pārdevējs.");
  });

  it("runs as part of the AI output vocabulary pass", () => {
    expect(applyProvinReportCopyVocabulary("Sveiki! Esmu izskatījis datus. Automašīnai ir 2 īpašnieki.")).toBe(
      "Automašīnai ir 2 īpašnieki.",
    );
  });
});
