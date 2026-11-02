import { describe, expect, it } from "vitest";
import { hydrateWorkspaceFromStorage } from "@/lib/admin-source-blocks";
import { emptyCsddTechData, type CsddTechData } from "@/lib/csdd-tech-data";
import type { DealerCheckRecord } from "@/lib/dealer-check";
import { decideAdminApiAccess, type AccessActor } from "@/lib/staff-roles";
import {
  buildDealerCheckManualOrderBody,
  buildDealerCheckManualOrderSeed,
  DEALER_CHECK_MANUAL_ORDER_ORIGIN,
  dealerCheckManualOrderCanCreate,
  parseDealerCheckManualOrderBody,
} from "@/lib/dealer-check-manual-order";
import type { OneautoDisplaySections } from "@/lib/oneauto-catalog";

const VIN = "WBA8A71070K896936";

function sampleCsdd(): CsddTechData {
  return {
    ...emptyCsddTechData(),
    registrationNumber: "LR4521",
    vin: VIN,
    make: "BMW",
    model: "320d",
    year: "2016",
    fuel: "Dīzeļdegviela",
    powerKw: "140",
    displacementCm3: "1995",
    firstRegistrationIso: "2016-03-12",
    color: "Pelēka",
    vehicleKind: "Vieglais plašlietojuma",
    cocCategory: "M1",
    cocType: "3T",
    cocApprovalNumber: "e1*2007/46*0317*20",
    grossMassKg: "2000",
    curbMassKg: "1500",
    insuranceEndIso: "2026-12-01",
    inspectionValidUntilIso: "2027-05-14",
  };
}

function displayWithService(): OneautoDisplaySections {
  return {
    equipment: [{ label: "S1CAA", value: "Sporta stūre" }],
    powertrain: [
      { label: "make", value: "BMW" },
      { label: "model", value: "320d" },
      { label: "body", value: "Sedans" },
      { label: "fuel", value: "dīzelis" },
      { label: "transmission", value: "Automātiskā" },
      { label: "firstRegistration", value: "2016-03-12" },
    ],
    serviceTimeline: [
      { date: "18.10.2024", odometer: "203900", place: "LV · Rīga", works: "Eļļas serviss" },
    ],
  };
}

function record(patch: Partial<DealerCheckRecord> = {}): DealerCheckRecord {
  const display = displayWithService();
  return {
    id: "dc-test-record-1",
    vin: VIN,
    plate: "LR-4521",
    template: "dzintarzeme",
    selectedProducts: ["vin_decoder", "oe_service_history"],
    results: {
      vin_decoder: { ok: true, payload: { make: "BMW", model: "320d" }, httpStatus: 200 },
      oe_service_history: {
        ok: true,
        payload: { events: [{ date: "2024-10-18", odometer: "203900", works: "Eļļas serviss" }] },
        httpStatus: 200,
      },
    },
    display,
    displayOriginal: display,
    vehicle: {
      make: "BMW",
      model: "320d",
      body: "Sedans",
      engine: "dīzelis",
      firstReg: "12.03.2016",
      color: "",
      gearbox: "Automātiskā",
      manufacturer: "BMW",
      vin: VIN,
    },
    mileageRows: [{ date: "18.10.2024", odometer: "203 900 km", source: "Dīlera serviss" }],
    serviceRows: [{ date: "18.10.2024", km: "203 900", works: "Eļļas serviss", dealer: "Rīga" }],
    comments: { serviceHistory: "Dīlera serviss 2024.", oilIntervals: "Eļļa 2024." },
    csdd: null,
    chargedCents: 18,
    quotedCents: 318,
    fetchedAt: "2026-11-01T16:41:00.000Z",
    monthKey: "2026-11",
    autoparks: { carId: "car-1", title: "BMW", stockPath: "/stock", dropboxFolderId: "dbx" },
    saved: true,
    createdAt: "2026-11-01T16:41:00.000Z",
    updatedAt: "2026-11-01T16:41:00.000Z",
    ...patch,
  };
}

describe("dīlera pārbaude → manuālā pasūtījuma lauki", () => {
  it("poga ieslēdzas tikai ar derīgu VIN un ielādētiem CSDD vai dīlera datiem", () => {
    expect(dealerCheckManualOrderCanCreate({ vin: "", plate: "", csdd: null, record: null })).toBe(false);
    expect(dealerCheckManualOrderCanCreate({ vin: VIN, plate: "", csdd: null, record: null })).toBe(false);
    expect(dealerCheckManualOrderCanCreate({ vin: "", plate: "LR-4521", csdd: null, record: null })).toBe(false);
    expect(
      dealerCheckManualOrderCanCreate({ vin: "NAV-VIN", plate: "LR-4521", csdd: sampleCsdd(), record: null }),
    ).toBe(false);
    expect(
      dealerCheckManualOrderCanCreate({ vin: VIN, plate: "LR-4521", csdd: sampleCsdd(), record: null }),
    ).toBe(true);
    expect(
      dealerCheckManualOrderCanCreate({ vin: VIN, plate: "LR-4521", csdd: null, record: record() }),
    ).toBe(true);
  });

  it("CSDD priekšskatījums aizpilda VIN, numurzīmi un reģistra laukus, bez klienta un Speckr", () => {
    const body = buildDealerCheckManualOrderBody({
      vin: VIN,
      plate: "LR-4521",
      csdd: sampleCsdd(),
      record: null,
    });
    expect(body.origin).toBe(DEALER_CHECK_MANUAL_ORDER_ORIGIN);
    const parsed = parseDealerCheckManualOrderBody(body);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const seed = buildDealerCheckManualOrderSeed(parsed.input);
    expect(seed.orderEdits.vin).toBe(VIN);
    expect(seed.orderEdits.licensePlate).toBe("LR4521");
    expect(seed.orderEdits.customerEmail).toBeUndefined();
    expect(seed.orderEdits.customerPhone).toBeUndefined();
    expect(seed.orderEdits.customerName).toBeUndefined();
    expect(seed.orderEdits.notes).toBeUndefined();
    expect(seed.orderEdits.internalComment).toBeUndefined();
    expect(parsed.input.checkId).toBeUndefined();
    expect(seed.orderEdits.listingUrl).toBeUndefined();
    const csdd = seed.workspace.sourceBlocks.csdd;
    expect(csdd.makeModel).toBe("BMW 320d");
    expect(csdd.vin).toBe(VIN);
    expect(csdd.modelYear).toBe("2016");
    expect(csdd.registrationNumber).toBe("LR4521");
    expect(csdd.enginePowerKw).toBe("140");
    expect(csdd.engineDisplacementCm3).toBe("1995");
    expect(csdd.fuelType).toBe("Dīzeļdegviela");
    expect(csdd.firstRegistration).toBe("2016-03-12");
    expect(csdd.nextInspectionDate).toBe("2027-05-14");
    expect(csdd.registry?.data.cocApprovalNumber).toBe("e1*2007/46*0317*20");
    expect(seed.workspace.sourceBlocks.auto_records.speckrSnapshot).toBeUndefined();
    expect(JSON.stringify(seed)).not.toMatch(/speckr/i);
    expect(seed.workspace.sourceBlocks.auto_records.oneautoIngest?.results.oe_service_history).toBeUndefined();

    const hydrated = hydrateWorkspaceFromStorage(JSON.stringify(seed.workspace));
    expect(hydrated?.sourceBlocks.csdd.makeModel).toBe("BMW 320d");
    expect(hydrated?.sourceBlocks.csdd.enginePowerKw).toBe("140");
  });

  it("OneAuto rezultāti, serviss un komentāri nonāk auto_records, HTTP 206 paliek bez jaunas maksas", () => {
    const loaded = record();
    const parsed = parseDealerCheckManualOrderBody(
      buildDealerCheckManualOrderBody({
        vin: VIN,
        plate: "lr-4521",
        csdd: sampleCsdd(),
        record: loaded,
        comments: { serviceHistory: "Labots komentārs.", oilIntervals: "Eļļa 2024." },
      }),
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.input.dealer?.comments.serviceHistory).toBe("Labots komentārs.");
    expect(parsed.input.checkId).toBe("dc-test-record-1");
    const seed = buildDealerCheckManualOrderSeed(parsed.input);
    expect(seed.orderEdits.internalComment).toBeUndefined();
    const auto = seed.workspace.sourceBlocks.auto_records;
    expect(auto.outvinReport?.vehicleInfo.model).toBe("BMW 320d");
    expect(auto.outvinReport?.vehicleInfo.transmission).toBe("automatic");
    expect(auto.outvinReport?.vehicleInfo.fuel).toBe("diesel");
    expect(auto.outvinReport?.vehicleInfo.body).toBe("Sedans");
    expect(auto.outvinReport?.vehicleInfo.vinCode).toBe(VIN);
    expect(auto.serviceWorks.some((row) => row.works.includes("Eļļas serviss"))).toBe(true);
    expect(auto.serviceHistoryNotes).toBe("Labots komentārs.");
    expect(auto.oilChangeIntervalNotes).toBe("Eļļa 2024.");
    expect(auto.oneautoIngest?.lastFetchedVin).toBe(VIN);
    expect(auto.oneautoIngest?.lastCostEur).toBe("0.18");
    expect(auto.oneautoIngest?.selectedProducts).toEqual(["vin_decoder", "oe_service_history"]);
    expect(auto.oneautoIngest?.results.oe_service_history).toMatchObject({
      ok: true,
      httpStatus: 200,
      payload: { events: [{ date: "2024-10-18", odometer: "203900", works: "Eļļas serviss" }] },
    });
    expect(auto.oneautoIngest?.results.vin_decoder?.payload).toMatchObject({ make: "BMW" });
    expect(JSON.stringify(seed)).not.toContain("car-1");
    expect(JSON.stringify(seed)).not.toMatch(/speckr/i);

    const http206 = record({
      display: { equipment: [], serviceTimeline: [], powertrain: [] },
      displayOriginal: { equipment: [], serviceTimeline: [], powertrain: [] },
      results: {
        oe_service_history: { ok: false, error: "http_206", httpStatus: 206, payload: { status: "no_data" } },
      },
      selectedProducts: ["oe_service_history"],
      chargedCents: 0,
      comments: { serviceHistory: "", oilIntervals: "" },
      mileageRows: [],
      serviceRows: [],
      vehicle: {
        make: "",
        model: "",
        body: "",
        engine: "",
        firstReg: "",
        color: "",
        gearbox: "",
        manufacturer: "",
        vin: VIN,
      },
    });
    const parsed206 = parseDealerCheckManualOrderBody(
      buildDealerCheckManualOrderBody({ vin: VIN, plate: "", csdd: null, record: http206 }),
    );
    expect(parsed206.ok).toBe(true);
    if (!parsed206.ok) return;
    const seed206 = buildDealerCheckManualOrderSeed(parsed206.input);
    expect(seed206.workspace.sourceBlocks.auto_records.oneautoIngest?.results.oe_service_history).toMatchObject({
      ok: false,
      error: "http_206",
      httpStatus: 206,
    });
    expect(seed206.workspace.sourceBlocks.auto_records.oneautoIngest?.lastCostEur).toBe("0.00");
  });

  it("bez VIN vai bez ielādētiem datiem API ķermeni noraida, darbiniekiem ceļš slēgts", () => {
    expect(parseDealerCheckManualOrderBody({ origin: DEALER_CHECK_MANUAL_ORDER_ORIGIN, vin: VIN }).ok).toBe(false);
    expect(parseDealerCheckManualOrderBody({ origin: DEALER_CHECK_MANUAL_ORDER_ORIGIN, vin: "ABC", csdd: sampleCsdd() })).toEqual({
      ok: false,
      error: "invalid_vin",
    });
    const staff: AccessActor = { kind: "staff", sections: ["pasutijumi", "vin"] };
    expect(decideAdminApiAccess("/api/admin/manual-orders", { kind: "admin" })).toBe("allow");
    expect(decideAdminApiAccess("/api/admin/manual-orders", staff)).toBe("forbidden");
  });
});
