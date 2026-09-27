import { describe, expect, it } from "vitest";
import { sortAdminOrdersIncompleteFirst } from "@/lib/admin-audit-deadline-complete";
import {
  availableUpsellQuotes,
  buildUpsellDraft,
  DEALER_TO_AUDIT_CENTS,
  ensureUpsellUrlInText,
  MINI_DEALER_ADDON_CENTS,
  quoteOrderUpsell,
  upsellListOverlay,
  type UpsellOfferSnapshot,
} from "@/lib/order-upsell";

function offer(partial: Partial<UpsellOfferSnapshot> & Pick<UpsellOfferSnapshot, "kind" | "status">): UpsellOfferSnapshot {
  return {
    chargeCents: 7500,
    priorCents: 2499,
    targetCents: 9999,
    targetLine: "audit",
    expiresAt: "2099-01-01T00:00:00.000Z",
    token: "a".repeat(32),
    ...partial,
  };
}

describe("order upsell quotes", () => {
  it("charges 75 EUR to turn dealer data into a full audit", () => {
    const q = quoteOrderUpsell("dealer_to_audit", { checkoutLine: "dealer", amountTotalCents: 2499 });
    expect(q).toMatchObject({
      chargeCents: DEALER_TO_AUDIT_CENTS,
      priorCents: 2499,
      targetCents: 9999,
      targetLine: "audit",
    });
  });

  it("does not offer a consumer 20% audit price", () => {
    const quotes = availableUpsellQuotes({ checkoutLine: "dealer", amountTotalCents: 2499 });
    expect(quotes.map((q) => q.chargeCents)).not.toContain(7999);
    const draft = buildUpsellDraft({
      kind: "dealer_to_audit",
      vin: "WAUZZZF44LA062962",
      url: "https://provin.lv/lv/papildinajums/abc",
      priorCents: 2499,
      chargeCents: 7500,
      targetCents: 9999,
    });
    expect(draft.emailText).toContain("75,00 €");
    expect(draft.emailText).toContain("24,99 €");
    expect(draft.emailText).toContain("99,99 €");
    expect(draft.emailText).not.toContain("20%");
    expect(draft.emailText).not.toContain("79,99");
    expect(draft.whatsappText).not.toMatch(/—/);
    expect(draft.emailText).not.toMatch(/–/);
  });

  it("offers MINI a dealer add-on at 19,99 and the audit remainder without a discount", () => {
    const order = { checkoutLine: "mini" as const, amountTotalCents: 3999 };
    expect(quoteOrderUpsell("mini_to_dealer", order)?.chargeCents).toBe(MINI_DEALER_ADDON_CENTS);
    expect(quoteOrderUpsell("mini_to_audit", order)).toMatchObject({
      chargeCents: 6000,
      priorCents: 3999,
      targetCents: 9999,
    });
    const afterDealer = [
      offer({
        kind: "mini_to_dealer",
        status: "paid",
        chargeCents: 1999,
        priorCents: 3999,
        targetCents: 5998,
        targetLine: "mini",
        paidAt: "2026-09-01T10:00:00.000Z",
      }),
    ];
    expect(quoteOrderUpsell("mini_to_dealer", order, afterDealer)).toBeNull();
    expect(quoteOrderUpsell("mini_to_audit", order, afterDealer)?.chargeCents).toBe(4001);
  });

  it("stops offers after the order is already a full audit", () => {
    const settled = [
      offer({
        kind: "dealer_to_audit",
        status: "manual",
        paidAt: "2026-09-02T10:00:00.000Z",
      }),
    ];
    expect(availableUpsellQuotes({ checkoutLine: "dealer", amountTotalCents: 2499 }, settled)).toEqual([]);
  });

  it("overlays the list with the new total and a fresh 48h anchor", () => {
    const overlay = upsellListOverlay([
      offer({
        kind: "dealer_to_audit",
        status: "paid",
        paidAt: "2026-09-27T12:00:00.000Z",
      }),
    ]);
    expect(overlay?.targetCents).toBe(9999);
    expect(overlay?.targetLine).toBe("audit");
    expect(overlay?.badge).toContain("24,99 € + 75,00 €");
    expect(overlay?.paidAtUnix).toBe(Math.floor(Date.parse("2026-09-27T12:00:00.000Z") / 1000));
  });

  it("keeps an open offer from changing the order", () => {
    expect(
      upsellListOverlay([
        offer({ kind: "dealer_to_audit", status: "open" }),
      ]),
    ).toBeNull();
  });

  it("appends the pay link if the operator removed it", () => {
    expect(ensureUpsellUrlInText("Sveiki", "https://provin.lv/lv/papildinajums/abc")).toBe(
      "Sveiki\n\nApmaksāt: https://provin.lv/lv/papildinajums/abc",
    );
  });

  it("sorts a fresh upsell above older incomplete orders", () => {
    const rows = [
      { id: "newer-open", created: 500, activityUnix: 500 },
      { id: "old-upsell", created: 100, activityUnix: 900 },
    ];
    expect(sortAdminOrdersIncompleteFirst(rows).map((r) => r.id)).toEqual(["old-upsell", "newer-open"]);
  });
});
