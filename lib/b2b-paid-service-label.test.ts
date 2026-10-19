import { describe, expect, it } from "vitest";
import { b2bPaidServiceLabelLv } from "@/lib/b2b-paid-service-label";
import { buildPartnerOrderNotes } from "@/lib/b2b-partner-orders";
import { buildB2bWalletOrderNoteParts } from "@/lib/b2b-wallet";

describe("b2bPaidServiceLabelLv", () => {
  it("reads wallet_product from stored notes without rewriting them", () => {
    const notes = [
      buildPartnerOrderNotes({
        plan: "dealer",
        partnerId: "ptr_0123456789abcdef",
        lotId: "wtx_1",
        companyName: "SIA Salons",
      }),
      ...buildB2bWalletOrderNoteParts({
        txnId: "wtx_1_1_abc",
        product: "dealer_pro",
        priceCents: 2499,
        reportLang: "lv",
      }),
    ].join(" · ");
    const snapshot = notes;
    expect(b2bPaidServiceLabelLv({ notes, checkoutLine: "dealer" })).toBe("Dīlera dati (PRO)");
    expect(notes).toBe(snapshot);
  });

  it("uses RAW / Business labels from wallet_product", () => {
    expect(
      b2bPaidServiceLabelLv({
        notes:
          "B2B dealer · partner_id=ptr_0123456789abcdef · wallet_txn=wtx_1 · wallet_product=dealer_raw · wallet_cents=1999",
      }),
    ).toBe("Dīlera dati (RAW)");
    expect(
      b2bPaidServiceLabelLv({
        notes:
          "B2B business · partner_id=ptr_0123456789abcdef · wallet_txn=wtx_2 · wallet_product=business · wallet_cents=7999",
      }),
    ).toBe("PROVIN Business");
  });

  it("falls back to checkout_line when wallet_product is absent (old orders)", () => {
    expect(
      b2bPaidServiceLabelLv({
        notes: "B2B dealer · partner_id=ptr_0123456789abcdef · lot=lot_1 · checkout_line=dealer",
        checkoutLine: "dealer",
      }),
    ).toBe("Dīlera dati");
    expect(b2bPaidServiceLabelLv({ checkoutLine: "business" })).toBe("PROVIN Business");
    expect(b2bPaidServiceLabelLv({ notes: "parasts komentārs", checkoutLine: "audit" })).toBeNull();
  });
});
