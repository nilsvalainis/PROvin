import { describe, expect, it } from "vitest";
import {
  cleanDateStr,
  parseDotOrIsoDateToMs,
  parseMileageSortTime,
} from "@/lib/clean-date-str";
import { autoRecordsDateSortKey } from "@/lib/auto-records-paste-parse";
import { parseMileageDateForSort } from "@/lib/unified-mileage";
import { formatOrderTimestampSec } from "@/lib/format-order-datetime";

describe("cleanDateStr", () => {
  it("converts Swiss day-zero dates to day 01", () => {
    expect(cleanDateStr("00.01.2026")).toBe("01.01.2026");
    expect(cleanDateStr("00.09.2022")).toBe("01.09.2022");
    expect(cleanDateStr("00.08.2021")).toBe("01.08.2021");
  });

  it("leaves normal dates unchanged", () => {
    expect(cleanDateStr("15.03.2024")).toBe("15.03.2024");
    expect(cleanDateStr("2024-03-15")).toBe("2024-03-15");
  });
});

describe("parseDotOrIsoDateToMs", () => {
  it("parses 00.MM.YYYY without NaN", () => {
    const ms = parseDotOrIsoDateToMs("00.01.2026");
    expect(ms).toBeGreaterThan(0);
    expect(Number.isFinite(ms)).toBe(true);
    expect(new Date(ms).getUTCFullYear()).toBe(2026);
    expect(new Date(ms).getUTCMonth()).toBe(0);
  });

  it("returns 0 for garbage", () => {
    expect(parseDotOrIsoDateToMs("")).toBe(0);
    expect(parseDotOrIsoDateToMs(null)).toBe(0);
    expect(parseDotOrIsoDateToMs("not-a-date")).toBe(0);
  });
});

describe("mileage date sort integration", () => {
  it("autoRecordsDateSortKey handles 00. dates", () => {
    expect(() => autoRecordsDateSortKey("00.09.2022")).not.toThrow();
    expect(autoRecordsDateSortKey("00.09.2022")).toBeGreaterThan(0);
  });

  it("parseMileageDateForSort handles 00. dates", () => {
    expect(() => parseMileageDateForSort("00.08.2021")).not.toThrow();
    expect(parseMileageDateForSort("00.08.2021")).toBeGreaterThan(0);
    expect(parseMileageSortTime("00.08.2021")).toBe(parseMileageDateForSort("00.08.2021"));
  });
});

describe("formatOrderTimestampSec string dates", () => {
  it("formats cleaned LV dot dates without throwing", () => {
    expect(() => formatOrderTimestampSec("00.01.2026")).not.toThrow();
    const s = formatOrderTimestampSec("00.01.2026");
    expect(s).not.toBe("—");
  });
});
