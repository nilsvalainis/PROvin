import { describe, expect, it } from "vitest";
import { ADMIN_GOOGLE_ALLOWED_EMAIL } from "@/lib/admin-session-token";
import { emptyCsddTechData } from "@/lib/csdd-tech-data";
import type { DealerCheckRecord } from "@/lib/dealer-check";
import {
  DEALER_CHECK_LIST_DEFAULT_FILTER,
  DEALER_CHECK_OWNER_ID,
  dealerCheckCreatorId,
  dealerCheckListToCsv,
  dealerCheckLoadShouldPersist,
  filterDealerCheckList,
  parseDealerCheckCsddSnapshot,
  type DealerCheckHistoryEntry,
} from "@/lib/dealer-check-history";

const VIN = "WVWZZZ3CZKE012345";

function entry(patch: Partial<DealerCheckHistoryEntry> = {}): DealerCheckHistoryEntry {
  return {
    id: "dc-history-open-1",
    vin: VIN,
    plate: "LR-4521",
    template: "dzintarzeme",
    createdAt: "2026-11-02T10:00:00.000Z",
    fetchedAt: "2026-11-02T10:00:00.000Z",
    createdBy: DEALER_CHECK_OWNER_ID,
    status: "open",
    orderId: "",
    chargedCents: 18,
    hasData: true,
    autoparksTitle: "VW Passat",
    ...patch,
  };
}

function record(patch: Partial<DealerCheckRecord> = {}): DealerCheckRecord {
  return {
    id: "dc-history-open-1",
    vin: VIN,
    plate: "LR-4521",
    template: "dzintarzeme",
    selectedProducts: ["vin_decoder"],
    results: { vin_decoder: { ok: true, payload: { success: true, make: "VW" }, httpStatus: 200 } },
    display: { equipment: [], serviceTimeline: [], powertrain: [] },
    displayOriginal: { equipment: [], serviceTimeline: [], powertrain: [] },
    vehicle: {
      make: "VW",
      model: "Passat",
      body: "",
      engine: "",
      firstReg: "",
      color: "",
      gearbox: "",
      manufacturer: "",
      vin: VIN,
    },
    mileageRows: [],
    serviceRows: [],
    comments: { serviceHistory: "", oilIntervals: "" },
    csdd: null,
    chargedCents: 18,
    quotedCents: 18,
    fetchedAt: "2026-11-02T10:00:00.000Z",
    monthKey: "2026-11",
    autoparks: null,
    saved: false,
    createdAt: "2026-11-02T10:00:00.000Z",
    updatedAt: "2026-11-02T10:00:00.000Z",
    ...patch,
  };
}

describe("dīlera pārbaužu saglabāšana", () => {
  it("saglabā tikai ielādi ar reāliem OneAuto datiem", () => {
    expect(dealerCheckLoadShouldPersist(record())).toBe(true);
    expect(
      dealerCheckLoadShouldPersist(
        record({
          selectedProducts: ["vin_decoder", "oe_service_history"],
          results: {
            vin_decoder: { ok: true, payload: { make: "VW" }, httpStatus: 200 },
            oe_service_history: { ok: false, error: "http_206", httpStatus: 206, payload: null },
          },
        }),
      ),
    ).toBe(true);
  });

  it("nesaglabā 206, no_data, kļūdu un tukšu ielādi", () => {
    expect(
      dealerCheckLoadShouldPersist(
        record({
          selectedProducts: ["oe_service_history"],
          results: { oe_service_history: { ok: false, error: "http_206", httpStatus: 206, payload: null } },
          chargedCents: 0,
        }),
      ),
    ).toBe(false);
    expect(
      dealerCheckLoadShouldPersist(
        record({
          selectedProducts: ["vin_decoder"],
          results: { vin_decoder: { ok: false, error: "no_data", payload: { success: false } } },
          chargedCents: 0,
        }),
      ),
    ).toBe(false);
    expect(
      dealerCheckLoadShouldPersist(
        record({
          selectedProducts: ["vin_decoder"],
          results: { vin_decoder: { ok: false, error: "upstream_error", payload: null } },
        }),
      ),
    ).toBe(false);
    expect(dealerCheckLoadShouldPersist(record({ selectedProducts: [], results: {} }))).toBe(false);
  });
});

describe("dīlera pārbaužu saraksta filtrs", () => {
  const open = entry();
  const older = entry({
    id: "dc-history-old-02",
    vin: "WBA8A71070K896936",
    plate: "AB-1000",
    template: "cits",
    createdAt: "2026-10-15T10:00:00.000Z",
    autoparksTitle: "",
  });
  const converted = entry({
    id: "dc-history-conv-03",
    vin: "WF0XXXGCDX1234567",
    plate: "ZZ-9",
    status: "converted",
    orderId: "ord_1",
    createdAt: "2026-11-02T12:00:00.000Z",
  });

  it("noklusējums rāda tikai atvērtās pārbaudes bez pasūtījuma", () => {
    const rows = filterDealerCheckList([converted, older, open], DEALER_CHECK_LIST_DEFAULT_FILTER);
    expect(rows.map((row) => row.id)).toEqual(["dc-history-open-1", "dc-history-old-02"]);
  });

  it("filtrē datumu, VIN, numurzīmi, šablonu, statusu un pasūtījumu", () => {
    const all = [open, older, converted];
    expect(filterDealerCheckList(all, { ...DEALER_CHECK_LIST_DEFAULT_FILTER, from: "2026-11-01", to: "2026-11-02" }).map((r) => r.id)).toEqual([
      "dc-history-open-1",
    ]);
    expect(filterDealerCheckList(all, { ...DEALER_CHECK_LIST_DEFAULT_FILTER, vin: "wba8" }).map((r) => r.id)).toEqual([
      "dc-history-old-02",
    ]);
    expect(filterDealerCheckList(all, { ...DEALER_CHECK_LIST_DEFAULT_FILTER, plate: "4521" }).map((r) => r.id)).toEqual([
      "dc-history-open-1",
    ]);
    expect(filterDealerCheckList(all, { ...DEALER_CHECK_LIST_DEFAULT_FILTER, template: "cits" }).map((r) => r.id)).toEqual([
      "dc-history-old-02",
    ]);
    expect(
      filterDealerCheckList(all, { ...DEALER_CHECK_LIST_DEFAULT_FILTER, status: "converted", ordered: "yes" }).map((r) => r.id),
    ).toEqual(["dc-history-conv-03"]);
    expect(filterDealerCheckList(all, { ...DEALER_CHECK_LIST_DEFAULT_FILTER, status: "all", ordered: "all" })).toHaveLength(3);
  });

  it("CSV satur filtrēto rindu un nevis cita auto VIN", () => {
    const csv = dealerCheckListToCsv(filterDealerCheckList([open, converted], DEALER_CHECK_LIST_DEFAULT_FILTER));
    expect(csv).toContain(VIN);
    expect(csv).toContain("0,18 €");
    expect(csv).toContain("VW Passat");
    expect(csv).not.toContain("WF0XXXGCDX1234567");
    expect(csv.split("\n")[0]).toContain("pasutijuma_id");
  });
});

describe("dīlera pārbaudes īpašnieks", () => {
  it("parole un atļautais Google konts ir viens īpašnieks, cits sub paliek atsevišķi", () => {
    expect(dealerCheckCreatorId(null)).toBe(DEALER_CHECK_OWNER_ID);
    expect(dealerCheckCreatorId({ via: undefined })).toBe(DEALER_CHECK_OWNER_ID);
    expect(
      dealerCheckCreatorId({ via: "google", sub: "nils-sub", email: ADMIN_GOOGLE_ALLOWED_EMAIL }),
    ).toBe(DEALER_CHECK_OWNER_ID);
    expect(dealerCheckCreatorId({ via: "google", sub: "cits-sub", email: "cits@example.com" })).toBe("google:cits-sub");
  });
});

describe("CSDD snapshots", () => {
  it("tukšs objekts nav snapshots", () => {
    expect(parseDealerCheckCsddSnapshot(emptyCsddTechData())).toBeNull();
    expect(parseDealerCheckCsddSnapshot({ ...emptyCsddTechData(), vin: VIN })?.vin).toBe(VIN);
  });
});
