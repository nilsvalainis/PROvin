import { describe, expect, it } from "vitest";
import { parseLogisticsHoursText } from "@/lib/iriss-logistics-hours";

describe("logistics hours", () => {
  it("parses P-Pk ranges", () => {
    const a = parseLogisticsHoursText("P-Pk 07:00-15:30");
    expect(a.hours).toEqual([{ days: "1-5", from: "07:00", to: "15:30" }]);
    const b = parseLogisticsHoursText("P-Pk 08:00-11:45, 12:30-16:00");
    expect(b.hours).toHaveLength(2);
    expect(b.hours[1]).toMatchObject({ from: "12:30", to: "16:00" });
  });

  it("keeps unspecified as empty slots", () => {
    expect(parseLogisticsHoursText("nav norādīts (ierašanās 07:30 pieteikta)").hours).toEqual([]);
  });
});
