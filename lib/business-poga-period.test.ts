import { describe, expect, it } from "vitest";
import { BUSINESS_POGA_START, parseBusinessPogaPeriod } from "@/lib/business-poga-period";

const today = "2026-11-05";

describe("statistikas periods", () => {
  it("pēc noklusējuma šis mēnesis līdz šodienai, nākamais mēnesis nav pieejams", () => {
    expect(parseBusinessPogaPeriod({}, today)).toMatchObject({
      kind: "month", from: "2026-11-01", to: "2026-11-05", label: "Novembris 2026", prevMonth: "2026-10", nextMonth: null,
    });
  });

  it("iepriekšējais mēnesis līdz mēneša beigām", () => {
    expect(parseBusinessPogaPeriod({ bp: "2026-02" }, today)).toMatchObject({ from: "2026-02-01", to: "2026-02-28", nextMonth: "2026-03" });
  });

  it("nākotnes vai nederīgs mēnesis - šis mēnesis", () => {
    expect(parseBusinessPogaPeriod({ bp: "2027-01" }, today).month).toBe("2026-11");
    expect(parseBusinessPogaPeriod({ bp: "x" }, today).month).toBe("2026-11");
  });

  it("viss laiks no uzskaites sākuma un savs intervāls", () => {
    expect(parseBusinessPogaPeriod({ bp: "all" }, today)).toMatchObject({ kind: "all", from: BUSINESS_POGA_START, to: today });
    expect(parseBusinessPogaPeriod({ bpFrom: "2026-10-01", bpTo: "2026-10-15" }, today)).toMatchObject({
      kind: "custom", from: "2026-10-01", to: "2026-10-15", label: "01.10.2026 - 15.10.2026",
    });
    expect(parseBusinessPogaPeriod({ bpFrom: "2026-10-15", bpTo: "2026-10-01" }, today).kind).toBe("month");
  });
});
