import { describe, expect, it } from "vitest";
import {
  applyReportLanguageFixes,
  cleanEquipmentDescription,
  formatModelDesignationCase,
  normalizeCsddDefectText,
  normalizeSourceNameSpelling,
  splitEquipmentText,
  translateLeakedSourceTerms,
} from "@/lib/report-language-fixes";
import { applyProvinReportCopyVocabulary } from "@/lib/source-summary-comment-format";
import { sanitizeVinRegistryClientLine } from "@/lib/vin-registry-client-text";

describe("24.11 audits #33 - CSDD TA defektu teksts", () => {
  it("atdala ģenitīva «s» un salipušus salikteņus", () => {
    expect(normalizeCsddDefectText("Dīzeļdegviela s pilēšana")).toBe("Dīzeļdegvielas pilēšana");
    expect(normalizeCsddDefectText("Mitra dīzeļdegviela s sprausla")).toBe("Mitra dīzeļdegvielas sprausla");
    expect(normalizeCsddDefectText("Izdilis balstiekārtasšarnīrā")).toBe("Izdilis balstiekārtas šarnīrā");
    expect(normalizeCsddDefectText("Bojāta pārvadašļūtene")).toBe("Bojāta pārvada šļūtene");
    expect(normalizeCsddDefectText("Noplūst dzesēšanasšķidrums")).toBe("Noplūst dzesēšanas šķidrums");
    expect(normalizeCsddDefectText("Plaisas bremžušļūtenes")).toBe("Plaisas bremžu šļūtenes");
  });

  it("pielīmētu cita defekta koda rindu liek jaunā rindā", () => {
    expect(
      normalizeCsddDefectText("Stāvbremze nedarbojas vienā pusē. 5.3.3.12. tilts. Funkcionalitāti neietekmējošas plaisas"),
    ).toBe("Stāvbremze nedarbojas vienā pusē.\n5.3.3.12. tilts. Funkcionalitāti neietekmējošas plaisas");
  });

  it("pareizu tekstu nemaina un ir idempotents", () => {
    const ok = "Amortizatora stiprinājums bojāts, bremžu disks nodilis";
    expect(normalizeCsddDefectText(ok)).toBe(ok);
    const once = normalizeCsddDefectText("Dīzeļdegviela s pilēšana balstiekārtasšarnīrā");
    expect(normalizeCsddDefectText(once)).toBe(once);
  });
});

describe("24.11 audits #34 - aprīkojums", () => {
  it("noņem «S0» atliekas un labo avota drukas kļūdas", () => {
    expect(cleanEquipmentDescription("S0300alpinweiss 3")).toBe("300 alpinweiss 3");
    expect(cleanEquipmentDescription("Steptronic transmissionS0")).toBe("Steptronic transmission");
    expect(cleanEquipmentDescription("Tyire Control")).toBe("Tyre Control");
    expect(cleanEquipmentDescription("Smoker ́s package")).toBe("Smoker's package");
    expect(cleanEquipmentDescription("Lt/aly Wheels/ellipsoid")).toBe("Light alloy Wheels/ellipsoid");
  });

  it("salipušu rindu sadala pozīcijās", () => {
    const parts = splitEquipmentText("205Steptronic transmissionS02NPM Lt/aly W. Double Spoke 135 M");
    expect(parts).toEqual(["205Steptronic transmission", "2NP M Light alloy W. double-spoke 135 M"]);
    expect(parts.join(" ")).not.toMatch(/S0/);
  });
});

describe("24.11 audits #42 - modeļa apzīmējums", () => {
  it("BMW degvielas burts mazais, citām markām nemaina", () => {
    expect(formatModelDesignationCase("BMW", "320D")).toBe("320d");
    expect(formatModelDesignationCase("BMW", "X5 XDRIVE30D")).toBe("X5 xDrive30d");
    expect(formatModelDesignationCase("BMW", "M550I")).toBe("M550i");
    expect(formatModelDesignationCase("AUDI", "A3 320D")).toBe("A3 320D");
    expect(formatModelDesignationCase("", "320D")).toBe("320D");
  });
});

describe("24.11 audits #18 / #5 uzdevums - neiztulkoti dāņu vārdi", () => {
  it("LV / EN / RU / DE", () => {
    const src = "Četras atzīmes (status: Ejerskifte), koeretoejAnvendelseNavn: Privat personkørsel, Betinget godkendt (Afmeldt)";
    expect(translateLeakedSourceTerms(src, "lv")).toBe(
      "Četras atzīmes (īpašnieka maiņa), privāta lietošana, nosacīti izturēta (noņemts no uzskaites)",
    );
    expect(translateLeakedSourceTerms("Betinget godkendt", "en")).toBe("conditionally passed");
    expect(translateLeakedSourceTerms("Ejerskifte", "ru")).toBe("смена владельца");
    expect(translateLeakedSourceTerms("Afmeldt", "de")).toBe("abgemeldet");
    expect(translateLeakedSourceTerms("LB Bilsyn ApS - Bov(ophørt)", "lv")).toBe("LB Bilsyn ApS - Bov (uzņēmums slēgts)");
  });

  it("reģistra rinda klientam tiek iztulkota", () => {
    expect(sanitizeVinRegistryClientLine("12.03.2019 Ejerskifte")).toBe("12.03.2019 īpašnieka maiņa");
  });
});

describe("24.11 audits #38, #41, #43 - rakstība", () => {
  it("avotu nosaukumi kā 1. lapas logo", () => {
    expect(normalizeSourceNameSpelling("CarVertical, CARVERTICAL un AutoDNA, ss.lv")).toBe("carVertical, carVertical un autoDNA, ss.com");
    // URL un e-pastu neskar.
    expect(normalizeSourceNameSpelling("https://www.ss.lv/msg/1 info@carvertical.com")).toBe("https://www.ss.lv/msg/1 info@carvertical.com");
  });

  it("«t.s.», «2016.gāda», «~9.5 mēn.», «BMW 320D»", () => {
    expect(applyReportLanguageFixes("ierakstus, t.s. pēc smagiem negadījumiem")).toBe("ierakstus, tostarp pēc smagiem negadījumiem");
    expect(applyReportLanguageFixes("2016.gāda vasarā; Arhīva fotogrāfijas 2017.gads")).toBe("2016. gada vasarā; Arhīva fotogrāfijas 2017. gads");
    expect(applyReportLanguageFixes("intervāls ~9.5 mēn., dzinējs 2.0 l")).toBe("intervāls ~9,5 mēn., dzinējs 2,0 l");
    expect(applyReportLanguageFixes("BMW 320D ar xDrive")).toBe("BMW 320d ar xDrive");
    // Datumus un versijas neskar.
    expect(applyReportLanguageFixes("12.05.2014 un v1.26.0")).toBe("12.05.2014 un v1.26.0");
  });

  it("idempotents un ieslēgts AI teksta vārdnīcā", () => {
    const once = applyReportLanguageFixes("CarVertical t.s. 2016.gāda ~9.5 mēn. (status: Ejerskifte)");
    expect(applyReportLanguageFixes(once)).toBe(once);
    expect(applyProvinReportCopyVocabulary("CarVertical dati, t.s. 2016.gāda ieraksts.")).toContain(
      "carVertical dati, tostarp 2016. gada ieraksts.",
    );
  });
});
