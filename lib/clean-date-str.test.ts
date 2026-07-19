import { describe, expect, it } from "vitest";
import {
  cleanDateStr,
  normalizeUnknownDayDatesInText,
  parseDotOrIsoDateToMs,
  parseMileageSortTime,
} from "@/lib/clean-date-str";
import { autoRecordsDateSortKey, formatAutoRecordsDateForOutput } from "@/lib/auto-records-paste-parse";
import { parseMileageDateForSort } from "@/lib/unified-mileage";
import { deepSanitizeDraftStrings } from "@/lib/admin-draft-sanitize";

describe("cleanDateStr", () => {
  it("rewrites unknown day 00 to 01", () => {
    expect(cleanDateStr("00.01.2026")).toBe("01.01.2026");
    expect(cleanDateStr("00.09.2022")).toBe("01.09.2022");
    expect(cleanDateStr("00.08.2021")).toBe("01.08.2021");
  });

  it("leaves known days unchanged", () => {
    expect(cleanDateStr("15.03.2024")).toBe("15.03.2024");
    expect(cleanDateStr("2024-03-15")).toBe("2024-03-15");
  });
});

describe("normalizeUnknownDayDatesInText", () => {
  it("rewrites embedded 00. dates in longer strings", () => {
    expect(normalizeUnknownDayDatesInText("notikums 00.05.2025 un tālāk")).toBe(
      "notikums 01.05.2025 un tālāk",
    );
  });
});

describe("formatAutoRecordsDateForOutput", () => {
  it("outputs 01. instead of 00. for unknown day", () => {
    expect(formatAutoRecordsDateForOutput("00.05.2025")).toBe("01.05.2025");
    expect(formatAutoRecordsDateForOutput("15.05.2025")).toBe("15.05.2025");
  });
});

describe("deepSanitizeDraftStrings", () => {
  it("migrates 00. dates inside draft JSON strings", () => {
    const out = deepSanitizeDraftStrings({
      date: "00.06.2024",
      note: "skat. 00.11.2020",
      nested: [{ csngDate: "00.03.2019" }],
    }) as {
      date: string;
      note: string;
      nested: { csngDate: string }[];
    };
    expect(out.date).toBe("01.06.2024");
    expect(out.note).toBe("skat. 01.11.2020");
    expect(out.nested[0]?.csngDate).toBe("01.03.2019");
  });
});

describe("parseDotOrIsoDateToMs", () => {
  it("parses 00.MM.YYYY without NaN", () => {
    const ms = parseDotOrIsoDateToMs("00.01.2026");
    expect(ms).toBeGreaterThan(0);
    expect(Number.isFinite(ms)).toBe(true);
  });
});

describe("date sort helpers", () => {
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
