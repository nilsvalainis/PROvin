import { describe, expect, it } from "vitest";
import { rigaLocalToUtc } from "@/lib/iriss-pavadzimes-parse";
import {
  formatWaybillCountdown,
  formatWaybillExpiryDdMmHm,
  parseLvTransitPlate,
  WAYBILL_COUNTDOWN_COLOR,
  waybillCountdownStatus,
  waybillRemainingShare,
} from "@/lib/iriss-pavadzimes-countdown";

describe("formatWaybillCountdown", () => {
  const now = rigaLocalToUtc(2026, 10, 14, 12, 0)!;

  it("rāda HH:MM:SS ja atlikušas <24h", () => {
    const until = rigaLocalToUtc(2026, 10, 14, 15, 59)!;
    expect(formatWaybillCountdown(until.toISOString(), now)).toEqual({
      label: "03:59:00",
      status: "soon",
    });
  });

  it("rāda Nd HH:MM ja atlikušas >=24h", () => {
    const until = rigaLocalToUtc(2026, 10, 16, 10, 0)!;
    expect(formatWaybillCountdown(until.toISOString(), now)).toEqual({
      label: "1d 22:00",
      status: "ok",
    });
  });

  it("rāda beigusies, ja termiņš pagājis", () => {
    const until = rigaLocalToUtc(2026, 10, 14, 11, 0)!;
    expect(formatWaybillCountdown(until.toISOString(), now)).toEqual({
      label: "beigusies",
      status: "expired",
    });
  });

  it("precīzi 24h ir Nd formāts", () => {
    const until = rigaLocalToUtc(2026, 10, 15, 12, 0)!;
    expect(formatWaybillCountdown(until.toISOString(), now)).toEqual({
      label: "1d 00:00",
      status: "ok",
    });
  });
});

describe("waybillCountdownStatus", () => {
  it("šodien Rīgā ir soon arī tad, ja paliek gandrīz 24h", () => {
    const now = rigaLocalToUtc(2026, 10, 14, 0, 10)!;
    const until = rigaLocalToUtc(2026, 10, 14, 23, 50)!;
    expect(waybillCountdownStatus(until.toISOString(), now)).toBe("soon");
  });
});

describe("formatWaybillExpiryDdMmHm", () => {
  it("formatē DD.MM HH:mm Rīgas laikā", () => {
    const iso = rigaLocalToUtc(2026, 10, 14, 15, 59)!.toISOString();
    expect(formatWaybillExpiryDdMmHm(iso)).toBe("14.10 15:59");
  });
});

describe("waybillRemainingShare", () => {
  const issued = rigaLocalToUtc(2026, 10, 14, 9, 59)!;
  const until = rigaLocalToUtc(2026, 10, 14, 15, 59)!;

  it("rēķina atlikumu no izdošanas līdz beigām", () => {
    const now = rigaLocalToUtc(2026, 10, 14, 12, 59)!;
    expect(waybillRemainingShare(issued.toISOString(), until.toISOString(), now)).toBeCloseTo(0.5, 5);
  });

  it("beigušai ir 0", () => {
    const now = rigaLocalToUtc(2026, 10, 14, 16, 0)!;
    expect(waybillRemainingShare(issued.toISOString(), until.toISOString(), now)).toBe(0);
  });
});

describe("WAYBILL_COUNTDOWN_COLOR", () => {
  it("ir variant J statusu krāsas", () => {
    expect(WAYBILL_COUNTDOWN_COLOR).toEqual({
      ok: "#15803d",
      soon: "#c2410c",
      expired: "#b91c1c",
    });
  });
});

describe("parseLvTransitPlate", () => {
  it("sadalā B193-7 un B 193-7", () => {
    expect(parseLvTransitPlate("B193-7")).toEqual({ letter: "B", digits: "193", last: "7" });
    expect(parseLvTransitPlate("B 193-7")).toEqual({ letter: "B", digits: "193", last: "7" });
    expect(parseLvTransitPlate("b762-7")).toEqual({ letter: "B", digits: "762", last: "7" });
  });

  it("nepazīstamu tekstu neatgriež", () => {
    expect(parseLvTransitPlate("ABC-12")).toBeNull();
    expect(parseLvTransitPlate("")).toBeNull();
  });
});
