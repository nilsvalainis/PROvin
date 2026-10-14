import { describe, expect, it } from "vitest";
import { parseResultMap } from "@/lib/oneauto-block";
import { buildOneautoProductResult, oneautoResponsePreview } from "@/lib/oneauto-product-result";

const NO_DATA_MSG =
  "There is no data available for this vehicle identification number. You have not been charged.";

describe("buildOneautoProductResult", () => {
  it("no-data saglabā kā ok:false, error:no_data un HTTP statusu", () => {
    const payload = { success: false, error: NO_DATA_MSG };
    const result = buildOneautoProductResult({ ok: false, status: 404, payload });
    expect(result).toMatchObject({
      ok: false,
      error: "no_data",
      httpStatus: 404,
      message: NO_DATA_MSG,
      payload,
    });
  });

  it("success:false no-data arī pie HTTP 200 ir ok:false", () => {
    const payload = { success: false, error: NO_DATA_MSG };
    const result = buildOneautoProductResult({ ok: true, status: 200, payload });
    expect(result.ok).toBe(false);
    expect(result.error).toBe("no_data");
    expect(result.httpStatus).toBe(200);
  });

  it("veiksmīgs payload paliek ok:true", () => {
    const payload = { success: true, result: { oem_engine_desc: "M274" } };
    const result = buildOneautoProductResult({ ok: true, status: 200, payload });
    expect(result.ok).toBe(true);
    expect(result.error).toBeUndefined();
    expect(result.httpStatus).toBe(200);
  });

  it("API unavailable paliek kļūda, ne no-data", () => {
    const payload = {
      success: false,
      result: { error: "Requested API is not available. Please contact support at help@oneautoapi.com" },
    };
    const result = buildOneautoProductResult({ ok: true, status: 200, payload });
    expect(result).toMatchObject({ ok: false, error: "api_unavailable", httpStatus: 200 });
  });

  it("pending 202 nav no-data", () => {
    const result = buildOneautoProductResult({
      ok: true,
      status: 202,
      payload: { success: true, request_id: "abc" },
    });
    expect(result.error).toBe("pending");
    expect(result.ok).toBe(false);
  });

  it("preview ir pirmie 300 simboli", () => {
    expect(oneautoResponsePreview({ a: "x".repeat(400) }).length).toBe(300);
  });

  it("parseResultMap saglabā httpStatus, message un fallback", () => {
    const parsed = parseResultMap({
      vin_decoder: {
        ok: false,
        error: "no_data",
        httpStatus: 404,
        message: NO_DATA_MSG,
        fallback: "vin_scan",
        payload: { success: false },
      },
    });
    expect(parsed.vin_decoder).toMatchObject({
      ok: false,
      error: "no_data",
      httpStatus: 404,
      message: NO_DATA_MSG,
      fallback: "vin_scan",
    });
  });
});
