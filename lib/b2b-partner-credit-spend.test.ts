import { describe, expect, it } from "vitest";
import { buildPartnerOrderNotes } from "@/lib/b2b-partner-orders";
import {
  normalizePartnerCompanyKey,
  resolvePartnerCreditSpendJob,
  tallyPartnerCreditSpend,
} from "@/lib/b2b-partner-credit-spend";

const PTR = "ptr_0123456789abcdef";

describe("partner credit spend tally", () => {
  it("counts VIN jobs per partner and sku", () => {
    const notes = buildPartnerOrderNotes({
      plan: "business",
      partnerId: PTR,
      lotId: "lot_1",
      companyName: "AM Cars SIA",
    });
    expect(
      tallyPartnerCreditSpend(
        [
          { partnerId: PTR, checkoutLine: "business" },
          { notes, checkoutLine: "audit" },
          { partnerId: PTR, checkoutLine: "dealer" },
          { partnerId: PTR, checkoutLine: "dealer", creditRestored: true },
          { partnerId: "ptr_ffffffffffffffff", checkoutLine: "business" },
        ],
        [PTR],
      ),
    ).toEqual({ [PTR]: { business: 2, dealer: 1 } });
  });

  it("maps a job without partner_id via company name", () => {
    const companyToId = new Map([[normalizePartnerCompanyKey("AM Cars SIA"), PTR]]);
    expect(
      resolvePartnerCreditSpendJob(
        { companyName: "AM Cars SIA", checkoutLine: "business" },
        companyToId,
      ),
    ).toEqual({ partnerId: PTR, plan: "business" });
    expect(
      tallyPartnerCreditSpend(
        [{ notes: "B2B business · partner_company=AM Cars SIA · checkout_line=business" }],
        [PTR],
        companyToId,
      ),
    ).toEqual({ [PTR]: { business: 1, dealer: 0 } });
  });
});
