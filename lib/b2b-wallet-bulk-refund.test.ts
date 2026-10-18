import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyB2bWalletTopup,
  emptyB2bWallet,
  type B2bWallet,
} from "@/lib/b2b-wallet";
import { buildPartnerOrderNotes } from "@/lib/b2b-partner-orders";
import type { DealerDataJob } from "@/lib/dealer-data-job-types";

const VINS = [
  "WVWZZZ3HZHE703058",
  "WVWZZZ1JZXW000001",
  "WVWZZZ1KZAW000001",
  "WBA8E9C50GK123456",
  "YV1MZ84BDK2123456",
] as const;

const PARTNER_ID = "ptr_0123456789abcdef";

const state = vi.hoisted(() => ({
  wallet: null as unknown as B2bWallet,
  drafts: new Map<string, { notes: string; vin: string }>(),
  jobs: new Map<string, DealerDataJob>(),
}));

vi.mock("@/lib/b2b-wallet-store", () => ({
  readB2bWallet: async () => state.wallet,
  updateB2bWallet: async <R>(_id: string, fn: (w: B2bWallet) => { value: R; next?: B2bWallet }) => {
    const r = fn(state.wallet);
    if (r.next) state.wallet = r.next;
    return r.value;
  },
}));

vi.mock("@/lib/b2b-partner-vin-dedup", () => ({
  findPartnerVinOrdersMap: async () => new Map(),
}));

vi.mock("@/lib/b2b-partner-place-vin-order", () => ({
  createPartnerCreditVinOrder: async (args: {
    vin: string;
    lotId: string;
    extraNoteParts?: readonly string[];
  }) => {
    const orderId = `manual_order_${args.lotId.replace(/\W/g, "").slice(-12) || args.vin.slice(-8)}`;
    const notes = buildPartnerOrderNotes({
      plan: "dealer",
      partnerId: PARTNER_ID,
      lotId: args.lotId,
      companyName: "Salons",
      extraParts: args.extraNoteParts,
    });
    state.drafts.set(orderId, { notes, vin: args.vin });
    state.jobs.set(orderId, {
      sessionId: orderId,
      vin: args.vin,
      status: "done",
      attempts: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      serviceEventCount: 1,
    });
    return { ok: true, orderId, dealerQueued: true };
  },
  schedulePartnerCreditVinOrderFollowups: vi.fn(),
}));

vi.mock("@/lib/admin-order-draft-store", () => ({
  readOrderDraft: async (id: string) => {
    const draft = state.drafts.get(id);
    return draft ? { orderEdits: { notes: draft.notes, vin: draft.vin } } : null;
  },
}));

vi.mock("@/lib/dealer-data-job-store", () => ({
  readDealerDataJob: async (id: string) => state.jobs.get(id) ?? null,
  upsertDealerDataJob: async (id: string, patch: Partial<DealerDataJob> & { vin: string }) => {
    const current = state.jobs.get(id);
    const next = {
      sessionId: id,
      vin: patch.vin,
      status: patch.status ?? current?.status ?? "no_data",
      attempts: current?.attempts ?? 1,
      createdAt: current?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      serviceEventCount: current?.serviceEventCount ?? 0,
      ...(patch.refund ? { refund: patch.refund } : current?.refund ? { refund: current.refund } : {}),
    } as DealerDataJob;
    state.jobs.set(id, next);
    return next;
  },
}));

function funded(cents: number): B2bWallet {
  return applyB2bWalletTopup(emptyB2bWallet(), { amountCents: cents, sessionId: "cs_bulk_ref" }).wallet;
}

describe("admin refunds each VIN from a bulk wallet order", () => {
  beforeEach(() => {
    state.wallet = funded(20_000);
    state.drafts = new Map();
    state.jobs = new Map();
  });

  it("charges 5 VINs as 5 orders, then refunds exactly 2 of them", async () => {
    const { purchaseB2bWalletBulk } = await import("@/lib/b2b-wallet-bulk-purchase");
    const bought = await purchaseB2bWalletBulk({
      partner: {
        id: PARTNER_ID,
        email: "salons@example.lv",
        phone: "+37120000000",
        contactName: "Jānis",
        companyName: "Salons",
        walletPrices: { business: null, dealer_raw: 1500, dealer_pro: null },
        walletHiddenProducts: [],
      },
      product: "dealer_raw",
      items: VINS.map((vin) => ({ vin, auditPurpose: null, listingUrl: "", reorder: false })),
      reportLang: null,
      bulkKey: "bulk_five_0001",
    });
    expect(bought.ok).toBe(true);
    if (!bought.ok) return;
    expect(bought.accepted).toHaveLength(5);
    expect(new Set(bought.accepted.map((row) => row.orderId)).size).toBe(5);
    expect(bought).toMatchObject({ priceCents: 1500, chargedCents: 7500, balanceCents: 12_500 });
    expect(state.wallet.txns.filter((txn) => txn.kind === "purchase")).toHaveLength(5);
    expect(new Set(state.wallet.txns.filter((txn) => txn.kind === "purchase").map((txn) => txn.vin)).size).toBe(5);

    const refundIds = bought.accepted.slice(0, 2).map((row) => row.orderId);
    for (const id of refundIds) {
      const job = state.jobs.get(id);
      if (job) state.jobs.set(id, { ...job, status: "no_data", serviceEventCount: 0 });
    }

    const { refundB2bWalletOrder } = await import("@/lib/b2b-wallet-refund");
    const first = await refundB2bWalletOrder(refundIds[0]!, {
      requireNoData: true,
      by: "admin",
      reason: "dealer_data_no_data_wallet",
    });
    const second = await refundB2bWalletOrder(refundIds[1]!, {
      requireNoData: true,
      by: "admin",
      reason: "dealer_data_no_data_wallet",
    });
    expect(first).toEqual({ refunded: true, amountCents: 1500, partnerId: PARTNER_ID });
    expect(second).toEqual({ refunded: true, amountCents: 1500, partnerId: PARTNER_ID });
    expect(state.wallet.balanceCents).toBe(15_500);
    expect(state.wallet.txns.filter((txn) => txn.kind === "refund")).toHaveLength(2);
    expect(state.wallet.txns.filter((txn) => txn.kind === "refund").map((txn) => txn.vin).sort()).toEqual(
      [VINS[0], VINS[1]].slice().sort(),
    );
    expect(state.jobs.get(refundIds[0]!)?.refund?.kind).toBe("wallet");
    expect(state.jobs.get(refundIds[1]!)?.refund?.amountCents).toBe(1500);

    const again = await refundB2bWalletOrder(refundIds[0]!, {
      requireNoData: true,
      by: "admin",
      reason: "dealer_data_no_data_wallet",
    });
    expect(again).toEqual({ refunded: false, reason: "already_refunded" });
    expect(state.wallet.txns.filter((txn) => txn.kind === "refund")).toHaveLength(2);
    expect(state.wallet.balanceCents).toBe(15_500);
    expect(state.wallet.txns.filter((txn) => txn.kind === "purchase" && !txn.orderId)).toHaveLength(0);
  });
});
