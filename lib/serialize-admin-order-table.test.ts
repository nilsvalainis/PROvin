import { describe, expect, it } from "vitest";
import { serializeAdminOrderTableRows } from "@/lib/serialize-admin-order-table";
import { isPartnerVinAdminOrder } from "@/lib/b2b-partner-orders";

describe("serializeAdminOrderTableRows partner VIN", () => {
  it("keeps notes so the list can mark a credit VIN as B2B", () => {
    const [row] = serializeAdminOrderTableRows([
      {
        id: "manual_order_1_abc",
        created: 1_700_000_000,
        amountTotal: null,
        currency: "EUR",
        paymentStatus: "paid",
        customerName: "Jānis",
        customerEmail: "b2b@example.com",
        vin: "WVWZZZ1JZXW000001",
        isManual: true,
        checkoutLine: "business",
        partnerId: "ptr_0123456789abcdef",
        partnerCompanyName: "SIA Demo Auto",
        notes: "B2B business · partner_id=ptr_0123456789abcdef",
      },
    ]);
    expect(row.notes).toContain("partner_id=ptr_0123456789abcdef");
    expect(row.partnerCompanyName).toBe("SIA Demo Auto");
    expect(isPartnerVinAdminOrder(row)).toBe(true);
  });
});
