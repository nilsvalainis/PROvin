import { describe, expect, it } from "vitest";
import { emptyCsddTechData } from "@/lib/csdd-tech-data";
import { inspectionState, maskVin, toPublicPlateView } from "@/lib/vin-dekoders-plate";

const NOW = new Date("2026-10-29T10:00:00Z");

describe("maskVin", () => {
  it("rāda 11 zīmes, pēdējās 6 slēpj; nederīgs -> tukšs", () => {
    expect(maskVin("TMBJG7NE1J0123456")).toBe("TMBJG7NE1J0******");
    expect(maskVin("ABC")).toBe("");
  });
});

describe("inspectionState", () => {
  it("derīga, drīz beigsies, nokavēta, nezināma", () => {
    expect(inspectionState("2027-05-14", NOW)).toBe("valid");
    expect(inspectionState("2026-11-20", NOW)).toBe("expiring");
    expect(inspectionState("2026-10-01", NOW)).toBe("expired");
    expect(inspectionState("", NOW)).toBe("unknown");
  });
});

describe("toPublicPlateView", () => {
  it("tikai publiskie lauki, VIN maskēts, OCTA nav", () => {
    const d = {
      ...emptyCsddTechData(),
      registrationNumber: "AB1234",
      vin: "TMBJG7NE1J0123456",
      make: "SKODA",
      model: "OCTAVIA",
      year: "2018",
      fuel: "DĪZELDEGVIELA",
      powerKw: "85",
      displacementCm3: "1598",
      color: "PELĒKA",
      firstRegistrationIso: "2021-03-02",
      inspectionValidUntilIso: "2027-05-14",
      insuranceEndIso: "2027-01-01",
    };
    const v = toPublicPlateView("AB1234", d, NOW);
    expect(v).toEqual({
      plate: "AB1234",
      make: "SKODA",
      model: "OCTAVIA",
      year: "2018",
      fuel: "Dīzeldegviela",
      powerKw: "85",
      displacementCm3: "1598",
      color: "Pelēka",
      firstRegistration: "2021-03-02",
      inspectionValidUntil: "2027-05-14",
      vinMasked: "TMBJG7NE1J0******",
      inspection: "valid",
    });
    expect(JSON.stringify(v)).not.toContain("2027-01-01");
    expect(JSON.stringify(v)).not.toContain("123456");
  });
});
