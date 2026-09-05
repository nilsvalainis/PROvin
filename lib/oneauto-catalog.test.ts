import { describe, expect, it } from "vitest";
import {
  buildOneautoDisplay,
  formatOneautoCostEur,
  oneautoPayloadIsPending,
  oneautoProductsCostCents,
  oneautoServiceHistoryIsEmpty,
  parseOneautoProductIds,
} from "@/lib/oneauto-catalog";

describe("OneAuto katalogs", () => {
  it("summē atzīmēto produktu cenas", () => {
    expect(oneautoProductsCostCents(["oe_build_sheet", "oe_service_history"])).toBe(495);
    expect(formatOneautoCostEur(495)).toBe("€4.95");
  });

  it("atlasa tikai zināmos produktu id", () => {
    expect(parseOneautoProductIds(["vin_decoder", "nope", "vin_decoder"])).toEqual(["vin_decoder"]);
  });

  it("izvelk servisa laika skalu un komplektāciju no OneAuto JSON", () => {
    const display = buildOneautoDisplay({
      oe_build_sheet: {
        result: {
          options: [{ name: "Panoramic roof", code: "PR3L" }],
          engine: "2.0 TDI",
        },
      },
      oe_service_history: {
        result: {
          service_events: [
            {
              date_of_service_event: "2019-10-21",
              mileage_observed: 69343,
              service_provider: "Premier Service Centre",
              service_actions: ["Engine: oil and filter change."],
            },
          ],
        },
      },
    });
    expect(display.serviceTimeline[0]?.date).toBe("2019-10-21");
    expect(display.serviceTimeline[0]?.odometer).toBe("69343");
    expect(display.equipment.some((r) => /Panoramic|PR3L/i.test(`${r.label} ${r.value}`))).toBe(true);
    expect(display.powertrain.some((r) => /2\.0 TDI/.test(r.value))).toBe(true);
  });

  it("202 un request_id bez result ir pending, ne gatavi dati", () => {
    expect(oneautoPayloadIsPending(202, { success: true, request_id: "abc" })).toBe(true);
    expect(oneautoPayloadIsPending(200, { success: true, request_id: "abc" })).toBe(true);
    expect(
      oneautoPayloadIsPending(200, {
        success: true,
        result: { vehicle_identification_number: "X", service_events: [] },
      }),
    ).toBe(false);
  });

  it("tukšs service_events ir derīga tukša atbilde", () => {
    expect(
      oneautoServiceHistoryIsEmpty({
        success: true,
        result: { vehicle_identification_number: "X", service_events: [] },
      }),
    ).toBe(true);
  });

  it("lasa workshop remarks un VIN decoder laukus", () => {
    const display = buildOneautoDisplay({
      vin_decoder: {
        result: {
          oem_engine_desc: "EB2ADTS",
          oem_transmission_type_desc: "automatic",
          power_kw: 96,
        },
      },
      oe_service_history: {
        result: {
          workshop_remarks: [
            {
              date: "2024-03-12",
              mileage: 41200,
              remark: "Warranty inspection.",
            },
          ],
        },
      },
    });
    expect(display.serviceTimeline[0]?.date).toBe("2024-03-12");
    expect(display.serviceTimeline[0]?.works).toMatch(/Warranty/);
    expect(display.powertrain.some((r) => r.value === "EB2ADTS")).toBe(true);
  });
});
