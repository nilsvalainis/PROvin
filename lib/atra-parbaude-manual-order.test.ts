import { describe, expect, it } from "vitest";
import type { WorkspaceSourceBlocks } from "@/lib/admin-source-blocks";
import {
  ATRA_MANUAL_ORDER_ORIGIN,
  buildAtraManualOrderBody,
  buildAtraManualOrderSeed,
  parseAtraManualOrderBody,
} from "@/lib/atra-parbaude-manual-order";
import { emptyCsddTechData, type CsddTechData } from "@/lib/csdd-tech-data";
import type { DealerCheckRecord } from "@/lib/dealer-check";
import { buildDealerCheckManualOrderBody } from "@/lib/dealer-check-manual-order";
import type { OneautoDisplaySections } from "@/lib/oneauto-catalog";

const VIN = "WBA8A71070K896936";

function csdd(): CsddTechData {
  return { ...emptyCsddTechData(), registrationNumber: "LR4521", vin: VIN, make: "BMW", model: "320d", year: "2016", inspectionValidUntilIso: "2027-05-14" };
}

function display(): OneautoDisplaySections {
  return {
    equipment: [],
    powertrain: [{ label: "make", value: "BMW" }],
    serviceTimeline: [{ date: "18.10.2024", odometer: "203900", place: "LV · Rīga", works: "Eļļas serviss" }],
  };
}

function record(): DealerCheckRecord {
  return {
    id: "dc-test-record-1",
    vin: VIN,
    plate: "LR-4521",
    template: "dzintarzeme",
    selectedProducts: ["oe_service_history"],
    results: { oe_service_history: { ok: true, payload: { events: [] }, httpStatus: 200 } },
    display: display(),
    displayOriginal: display(),
    vehicle: { make: "BMW", model: "320d", body: "", engine: "", firstReg: "", color: "", gearbox: "", manufacturer: "", vin: VIN },
    mileageRows: [],
    serviceRows: [],
    comments: { serviceHistory: "Dīlera serviss 2024.", oilIntervals: "" },
    csdd: null,
    chargedCents: 300,
    quotedCents: 300,
    fetchedAt: "2026-11-23T08:14:00.000Z",
    monthKey: "2026-11",
    autoparks: null,
    saved: false,
    createdAt: "2026-11-23T08:14:00.000Z",
    updatedAt: "2026-11-23T08:14:00.000Z",
  } as DealerCheckRecord;
}

const vinScan = {
  vin: VIN,
  plate: "LR4521",
  csdd: csdd(),
  sources: [{ id: "csdd", label: "CSDD", country: "LV", status: "found", summary: "BMW 320d", openUrl: "", mileage: [] }],
};

describe("Ātrā pārbaude → viens manuālais pasūtījums", () => {
  it("VIN SCAN + dīlera dati + Speckr vienā sēklā", () => {
    const body = buildAtraManualOrderBody({
      vinScan,
      dealer: buildDealerCheckManualOrderBody({ vin: VIN, plate: "LR4521", csdd: csdd(), record: record() }),
      speckr: { vin: VIN, fetchedAt: "2026-11-23T08:15:00.000Z", result: { outcome: "ok", summary: "Spec", lines: [{ label: "Dzinējs", value: "B47" }] } },
    });
    expect(body.origin).toBe(ATRA_MANUAL_ORDER_ORIGIN);
    const parsed = parseAtraManualOrderBody(JSON.parse(JSON.stringify(body)));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.input.dealer?.checkId).toBe("dc-test-record-1");
    const seed = buildAtraManualOrderSeed(parsed.input);
    const blocks = seed.workspace.sourceBlocks as WorkspaceSourceBlocks;
    expect(seed.orderEdits.vin).toBe(VIN);
    expect(blocks.csdd.vin).toBe(VIN);
    expect(blocks.auto_records.oneautoIngest?.lastFetchedVin).toBe(VIN);
    expect(blocks.auto_records.speckrSnapshot?.result.lines[0]?.value).toBe("B47");
  });

  it("bez dīlera datiem - tikai VIN SCAN; cita VIN dīlera dati netiek jaukti", () => {
    const other = buildDealerCheckManualOrderBody({ vin: "WVWZZZ3CZEE000001", plate: "", csdd: null, record: { ...record(), vin: "WVWZZZ3CZEE000001" } });
    const parsed = parseAtraManualOrderBody(buildAtraManualOrderBody({ vinScan, dealer: other }));
    expect(parsed.ok && parsed.input.dealer).toBe(null);
    expect(parseAtraManualOrderBody({ origin: ATRA_MANUAL_ORDER_ORIGIN, vinScan: { vin: "x" } }).ok).toBe(false);
  });
});
