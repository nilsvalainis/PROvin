import { describe, expect, it } from "vitest";
import { toAdminOrderDetailClientModel } from "@/lib/admin-order-detail-client-model";

describe("toAdminOrderDetailClientModel", () => {
  it("coerces corrupt numeric and string fields", () => {
    const model = toAdminOrderDetailClientModel({
      id: "cs_test",
      created: NaN,
      amountTotal: Infinity,
      currency: "EUR",
      paymentStatus: "paid",
      customerEmail: null,
      vin: "WDD2210801A318496",
      listingUrl: null,
      customerName: null,
      phone: null,
      contactMethod: null,
      notes: null,
      customerDetailsEmail: null,
      customerDetailsPhone: null,
      attachments: [{ label: "x", fileName: "y.pdf" }, null, { bad: true }],
    } as never);

    expect(model.created).toBe(0);
    expect(model.amountTotal).toBe(null);
    expect(model.vin).toBe("WDD2210801A318496");
    expect(model.attachments).toEqual([{ label: "x", fileName: "y.pdf" }]);
  });
});
