import { describe, expect, it } from "vitest";
import type { AdminPushMessage } from "@/lib/admin-push-shared";
import { applyB2bWalletTopup, emptyB2bWallet, type B2bWallet } from "@/lib/b2b-wallet";
import {
  handleStripeChargeEvent,
  type ChargeSessionInfo,
  type StripeChargeEventDeps,
} from "@/lib/stripe-charge-events";
import {
  netPaidAmountCents,
  paymentAdjustmentView,
  type StripePaymentAdjustment,
} from "@/lib/stripe-payment-adjustments";
import { serializeAdminOrderTableRows } from "@/lib/serialize-admin-order-table";

const PARTNER = "ptr_0123456789abcdef";

function harness(sessions: Record<string, ChargeSessionInfo>, charges: Record<string, { paymentIntentId: string; amountCents: number }> = {}) {
  const adjustments = new Map<string, StripePaymentAdjustment>();
  const wallets = new Map<string, B2bWallet>();
  const pushes: AdminPushMessage[] = [];
  let writes = 0;
  const deps: StripeChargeEventDeps = {
    async findSessionByPaymentIntent(pi) {
      return sessions[pi] ?? null;
    },
    async retrieveCharge(id) {
      return charges[id] ?? null;
    },
    async updateAdjustment(sessionId, mutate) {
      const r = mutate(adjustments.get(sessionId));
      if (r.next) {
        writes++;
        adjustments.set(sessionId, r.next);
      }
      return r.value;
    },
    async updateWallet(partnerId, mutate) {
      const r = mutate(wallets.get(partnerId) ?? emptyB2bWallet());
      if (r.next) wallets.set(partnerId, r.next);
      return r.value;
    },
    async push(msg) {
      pushes.push(msg);
    },
    now: () => new Date("2026-11-18T10:00:00Z"),
  };
  return { deps, adjustments, wallets, pushes, writes: () => writes };
}

const auditSession: ChargeSessionInfo = {
  id: "cs_live_audit1",
  fulfillment: null,
  partnerId: null,
  vin: "WBA3K11000F123456",
  amountTotalCents: 7999,
};

const topupSession: ChargeSessionInfo = {
  id: "cs_live_topup1",
  fulfillment: "b2b_wallet_topup",
  partnerId: PARTNER,
  vin: null,
  amountTotalCents: 6000,
};

function refundEvent(id: string, pi: string, amount: number, refunded: number, created = 1_800_000_000) {
  return {
    id,
    type: "charge.refunded",
    created,
    data: { object: { id: "ch_1", object: "charge", amount, amount_refunded: refunded, payment_intent: pi } },
  };
}

function disputeEvent(
  type: string,
  status: string,
  opts: { pi?: string | null; charge?: string; amount?: number; created?: number; id?: string } = {},
) {
  return {
    id: opts.id ?? `evt_${type}_${status}`,
    type,
    created: opts.created ?? 1_800_000_100,
    data: {
      object: {
        id: "dp_1",
        object: "dispute",
        amount: opts.amount ?? 7999,
        charge: opts.charge ?? "ch_1",
        payment_intent: opts.pi === undefined ? "pi_audit" : opts.pi,
        status,
        reason: "fraudulent",
        created: 1_800_000_050,
      },
    },
  };
}

describe("charge.refunded", () => {
  it("pilna atmaksa: pasūtījums atzīmēts „Atmaksāts”, vajag kredītrēķinu, statistikā 0", async () => {
    const h = harness({ pi_audit: auditSession });
    const r = await handleStripeChargeEvent(refundEvent("evt_1", "pi_audit", 7999, 7999), h.deps);
    expect(r).toMatchObject({ handled: true, sessionId: "cs_live_audit1", changed: true, pushed: false });
    const adj = h.adjustments.get("cs_live_audit1")!;
    expect(paymentAdjustmentView(adj)).toEqual({ label: "Atmaksāts", tone: "refund", fullyReversed: true });
    expect(adj.invoiceNeedsCreditNote).toBe(true);
    expect(netPaidAmountCents(7999, adj)).toBe(0);
    expect(h.wallets.size).toBe(0);
    expect(h.pushes).toHaveLength(0);
  });

  it("atkārtots notikums ar to pašu summu neko nepārraksta", async () => {
    const h = harness({ pi_audit: auditSession });
    await handleStripeChargeEvent(refundEvent("evt_1", "pi_audit", 7999, 2000), h.deps);
    const r = await handleStripeChargeEvent(refundEvent("evt_2", "pi_audit", 7999, 2000), h.deps);
    expect(r).toMatchObject({ handled: true, changed: false });
    expect(h.writes()).toBe(1);
  });

  it("daļēja atmaksa rāda summu; vecāks notikums ar mazāku summu atmaksu nesamazina", async () => {
    const h = harness({ pi_audit: auditSession });
    await handleStripeChargeEvent(refundEvent("evt_1", "pi_audit", 7999, 3000), h.deps);
    await handleStripeChargeEvent(refundEvent("evt_0", "pi_audit", 7999, 1000), h.deps);
    const adj = h.adjustments.get("cs_live_audit1")!;
    expect(adj.refundedCents).toBe(3000);
    expect(paymentAdjustmentView(adj)?.label).toBe("Atmaksāts 30,00 €");
    expect(netPaidAmountCents(7999, adj)).toBe(4999);
  });

  it("maka papildinājums: atmaksātā summa atņemta no maka vienreiz, pēc tam tikai starpība", async () => {
    const h = harness({ pi_topup: topupSession });
    h.wallets.set(PARTNER, applyB2bWalletTopup(emptyB2bWallet(), { amountCents: 6000, sessionId: "cs_live_topup1" }).wallet);

    await handleStripeChargeEvent(refundEvent("evt_1", "pi_topup", 6000, 2000), h.deps);
    expect(h.wallets.get(PARTNER)!.balanceCents).toBe(4000);

    const dup = await handleStripeChargeEvent(refundEvent("evt_2", "pi_topup", 6000, 2000), h.deps);
    expect(dup).toMatchObject({ walletCorrectedCents: 0 });
    expect(h.wallets.get(PARTNER)!.balanceCents).toBe(4000);

    const more = await handleStripeChargeEvent(refundEvent("evt_3", "pi_topup", 6000, 6000), h.deps);
    expect(more).toMatchObject({ walletCorrectedCents: 4000 });
    const wallet = h.wallets.get(PARTNER)!;
    expect(wallet.balanceCents).toBe(0);
    expect(wallet.topupTotalCents).toBe(0);
    expect(wallet.txns.filter((t) => t.kind === "adjust").map((t) => t.amountCents)).toEqual([-2000, -4000]);
  });

  it("maks var kļūt negatīvs, ja papildinājums jau iztērēts", async () => {
    const h = harness({ pi_topup: topupSession });
    const topped = applyB2bWalletTopup(emptyB2bWallet(), { amountCents: 6000, sessionId: "cs_live_topup1" }).wallet;
    h.wallets.set(PARTNER, { ...topped, balanceCents: 1000 });
    await handleStripeChargeEvent(refundEvent("evt_1", "pi_topup", 6000, 6000), h.deps);
    expect(h.wallets.get(PARTNER)!.balanceCents).toBe(-5000);
  });

  it("nezināms maksājums (nav Checkout sesijas) netiek apstrādāts", async () => {
    const h = harness({});
    const r = await handleStripeChargeEvent(refundEvent("evt_1", "pi_other", 1000, 1000), h.deps);
    expect(r).toEqual({ handled: false, reason: "session_not_found" });
    expect(h.adjustments.size).toBe(0);
  });
});

describe("charge.dispute.*", () => {
  it("jauns strīds: atzīme „Strīds”, viens push Nilam, nauda vēl nav atņemta", async () => {
    const h = harness({ pi_audit: auditSession });
    const r = await handleStripeChargeEvent(disputeEvent("charge.dispute.created", "needs_response"), h.deps);
    expect(r).toMatchObject({ handled: true, pushed: true });
    expect(h.pushes[0]).toMatchObject({ title: "Stripe strīds (chargeback)", url: "/admin/orders/cs_live_audit1", audience: "pro" });
    expect(h.pushes[0]!.body).toContain("79,99 €");
    expect(h.pushes[0]!.body).not.toContain("WBA3K11000F123456");
    const adj = h.adjustments.get("cs_live_audit1")!;
    expect(paymentAdjustmentView(adj)?.label).toBe("Strīds");
    expect(netPaidAmountCents(7999, adj)).toBe(7999);

    await handleStripeChargeEvent(disputeEvent("charge.dispute.updated", "under_review", { id: "evt_u" }), h.deps);
    expect(h.pushes).toHaveLength(1);
  });

  it("zaudēts strīds: push, izslēgts no ieņēmumiem; maka papildinājumam korekcija", async () => {
    const h = harness({ pi_topup: topupSession });
    h.wallets.set(PARTNER, applyB2bWalletTopup(emptyB2bWallet(), { amountCents: 6000, sessionId: "cs_live_topup1" }).wallet);
    await handleStripeChargeEvent(disputeEvent("charge.dispute.created", "needs_response", { pi: "pi_topup", amount: 6000 }), h.deps);
    expect(h.wallets.get(PARTNER)!.balanceCents).toBe(6000);

    const r = await handleStripeChargeEvent(
      disputeEvent("charge.dispute.closed", "lost", { pi: "pi_topup", amount: 6000, created: 1_800_000_200 }),
      h.deps,
    );
    expect(r).toMatchObject({ walletCorrectedCents: 6000, pushed: true });
    expect(h.pushes.at(-1)!.title).toBe("Stripe strīds zaudēts");
    const adj = h.adjustments.get("cs_live_topup1")!;
    expect(paymentAdjustmentView(adj)?.label).toBe("Strīds zaudēts");
    expect(netPaidAmountCents(6000, adj)).toBe(0);
    expect(h.wallets.get(PARTNER)!.balanceCents).toBe(0);

    // Atkārtots closed notikums: ne otra korekcija, ne otrs push.
    await handleStripeChargeEvent(
      disputeEvent("charge.dispute.closed", "lost", { pi: "pi_topup", amount: 6000, id: "evt_again", created: 1_800_000_300 }),
      h.deps,
    );
    expect(h.wallets.get(PARTNER)!.balanceCents).toBe(0);
    expect(h.pushes).toHaveLength(2);
  });

  it("uzvarēts strīds paliek ieņēmumos; vecāks atvērts notikums to neatver atpakaļ", async () => {
    const h = harness({ pi_audit: auditSession });
    await handleStripeChargeEvent(disputeEvent("charge.dispute.closed", "won", { created: 1_800_000_500 }), h.deps);
    await handleStripeChargeEvent(
      disputeEvent("charge.dispute.updated", "under_review", { id: "evt_late", created: 1_800_000_400 }),
      h.deps,
    );
    const adj = h.adjustments.get("cs_live_audit1")!;
    expect(adj.dispute?.status).toBe("won");
    expect(paymentAdjustmentView(adj)?.label).toBe("Strīds uzvarēts");
    expect(netPaidAmountCents(7999, adj)).toBe(7999);
  });

  it("strīds bez payment_intent: maksājumu atrod caur Charge", async () => {
    const h = harness({ pi_audit: auditSession }, { ch_1: { paymentIntentId: "pi_audit", amountCents: 7999 } });
    const r = await handleStripeChargeEvent(disputeEvent("charge.dispute.created", "needs_response", { pi: null }), h.deps);
    expect(r).toMatchObject({ handled: true, sessionId: "cs_live_audit1" });
  });

  it("citi notikumi netiek apstrādāti", async () => {
    const h = harness({ pi_audit: auditSession });
    const r = await handleStripeChargeEvent({ id: "e", type: "charge.succeeded", created: 1, data: { object: {} } }, h.deps);
    expect(r).toEqual({ handled: false, reason: "unsupported_event" });
  });
});

describe("admin saraksts", () => {
  it("serializētā rinda nes atmaksas/strīda atzīmi", () => {
    const [row] = serializeAdminOrderTableRows([
      {
        id: "cs_live_audit1",
        created: 1,
        amountTotal: 7999,
        currency: "EUR",
        paymentStatus: "paid",
        customerEmail: null,
        vin: null,
        paymentAdjustment: { label: "Strīds", tone: "dispute", clawbackCents: 0, invoiceNeedsCreditNote: true },
      },
    ]);
    expect(row).toMatchObject({ paymentAdjustmentLabel: "Strīds", paymentAdjustmentTone: "dispute" });
  });
});
