import { describe, expect, it } from "vitest";
import { decideAdminApiAccess, decideAdminPageAccess, type AccessActor } from "@/lib/staff-roles";
import {
  addDealerCheckLedgerLoad,
  buildDealerCheckLvHtml,
  compareDealerCheckCsdd,
  dealerCheckCanLoad,
  dealerCheckChargedCents,
  dealerCheckEmptyStateText,
  dealerCheckForbidsNoHistoryClaim,
  dealerCheckHasCsddInHtml,
  dealerCheckHasHttp206,
  dealerCheckHttp206Comments,
  dealerCheckHttp206Warning,
  dealerCheckMileageHttp206Note,
  dealerCheckPageHref,
  dealerCheckSelection,
  dealerCheckServiceHistoryHttp206,
  dealerCheckVehicleFromDisplay,
  DEALER_CHECK_DEFAULT_SELECTED,
  DEALER_CHECK_PAGE_PATH,
  DEALER_CHECK_SOURCES,
  emptyDealerCheckLedgerMonth,
  findAutoparksCarByVin,
  formatDealerCheckEur,
  formatDealerCheckLedgerBar,
  formatDealerCheckLoadLog,
  formatDealerCheckProductLog,
  isSafeDealerCheckId,
  lastDealerCheckOdometerKm,
  normalizeDealerCheckPlate,
  oneautoResultIsHttp206,
  parseDealerCheckSearchVin,
  parseDealerCheckTemplateId,
  sanitizeDealerCheckComment,
  type DealerCheckRecord,
} from "@/lib/dealer-check";
import type { OneautoDisplaySections } from "@/lib/oneauto-catalog";
const VIN = "WVWZZZ3CZKE012345";

function displayWithService(): OneautoDisplaySections {
  return {
    equipment: [],
    powertrain: [
      { label: "make", value: "BMW" },
      { label: "model", value: "3 sērija 320d" },
      { label: "body", value: "Sedans" },
      { label: "fuel", value: "d" },
      { label: "displacement", value: "2,0" },
      { label: "power", value: "140 kW" },
      { label: "transmission", value: "Automātiskā" },
      { label: "color", value: "Mineral Grau" },
      { label: "manufacturer", value: "BMW AG" },
      { label: "firstRegistration", value: "2016-03-12" },
    ],
    serviceTimeline: [
      { date: "18.10.2024", odometer: "203900", place: "LV · Rīga", works: "Eļļas serviss" },
    ],
  };
}

function record(patch: Partial<DealerCheckRecord> = {}): DealerCheckRecord {
  return {
    id: "dc-test-record-1",
    vin: VIN,
    plate: "LR-4521",
    template: "dzintarzeme",
    selectedProducts: ["vin_decoder", "oe_service_history"],
    results: {},
    display: { equipment: [], serviceTimeline: [], powertrain: [] },
    displayOriginal: { equipment: [], serviceTimeline: [], powertrain: [] },
    vehicle: {
      make: "BMW",
      model: "3 sērija 320d",
      body: "Sedans",
      engine: "2,0 d · 140 kW",
      firstReg: "12.03.2016",
      color: "Mineral Grau",
      gearbox: "Automātiskā",
      manufacturer: "BMW AG",
      vin: "WBA8A71070K896936",
    },
    mileageRows: [],
    serviceRows: [],
    comments: { serviceHistory: "", oilIntervals: "" },
    csdd: null,
    chargedCents: 18,
    quotedCents: 318,
    fetchedAt: "2026-11-01T16:41:00.000Z",
    monthKey: "2026-11",
    autoparks: null,
    saved: false,
    createdAt: "2026-11-01T16:41:00.000Z",
    updatedAt: "2026-11-01T16:41:00.000Z",
    ...patch,
  };
}

describe("Dīlera datu pārbaude: avoti un summa", () => {
  it("noklusējumā visi avoti ir izslēgti un Ielādēt nav aktīvs", () => {
    expect(DEALER_CHECK_DEFAULT_SELECTED).toEqual([]);
    expect(dealerCheckCanLoad([])).toBe(false);
    expect(dealerCheckSelection([]).cents).toBe(0);
  });

  it("summa ir tikai atzīmētie avoti, Speckr nav", () => {
    expect(DEALER_CHECK_SOURCES.map((s) => s.id)).toEqual([
      "vin_decoder",
      "oe_vin_lookup",
      "oe_build_sheet",
      "oe_service_history",
    ]);
    expect(DEALER_CHECK_SOURCES.some((s) => /speckr/i.test(s.id + s.label))).toBe(false);
    const picked = dealerCheckSelection(["vin_decoder", "oe_build_sheet", "oe_service_history"]);
    expect(picked).toEqual({ count: 3, cents: 513, canLoad: true });
    expect(formatDealerCheckEur(513)).toBe("5,13 €");
    expect(formatDealerCheckEur(18)).toBe("0,18 €");
    expect(formatDealerCheckEur(36)).toBe("0,36 €");
    expect(formatDealerCheckEur(195)).toBe("1,95 €");
    expect(formatDealerCheckEur(300)).toBe("3,00 €");
  });

  it("HTTP 206 netiek iekasēts, arī ja Service History bija atzīmēts", () => {
    const results = {
      vin_decoder: { ok: true, payload: { success: true } },
      oe_build_sheet: { ok: true, payload: { success: true } },
      oe_service_history: { ok: false, error: "http_206", httpStatus: 206, payload: {} },
    };
    expect(oneautoResultIsHttp206(results.oe_service_history)).toBe(true);
    expect(dealerCheckHasHttp206(results)).toBe(true);
    expect(dealerCheckServiceHistoryHttp206(results)).toBe(true);
    expect(
      dealerCheckChargedCents(["vin_decoder", "oe_build_sheet", "oe_service_history"], results),
    ).toBe(213);
  });
});

describe("Dīlera datu pārbaude: 206 teksts", () => {
  it("brīdinājums saka tukšs ≠ vēstures nav un neapgalvo, ka vēstures nav", () => {
    const warn = dealerCheckHttp206Warning();
    expect(warn.body).toContain("tukšs ≠ vēstures nav");
    expect(warn.title).toContain("206");
    expect(warn.title).toContain("bez maksas");
    expect(dealerCheckForbidsNoHistoryClaim(warn.title + warn.body)).toBe(false);
    expect(dealerCheckForbidsNoHistoryClaim("Šim VIN vēstures nav")).toBe(true);
    const notes = dealerCheckHttp206Comments("BMW");
    expect(notes.serviceHistory).toContain("206");
    expect(notes.serviceHistory).toContain("Neizdarīt secinājumu");
    expect(dealerCheckForbidsNoHistoryClaim(notes.serviceHistory + notes.oilIntervals)).toBe(false);
    expect(sanitizeDealerCheckComment("Šim auto vēstures nav", true)).toBe(notes.serviceHistory);
    expect(dealerCheckMileageHttp206Note()).toContain("206");
    expect(dealerCheckMileageHttp206Note({ mentionCsdd: true })).toContain("CSDD");
    expect(dealerCheckForbidsNoHistoryClaim(dealerCheckMileageHttp206Note())).toBe(false);
  });

  it("LV PDF iekļauj 206 brīdinājumu, bet ne CSDD", () => {
    const html = buildDealerCheckLvHtml(
      record({
        results: {
          oe_service_history: { ok: false, error: "http_206", httpStatus: 206, payload: {} },
        },
        comments: dealerCheckHttp206Comments("BMW"),
      }),
    );
    expect(html).toContain("206");
    expect(html).toContain("tukšs ≠ vēstures nav");
    expect(dealerCheckHasCsddInHtml(html)).toBe(false);
    expect(dealerCheckForbidsNoHistoryClaim(html)).toBe(false);
  });
});

describe("Dīlera datu pārbaude: deep-link un šablons", () => {
  it("Autoparks saite iekopē VIN un avotus neatver", () => {
    expect(dealerCheckPageHref({ vin: VIN, from: "autoparks" })).toBe(
      `${DEALER_CHECK_PAGE_PATH}?vin=${VIN}&no=autoparks`,
    );
    expect(parseDealerCheckSearchVin(VIN)).toBe(VIN);
    expect(parseDealerCheckSearchVin("abc")).toBe("");
    expect(parseDealerCheckTemplateId("cits")).toBe("cits");
    expect(parseDealerCheckTemplateId("nope")).toBe("dzintarzeme");
  });

  it("mēneša uzskaite palielinās tikai par iekasēto", () => {
    const empty = emptyDealerCheckLedgerMonth("2026-11");
    const next = addDealerCheckLedgerLoad(empty, "dzintarzeme", 213);
    expect(next.dzintarzeme).toEqual({ cents: 213, loads: 1 });
    expect(formatDealerCheckLedgerBar(next)).toContain("2,13 €");
    expect(formatDealerCheckLedgerBar(next)).toContain("novembris");
    expect(formatDealerCheckLedgerBar(next)).toContain("Cits · 0,00 € · 0");
  });

  it("VIN saistās ar Autoparks ierakstu", () => {
    const cars = [
      { id: "ap-1", vin: "WVWZZZ3CZKE000000" },
      { id: "ap-2", vin: VIN.toLowerCase() },
    ];
    expect(findAutoparksCarByVin(cars, VIN)?.id).toBe("ap-2");
    expect(findAutoparksCarByVin(cars, "WVWZZZ3CZKE999999")).toBeNull();
  });

  it("id un numurzīme ir droši", () => {
    expect(isSafeDealerCheckId("dc-abcdef12-3456")).toBe(true);
    expect(isSafeDealerCheckId("../etc/passwd")).toBe(false);
    expect(normalizeDealerCheckPlate("lr 4521")).toBe("LR-4521");
  });
});

describe("Dīlera datu pārbaude: rezultāta lauki", () => {
  it("transporta info un CSDD salīdzinājums", () => {
    const vehicle = dealerCheckVehicleFromDisplay(displayWithService(), "WBA8A71070K896936");
    expect(vehicle.make).toBe("BMW");
    expect(vehicle.body).toBe("Sedans");
    expect(vehicle.vin).toBe("WBA8A71070K896936");
    expect(lastDealerCheckOdometerKm([{ date: "18.10.2024", odometer: "203 900 km", source: "Dīlera serviss" }])).toBe(
      203900,
    );
    expect(
      compareDealerCheckCsdd({ dealerLastKm: 203900, csddKm: 203400, http206: false }).matchLabel,
    ).toContain("sakrīt");
    expect(compareDealerCheckCsdd({ dealerLastKm: 203900, csddKm: 203400, http206: true }).match).toBe("none");
    expect(compareDealerCheckCsdd({ dealerLastKm: null, csddKm: 203400, http206: false }).matchLabel).toBe(
      "nav ar ko salīdzināt",
    );
  });

  it("logs rāda 206 kā 0,00 €", () => {
    expect(
      formatDealerCheckProductLog("oe_service_history", {
        ok: false,
        error: "http_206",
        httpStatus: 206,
      }),
    ).toBe("⚠ OE Service History (Europe) · HTTP 206 (0,00 €)");
    const log = formatDealerCheckLoadLog({
      results: {
        vin_decoder: { ok: true },
        oe_service_history: { ok: false, error: "http_206", httpStatus: 206 },
      },
      selected: ["vin_decoder", "oe_service_history"],
      fetchedAt: "2026-11-01T16:41:00.000Z",
      template: "dzintarzeme",
      chargedCents: 18,
      monthKey: "2026-11",
    });
    expect(log).toContain("HTTP 206 (0,00 €)");
    expect(log).toContain("0,18 €");
    expect(log).toContain("Dzintarzeme Auto");
    expect(dealerCheckEmptyStateText()).toContain("Ielādēt");
  });
});

describe("Dīlera datu pārbaude: ADMIN only", () => {
  const vinStaff: AccessActor = { kind: "staff", sections: ["vin"] };
  const allIrissStaff: AccessActor = {
    kind: "staff",
    sections: ["pasutijumi", "sludinajumi", "radars", "logistika", "serviss", "pavadzimes", "vin"],
  };

  it("lapa un API ir tikai administratoram, arī VIN darbiniekam", () => {
    expect(decideAdminPageAccess("/admin/dilera-dati", { kind: "admin" })).toBe("allow");
    expect(decideAdminApiAccess("/api/admin/dealer-check", { kind: "admin" })).toBe("allow");
    expect(decideAdminApiAccess("/api/admin/dealer-check/pdf", { kind: "admin" })).toBe("allow");
    expect(decideAdminPageAccess("/admin/dilera-dati", vinStaff)).toBe("forbidden");
    expect(decideAdminApiAccess("/api/admin/dealer-check", vinStaff)).toBe("forbidden");
    expect(decideAdminApiAccess("/api/admin/dealer-check/pdf", vinStaff)).toBe("forbidden");
    expect(decideAdminPageAccess("/admin/dilera-dati", allIrissStaff)).toBe("forbidden");
    expect(decideAdminPageAccess("/admin/vin-scan", vinStaff)).toBe("allow");
  });
});
