import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyB2bWalletTopup, emptyB2bWallet, type B2bWallet } from "@/lib/b2b-wallet";
import type { DealerDataJob } from "@/lib/dealer-data-job-types";

const PARTNER_ID = "ptr_0123456789abcdef";
const ORDER_ID = "manual_order_wallet1";
const NOTES =
  "B2B dealer · partner_id=ptr_0123456789abcdef · lot=wtx_1 · checkout_line=dealer · wallet_txn=wtx_1_1_abc · wallet_product=dealer_raw · wallet_cents=1999";

const state = vi.hoisted(() => ({
  wallet: null as unknown as B2bWallet,
  job: null as DealerDataJob | null,
  send: vi.fn(),
  partnerEmail: "salons@example.lv",
}));

vi.mock("@/lib/admin-order-draft-store", () => ({
  readOrderDraft: async () => ({ orderEdits: { notes: NOTES, vin: "WVWZZZ3HZHE703058" } }),
}));
vi.mock("@/lib/b2b-partner-store", () => ({
  getB2bPartnerById: async () => ({ id: PARTNER_ID, email: state.partnerEmail }),
}));
vi.mock("@/lib/b2b-wallet-store", () => ({
  readB2bWallet: async () => state.wallet,
  updateB2bWallet: async <R>(_id: string, fn: (w: B2bWallet) => { value: R; next?: B2bWallet }) => {
    const r = fn(state.wallet);
    if (r.next) state.wallet = r.next;
    return r.value;
  },
}));
vi.mock("@/lib/dealer-data-job-store", () => ({
  readDealerDataJob: async () => state.job,
  upsertDealerDataJob: async (_id: string, patch: { refund?: DealerDataJob["refund"]; vin: string }) => {
    if (!state.job) return null;
    if (patch.refund?.emailSentAt && !state.job.refund?.emailSentAt && state.job.refund) {
      state.job = { ...state.job, refund: { ...state.job.refund, emailSentAt: patch.refund.emailSentAt } };
    }
    return state.job;
  },
}));
vi.mock("@/lib/email/send-transactional", () => ({
  trySendB2bWalletRefundEmail: (args: { to: string; subject: string; text: string }) => state.send(args),
}));

describe("notifyB2bWalletRefundEmail", () => {
  beforeEach(() => {
    state.wallet = applyB2bWalletTopup(emptyB2bWallet(), { amountCents: 5000, sessionId: "cs_n" }).wallet;
    state.partnerEmail = "salons@example.lv";
    state.send.mockReset();
    state.send.mockResolvedValue(true);
    state.job = {
      sessionId: ORDER_ID,
      vin: "WVWZZZ3HZHE703058",
      status: "no_data",
      attempts: 1,
      createdAt: "2026-10-18T00:00:00.000Z",
      updatedAt: "2026-10-18T00:00:00.000Z",
      serviceEventCount: 0,
      refund: {
        at: "2026-10-18T12:00:00.000Z",
        amountCents: 1999,
        stripeRefundId: "wallet_wtx_1_1_abc",
        by: "admin",
        reason: "dealer_data_no_data_wallet",
        kind: "wallet",
      },
    };
  });

  it("sends one IRISS mail and then refuses a second send", async () => {
    const { notifyB2bWalletRefundEmail } = await import("@/lib/b2b-wallet-refund");
    expect(await notifyB2bWalletRefundEmail(ORDER_ID)).toBe(true);
    expect(state.send).toHaveBeenCalledTimes(1);
    const args = state.send.mock.calls[0]![0] as { to: string; subject: string; text: string };
    expect(args.to).toBe("salons@example.lv");
    expect(args.subject).toContain("IRISS");
    expect(args.subject + args.text).not.toMatch(/PROVIN/i);
    expect(args.text).toContain("19,99 €");
    expect(args.text).toContain("50,00 €");
    expect(state.job?.refund?.emailSentAt).toBeTruthy();

    expect(await notifyB2bWalletRefundEmail(ORDER_ID)).toBe(true);
    expect(state.send).toHaveBeenCalledTimes(1);
  });

  it("does not send when the refund is not a wallet refund", async () => {
    state.job = { ...state.job!, refund: { ...state.job!.refund!, kind: "credit" } };
    const { notifyB2bWalletRefundEmail } = await import("@/lib/b2b-wallet-refund");
    expect(await notifyB2bWalletRefundEmail(ORDER_ID)).toBe(false);
    expect(state.send).not.toHaveBeenCalled();
  });
});
