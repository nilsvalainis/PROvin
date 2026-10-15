import { describe, expect, it } from "vitest";
import { formatUsHistoryDateTimeInRiga } from "@/lib/format-us-history-datetime";

describe("formatUsHistoryDateTimeInRiga", () => {
  it("converts UTC ISO to Europe/Riga wall time", () => {
    expect(formatUsHistoryDateTimeInRiga("2024-01-15T18:00:00Z")).toBe("15.01.2024 20:00");
  });

  it("converts US zone abbreviations (PDT / PST)", () => {
    expect(formatUsHistoryDateTimeInRiga("2026-09-05 06:09:11 PDT")).toBe("05.09.2026 16:09");
    expect(formatUsHistoryDateTimeInRiga("2018-03-02 09:47:20 PST")).toBe("02.03.2018 19:47");
  });

  it("leaves date-only strings to the caller", () => {
    expect(formatUsHistoryDateTimeInRiga("2011-05-20")).toBeNull();
    expect(formatUsHistoryDateTimeInRiga("20.05.2011")).toBeNull();
  });
});
