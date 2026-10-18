import { describe, expect, it } from "vitest";
import { prepareBulkVinDebit } from "@/lib/b2b-partner-bulk-vin-debit";
import {
  emptyB2bCreditWallet,
  grantB2bCredits,
  remainingB2bCredits,
  rememberB2bDebitKey,
} from "@/lib/b2b-partner-credits";
import { partnerVinSpendKey } from "@/lib/b2b-partner-archive-rows";

const NOW = Date.parse("2026-10-18T09:00:00.000Z");
const VIN_A = "WVWZZZ3HZHE703058";
const VIN_B = "WVWZZZ1JZXW000001";

function item(vin: string, reorder = false) {
  return { vin, auditPurpose: "client" as const, listingUrl: "", reorder };
}

describe("prepareBulkVinDebit", () => {
  it("refuses the whole batch when credits are short, without debiting", () => {
    const now = new Date(NOW);
    const wallet = grantB2bCredits(emptyB2bCreditWallet(), "business", 1, now);
    const prep = prepareBulkVinDebit({
      wallet,
      plan: "business",
      items: [item(VIN_A), item(VIN_B)],
      already: new Map(),
      nowMs: NOW,
    });
    expect(prep).toEqual({ ok: false, have: 1, need: 2 });
    expect(remainingB2bCredits(wallet.lots, now).business).toBe(1);
  });

  it("replays when the bulk idempotency key is already stored", () => {
    const now = new Date(NOW);
    let wallet = grantB2bCredits(emptyB2bCreditWallet(), "business", 5, now);
    wallet = rememberB2bDebitKey(wallet, "bulk_abc");
    const prep = prepareBulkVinDebit({
      wallet,
      plan: "business",
      items: [item(VIN_A)],
      already: new Map(),
      nowMs: NOW,
      bulkKey: "bulk_abc",
    });
    expect(prep).toEqual({ ok: true, replay: true });
  });

  it("skips already ordered VINs unless reorder is set, then debits the rest", () => {
    const now = new Date(NOW);
    const wallet = grantB2bCredits(emptyB2bCreditWallet(), "business", 5, now);
    const already = new Map([
      [VIN_A, { id: "ord_old", created: NOW / 1000, reportReady: false }],
    ]);
    const prep = prepareBulkVinDebit({
      wallet,
      plan: "business",
      items: [item(VIN_A), item(VIN_B), item(VIN_A, true)],
      already,
      nowMs: NOW,
      bulkKey: "bulk_1",
    });
    expect(prep.ok).toBe(true);
    if (!prep.ok || prep.replay) throw new Error("expected debit");
    expect(prep.charged.map((row) => row.vin)).toEqual([VIN_B, VIN_A]);
    expect(prep.charged[1]?.reorder).toBe(true);
    expect(remainingB2bCredits(prep.wallet.lots, now).business).toBe(3);
    expect(prep.wallet.debitKeys).toContain("bulk_1");
    expect(prep.wallet.debitKeys).toContain(partnerVinSpendKey(VIN_B, "business", NOW));
  });
});
