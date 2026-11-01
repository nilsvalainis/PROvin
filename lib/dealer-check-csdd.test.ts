import { describe, expect, it } from "vitest";
import { emptyCsddTechData, type CsddTechData } from "@/lib/csdd-tech-data";
import { CSDD_API_LOCKED_KEYS, csddRegistryFieldValues } from "@/lib/csdd-field-lock";
import {
  DEALER_CHECK_CSDD_LOOKUP_PATH,
  DEALER_CHECK_CSDD_TITLE,
  applyDealerCheckCsddResult,
  dealerCheckCsddLookupQuery,
  dealerCheckCsddPreviewIsComplete,
  dealerCheckCsddPreviewKeys,
  dealerCheckCsddPreviewMatchesQuery,
  dealerCheckCsddPreviewRows,
  dealerCheckHasCsddPreview,
  dealerCheckVinFromCsdd,
  parseDealerCheckCsddResponse,
} from "@/lib/dealer-check-csdd";
import { dealerCheckHasResult, type DealerCheckRecord } from "@/lib/dealer-check";

const VIN = "WBA8A71070K896936";

function sampleCsdd(patch: Partial<CsddTechData> = {}): CsddTechData {
  return {
    ...emptyCsddTechData(),
    registrationNumber: "LR4521",
    vin: VIN,
    make: "BMW",
    model: "320d",
    year: "2016",
    fuel: "Dīzeļdegviela",
    powerKw: "140",
    electricPowerKw: "",
    electricPowerKw2: "",
    displacementCm3: "1995",
    firstRegistrationIso: "2016-03-12",
    color: "Pelēka",
    vehicleKind: "Vieglais plašlietojuma",
    cocCategory: "M1",
    cocType: "3T",
    cocApprovalNumber: "e1*2007/46*0317*20",
    cocVariant: "ACD",
    cocVersion: "NFD7",
    grossMassKg: "2000",
    curbMassKg: "1500",
    insuranceEndIso: "2026-12-01",
    inspectionValidUntilIso: "2027-05-14",
    ...patch,
  };
}

describe("Dīlera pārbaude: CSDD plate→VIN", () => {
  it("izmanto esošo admin CSDD ceļu, ne jaunu provideru", () => {
    expect(DEALER_CHECK_CSDD_LOOKUP_PATH).toBe("/api/admin/csdd-tech-data");
  });

  it("derīga numurzīme kļūst par CSDD vaicājumu; nepilna numurzīme negaida VIN", () => {
    expect(dealerCheckCsddLookupQuery("LR-4521", "")).toBe("LR4521");
    expect(dealerCheckCsddLookupQuery("lr 4521", VIN)).toBe("LR4521");
    expect(dealerCheckCsddLookupQuery("LR", VIN)).toBe("");
    expect(dealerCheckCsddLookupQuery("", VIN)).toBe(VIN);
    expect(dealerCheckCsddLookupQuery("", "ABC")).toBe("");
  });

  it("CSDD rezultāts no v/n aizpilda VIN un formatē numuru", () => {
    const applied = applyDealerCheckCsddResult(
      { vin: "", plate: "lr 4521" },
      { found: true, data: sampleCsdd(), message: "BMW 320d" },
    );
    expect(applied.found).toBe(true);
    expect(applied.vin).toBe(VIN);
    expect(applied.plate).toBe("LR-4521");
    expect(dealerCheckVinFromCsdd({ found: true, data: sampleCsdd(), message: "" })).toBe(VIN);
  });

  it("nav atrasts: VIN paliek, kā ievadīts, snapshot nav", () => {
    const applied = applyDealerCheckCsddResult(
      { vin: VIN, plate: "ZZ-9999" },
      { found: false, message: "CSDD reģistrā šāds numurs netika atrasts" },
    );
    expect(applied.found).toBe(false);
    expect(applied.vin).toBe(VIN);
    expect(applied.csdd).toBeNull();
    expect(applied.message).toContain("netika atrasts");
  });
});

describe("Dīlera pārbaude: CSDD snapshot pirms OneAuto", () => {
  it("rāda visus aizpildītos reģistra laukus, ne stub", () => {
    const data = sampleCsdd();
    const rows = dealerCheckCsddPreviewRows(data);
    const keys = dealerCheckCsddPreviewKeys(data);
    const expected = CSDD_API_LOCKED_KEYS.filter((key) => Boolean(csddRegistryFieldValues(data)[key]));
    expect(expected.length).toBeGreaterThan(10);
    expect(keys).toEqual(expected);
    expect(dealerCheckCsddPreviewIsComplete(data)).toBe(true);
    expect(dealerCheckHasCsddPreview(data)).toBe(true);
    expect(rows.find((r) => r.key === "vin")?.value).toBe(VIN);
    expect(rows.find((r) => r.key === "makeModel")?.value).toBe("BMW 320d");
    expect(rows.find((r) => r.key === "firstRegistration")?.value).toBe("12.03.2016");
    expect(rows.find((r) => r.key === "nextInspectionDate")?.value).toBe("14.05.2027");
    expect(rows.find((r) => r.key === "insuranceValidUntil")?.value).toBe("01.12.2026");
    expect(rows.some((r) => r.key === "electricPowerKw")).toBe(false);
    expect(DEALER_CHECK_CSDD_TITLE).toBe("CSDD reģistra dati");
  });

  it("CSDD bloks ir redzams, kamēr dīlera rezultāta vēl nav", () => {
    const data = sampleCsdd();
    const emptyRecord: DealerCheckRecord | null = null;
    expect(dealerCheckHasCsddPreview(data)).toBe(true);
    expect(dealerCheckHasResult(emptyRecord)).toBe(false);
    expect(dealerCheckCsddPreviewMatchesQuery(data, "LR-4521")).toBe(true);
    expect(dealerCheckCsddPreviewMatchesQuery(data, VIN)).toBe(true);
    expect(dealerCheckCsddPreviewMatchesQuery(data, "AB-1234")).toBe(false);
  });

  it("API atbilde tiek atpazīta kā CSDD rezultāts", () => {
    expect(parseDealerCheckCsddResponse({ found: true, data: sampleCsdd(), message: "ok" })?.found).toBe(true);
    expect(parseDealerCheckCsddResponse({ error: "invalid_nr1" })).toBeNull();
  });
});
