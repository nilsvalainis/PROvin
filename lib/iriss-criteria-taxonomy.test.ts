import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  AUTOBID_BODY_ID_TO_NAME,
  AUTOBID_FUEL_ID_TO_NAME,
  AUTOBID_GEARBOX_ID_TO_NAME,
  OPENLANE_FUEL_ID_TO_NAME,
} from "@/lib/iriss-listings-ecarstrade-criteria";
import {
  confirmedNumericCodes,
  ECARSTRADE_FUEL_TO_GROUP,
  normalizeBody,
  normalizeDrive,
  normalizeEmission,
  normalizeFuel,
  normalizeGearbox,
  normalizePowerKw,
  resolveAuctionPlatform,
} from "@/lib/iriss-criteria-taxonomy";

describe("resolveAuctionPlatform", () => {
  it("accepts IRISS aliases", () => {
    expect(resolveAuctionPlatform("openline")).toBe("openlane");
    expect(resolveAuctionPlatform("mobile.de")).toBe("mobile_de");
    expect(resolveAuctionPlatform("ET")).toBe("ecarstrade");
    expect(resolveAuctionPlatform("CarOnSale")).toBe("caronsale");
    expect(resolveAuctionPlatform("")).toBeUndefined();
    expect(resolveAuctionPlatform("ss.lv")).toBeUndefined();
  });
});

describe("confirmed numeric auction codes", () => {
  it("covers every code already stored in the listing maps", () => {
    const rows = confirmedNumericCodes();
    const codes = (platform: string, field: string) =>
      rows.filter((row) => row.platform === platform && row.field === field).map((row) => row.code).sort();
    expect(codes("openlane", "fuel")).toEqual(Object.keys(OPENLANE_FUEL_ID_TO_NAME).sort());
    expect(codes("autobid", "fuel")).toEqual(Object.keys(AUTOBID_FUEL_ID_TO_NAME).sort());
    expect(codes("autobid", "gearbox")).toEqual(Object.keys(AUTOBID_GEARBOX_ID_TO_NAME).sort());
    expect(codes("autobid", "body")).toEqual(Object.keys(AUTOBID_BODY_ID_TO_NAME).sort());
  });

  it("normalizes each confirmed code to its group and never marks it TODO", () => {
    for (const row of confirmedNumericCodes()) {
      const norm =
        row.field === "fuel"
          ? normalizeFuel(row.code, row.platform)
          : row.field === "gearbox"
            ? normalizeGearbox(row.code, row.platform)
            : normalizeBody(row.code, row.platform);
      expect(norm.group, `${row.platform} ${row.field} ${row.code}`).toBe(row.group);
      expect(norm.todo, row.code).toBeUndefined();
      expect(norm.confidence === "high" || norm.confidence === "medium").toBe(true);
    }
  });

  it("is listed in the Latvian taxonomy doc", () => {
    const doc = readFileSync("docs/iriss-criteria-taxonomy.md", "utf8");
    for (const row of confirmedNumericCodes()) {
      expect(doc, row.code).toContain(row.code);
    }
    expect(doc).toContain("100001");
    expect(doc).toContain("100003");
    expect(doc).toContain("100013");
  });
});

describe("normalizeFuel", () => {
  it.each([
    ["Benzin", "petrol"],
    ["benzīns", "petrol"],
    ["Benzine", "petrol"],
    ["Essence", "petrol"],
    ["Gasoline", "petrol"],
    ["Diesel", "diesel"],
    ["dīzelis", "diesel"],
    ["Gazole", "diesel"],
    ["Gasoil", "diesel"],
    ["Elektro", "electric"],
    ["électrique", "electric"],
    ["elektrisch", "electric"],
    ["Autogas", "gas"],
    ["Erdgas", "gas"],
    ["aardgas", "gas"],
    ["LPG", "gas"],
    ["GPL", "gas"],
    ["CNG", "gas"],
    ["Wasserstoff", "hydrogen"],
    ["fuel cell", "hydrogen"],
  ] as const)("maps %s to %s", (raw, group) => {
    const hit = normalizeFuel(raw);
    expect(hit.group).toBe(group);
    expect(hit.todo).toBeUndefined();
  });

  it("splits hybrid subs without guessing a bare hybrid", () => {
    expect(normalizeFuel("Hybrid (Benzin/Elektro)")).toMatchObject({ group: "hybrid", confidence: "high" });
    expect(normalizeFuel("Hybrid (Benzin/Elektro)").sub).toBeUndefined();
    expect(normalizeFuel("Plug-in-Hybrid")).toMatchObject({ group: "hybrid", sub: "phev" });
    expect(normalizeFuel("PHEV")).toMatchObject({ group: "hybrid", sub: "phev" });
    expect(normalizeFuel("Mild-Hybrid")).toMatchObject({ group: "hybrid", sub: "mhev" });
    expect(normalizeFuel("MHEV 48V")).toMatchObject({ group: "hybrid", sub: "mhev" });
    expect(normalizeFuel("e-Hybrid")).toMatchObject({ group: "hybrid", sub: "phev", confidence: "medium" });
    expect(normalizeFuel("HEV")).toMatchObject({ group: "hybrid", sub: "full_hev" });
    expect(normalizeFuel("Vollhybrid")).toMatchObject({ group: "hybrid", sub: "full_hev" });
    expect(normalizeFuel("Hybrid (Diesel/Elektro)")).toMatchObject({ group: "hybrid", sub: "diesel_hybrid" });
    expect(normalizeFuel("diesel hybrid")).toMatchObject({ group: "hybrid", sub: "diesel_hybrid" });
  });

  it("maps electric subs and copart gas", () => {
    expect(normalizeFuel("BEV")).toMatchObject({ group: "electric", sub: "bev" });
    expect(normalizeFuel("EREV")).toMatchObject({ group: "electric", sub: "erev" });
    expect(normalizeFuel("range extender")).toMatchObject({ group: "electric", sub: "erev" });
    expect(normalizeFuel("GAS", "copart")).toMatchObject({ group: "petrol", confidence: "high" });
    expect(normalizeFuel("GAS").group).toBeNull();
    expect(normalizeFuel("GAS").todo).toMatch(/^TODO/);
  });

  it("maps ET fuel labels", () => {
    for (const [label, expected] of Object.entries(ECARSTRADE_FUEL_TO_GROUP)) {
      const hit = normalizeFuel(label, "ecarstrade");
      expect(hit.group, label).toBe(expected.group);
      expect(hit.sub, label).toBe(expected.sub);
    }
  });

  it("does not guess unknown numeric fuel codes", () => {
    expect(normalizeFuel("100099", "openlane")).toMatchObject({ group: null });
    expect(normalizeFuel("100099", "openlane").todo).toMatch(/^TODO/);
    expect(normalizeFuel("100002", "openlane").group).toBeNull();
    expect(normalizeFuel("9", "autobid").group).toBeNull();
    expect(normalizeFuel("9", "autobid").todo).toMatch(/e17/);
    expect(normalizeFuel("2").group).toBeNull();
    expect(normalizeFuel("2").todo).toMatch(/^TODO/);
    expect(normalizeFuel("100001").group).toBe("petrol");
    expect(normalizeFuel("ūdensdzinējs").group).toBeNull();
    expect(normalizeFuel("ūdensdzinējs").todo).toBeUndefined();
  });

  it("keeps autobid hybrid ids without a guessed sub", () => {
    for (const code of ["6", "12", "14"]) {
      const hit = normalizeFuel(code, "autobid");
      expect(hit.group).toBe("hybrid");
      expect(hit.sub).toBeUndefined();
      expect(hit.note).toMatch(/HEV/);
    }
    expect(normalizeFuel("2", "autobid").group).toBe("petrol");
    expect(normalizeFuel("3", "autobid").group).toBe("diesel");
    expect(normalizeFuel("100003", "openlane").group).toBe("diesel");
    expect(normalizeFuel("100013", "openlane").sub).toBeUndefined();
  });
});

describe("normalizeGearbox", () => {
  it.each([
    ["Schaltgetriebe", "manual", undefined],
    ["manuell", "manual", undefined],
    ["mehāniskā", "manual", undefined],
    ["Automatik", "automatic", undefined],
    ["Steptronic", "automatic", "torque_converter"],
    ["Tiptronic", "automatic", "torque_converter"],
    ["Geartronic", "automatic", "torque_converter"],
    ["7G-TRONIC", "automatic", "torque_converter"],
    ["9G-TRONIC", "automatic", "torque_converter"],
    ["DSG", "automatic", "dsg_dct"],
    ["DCT", "automatic", "dsg_dct"],
    ["PDK", "automatic", "dsg_dct"],
    ["S tronic", "automatic", "dsg_dct"],
    ["S-tronic", "automatic", "dsg_dct"],
    ["EDC", "automatic", "dsg_dct"],
    ["Powershift", "automatic", "dsg_dct"],
    ["CVT", "automatic", "cvt"],
    ["e-CVT", "automatic", "cvt"],
    ["Multitronic", "automatic", "cvt"],
    ["ASG", "automatic", "amt"],
    ["robotised", "automatic", "amt"],
    ["robotized", "automatic", "amt"],
    ["single-speed", "automatic", "single_speed_ev"],
  ] as const)("maps %s", (raw, group, sub) => {
    const hit = normalizeGearbox(raw);
    expect(hit.group).toBe(group);
    expect(hit.sub).toBe(sub);
    expect(hit.todo).toBeUndefined();
  });

  it("maps autobid e70 and refuses unknown ids", () => {
    expect(normalizeGearbox("1", "autobid").group).toBe("manual");
    expect(normalizeGearbox("3", "autobid")).toMatchObject({ group: "automatic" });
    expect(normalizeGearbox("3", "autobid").sub).toBeUndefined();
    expect(normalizeGearbox("4", "autobid").group).toBe("automatic");
    expect(normalizeGearbox("2", "autobid").group).toBeNull();
    expect(normalizeGearbox("2", "autobid").todo).toMatch(/^TODO/);
    expect(normalizeGearbox("1").todo).toMatch(/^TODO/);
  });

  it("does not invent a mobile.de semi-automatic sub", () => {
    const hit = normalizeGearbox("SEMIAUTOMATIC_GEAR", "mobile_de");
    expect(hit.group).toBe("automatic");
    expect(hit.sub).toBeUndefined();
    expect(hit.confidence).toBe("medium");
    expect(normalizeGearbox("AUTOMATIC_GEAR", "mobile.de").group).toBe("automatic");
    expect(normalizeGearbox("MANUAL_GEAR", "mobile").group).toBe("manual");
  });
});

describe("normalizeBody", () => {
  it.each([
    ["sedan", "sedan"],
    ["Saloon", "sedan"],
    ["Limousine", "sedan"],
    ["LIMO", "sedan"],
    ["berline", "sedan"],
    ["wagon", "wagon"],
    ["Estate", "wagon"],
    ["COMBI", "wagon"],
    ["break", "wagon"],
    ["Kombi", "wagon"],
    ["hatchback", "hatchback"],
    ["Schrägheck", "hatchback"],
    ["SUV", "suv"],
    ["crossover", "suv"],
    ["coupe", "coupe"],
    ["coupé", "coupe"],
    ["cabrio", "cabrio"],
    ["Convertible", "cabrio"],
    ["mpv", "mpv"],
    ["minivan", "mpv"],
    ["van", "van_bus"],
    ["Minibus", "van_bus"],
    ["Transporter", "van_bus"],
    ["pickup", "pickup"],
    ["pick-up", "pickup"],
  ] as const)("maps %s to %s", (raw, group) => {
    expect(normalizeBody(raw).group).toBe(group);
  });

  it("maps autobid body ids and leaves unknown ids empty", () => {
    expect(normalizeBody("6", "autobid").group).toBe("sedan");
    expect(normalizeBody("1;17", "autobid").group).toBe("wagon");
    expect(normalizeBody("8", "autobid").group).toBe("van_bus");
    expect(normalizeBody("10", "autobid").group).toBe("van_bus");
    expect(normalizeBody("56", "autobid").group).toBe("van_bus");
    expect(normalizeBody("1", "autobid").group).toBeNull();
    expect(normalizeBody("1", "autobid").todo).toMatch(/PKW/);
    expect(normalizeBody("99", "autobid").group).toBeNull();
    expect(normalizeBody("99", "autobid").todo).toMatch(/^TODO/);
    expect(normalizeBody("4", "bca").group).toBeNull();
    expect(normalizeBody("4", "caronsale").todo).toMatch(/^TODO/);
  });

  it("keeps the ET suv bucket on suv and does not pretend it is only a pickup", () => {
    const hit = normalizeBody("SUV/Off-road Vehicle/Pickup Truck", "ecarstrade");
    expect(hit.group).toBe("suv");
    expect(hit.confidence).toBe("medium");
    expect(hit.note).toMatch(/pickup/);
  });
});

describe("normalizeDrive and emission and power", () => {
  it.each([
    ["fwd", "fwd"],
    ["front", "fwd"],
    ["priekšējā", "fwd"],
    ["rwd", "rwd"],
    ["rear", "rwd"],
    ["awd", "awd"],
    ["AWD", "awd"],
    ["4x4", "awd"],
    ["xDrive", "awd"],
    ["4MATIC", "awd"],
    ["quattro", "awd"],
    ["4Motion", "awd"],
    ["ALL4", "awd"],
    ["ALL_WHEEL", "awd"],
  ] as const)("maps drive %s", (raw, group) => {
    expect(normalizeDrive(raw).group).toBe(group);
    expect(normalizeDrive(raw).todo).toBeUndefined();
  });

  it("does not guess an unknown drive code", () => {
    expect(normalizeDrive("99", "copart").group).toBeNull();
    expect(normalizeDrive("99", "copart").todo).toMatch(/^TODO/);
    expect(normalizeDrive("").group).toBeNull();
  });

  it("reuses ET emission classes and kW parsing", () => {
    expect(normalizeEmission("Euro 6d").group).toBe("Euro6d");
    expect(normalizeEmission("Euro 6d-TEMP").group).toBe("Euro6d-TEMP");
    expect(normalizeEmission("Euro 9").group).toBeNull();
    expect(normalizeEmission("Euro 9").todo).toMatch(/^TODO/);
    expect(normalizePowerKw("140 kW")).toEqual({ from: 140, to: 140 });
    expect(normalizePowerKw("100-130 kW")).toEqual({ from: 100, to: 130 });
    expect(normalizePowerKw("150 ZS").from).toBe(110);
  });
});
