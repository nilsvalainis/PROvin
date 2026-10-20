import { describe, expect, it } from "vitest";
import {
  decideLogisticsMapsQuota,
  emptyLogisticsMapsUsageMonth,
  incrementLogisticsMapsUsage,
  LOGISTICS_GEOCODE_PLACE_URL,
  LOGISTICS_MAPS_DAILY_CAP,
  LOGISTICS_MAPS_LIMIT_NOTICE,
  LOGISTICS_MAPS_MONTHLY_CAP,
  LOGISTICS_SEARCH_DESTINATIONS_URL,
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
    usage.days[logisticsMapsDayKey(at)] = {
      mapsJs: 0,
      geocoding: LOGISTICS_MAPS_DAILY_CAP,
      geocodePlace: 0,
      searchDestinations: 0,
      directions: 0,
    };
    const d = decideLogisticsMapsQuota({ usage, api: "geocoding", at });
    expect(d.allowed).toBe(false);
    expect(d.reason).toBe("daily_cap");
    expect(LOGISTICS_MAPS_DAILY_CAP).toBe(320);
    expect(LOGISTICS_MAPS_MONTHLY_CAP).toBe(10_000);
  });

  it("caps GeocodePlace and SearchDestinations at 320/day like the others", () => {
    const usage = emptyLogisticsMapsUsageMonth("2026-10");
    usage.days[logisticsMapsDayKey(at)] = {
      mapsJs: 0,
      geocoding: 0,
      geocodePlace: LOGISTICS_MAPS_DAILY_CAP,
      searchDestinations: LOGISTICS_MAPS_DAILY_CAP,
      directions: 0,
    };
    usage.geocodePlace = LOGISTICS_MAPS_DAILY_CAP;
    usage.searchDestinations = LOGISTICS_MAPS_DAILY_CAP;
    expect(decideLogisticsMapsQuota({ usage, api: "geocode_place", at }).allowed).toBe(false);
    expect(decideLogisticsMapsQuota({ usage, api: "search_destinations", at }).allowed).toBe(false);
    expect(decideLogisticsMapsQuota({ usage, api: "geocode_place", at }).reason).toBe("daily_cap");
    expect(LOGISTICS_GEOCODE_PLACE_URL).toContain("/v4/geocode/places");
    expect(LOGISTICS_SEARCH_DESTINATIONS_URL).toContain("/v4/geocode/destinations");
    const next = incrementLogisticsMapsUsage(emptyLogisticsMapsUsageMonth("2026-10"), "geocode_place", at);
    expect(next.geocodePlace).toBe(1);
    expect(next.searchDestinations).toBe(0);
  });

  it("counts Directions against the same hard monthly and daily caps", () => {
    const empty = emptyLogisticsMapsUsageMonth("2026-10");
    const next = incrementLogisticsMapsUsage(empty, "directions", at);
    expect(next.directions).toBe(1);
    expect(next.days[logisticsMapsDayKey(at)]?.directions).toBe(1);
    next.directions = LOGISTICS_MAPS_MONTHLY_CAP;
    expect(decideLogisticsMapsQuota({ usage: next, api: "directions", at }).allowed).toBe(false);
  });
});
