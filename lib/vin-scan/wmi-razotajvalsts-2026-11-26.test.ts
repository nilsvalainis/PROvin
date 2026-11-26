/**
 * 26.11 (Nils): VIN SCAN rinda «WMI · 2017 PEUGEOT · Francija» kopsavilkumā «Valstis» rādīja Franciju
 * kā valsti, kur auto bijis. WMI / VIN atšifrējums dod tikai RAŽOŠANAS valsti: to rāda tikai identitātē
 * («Ražots: Francija»), valstu kartītē, vēsturē un pretrunās to neskaita. Testos tikai izdomāti dati.
 */
import { describe, expect, it } from "vitest";
import { createDefaultSourceBlocks, emptyCsddFields, SOURCE_BLOCK_LABELS } from "@/lib/admin-source-blocks";
import { buildAtraFacts, type AtraFactRow } from "@/lib/atra-parbaude-facts";
import { countryLabelToIso2 } from "@/lib/country-names-lv";
import { oneautoPowertrainFromLocalVin } from "@/lib/oneauto-vin-fallback";
import { vehicleCountries } from "@/lib/quick-eval-auto-core";
import { checkSourceConsistency } from "@/lib/source-consistency";
import { buildVehicleLifecycleEvents, lifecycleEventProvidesCountryResidence } from "@/lib/vehicle-lifecycle-timeline";
import { buildVinScanResultCard } from "@/lib/vin-scan/result-fields";
import { vinScanRowManufactureCountry, vinScanRowRegistrationCountry } from "@/lib/vin-scan/row-country";
import { buildVinScanFacts } from "@/lib/vin-scan/summary";
import type { VinScanIndicator } from "@/lib/vin-scan/types";
import { decodeVinLocal, mergeVinDecodeWithVpic, vinDecodeParseFromLocal } from "@/lib/vin-scan/vin-decode";

/** Izdomāts Peugeot VIN: VF3 = Peugeot (FR), 10. zīme H = 2017. */
const PEUGEOT_VIN = "VF3LCYHZPHS000001";
/** Izdomāts Volvo VIN: YV1 = Volvo (SE). */
const VOLVO_VIN = "YV1DZ8256J0000001";

function wmiRow(flags: AtraFactRow["flags"]): AtraFactRow {
  return { id: "vin_decode", label: "WMI", country: "ISO", status: "found", summary: "2017 PEUGEOT · Ražots: Francija", flags };
}

function indicator(partial: Partial<VinScanIndicator> & Pick<VinScanIndicator, "id">): VinScanIndicator {
  return { label: partial.id, country: "", status: "found", summary: "", detail: "", openUrl: null, ...partial } as VinScanIndicator;
}

describe("WMI dekodējums: ražotājvalsts tikai identitātē", () => {
  it("lokālais dekodējums: «Ražots: Francija», flags.manufactureCountry, bez registrationCountry", () => {
    const parsed = vinDecodeParseFromLocal(decodeVinLocal(PEUGEOT_VIN));
    expect(parsed.summary).toBe("2017 Peugeot · Ražots: Francija");
    expect(parsed.flags?.manufactureCountry).toBe("FR");
    expect(parsed.flags?.registrationCountry).toBeUndefined();
  });

  it("vPIC apvienojums arī dod tikai manufactureCountry", () => {
    const merged = mergeVinDecodeWithVpic(decodeVinLocal(PEUGEOT_VIN), {
      status: "found",
      summary: "2017 PEUGEOT 308",
      vehicle: { make: "PEUGEOT", model: "308", year: "2017" },
    });
    expect(merged.summary).toBe("2017 PEUGEOT 308 · Ražots: Francija");
    expect(merged.flags?.manufactureCountry).toBe("FR");
    expect(merged.flags?.registrationCountry).toBeUndefined();
  });

  it("rindas palīgi: WMI rindai reģistrācijas valsts vienmēr tukša (arī vecam momentuzņēmumam)", () => {
    expect(vinScanRowRegistrationCountry({ id: "vin_decode", flags: { registrationCountry: "FR" } })).toBe("");
    expect(vinScanRowManufactureCountry({ id: "vin_decode", flags: { registrationCountry: "FR" } })).toBe("FR");
    expect(vinScanRowRegistrationCountry({ id: "carinfo", flags: { registrationCountry: "SE" } })).toBe("SE");
    expect(vinScanRowManufactureCountry({ id: "carinfo", flags: { registrationCountry: "SE" } })).toBe("");
  });

  it("rezultātu kartīte: WMI valsts ir «Ražots», ne «Valsts»", () => {
    const card = buildVinScanResultCard({ id: "vin_decode", label: "WMI", status: "found", flags: { manufactureCountry: "FR" } });
    expect(card?.made).toBe("Francija");
    expect(card?.origin).toBe("");
  });

  it("OneAuto fallback rinda saucas «Ražots (fallback)», ne «Valsts (fallback)»", () => {
    const rows = oneautoPowertrainFromLocalVin(PEUGEOT_VIN);
    expect(rows.find((r) => r.label === "Ražots (fallback)")?.value).toBe("FR");
    expect(rows.some((r) => r.label === "Valsts (fallback)")).toBe(false);
  });
});

describe("VIN SCAN v4 kopsavilkums «Valstis» (buildAtraFacts)", () => {
  const base = { vin: PEUGEOT_VIN, plate: "", title: "PEUGEOT 308", year: "2017", dealer: null, csdd: null, hasListing: false };

  it("WMI Francija netiek skaitīta (jaunais flags.manufactureCountry)", () => {
    const facts = buildAtraFacts({ ...base, rows: [wmiRow({ manufactureCountry: "FR" })] });
    expect(facts.countries).toEqual([]);
  });

  it("vecs momentuzņēmums ar WMI registrationCountry: FR arī netiek skaitīta", () => {
    const facts = buildAtraFacts({ ...base, rows: [wmiRow({ registrationCountry: "FR" })] });
    expect(facts.countries).toEqual([]);
  });

  it("reģistra valsts paliek, WMI - nē", () => {
    const facts = buildAtraFacts({
      ...base,
      rows: [
        wmiRow({ registrationCountry: "FR" }),
        { id: "carinfo", label: "car.info", country: "SE", status: "found", summary: "Atrasts", flags: { registrationCountry: "SE" } },
      ],
    });
    expect(facts.countries).toEqual(["SE"]);
  });
});

describe("Ātrais vērtējums (sarkanie karogi, «Ieteicams piedāvāt») valstis", () => {
  it("vehicleCountries neskaita WMI valsti", () => {
    const rows = [
      indicator({ id: "vin_decode", flags: { manufactureCountry: "FR" } }),
      indicator({ id: "vin_decode", flags: { registrationCountry: "FR" } }),
    ];
    expect(vehicleCountries(rows)).toEqual([]);
    expect(vehicleCountries([...rows, indicator({ id: "tjekbil", flags: { registrationCountry: "DK" } })])).toEqual(["DK"]);
  });
});

describe("vecie VIN SCAN fakti (buildVinScanFacts «Reģistrācijas»)", () => {
  it("Volvo WMI Zviedrija nav reģistrācija", () => {
    const facts = buildVinScanFacts(
      [{ id: "vin_decode", label: "WMI", country: "ISO", status: "found", summary: "", flags: { registrationCountry: "SE" } }],
      VOLVO_VIN,
    );
    expect(facts.registrations).toEqual([]);
  });
});

describe("klienta PDF laikjosla: «Ražots <valsts>» nav valsts, kur auto bijis", () => {
  function input() {
    return {
      csddForm: { ...emptyCsddFields(), previousRegistrationCountry: "Vācija", firstRegistration: "10.06.2017" },
      manualVendorBlocks: [
        {
          title: SOURCE_BLOCK_LABELS.carvertical,
          mileageRows: [{ date: "10.06.2018", odometer: "20000", country: "Vācija" }],
          incidentRows: [],
          comments: "",
          vehicleHistoryTimeline: [
            { date: "02.03.2017", country: "Francija", description: "Ražots", includeInPdf: true },
            { date: "10.06.2017", country: "Vācija", description: "Pirmā reģistrācija", includeInPdf: true },
          ],
        },
      ],
    };
  }

  it("nav pārejas «Francija → Vācija»", () => {
    const events = buildVehicleLifecycleEvents(input());
    const hops = events
      .filter((e) => e.kind === "import")
      .map((e) => `${countryLabelToIso2(e.fromCountry ?? "")}→${countryLabelToIso2(e.country)}`);
    expect(hops.some((h) => h.startsWith("FR"))).toBe(false);
    const made = events.find((e) => /Ražots/.test(e.title));
    expect(made).toBeTruthy();
    expect(lifecycleEventProvidesCountryResidence(made!)).toBe(false);
  });
});

describe("source-consistency: ražotājvalsts nerada valstu pretrunu", () => {
  it("CSDD iepriekšējā valsts Vācija, CarVertical tikai «Ražots Francija» - nav country_prev", () => {
    const blocks = createDefaultSourceBlocks();
    blocks.csdd = { ...blocks.csdd, previousRegistrationCountry: "Vācija" };
    blocks.carvertical = {
      ...blocks.carvertical,
      vehicleHistoryTimeline: [{ date: "02.03.2017", country: "Francija", description: "Ražots", includeInPdf: true }],
    };
    const issues = checkSourceConsistency({ vin: PEUGEOT_VIN, sourceBlocks: blocks });
    expect(issues.some((i) => i.id === "country_prev")).toBe(false);
  });

  it("īsta citas valsts vēsture joprojām rada country_prev", () => {
    const blocks = createDefaultSourceBlocks();
    blocks.csdd = { ...blocks.csdd, previousRegistrationCountry: "Vācija" };
    blocks.carvertical = {
      ...blocks.carvertical,
      vehicleHistoryTimeline: [{ date: "02.03.2019", country: "Francija", description: "Reģistrēts", includeInPdf: true }],
    };
    const issues = checkSourceConsistency({ vin: PEUGEOT_VIN, sourceBlocks: blocks });
    expect(issues.some((i) => i.id === "country_prev")).toBe(true);
  });
});
