/**
 * 24.11.2026 - piedziņa no bezmaksas, VIN-specifiskiem pierādījumiem, kas jau ir pasūtījuma datos
 * (pārbaude uz 7 pilnpiedziņas pasūtījumiem: #1183 loģika deva tikai kataloga mājienu).
 * Visi dati izdomāti (VIN, modeļi, servisa rindas) - bez klientu datiem.
 * 1) Kārbas rūpnīcas kods ar piedziņu (Outvin / OneAuto, Audi „G1G ... for four-wheel drive vehicle”).
 * 2) CSDD modelis „XDRIVE” / „4MATIC” / „QUATTRO” ...
 * 3) BMW servisa detaļa grupā 31 60 (priekšējā pusass).
 */
import { describe, expect, it } from "vitest";

import { mergeSourceBlocksWithDefaults, type WorkspaceSourceBlocks } from "@/lib/admin-source-blocks";
import { buildCanonicalFacts } from "@/lib/canonical-facts-sheet";
import { emptyOutvinVehicleInfo, type OutvinVehicleInfo } from "@/lib/outvin-dealer-types";
import {
  BMW_FRONT_AXLE_PART_LABEL,
  collectDrivetrainEvidence,
  CSDD_MODEL_DRIVETRAIN_LABEL,
  csddModelClaimsAwd,
  drivetrainFromTransmissionCode,
  extractVehicleDrivetrain,
  findDrivetrainContradictions,
  resolveVehicleDrivetrain,
  TRANSMISSION_CODE_DEALER_LABEL,
  TRANSMISSION_CODE_ONEAUTO_LABEL,
} from "@/lib/registry-drivetrain";
import { checkSourceConsistency } from "@/lib/source-consistency";

const NOW = Date.UTC(2026, 10, 24);
const VIN = "TESTVIN0000000001";

type Patch = {
  vi?: Partial<OutvinVehicleInfo>;
  oneautoResults?: Record<string, unknown>;
  csddMakeModel?: string;
  csddRegistry?: { make?: string; model?: string; vin?: string };
  works?: string[];
  carverticalRaw?: string;
  tjekbilRaw?: string;
};

/** Melnraksta bloki ar izdomātiem datiem (lauki ielikti tieši, kā saglabātā melnrakstā). */
function blocks(p: Patch): WorkspaceSourceBlocks {
  const b = mergeSourceBlocksWithDefaults(
    p.carverticalRaw ? ({ carvertical: { serviceHistory: [], aiContextRaw: p.carverticalRaw } } as unknown) : ({} as unknown),
  );
  if (p.vi) {
    b.auto_records = {
      ...b.auto_records,
      outvinReport: { vehicleInfo: { ...emptyOutvinVehicleInfo(), ...p.vi }, equipment: [], accidentCheck: "", stolenCheck: "" },
    };
  }
  if (p.oneautoResults) b.auto_records = { ...b.auto_records, oneautoIngest: { results: p.oneautoResults } as never };
  if (p.works) {
    b.auto_records = {
      ...b.auto_records,
      serviceWorks: p.works.map((works, i) => ({ date: `0${i + 1}.03.2018`, odometer: "", location: "", works })),
    };
  }
  if (p.csddMakeModel != null) b.csdd = { ...b.csdd, makeModel: p.csddMakeModel };
  if (p.csddRegistry) {
    b.csdd = {
      ...b.csdd,
      registry: { nr1: "", fetchedAt: "", data: { make: "", model: "", vin: "", ...p.csddRegistry } } as never,
    };
  }
  if (p.tjekbilRaw) b.tjekbil = { ...b.tjekbil, rawUnprocessedData: p.tjekbilRaw };
  return b;
}

describe("1. kārbas rūpnīcas kods ar piedziņu", () => {
  it("rindu lasītājs: tikai ar rūpnīcas kodu un viennozīmīgu formulējumu", () => {
    expect(drivetrainFromTransmissionCode("G1G: 8-speed automatic transmission for four-wheel drive vehicle")).toBe(true);
    expect(drivetrainFromTransmissionCode("RHU (G1G : 8-speed automatic transmission for four-wheel drive vehicle)")).toBe(true);
    expect(drivetrainFromTransmissionCode("8-speed automatic transmission for four-wheel drive (G1G)")).toBe(true);
    expect(drivetrainFromTransmissionCode("G0K: 7-speed dual clutch transmission for front-wheel drive")).toBe(false);
    // Bez koda - var būt kataloga tips.
    expect(drivetrainFromTransmissionCode("8-speed automatic transmission for four-wheel drive vehicle")).toBe(null);
    expect(drivetrainFromTransmissionCode("Automatic (AWD)")).toBe(null);
    expect(drivetrainFromTransmissionCode("automatic")).toBe(null);
    // Kods bez piedziņas vai abi varianti.
    expect(drivetrainFromTransmissionCode("PUZ (G1D : 7-speed automatic transmission)")).toBe(null);
    expect(drivetrainFromTransmissionCode("G1X: 6-speed manual for 2WD/4WD")).toBe(null);
    expect(drivetrainFromTransmissionCode("G1X: gearbox for front-wheel drive and four-wheel drive")).toBe(null);
  });

  it("Outvin kārbas kods AWD - rūpnīcas kodu līmenis, katalogs vairs nav tikai mājiens", () => {
    const b = blocks({
      vi: { transmission: "G1G: 8-speed automatic transmission for four-wheel drive vehicle", drive: "All-wheel Drive" },
    });
    const res = resolveVehicleDrivetrain(b);
    expect(res.tier).toBe("factory_codes");
    expect(res.drivetrain).toMatchObject({ awd: true, sourceLabel: TRANSMISSION_CODE_DEALER_LABEL });
    expect(res.catalogHint).toBeNull();
    const facts = buildCanonicalFacts({ sourceBlocks: b, vin: VIN });
    expect(facts.sheet).toContain(`Piedziņa (avots ${TRANSMISSION_CODE_DEALER_LABEL}, prioritāte`);
    expect(facts.sheet).toMatch(/: pilnpiedziņa \(2 dzenošās asis\)/);
    expect(facts.sheet).not.toMatch(/nav apstiprināta/);
  });

  it("OneAuto VIN Lookup kārbas kods AWD uzvar tā paša kataloga FWD (info, ne brīdinājums)", () => {
    const b = blocks({
      oneautoResults: {
        oe_vin_lookup: {
          payload: {
            result: {
              oem_drivetrain_desc: "Front-Wheel Drive",
              oem_transmission_type_desc: "RHU (G1G : 8-speed automatic transmission for four-wheel drive vehicle)",
            },
          },
        },
      },
    });
    const res = resolveVehicleDrivetrain(b);
    expect(res.drivetrain).toMatchObject({ awd: true, sourceLabel: TRANSMISSION_CODE_ONEAUTO_LABEL });
    expect(res.conflictOnlyCatalog).toBe(true);
    const dt = checkSourceConsistency({ sourceBlocks: b, nowMs: NOW }).find((i) => i.kind === "drivetrain");
    expect(dt?.severity).toBe("info");
    expect(dt!.values.map((v) => `${v.source}=${v.value}`)).toContain(`${TRANSMISSION_CODE_ONEAUTO_LABEL}=pilnpiedziņa`);
  });

  it("kārbas kods FWD uzvar specifikāciju AWD; AI pilnpiedziņas apgalvojums - kritiska pretruna", () => {
    const b = blocks({
      vi: { transmission: "G0K: 7-speed dual clutch transmission for front-wheel drive" },
      carverticalRaw: "Piedziņas tips\nPilnpiedziņa",
    });
    const res = resolveVehicleDrivetrain(b);
    expect(res.tier).toBe("factory_codes");
    expect(res.drivetrain).toMatchObject({ awd: false, sourceLabel: TRANSMISSION_CODE_DEALER_LABEL });
    expect(res.conflict).toBe(true);
    expect(findDrivetrainContradictions("Auto ar quattro pilnpiedziņu.", res.drivetrain)).toHaveLength(1);
    const issues = checkSourceConsistency({
      sourceBlocks: b,
      texts: [{ label: "Risku analīze", text: "Auto ar quattro pilnpiedziņu." }],
      nowMs: NOW,
    });
    expect(issues.find((i) => i.kind === "ai_drivetrain")?.severity).toBe("critical");
    expect(issues.find((i) => i.kind === "drivetrain")?.severity).toBe("warn");
  });

  it("kārbas kods AWD pret rūpnīcas opciju kodu FWD (vienāds līmenis) - null + pretruna", () => {
    const b = blocks({
      vi: { transmission: "G1G: 8-speed automatic transmission for four-wheel drive vehicle" },
      carverticalRaw: "1X0Front-wheel drive1Z9Initial standard fuel filling",
    });
    const res = resolveVehicleDrivetrain(b);
    expect(res.drivetrain).toBeNull();
    expect(res.conflict).toBe(true);
    const dt = checkSourceConsistency({ sourceBlocks: b, nowMs: NOW }).find((i) => i.kind === "drivetrain");
    expect(dt?.severity).toBe("warn");
    expect(dt?.title).toMatch(/nav noteikta/);
  });
});

describe("2. CSDD modelis ar pilnpiedziņas marķieri", () => {
  it("marķieri un nepatiesi trāpījumi", () => {
    for (const m of ["BMW 530D XDRIVE", "BMW X5 XDRIVE40D", "MERCEDES-BENZ ML 350 4MATIC", "MERCEDES-BENZ GLC 300 4-MATIC", "AUDI A4 ALLROAD QUATTRO", "VOLKSWAGEN PASSAT 4MOTION", "MINI COUNTRYMAN COOPER S ALL4", "SUZUKI JIMNY 4X4", "VOLVO XC60 AWD"]) {
      expect(csddModelClaimsAwd(m), m).toBe(true);
    }
    for (const m of ["BMW X1 SDRIVE18D", "BMW 530", "MASERATI QUATTROPORTE", "AUDI A4", "BMW 320D", "TOYOTA 4X2 HILUX", "MERCEDES-BENZ E 220 D", ""]) {
      expect(csddModelClaimsAwd(m), m).toBe(false);
    }
  });

  it("CSDD «530D XDRIVE» + Outvin katalogs AWD - specifikācijas līmenis, piedziņa noteikta", () => {
    const b = blocks({ csddMakeModel: "BMW 530D XDRIVE", vi: { drive: "All-wheel Drive" } });
    const res = resolveVehicleDrivetrain(b);
    expect(res.tier).toBe("vendor_spec");
    expect(res.drivetrain).toMatchObject({ awd: true, sourceLabel: CSDD_MODEL_DRIVETRAIN_LABEL });
    expect(res.catalogHint).toBeNull();
    expect(extractVehicleDrivetrain(b)?.awd).toBe(true);
    const facts = buildCanonicalFacts({ sourceBlocks: b, vin: VIN });
    expect(facts.sheet).toContain(`Piedziņa (avots ${CSDD_MODEL_DRIVETRAIN_LABEL}, prioritāte`);
  });

  it("CSDD API modelis «ML 350 4MATIC» (registry.data.model)", () => {
    const b = blocks({ csddRegistry: { make: "MERCEDES-BENZ", model: "ML 350 4MATIC" } });
    expect(resolveVehicleDrivetrain(b).drivetrain).toMatchObject({ awd: true, sourceLabel: CSDD_MODEL_DRIVETRAIN_LABEL });
  });

  it("CSDD bez marķiera - nav pierādījuma (tikai kataloga mājiens)", () => {
    const b = blocks({ csddMakeModel: "BMW X1 SDRIVE18D", vi: { drive: "All-wheel Drive" } });
    const res = resolveVehicleDrivetrain(b);
    expect(collectDrivetrainEvidence(b).some((e) => e.source === CSDD_MODEL_DRIVETRAIN_LABEL)).toBe(false);
    expect(res.drivetrain).toBeNull();
    expect(res.catalogHint).toMatchObject({ awd: true });
  });

  it("CSDD «4MATIC» pret specifikāciju «aizmugurējo riteņu piedziņa» (vienāds līmenis) - null + brīdinājums", () => {
    const b = blocks({ csddMakeModel: "MERCEDES-BENZ E 300 DE 4MATIC", carverticalRaw: "Piedziņas tips\nAizmugurējo riteņu piedziņa" });
    const res = resolveVehicleDrivetrain(b);
    expect(res.drivetrain).toBeNull();
    expect(res.conflict).toBe(true);
    expect(checkSourceConsistency({ sourceBlocks: b, nowMs: NOW }).find((i) => i.kind === "drivetrain")?.severity).toBe("warn");
  });

  it("CSDD «4MATIC» pret oficiālo reģistru (DMR aizmugurējo riteņu) - reģistrs uzvar", () => {
    const b = blocks({ csddMakeModel: "MERCEDES-BENZ E 300 DE 4MATIC", tjekbilRaw: '{"traekhjul": "Baghjulstrukket"}' });
    const res = resolveVehicleDrivetrain(b);
    expect(res.tier).toBe("registry");
    expect(res.drivetrain).toMatchObject({ awd: false });
    expect(res.conflict).toBe(true);
  });
});

describe("3. BMW servisa detaļa 31 60 (priekšējā pusass)", () => {
  const BELLOWS = "Repair kit bellows, exterior (31607606091).";

  it("garenisks BMW ar 31 60 detaļu - pilnpiedziņa (specifikācijas līmenis)", () => {
    const b = blocks({ csddMakeModel: "BMW 530", works: ["Engine oil service.", BELLOWS] });
    const res = resolveVehicleDrivetrain(b);
    expect(res.tier).toBe("vendor_spec");
    expect(res.drivetrain).toMatchObject({ awd: true, sourceLabel: BMW_FRONT_AXLE_PART_LABEL });
    expect(res.evidence.find((e) => e.source === BMW_FRONT_AXLE_PART_LABEL)?.detail).toBe("31607606091");
  });

  it("numurs ar atstarpēm; marka tikai no VIN, modelis no dīlera datiem", () => {
    const b = blocks({
      vi: { vinCode: "WBA00000000000001", model: "530d Touring", developmentCode: "F11" },
      works: ["Ersatzteil 31 60 7 606 091 Faltenbalg"],
    });
    expect(resolveVehicleDrivetrain(b).drivetrain).toMatchObject({ awd: true, sourceLabel: BMW_FRONT_AXLE_PART_LABEL });
  });

  it("nav pierādījuma: šķērseniskie BMW / MINI, nezināms modelis, cita marka, cits numurs", () => {
    const none = (p: Patch) => collectDrivetrainEvidence(blocks(p)).filter((e) => e.source === BMW_FRONT_AXLE_PART_LABEL);
    expect(none({ csddMakeModel: "BMW X1", works: [BELLOWS] })).toEqual([]);
    expect(none({ csddMakeModel: "BMW 218I ACTIVE TOURER", works: [BELLOWS] })).toEqual([]);
    expect(none({ csddMakeModel: "BMW 118D", works: [BELLOWS] })).toEqual([]);
    expect(none({ csddMakeModel: "MINI COOPER", works: [BELLOWS] })).toEqual([]);
    expect(none({ vi: { vinCode: "WMW00000000000001", model: "Cooper" }, works: [BELLOWS] })).toEqual([]);
    expect(none({ csddMakeModel: "BMW", works: [BELLOWS] })).toEqual([]);
    expect(none({ csddMakeModel: "AUDI A6", works: [BELLOWS] })).toEqual([]);
    expect(none({ csddMakeModel: "BMW 530", works: ["Part 316076060912 replaced"] })).toEqual([]);
    expect(none({ csddMakeModel: "BMW 530", works: ["Part 31617606091 replaced", "Order 9931607606091"] })).toEqual([]);
    // Garenisks 1. sērijas F20 ar izstrādes kodu - atļauts.
    expect(none({ vi: { vinCode: "WBA00000000000001", model: "118d", developmentCode: "F20" }, works: [BELLOWS] })).toHaveLength(1);
  });

  it("detaļa pret specifikāciju «aizmugurējo riteņu piedziņa» - null; pret DMR viena ass - reģistrs uzvar", () => {
    const spec = blocks({ csddMakeModel: "BMW 530", works: [BELLOWS], carverticalRaw: "Piedziņas tips\nAizmugurējo riteņu piedziņa" });
    expect(resolveVehicleDrivetrain(spec).drivetrain).toBeNull();
    expect(resolveVehicleDrivetrain(spec).conflict).toBe(true);
    const reg = blocks({ csddMakeModel: "BMW 530", works: [BELLOWS], tjekbilRaw: '{"traekhjul": "Baghjulstrukket"}' });
    expect(resolveVehicleDrivetrain(reg).drivetrain).toMatchObject({ awd: false });
  });
});
