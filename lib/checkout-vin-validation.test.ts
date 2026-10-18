import { describe, expect, it } from "vitest";
import { getOrderCopy } from "@/lib/checkout-copy";
import {
  VIN_INCOMPLETE_LENGTH_ERROR_LV,
  vinOrPlateErrorMessage,
} from "@/lib/order-field-validation";

describe("checkout API VIN rejection", () => {
  it("rejects a 16-char VIN with the approved length message (lv)", async () => {
    const copy = await getOrderCopy("lv");
    const error = vinOrPlateErrorMessage("W0VZCYHZXN684325", {
      vin: copy.validation.vin,
      vinLength: copy.validation.vinLength,
      empty: copy.validation.fieldEmpty,
    });
    expect(copy.validation.vinLength).toBe(VIN_INCOMPLETE_LENGTH_ERROR_LV);
    expect(error).toBe("VIN jābūt 17 zīmēm, pārbaudiet VIN numuru");
  });

  it("accepts a 17-char VIN and a Latvian plate", async () => {
    const copy = await getOrderCopy("lv");
    const messages = {
      vin: copy.validation.vin,
      vinLength: copy.validation.vinLength,
    };
    expect(vinOrPlateErrorMessage("W0VZCYHZXN6843259", messages)).toBeNull();
    expect(vinOrPlateErrorMessage("KG982", messages)).toBeNull();
    expect(vinOrPlateErrorMessage("VIN: W0VZCYHZXN6843259", messages)).toBeNull();
  });
});
