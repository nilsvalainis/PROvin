/**
 * Nils 26.11: dīlera datu atmaksa tikai no loga ar Nila apstiprināto tekstu.
 * - bez teksta atmaksas nav;
 * - aiziet tieši rediģētais teksts;
 * - Stripe kļūda -> e-pastu nesūta;
 * - dubulta atmaksa nav iespējama.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DealerDataJob } from "@/lib/dealer-data-job-types";

const h = vi.hoisted(() => ({
  jobs: new Map<string, unknown>(),
  refundsCreate: vi.fn(),
  sendMail: vi.fn(async (_opts: unknown) => true),
  recordSend: vi.fn(async (_sid: string, _rec: unknown) => ({ dealerSends: [] })),
}));

vi.mock("@/lib/admin-auth", () => ({ getAdminSession: async () => ({ user: "admin" }) }));
vi.mock("@/lib/admin-order-draft-store", () => ({
  isSafeOrderDraftSessionId: (s: string) => /^[A-Za-z0-9_-]{4,200}$/.test(s),
  readOrderDraft: async () => ({ orderEdits: { customerEmail: "klients@example.com", vin: "WAUZZZ4F87N058349" } }),
}));
vi.mock("@/lib/dealer-data-job-store", async () => {
  const t = await import("@/lib/dealer-data-job-types");
  const read = async (sid: string) => (h.jobs.has(sid) ? (t.normalizeDealerDataJob(h.jobs.get(sid), sid) as DealerDataJob) : null);
  return {
    readDealerDataJob: read,
    writeDealerDataJob: async (job: DealerDataJob) => {
      h.jobs.set(job.sessionId, job);
      return true;
    },
    upsertDealerDataJob: async (sid: string, patch: Partial<DealerDataJob>) => {
      const cur = (await read(sid)) ?? {};
      const next = { ...cur, ...patch, sessionId: sid };
      h.jobs.set(sid, next);
      return next;
    },
    claimDealerRefundLock: async (sid: string) => {
      const cur = await read(sid);
      const gate = t.decideDealerRefundLock(cur);
      if (!gate.ok) return gate;
      const next = { ...cur!, refundPendingAt: new Date().toISOString() };
      h.jobs.set(sid, next);
      return { ok: true, job: next };
    },
    releaseDealerRefundLock: async (sid: string) => {
      const cur = await read(sid);
      if (cur) {
        const { refundPendingAt: _x, ...rest } = cur;
        void _x;
        h.jobs.set(sid, rest);
      }
    },
  };
});
vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({
    checkout: {
      sessions: {
        retrieve: async (id: string) => ({
          id,
          amount_total: 1749,
          payment_status: "paid",
          payment_intent: "pi_test_1",
          locale: "lv",
          customer_details: { email: "klients@example.com" },
        }),
      },
    },
    refunds: { create: h.refundsCreate },
  }),
}));
vi.mock("@/lib/stripe-session", () => ({ getCheckoutLineFromSession: () => null }));
vi.mock("@/lib/email/send-transactional", () => ({
  trySendDealerDataOperatorEmail: h.sendMail,
}));
vi.mock("@/lib/order-client-marks-store", () => ({ recordDealerSendOnServer: h.recordSend }));
vi.mock("@/lib/dealer-send-recipient", () => ({
  resolveDealerSendRecipient: async (o: { requested: string }) => ({ ok: true, to: o.requested || "klients@example.com" }),
  dealerSendRecipientErrorBody: () => ({ error: "recipient" }),
}));
vi.mock("@/lib/b2b-wallet-refund", () => ({ notifyB2bWalletRefundEmail: vi.fn(), refundB2bWalletOrder: vi.fn() }));
vi.mock("@/lib/b2b-partner-credit-store", () => ({ updateB2bCreditWallet: vi.fn() }));

import { POST } from "@/app/api/admin/dealer-data/refund/route";

const SID = "cs_live_test_refund_1";

function req(body: unknown) {
  return new Request("http://localhost/api/admin/dealer-data/refund", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const EDITED = {
  sessionId: SID,
  channel: "email",
  subject: "PROVIN · Nila labots temats",
  text: "Labdien!\n\nNila labots teksts par atmaksu.\n\nAr cieņu,\nPROVIN.LV",
  lang: "lv",
  customerEmail: "klients@example.com",
};

beforeEach(() => {
  h.jobs.clear();
  h.jobs.set(SID, {
    sessionId: SID,
    vin: "WAUZZZ4F87N058349",
    status: "no_data",
    attempts: 1,
    createdAt: "2026-11-26T18:00:00.000Z",
    updatedAt: "2026-11-26T18:00:00.000Z",
  });
  h.refundsCreate.mockReset();
  h.refundsCreate.mockResolvedValue({ id: "re_test_1" });
  h.sendMail.mockClear();
  h.sendMail.mockResolvedValue(true);
  h.recordSend.mockClear();
});

describe("POST /api/admin/dealer-data/refund (Stripe, atmaksas logs)", () => {
  it("bez loga teksta (vecais «notifyEmail» pieprasījums) - nekādas atmaksas un e-pasta", async () => {
    const res = await POST(req({ sessionId: SID, notifyEmail: true }));
    expect(res.status).toBe(400);
    expect(h.refundsCreate).not.toHaveBeenCalled();
    expect(h.sendMail).not.toHaveBeenCalled();
  });

  it("aiziet tieši Nila rediģētais temats un teksts, bez «nosūtīts automātiski», pēc atmaksas", async () => {
    const res = await POST(req(EDITED));
    const body = (await res.json()) as { ok: boolean; emailSent: boolean };
    expect(res.status).toBe(200);
    expect(body).toMatchObject({ ok: true, emailSent: true });
    expect(h.refundsCreate).toHaveBeenCalledTimes(1);
    expect(h.refundsCreate.mock.calls[0]![0]).toMatchObject({ payment_intent: "pi_test_1", amount: 1749 });
    expect(h.sendMail).toHaveBeenCalledTimes(1);
    const mail = h.sendMail.mock.calls[0]![0] as Record<string, unknown>;
    expect(mail).toMatchObject({ to: "klients@example.com", subject: EDITED.subject, text: EDITED.text, lang: "lv", humanSent: true });
    expect(h.refundsCreate.mock.invocationCallOrder[0]!).toBeLessThan(h.sendMail.mock.invocationCallOrder[0]!);
    const job = h.jobs.get(SID) as DealerDataJob;
    expect(job.refund?.stripeRefundId).toBe("re_test_1");
    expect(job.refund?.emailSentAt).toBeTruthy();
    expect(job.refundPendingAt).toBeUndefined();
  });

  it("Stripe atmaksa neizdodas - e-pastu NESŪTA, rāda kļūdu, slēdzene noņemta", async () => {
    h.refundsCreate.mockRejectedValue(new Error("card_declined"));
    const res = await POST(req(EDITED));
    const body = (await res.json()) as { error: string; emailSent: boolean };
    expect(res.status).toBe(502);
    expect(body).toMatchObject({ error: "refund_failed", emailSent: false });
    expect(h.sendMail).not.toHaveBeenCalled();
    expect(h.recordSend).not.toHaveBeenCalled();
    const job = h.jobs.get(SID) as DealerDataJob;
    expect(job.refund).toBeUndefined();
    expect(job.refundPendingAt).toBeUndefined();
  });

  it("dubulta atmaksa nav iespējama: otrā poga -> 409, Stripe un e-pasts tikai vienreiz", async () => {
    expect((await POST(req(EDITED))).status).toBe(200);
    const second = await POST(req(EDITED));
    expect(second.status).toBe(409);
    expect(((await second.json()) as { error: string }).error).toBe("already_refunded");
    expect(h.refundsCreate).toHaveBeenCalledTimes(1);
    expect(h.sendMail).toHaveBeenCalledTimes(1);
  });

  it("paralēla atmaksa ceļā (svaiga slēdzene) -> 409 refund_in_progress, Stripe neizsauc", async () => {
    const cur = h.jobs.get(SID) as DealerDataJob;
    h.jobs.set(SID, { ...cur, refundPendingAt: new Date().toISOString() });
    const res = await POST(req(EDITED));
    expect(res.status).toBe(409);
    expect(((await res.json()) as { error: string }).error).toBe("refund_in_progress");
    expect(h.refundsCreate).not.toHaveBeenCalled();
    expect(h.sendMail).not.toHaveBeenCalled();
  });

  it("Stripe idempotences atslēga katram pasūtījumam viena", async () => {
    await POST(req(EDITED));
    expect(h.refundsCreate.mock.calls[0]![1]).toEqual({ idempotencyKey: `provin-dealer-refund-${SID}` });
  });

  it("WhatsApp: atmaksa notiek, e-pastu nesūta, saziņas žurnālā WhatsApp", async () => {
    const res = await POST(req({ ...EDITED, channel: "whatsapp", subject: "" }));
    expect(res.status).toBe(200);
    expect(h.sendMail).not.toHaveBeenCalled();
    expect(h.recordSend).toHaveBeenCalledTimes(1);
    expect(h.recordSend.mock.calls[0]![1]).toMatchObject({ channel: "whatsapp", situation: "no_data" });
  });
});
