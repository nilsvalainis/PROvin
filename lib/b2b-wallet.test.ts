import { describe, expect, it } from "vitest";
import { compareAndSwap, createMemoryConditionalStore } from "@/lib/conditional-write";
import { CLIENT_REPORT_LANGS } from "@/lib/client-report-i18n";
import {
  B2B_WALLET_REPORT_LANGS,
  applyB2bWalletAdjust,
  applyB2bWalletPurchase,
  applyB2bWalletRefund,
  applyB2bWalletTopup,
  b2bWalletDiscountPct,
  buildB2bWalletOrderNoteParts,
  canAffordCheapestB2bWalletProduct,
  cheapestB2bWalletPriceCents,
  emptyB2bWallet,
  formatB2bWalletEuro,
  isB2bWalletProductVisible,
  isB2bWalletReportLang,
  parseB2bWallet,
  parseB2bWalletHiddenProducts,
  parseB2bWalletOrderMarks,
  resolveB2bWalletPrice,
  shouldAutoRefundB2bWalletOrder,
  validateB2bWalletPriceInput,
  visibleB2bWalletProducts,
  type B2bWallet,
} from "@/lib/b2b-wallet";
import { buildB2bWalletView } from "@/lib/b2b-wallet-view";

function funded(cents: number): B2bWallet {
  return applyB2bWalletTopup(emptyB2bWallet(), { amountCents: cents, sessionId: "cs_test_seed" }).wallet;
}

describe("b2b wallet ledger", () => {
  it("credits a top-up once per Stripe session", () => {
    const first = applyB2bWalletTopup(emptyB2bWallet(), { amountCents: 3000, sessionId: "cs_1" });
    expect(first.applied).toBe(true);
    expect(first.wallet.balanceCents).toBe(3000);
    expect(first.wallet.topupTotalCents).toBe(3000);
    const again = applyB2bWalletTopup(first.wallet, { amountCents: 3000, sessionId: "cs_1" });
    expect(again.applied).toBe(false);
    expect(again.wallet.balanceCents).toBe(3000);
    expect(again.wallet.txns).toHaveLength(1);
  });

  it("deducts the price and refuses when the balance is short", () => {
    const wallet = funded(2000);
    const ok = applyB2bWalletPurchase(wallet, { product: "dealer_raw", priceCents: 1599, idempotencyKey: "k1", vin: "WVWZZZ1KZAW000001" });
    expect(ok.ok).toBe(true);
    if (!ok.ok) return;
    expect(ok.wallet.balanceCents).toBe(401);
    expect(ok.wallet.spentTotalCents).toBe(1599);
    expect(ok.txn.amountCents).toBe(-1599);
    const short = applyB2bWalletPurchase(ok.wallet, { product: "dealer_raw", priceCents: 1599, idempotencyKey: "k2", vin: "WVWZZZ1KZAW000001" });
    expect(short).toEqual({ ok: false, reason: "insufficient", balanceCents: 401, priceCents: 1599 });
  });

  it("does not charge twice for the same idempotency key", () => {
    const wallet = funded(5000);
    const a = applyB2bWalletPurchase(wallet, { product: "dealer_pro", priceCents: 1999, idempotencyKey: "same", vin: "V" });
    if (!a.ok) throw new Error("expected ok");
    const b = applyB2bWalletPurchase(a.wallet, { product: "dealer_pro", priceCents: 1999, idempotencyKey: "same", vin: "V" });
    expect(b.ok && b.duplicate).toBe(true);
    if (!b.ok) return;
    expect(b.wallet.balanceCents).toBe(3001);
    expect(b.txn.id).toBe(a.txn.id);
  });

  it("never overdraws under concurrent purchases (compare-and-swap)", async () => {
    const store = createMemoryConditionalStore<B2bWallet>();
    await store.write("ptr", funded(5000), null);
    const buy = (i: number) =>
      compareAndSwap<B2bWallet, boolean>({
        read: () => store.read("ptr"),
        write: (next, etag) => store.write("ptr", next, etag),
        maxAttempts: 20,
        update: (current) => {
          const r = applyB2bWalletPurchase(parseB2bWallet(current), {
            product: "dealer_raw",
            priceCents: 1599,
            idempotencyKey: `buy_${i}`,
            vin: "WVWZZZ1KZAW000001",
          });
          return r.ok && !r.duplicate ? { next: r.wallet, result: true } : { result: false };
        },
      });
    const results = await Promise.all(Array.from({ length: 8 }, (_, i) => buy(i)));
    const final = store.peek("ptr")!;
    expect(results.filter(Boolean)).toHaveLength(3);
    expect(final.balanceCents).toBe(5000 - 3 * 1599);
    expect(final.balanceCents).toBeGreaterThanOrEqual(0);
    expect(final.txns.filter((t) => t.kind === "purchase")).toHaveLength(3);
  });

  it("refunds a purchase back to the balance exactly once", () => {
    const bought = applyB2bWalletPurchase(funded(2000), { product: "dealer_raw", priceCents: 1599, idempotencyKey: "r1", vin: "V" });
    if (!bought.ok) throw new Error("expected ok");
    const refund = applyB2bWalletRefund(bought.wallet, { purchaseTxnId: bought.txn.id, note: "no data" });
    expect(refund.applied).toBe(true);
    expect(refund.wallet.balanceCents).toBe(2000);
    expect(refund.wallet.spentTotalCents).toBe(0);
    expect(refund.txn?.kind).toBe("refund");
    const again = applyB2bWalletRefund(refund.wallet, { purchaseTxnId: bought.txn.id });
    expect(again.applied).toBe(false);
    expect(again.wallet.balanceCents).toBe(2000);
    expect(applyB2bWalletRefund(funded(100), { purchaseTxnId: "wtx_missing" }).applied).toBe(false);
  });

  it("admin adjust needs a note and cannot go negative", () => {
    const wallet = funded(1000);
    expect(applyB2bWalletAdjust(wallet, { amountCents: 500, note: " ", key: "a1" })).toEqual({ ok: false, reason: "note_required" });
    expect(applyB2bWalletAdjust(wallet, { amountCents: -1500, note: "x", key: "a2" })).toEqual({ ok: false, reason: "negative_balance" });
    const ok = applyB2bWalletAdjust(wallet, { amountCents: -400, note: "korekcija", key: "a3" });
    expect(ok.ok && ok.wallet.balanceCents).toBe(600);
  });
});

describe("b2b wallet auto refund on missing dealer data", () => {
  const notes = (product: "business" | "dealer_raw" | "dealer_pro") =>
    ["B2B partner", "partner_id=ptr_0123456789abcdef", ...buildB2bWalletOrderNoteParts({ txnId: "wtx_1_1_abc", product, priceCents: 1599, reportLang: product === "dealer_pro" ? "ru" : null })].join(" · ");

  it("parses wallet marks from order notes", () => {
    expect(parseB2bWalletOrderMarks(notes("dealer_pro"))).toEqual({
      txnId: "wtx_1_1_abc",
      product: "dealer_pro",
      priceCents: 1599,
      reportLang: "ru",
    });
    expect(parseB2bWalletOrderMarks("partner_id=ptr_0123456789abcdef lot=x")).toBeNull();
  });

  it("keeps German as a PRO report language from order notes to the PDF language", () => {
    const de = buildB2bWalletOrderNoteParts({ txnId: "wtx_1_1_abc", product: "dealer_pro", priceCents: 1999, reportLang: "de" }).join(" · ");
    expect(de).toContain("report_lang=de");
    expect(parseB2bWalletOrderMarks(de)?.reportLang).toBe("de");
    expect(isB2bWalletReportLang("de")).toBe(true);
    expect(isB2bWalletReportLang("fr")).toBe(false);
    expect(parseB2bWalletOrderMarks(`${de.replace("report_lang=de", "report_lang=dex")}`)?.reportLang).toBeNull();
    for (const lang of B2B_WALLET_REPORT_LANGS) expect(CLIENT_REPORT_LANGS).toContain(lang);
  });

  it("refunds RAW and PRO only when the dealer job says no data", () => {
    expect(shouldAutoRefundB2bWalletOrder({ notes: notes("dealer_raw"), dealerJobStatus: "no_data" })?.txnId).toBe("wtx_1_1_abc");
    expect(shouldAutoRefundB2bWalletOrder({ notes: notes("dealer_pro"), dealerJobStatus: "no_data" })).not.toBeNull();
    expect(shouldAutoRefundB2bWalletOrder({ notes: notes("dealer_raw"), dealerJobStatus: "done" })).toBeNull();
    expect(shouldAutoRefundB2bWalletOrder({ notes: notes("dealer_raw"), dealerJobStatus: "failed" })).toBeNull();
    expect(shouldAutoRefundB2bWalletOrder({ notes: notes("business"), dealerJobStatus: "no_data" })).toBeNull();
    expect(shouldAutoRefundB2bWalletOrder({ notes: "legacy credit order", dealerJobStatus: "no_data" })).toBeNull();
  });
});

describe("b2b wallet prices", () => {
  it("rejects admin prices below the product minimum", () => {
    expect(validateB2bWalletPriceInput({ business: "69,98", dealer_raw: "", dealer_pro: null })).toEqual({
      ok: false,
      product: "business",
      reason: "below_min",
      minCents: 6999,
    });
    expect(validateB2bWalletPriceInput({ dealer_raw: "11,98" })).toMatchObject({ ok: false, product: "dealer_raw", reason: "below_min" });
    expect(validateB2bWalletPriceInput({ dealer_raw: "abc" })).toMatchObject({ ok: false, reason: "invalid" });
    expect(validateB2bWalletPriceInput({ business: "69,99", dealer_raw: "11.99 €", dealer_pro: "" })).toEqual({
      ok: true,
      prices: { business: 6999, dealer_raw: 1199, dealer_pro: null },
    });
  });

  it("empty override means the default price", () => {
    expect(resolveB2bWalletPrice("business", null)).toEqual({ product: "business", priceCents: 7999, defaultCents: 7999, discountPct: 0 });
    expect(resolveB2bWalletPrice("dealer_raw", { business: null, dealer_raw: null, dealer_pro: null }).priceCents).toBe(1599);
    expect(resolveB2bWalletPrice("dealer_pro", { business: null, dealer_raw: null, dealer_pro: 1999 }).discountPct).toBe(0);
  });

  it("computes the discount badge percentage", () => {
    expect(resolveB2bWalletPrice("business", { business: 7199, dealer_raw: null, dealer_pro: null }).discountPct).toBe(10);
    expect(b2bWalletDiscountPct(1199, 1599)).toBe(25);
    expect(b2bWalletDiscountPct(7998, 7999)).toBe(1);
    expect(b2bWalletDiscountPct(7999, 7999)).toBe(0);
  });

  it("uses the cheapest price for the low balance state", () => {
    expect(cheapestB2bWalletPriceCents(null)).toBe(1599);
    expect(canAffordCheapestB2bWalletProduct(850, null)).toBe(false);
    expect(canAffordCheapestB2bWalletProduct(0, null)).toBe(false);
    expect(canAffordCheapestB2bWalletProduct(12000, null)).toBe(true);
    expect(canAffordCheapestB2bWalletProduct(1199, { business: null, dealer_raw: 1199, dealer_pro: null })).toBe(true);
  });

  it("formats euro amounts with a comma and ASCII minus", () => {
    expect(formatB2bWalletEuro(12000)).toBe("120,00 €");
    expect(formatB2bWalletEuro(850)).toBe("8,50 €");
    expect(formatB2bWalletEuro(-1599)).toBe("-15,99 €");
    expect(formatB2bWalletEuro(-1599)).not.toMatch(/[\u2013\u2014\u2212]/);
  });

  it("builds a view with newest transactions first", () => {
    const a = applyB2bWalletTopup(emptyB2bWallet(), { amountCents: 1500, sessionId: "cs_a" }).wallet;
    const b = applyB2bWalletTopup(a, { amountCents: 3000, sessionId: "cs_b" }).wallet;
    const view = buildB2bWalletView(b, null);
    expect(view.balanceCents).toBe(4500);
    expect(view.txns[0]?.sessionId).toBe("cs_b");
    expect(view.cheapestCents).toBe(1599);
    expect(view.products).toEqual(["business", "dealer_raw", "dealer_pro"]);
  });

  it("drops admin-hidden products from the view and the cheapest price", () => {
    expect(parseB2bWalletHiddenProducts(undefined)).toEqual([]);
    expect(parseB2bWalletHiddenProducts("dealer_raw")).toEqual([]);
    expect(parseB2bWalletHiddenProducts(["dealer_pro", "x", "dealer_raw"])).toEqual(["dealer_raw", "dealer_pro"]);
    expect(isB2bWalletProductVisible("business", [])).toBe(true);
    expect(isB2bWalletProductVisible("dealer_raw", ["dealer_raw"])).toBe(false);
    expect(visibleB2bWalletProducts(["business"])).toEqual(["dealer_raw", "dealer_pro"]);

    const wallet = applyB2bWalletTopup(emptyB2bWallet(), { amountCents: 1700, sessionId: "cs_v" }).wallet;
    const noRaw = buildB2bWalletView(wallet, null, 50, ["dealer_raw"]);
    expect(noRaw.products).toEqual(["business", "dealer_pro"]);
    expect(noRaw.cheapestCents).toBe(1999);
    expect(canAffordCheapestB2bWalletProduct(1700, null, ["dealer_raw"])).toBe(false);

    const none = buildB2bWalletView(wallet, null, 50, ["business", "dealer_raw", "dealer_pro"]);
    expect(none.products).toEqual([]);
    expect(none.cheapestCents).toBe(0);
  });
});
