import { describe, expect, it, vi } from "vitest";

import {
  fetchSpeckrVehicleSpecs,
  parseSpeckrHttpFailure,
  parseSpeckrVehicleSpecs,
  speckrApiConfigured,
  speckrIdempotencyKey,
} from "@/lib/speckr-api";

const TESLA_VIN = "5YJ3E1EA7KF000000";

describe("speckr-api", () => {
  it("konfigurācija", () => {
    expect(speckrApiConfigured({})).toBe(false);
    expect(speckrApiConfigured({ SPECKR_API_KEY: "spk_live_test" })).toBe(true);
    expect(speckrIdempotencyKey("5yj3e1ea7kf000000")).toBe("provin-order-speckr-5YJ3E1EA7KF000000");
  });

  it("parseSpeckrVehicleSpecs", () => {
    const parsed = parseSpeckrVehicleSpecs({
      vin: TESLA_VIN,
      title: "2019 Tesla Model 3 Long Range AWD",
      vehicle: { year: "2019", make: "Tesla", model: "Model 3", trim: "Long Range AWD" },
      summary: { paint: "Pearl White", production_date: "2019-03-12" },
      battery: { state_of_health_percent: 92 },
    });
    expect(parsed.outcome).toBe("ok");
    expect(parsed.lines.some((l) => l.label === "Krāsa")).toBe(true);
    expect(parsed.vehicle?.make).toBe("Tesla");
  });

  it("HTTP kļūdas", () => {
    expect(parseSpeckrHttpFailure(402, { error: { message: "No credits", code: "insufficient_credits" } }).outcome).toBe(
      "needs_payment",
    );
    expect(parseSpeckrHttpFailure(422, null).outcome).toBe("no_data");
  });

  it("fetch ar mock", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
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
    expect(out.outcome).toBe("ok");
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("bez atslēgas", async () => {
    const out = await fetchSpeckrVehicleSpecs(TESLA_VIN, { env: {}, fetchImpl: vi.fn() });
    expect(out.outcome).toBe("not_configured");
  });
});
