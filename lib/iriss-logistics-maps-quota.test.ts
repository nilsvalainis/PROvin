import { describe, expect, it } from "vitest";
import {
  decideLogisticsMapsQuota,
  emptyLogisticsMapsUsageMonth,
  incrementLogisticsMapsUsage,
  LOGISTICS_MAPS_DAILY_CAP,
  LOGISTICS_MAPS_LIMIT_NOTICE,
  LOGISTICS_MAPS_MONTHLY_CAP,
  logisticsMapsDayKey,
  logisticsMapsMonthKey,
} from "@/lib/iriss-logistics-maps-quota";

describe("Google Maps hard counters", () => {
  const at = new Date("2026-10-20T12:00:00.000Z");

  it("allows the first call and increments", () => {
    const empty = emptyLogisticsMapsUsageMonth(logisticsMapsMonthKey(at));
    expect(decideLogisticsMapsQuota({ usage: empty, api: "geocoding", at }).allowed).toBe(true);
    const next = incrementLogisticsMapsUsage(empty, "geocoding", at);
    expect(next.geocoding).toBe(1);
    expect(next.days[logisticsMapsDayKey(at)]?.geocoding).toBe(1);
    expect(next.mapsJs).toBe(0);
  });

  it("blocks at 10 000 monthly and does not require a live API call", () => {
    const usage = emptyLogisticsMapsUsageMonth("2026-10");
    usage.mapsJs = LOGISTICS_MAPS_MONTHLY_CAP;
    const d = decideLogisticsMapsQuota({ usage, api: "maps_js", at });
    expect(d.allowed).toBe(false);
    expect(d.reason).toBe("monthly_cap");
    expect(d.notice).toBe(LOGISTICS_MAPS_LIMIT_NOTICE);
  });

  it("blocks at ~320 per day before the month is full", () => {
    const usage = emptyLogisticsMapsUsageMonth("2026-10");
    usage.geocoding = 400;
    usage.days[logisticsMapsDayKey(at)] = { mapsJs: 0, geocoding: LOGISTICS_MAPS_DAILY_CAP };
    const d = decideLogisticsMapsQuota({ usage, api: "geocoding", at });
    expect(d.allowed).toBe(false);
    expect(d.reason).toBe("daily_cap");
    expect(LOGISTICS_MAPS_DAILY_CAP).toBe(320);
    expect(LOGISTICS_MAPS_MONTHLY_CAP).toBe(10_000);
  });
});
