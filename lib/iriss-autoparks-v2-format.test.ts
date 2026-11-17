import { describe, expect, it } from "vitest";
import { fmtCm3, fmtDateLv, fmtDayMonth, fmtEur, fmtEurRound, fmtKm, lapasLv, parseEurInput } from "@/lib/iriss-autoparks-v2-format";

describe("v2 formāti", () => {
  it("datumi, km, cm³, eiro", () => {
    expect(fmtDateLv("2026-10-17")).toBe("17.10.2026");
    expect(fmtDayMonth("2026-10-20T10:00:00Z")).toBe("20.10");
    expect(fmtKm(148950)).toBe("148 950 km");
    expect(fmtCm3(1968)).toBe("1968 cm³");
    expect(fmtEur(11064.9)).toBe("11 064,90 €");
    expect(fmtEurRound(18900)).toBe("18 900 €");
    expect(lapasLv(1)).toBe("1 lapa");
    expect(lapasLv(2)).toBe("2 lapas");
  });
  it("summas ievade ar komatu un atstarpēm", () => {
    expect(parseEurInput("1 234,50 €")).toBe(1234.5);
    expect(parseEurInput("258.4")).toBe(258.4);
    expect(parseEurInput("")).toBeNull();
    expect(parseEurInput("-5")).toBeNull();
    expect(parseEurInput("abc")).toBeNull();
  });
});
