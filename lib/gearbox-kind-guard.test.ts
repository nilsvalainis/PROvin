import { describe, expect, it } from "vitest";
import {
  classifyGearboxRaw,
  decodeGearboxLabelLv,
  findGearboxContradictions,
  gearboxPromptBlock,
  resolveCanonicalGearbox,
  stripGearboxContradictions,
} from "@/lib/gearbox-kind-guard";

describe("classifyGearboxRaw", () => {
  it.each([
    ["MANU", "manual"],
    ["MANUĀLS", "manual"],
    ["Manuālā, 6 pārnesumi", "manual"],
    ["6-speed manual", "manual"],
    ["Schaltgetriebe", "manual"],
    ["Automātiskā (S tronic, dubultsajūga)", "dct"],
    ["7-speed DSG", "dct"],
    ["DQ381", "dct"],
    ["Tiptronic 8", "torque_converter"],
    ["ZF 8HP", "torque_converter"],
    ["AUTO", "automatic"],
    ["Automātiskā", "automatic"],
    ["", "unknown"],
    ["-", "unknown"],
    ["nav datu", "unknown"],
  ])("%s -> %s", (raw, kind) => {
    expect(classifyGearboxRaw(raw)).toBe(kind);
  });
});

describe("decodeGearboxLabelLv", () => {
  it("atšifrē dīlera kodu MANU", () => {
    expect(decodeGearboxLabelLv("MANU")).toBe("manuālā (MANU)");
  });
  it("garu latvisku vērtību atstāj", () => {
    expect(decodeGearboxLabelLv("Manuālā, 6 pārnesumi")).toBe("Manuālā, 6 pārnesumi");
  });
  it("nezināmu atstāj", () => {
    expect(decodeGearboxLabelLv("XYZ")).toBe("XYZ");
  });
});

describe("resolveCanonicalGearbox", () => {
  it("izsole + AutoDNA + dīleris saka manuālā -> manual", () => {
    const gb = resolveCanonicalGearbox({
      contextText: "Ātrumkārba: Manuālā, 6 pārnesumi\nĀtrumkārbas veids\nMANUĀLS\nTransmission: MANU",
    });
    expect(gb.kind).toBe("manual");
    expect(gb.evidence.length).toBe(3);
    expect(gearboxPromptBlock(gb)).toMatch(/AIZLIEGTS rakstīt par DSG/);
  });
  it("JSON lauks ar pēdiņām", () => {
    expect(resolveCanonicalGearbox({ contextText: '"transmission": "Manual",' }).kind).toBe("manual");
  });
  it("pretrunīgi avoti -> unknown + conflict, sargs neaktīvs", () => {
    const gb = resolveCanonicalGearbox({ contextText: "Ātrumkārba: Manuālā\nTransmission: DSG" });
    expect(gb.kind).toBe("unknown");
    expect(gb.conflict).toBe(true);
    expect(gearboxPromptBlock(gb)).toBe("");
    expect(stripGearboxContradictions("DSG sajūgs. Labs.", gb)).toBe("DSG sajūgs. Labs.");
  });
  it("nav kārbas datu -> unknown", () => {
    expect(resolveCanonicalGearbox({ contextText: "Dzinējs: CUAA" }).kind).toBe("unknown");
  });
  it("automāts + DSG -> dct", () => {
    expect(resolveCanonicalGearbox({ contextText: "Ātrumkārba: Automātiskā\nTransmission: 7-speed DSG" }).kind).toBe("dct");
  });
});

describe("kārbas pretrunu filtrs", () => {
  const manual = resolveCanonicalGearbox({ contextText: "Ātrumkārba: Manuālā" });
  const tc = resolveCanonicalGearbox({ contextText: "Ātrumkārba: Tiptronic" });

  it("manuālajai izmet DSG / divsajūga / automāta teikumus, sajūgu un spararatu atstāj", () => {
    const text = [
      "Testa braucienā pārbaudiet sajūga ķeršanas punktu un slīdēšanu.",
      "DSG kārbai lēni uzsāciet kustību pēc bremžu atlaišanas.",
      "Divsajūgu mehatronika ir dārgs mezgls.",
      "Automātiskās kārbas eļļa jāmaina ik 60 000 km.",
      "Divmasu spararata graboņu klausieties pie kreisā priekšējā riteņa.",
      "Automātiskā klimata kontrole strādā.",
    ].join(" ");
    const hits = findGearboxContradictions(text, manual).map((h) => h.match.toLowerCase());
    expect(hits).toHaveLength(3);
    const out = stripGearboxContradictions(text, manual);
    expect(out).toContain("sajūga ķeršanas punktu");
    expect(out).toContain("Divmasu spararata");
    expect(out).toContain("klimata kontrole");
    expect(out).not.toMatch(/DSG|Divsajūg|Automātiskās kārbas/);
  });

  it("virsraksts bez satura pazūd kopā ar rindkopu", () => {
    const text = "Kārba un sajūgs\nS tronic mehatronika ir vājā vieta.\n\nDzinējs\nĶēde ir izturīga.";
    expect(stripGearboxContradictions(text, manual)).toBe("Dzinējs\nĶēde ir izturīga.");
  });

  it("hidrotransformatora automātam izmet sajūga diska / pedāļa teikumus", () => {
    const text = "Pārbaudiet sajūga disku nodilumu. ATF eļļas maiņa ir svarīga.";
    expect(stripGearboxContradictions(text, tc)).toBe("ATF eļļas maiņa ir svarīga.");
  });
});
