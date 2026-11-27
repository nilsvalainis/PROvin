import { describe, expect, it } from "vitest";
import { applyExpertFieldGuards, findExpertFieldIssues, stripRepairSpeculation } from "@/lib/ai-expert-field-guards";
import { resolveCanonicalGearbox } from "@/lib/gearbox-kind-guard";

describe("stripRepairSpeculation", () => {
  it("izmet remonta minējumus", () => {
    const text =
      "LTAB fiksēts negadījums 2023. gadā. Iespējams, nomainīts priekšējais bamperis. Visticamāk tika pārkrāsota labā durvis. Pārbaudiet, vai bamperis nav krāsots.";
    expect(stripRepairSpeculation(text)).toBe("LTAB fiksēts negadījums 2023. gadā. Pārbaudiet, vai bamperis nav krāsots.");
  });

  it("obligāto atrunu par kosmētisku krāsojumu un apkopes nomaiņu atstāj", () => {
    const text =
      "Avotos nav fiksētu negadījumu. Tas neizslēdz nefiksētu negadījumu vai kosmētisku krāsojumu pagātnē. Iespējams, zobsiksnas nomaiņa vēl priekšā.";
    expect(stripRepairSpeculation(text)).toBe(text);
  });

  it("kalibrēšana bez avota -> izmet; ar avotu (vējstikla maiņa) -> atstāj", () => {
    const text = "Pēc remonta veikta radara kalibrēšana. Riepas labā stāvoklī.";
    expect(stripRepairSpeculation(text, { sourceText: "LTAB: bojāts priekšējais bamperis" })).toBe("Riepas labā stāvoklī.");
    expect(stripRepairSpeculation(text, { sourceText: "Dīleris: Windscreen replacement" })).toBe(text);
  });
});

describe("applyExpertFieldGuards", () => {
  it("EUR + minējums + kārba vienā gājienā", () => {
    const gb = resolveCanonicalGearbox({ contextText: "Transmission: MANU" });
    const text =
      "Apdrošināšanas izmaksa 2 300 EUR. Iespējams, remontēts aizmugurējais spārns. DSG sajūgs jāpārbauda. Sajūga pedālis jāpārbauda.";
    expect(applyExpertFieldGuards(text, { gearbox: gb, sourceText: "" })).toBe("Sajūga pedālis jāpārbauda.");
    const ids = findExpertFieldIssues(text, { gearbox: gb, sourceText: "" }).map((i) => i.id);
    expect(ids).toEqual(["eur", "repair_guess", "gearbox"]);
  });
});
