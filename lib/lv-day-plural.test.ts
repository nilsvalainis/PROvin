import { describe, expect, it } from "vitest";
import { formatLvDayCount, replaceDienaSPlaceholder } from "@/lib/lv-day-plural";

describe("formatLvDayCount", () => {
  it("uses diena for 1 and 21, dienas otherwise", () => {
    expect(formatLvDayCount(1)).toBe("1 diena");
    expect(formatLvDayCount(21)).toBe("21 diena");
    expect(formatLvDayCount(11)).toBe("11 dienas");
    expect(formatLvDayCount(18)).toBe("18 dienas");
    expect(formatLvDayCount(5)).toBe("5 dienas");
  });

  it("replaces diena(s) placeholders", () => {
    expect(replaceDienaSPlaceholder("Reģistrēta 106 diena(s)")).toBe("Reģistrēta 106 dienas");
    expect(replaceDienaSPlaceholder("1 diena(s)")).toBe("1 diena");
  });
});
