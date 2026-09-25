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

  it("keeps partner company name for the order header", () => {
    const model = toAdminOrderDetailClientModel({
      id: "manual_order_1",
      created: 1,
      amountTotal: null,
      currency: "EUR",
      paymentStatus: "unpaid",
      customerEmail: "p@auto.lv",
      vin: "WVWZZZ1JZXW000001",
      listingUrl: null,
      customerName: "Jānis",
      phone: null,
      contactMethod: null,
      notes: "B2B business · partner_id=ptr_0123456789abcdef",
      customerDetailsEmail: null,
      customerDetailsPhone: null,
      isManual: true,
      partnerId: "ptr_0123456789abcdef",
      partnerCompanyName: "SIA Demo Auto",
      partnerAuditPurpose: "internal",
    } as never);
    expect(model.partnerCompanyName).toBe("SIA Demo Auto");
    expect(model.partnerId).toBe("ptr_0123456789abcdef");
    expect(model.partnerAuditPurpose).toBe("internal");
    expect(model.isManual).toBe(true);
  });
});
