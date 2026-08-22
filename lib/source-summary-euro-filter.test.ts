import { describe, expect, it } from "vitest";
import {
  splitIntoSentences,
  stripUnauthorizedEuroAmounts,
} from "@/lib/source-summary-comment-format";

describe("splitIntoSentences", () => {
  it("never loses characters", () => {
    for (const input of [
      "2.0 TDI dzinējs. Otrais teikums.",
      "Dūmainība 0.03 ir laba! Vai tiešām? Jā.",
      "Bez punkta vispār",
      "Virsraksts\nRindkopa ar 1.9 TDI un 4.2 V8.",
      "",
    ]) {
      expect(splitIntoSentences(input).join("")).toBe(input);
    }
  });

  it("does not treat a decimal point as a sentence boundary", () => {
    expect(splitIntoSentences("2.0 TDI dzinējs ir izturīgs. Nākamais.")).toEqual([
      "2.0 TDI dzinējs ir izturīgs. ",
      "Nākamais.",
    ]);
  });
});

describe("stripUnauthorizedEuroAmounts", () => {
  it("keeps the heading and the decimal engine size intact", () => {
    const input = [
      "Eļļas sūkņa piedziņas ass",
      "2.0 TDI dzinējiem ar CAHA kodu ass nodilums ir tipisks. Nomaiņa ir profilaktisks darbs.",
      "",
      "Cieto daļiņu rādītājs",
      "Dūmainības koeficients 0.03 ir labvēlīgs signāls datos.",
    ].join("\n");
    const out = stripUnauthorizedEuroAmounts(input);
    expect(out).toContain("Eļļas sūkņa piedziņas ass\n2.0 TDI dzinējiem ar CAHA kodu");
    expect(out).toContain("Cieto daļiņu rādītājs\nDūmainības koeficients 0.03");
  });

  it("drops only the sentence carrying € and keeps its neighbours", () => {
    const out = stripUnauthorizedEuroAmounts(
      "Pirmais teikums bez summas. Nomaiņa izmaksā 250-500 € servisā. Trešais teikums.",
    );
    expect(out).not.toMatch(/€/);
    expect(out).toContain("Pirmais teikums bez summas.");
    expect(out).toContain("Trešais teikums.");
  });

  it("removes the whole block when every body sentence carried a price", () => {
    const out = stripUnauthorizedEuroAmounts(
      ["Zobsiksnas maiņa", "Darbs maksā ap 600 EUR."].join("\n"),
    );
    expect(out).toBe("");
  });

  it("keeps a paragraph whose heading is the only line", () => {
    expect(stripUnauthorizedEuroAmounts("Tikai virsraksts")).toBe("Tikai virsraksts");
  });
});
