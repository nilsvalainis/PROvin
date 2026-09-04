import { describe, expect, it } from "vitest";
import {
  B2B_PARTNER_DEMO_ORDERS,
  formatB2bArchiveAmount,
  formatB2bPartnerOrderDate,
} from "@/lib/b2b-partner-orders";

describe("b2b partner archive rows", () => {
  it("keeps date, VIN, invoice number and amount on every demo row", () => {
    expect(B2B_PARTNER_DEMO_ORDERS.length).toBeGreaterThan(0);
    expect(B2B_PARTNER_DEMO_ORDERS[0]?.reportHref).toBeTruthy();
    expect(B2B_PARTNER_DEMO_ORDERS.slice(1).every((row) => !row.reportHref)).toBe(true);
    for (const row of B2B_PARTNER_DEMO_ORDERS) {
      expect(row.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}/);
      expect(row.vin.length).toBeGreaterThanOrEqual(11);
      expect(row.invoiceNumber).toMatch(/^PRV-\d{4}-\d{4}$/);
      expect(row.amountLabel).toMatch(/^\d+,\d{2} €$/);
      expect(row.amountLabel).not.toContain("—");
      expect(row.amountLabel).not.toContain("–");
    }
  });

  it("formats archive amounts without a unicode dash", () => {
    expect(formatB2bArchiveAmount(6999, "eur")).toBe("69,99 €");
    expect(formatB2bArchiveAmount(null, "EUR")).toBe("-");
  });

  it("formats dates for lv and en", () => {
    expect(formatB2bPartnerOrderDate("2026-09-02T10:14:00+03:00", "lv")).toBe("02.09.2026");
    expect(formatB2bPartnerOrderDate("2026-09-02T10:14:00+03:00", "en")).toBe("02/09/2026");
  });
});
