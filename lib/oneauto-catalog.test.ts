import { describe, expect, it } from "vitest";
import {
  buildOneautoDisplay,
  formatOneautoCostEur,
  oneautoProductsCostCents,
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
});
