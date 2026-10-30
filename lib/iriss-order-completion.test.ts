import { describe, expect, it } from "vitest";
import { irissMergedInternalNotes, irissOrderProgress, irissOrderStepStatuses, irissWhatsAppAppHref } from "@/lib/iriss-order-completion";
import { emptyIrissPasutijums } from "@/lib/iriss-pasutijumi-types";

const base = () => ({ ...emptyIrissPasutijums("x", "2026-10-28T10:00:00.000Z") });

describe("Pasūtījuma aizpildījums (Nils 28.10)", () => {
  it("tukšs pasūtījums - 0 no 5, trūkstošie lauki nosaukti", () => {
    const p = irissOrderProgress(base());
    expect(p).toMatchObject({ done: 0, total: 5 });
    expect(p.missing).toContain("Virsbūve");
    expect(p.missing).toContain("Gadi");
  });

  it("meklēšanas filtri zaļi tikai ar visiem obligātajiem laukiem", () => {
    const part = { ...base(), brandModel: "Volvo V60", bodyType: "Universālis", totalBudget: "20000" };
    expect(irissOrderStepStatuses(part)[0]!.missing).toEqual(["Gadi", "Nobraukums", "Degviela", "Ātrumkārba"]);
    const rec = {
      ...part,
      productionYears: "2016-2019",
      maxMileage: "180000",
      engineType: "Dīzelis, Benzīns",
      transmission: "Automāts",
      budgetIncludes: "all",
    };
    const s = irissOrderStepStatuses(rec);
    expect(s[0]).toEqual({ done: true, missing: [] });
    expect(s[1]!.done).toBe(true);
    expect(irissOrderProgress(rec).done).toBe(2);
  });

  it("piezīmes aģentam un iekšējās - kopā, nekas nepazūd", () => {
    expect(irissMergedInternalNotes({ agentNotes: "A", internalNotes: "B" })).toBe("A\n\nB");
    expect(irissMergedInternalNotes({ agentNotes: "", internalNotes: "B" })).toBe("B");
  });

  it("tālrunis atver WhatsApp lietotni", () => {
    expect(irissWhatsAppAppHref("29122566")).toBe("whatsapp://send?phone=37129122566");
    expect(irissWhatsAppAppHref("+371 29 122 566")).toBe("whatsapp://send?phone=37129122566");
    expect(irissWhatsAppAppHref("")).toBe("");
  });
});
