import { describe, expect, it, vi } from "vitest";

import {
  fetchSpeckrVehicleSpecs,
  parseSpeckrHttpFailure,
  parseSpeckrVehicleSpecs,
  speckrApiConfigured,
  speckrIdempotencyKey,
  speckrNotConfiguredParse,
} from "@/lib/vin-scan/speckr-api";

const TESLA_VIN = "5YJ3E1EA7KF000000";

describe("speckr-api", () => {
  it("konfigurācija un skipped bez atslēgas", () => {
    expect(speckrApiConfigured({})).toBe(false);
    expect(speckrApiConfigured({ SPECKR_API_KEY: "  " })).toBe(false);
    expect(speckrApiConfigured({ SPECKR_API_KEY: "spk_live_test" })).toBe(true);
    expect(speckrNotConfiguredParse()).toEqual({ status: "skipped", summary: "nav konfigurēts" });
  });

  it("idempotency atslēga ir stabila pa VIN", () => {
    expect(speckrIdempotencyKey("5yj3e1ea7kf000000")).toBe("provin-vin-scan-5YJ3E1EA7KF000000");
  });

  it("parseSpeckrVehicleSpecs veido kopsavilkumu un detaļas", () => {
    const parsed = parseSpeckrVehicleSpecs({
      object: "vehicle_specs",
      vin: TESLA_VIN,
      title: "2019 Tesla Model 3 Long Range AWD",
      vehicle: { year: "2019", make: "Tesla", model: "Model 3", trim: "Long Range AWD" },
      summary: {
        production_date: "2019-03-12",
        factory: "Fremont",
        wheels: "18\" Aero",
        paint: "Pearl White",
        interior: "Black",
        supercharging: "Pay-as-you-go",
      },
      battery: {
        state_of_health_percent: 92,
        usable_capacity: "72 kWh",
        original_capacity_kwh: 75,
        capacity_summary: "Long Range pack",
        last_measured: "2025-11-01",
      },
      sections: [
        {
          key: "technology",
          title: "Tehnoloģija",
          rows: [{ key: "autopilot", label: "Autopilot", value: "Enhanced Autopilot" }],
        },
      ],
    });
    expect(parsed.status).toBe("found");
    expect(parsed.summary).toContain("Tesla Model 3");
    expect(parsed.vehicle).toEqual({
      year: "2019",
      make: "Tesla",
      model: "Model 3 Long Range AWD",
    });
    expect(parsed.detail).toContain("Ražošanas datums: 2019-03-12");
    expect(parsed.detail).toContain("Baterijas SOH: 92%");
    expect(parsed.detail).toContain("Autopilot: Enhanced Autopilot");
    expect(parsed.openUrl).toContain(TESLA_VIN);
  });

  it("HTTP kļūdas", () => {
    expect(parseSpeckrHttpFailure(402, { error: { message: "No credits", code: "insufficient_credits" } }).status).toBe(
      "manual",
    );
    expect(parseSpeckrHttpFailure(422, { error: { message: "Unsupported VIN", code: "unsupported_vin" } }).status).toBe(
      "none",
    );
    expect(parseSpeckrHttpFailure(503, null).summary).toContain("nav pieejams");
  });

  it("fetchSpeckrVehicleSpecs ar mock atgriež found", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          object: "vehicle_specs",
          vin: TESLA_VIN,
          title: "2019 Tesla Model 3",
          vehicle: { year: "2019", make: "Tesla", model: "Model 3", trim: null },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    const out = await fetchSpeckrVehicleSpecs(TESLA_VIN, {
      env: { SPECKR_API_KEY: "spk_live_x" },
      fetchImpl,
    });
    expect(out.status).toBe("found");
    expect(fetchImpl).toHaveBeenCalledOnce();
    const firstCall = fetchImpl.mock.calls[0];
    expect(firstCall).toBeDefined();
    const [url, init] = firstCall as [string, RequestInit];
    expect(url).toBe("https://speckr.com/api/v1/vehicle-specs");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({
      authorization: "Bearer spk_live_x",
      "idempotency-key": speckrIdempotencyKey(TESLA_VIN),
    });
    expect(JSON.parse(String(init.body))).toEqual({ vin: TESLA_VIN });
  });

  it("fetch bez atslēgas atgriež skipped", async () => {
    const fetchImpl = vi.fn();
    const out = await fetchSpeckrVehicleSpecs(TESLA_VIN, { env: {}, fetchImpl });
    expect(out).toEqual(speckrNotConfiguredParse());
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
