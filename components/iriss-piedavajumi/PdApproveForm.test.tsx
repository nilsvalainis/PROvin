import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { PdApproveForm } from "@/components/iriss-piedavajumi/PdApproveForm";
import { renderText } from "@/lib/test-render";

const TOKEN = "AbCdEfGhIjKlMnOpQrStUvWx";

describe("klienta saites atbildes bloks", () => {
  it("atvērts piedāvājums: Apstiprināt, Noraidīt un Uzdot jautājumu", () => {
    const text = renderText(createElement(PdApproveForm, { token: TOKEN, needsContact: false, state: "open" }));
    expect(text).toContain("Apstiprināt");
    expect(text).toContain("Noraidīt");
    expect(text).toContain("Uzdot jautājumu");
  });

  it("noraidīts: tikai statuss un klienta jautājumi, bez lēmuma pogām", () => {
    const text = renderText(
      createElement(PdApproveForm, { token: TOKEN, needsContact: false, state: "declined", questions: [{ at: "2026-10-26T10:00:00Z", text: "Vai ir atslēgas?" }] }),
    );
    expect(text).toContain("Piedāvājums noraidīts");
    expect(text).toContain("Vai ir atslēgas?");
    expect(text).not.toContain("Apstiprināt");
    expect(text).not.toContain("Uzdot jautājumu");
  });

  it("apstiprināts: statuss un iespēja vēl uzdot jautājumu, bez Noraidīt", () => {
    const text = renderText(createElement(PdApproveForm, { token: TOKEN, needsContact: false, state: "approved" }));
    expect(text).toContain("Piedāvājums apstiprināts");
    expect(text).toContain("Uzdot jautājumu");
    expect(text).not.toContain("Noraidīt");
  });
});
