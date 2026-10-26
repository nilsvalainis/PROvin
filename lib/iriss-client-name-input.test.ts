import { describe, expect, it } from "vitest";
import { irissClientNameInputValue, splitIrissClientNameInput } from "@/lib/iriss-client-name-input";

/** Simulē rakstīšanu pa burtam: lauka vērtība vienmēr tiek atvasināta no ieraksta. */
function typeInto(text: string) {
  let rec = { clientFirstName: "", clientLastName: "" };
  for (const ch of text) {
    rec = splitIrissClientNameInput(irissClientNameInputValue(rec) + ch);
  }
  return rec;
}

describe("splitIrissClientNameInput", () => {
  it("rakstot atstarpe nepazūd («FABLE DEMO», ne «FABLEDEMO»)", () => {
    const rec = typeInto("FABLE DEMO");
    expect(rec).toEqual({ clientFirstName: "FABLE", clientLastName: "DEMO" });
    expect(irissClientNameInputValue(rec)).toBe("FABLE DEMO");
  });

  it("trīs vārdi un beigu atstarpe rakstīšanas laikā", () => {
    expect(irissClientNameInputValue(typeInto("Anna Marija "))).toBe("Anna Marija ");
    expect(typeInto("Anna Marija Ozola")).toEqual({ clientFirstName: "Anna", clientLastName: "Marija Ozola" });
  });

  it("vairākas atstarpes saplūst, sākuma atstarpe tiek nomesta, tukšs = tukšs", () => {
    expect(splitIrissClientNameInput("  Jānis   Bērziņš")).toEqual({ clientFirstName: "Jānis", clientLastName: "Bērziņš" });
    expect(splitIrissClientNameInput("   ")).toEqual({ clientFirstName: "", clientLastName: "" });
    expect(splitIrissClientNameInput("")).toEqual({ clientFirstName: "", clientLastName: "" });
  });

  it("dzēšot atpakaļ līdz vienam vārdam", () => {
    expect(splitIrissClientNameInput("FABLE D".slice(0, -1))).toEqual({ clientFirstName: "FABLE ", clientLastName: "" });
    expect(splitIrissClientNameInput("FABLE")).toEqual({ clientFirstName: "FABLE", clientLastName: "" });
  });
});
