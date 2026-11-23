import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuctionArchiveOfferDoc } from "@/lib/auction-archive-offer";

vi.mock("server-only", () => ({}));
const order = vi.fn();
vi.mock("@/lib/admin-orders", () => ({ getCheckoutSessionDetail: (id: string) => order(id) }));
vi.mock("@/lib/admin-order-draft-store", () => ({ readOrderDraft: async () => null }));
const push = vi.fn(async (_m: unknown) => ({ sent: 1, removed: 0 }));
vi.mock("@/lib/admin-push", () => ({ sendAdminPush: (m: unknown) => push(m) }));
const mail = vi.fn(async (_o: unknown) => true);
vi.mock("@/lib/email/send-transactional", () => ({ trySendDealerDataOperatorEmail: (o: unknown) => mail(o) }));
vi.mock("@/lib/notify", () => ({ getAdminOrderNotifyEmail: () => "nils@example.test" }));

let stored: AuctionArchiveOfferDoc | null = null;
vi.mock("@/lib/auction-archive-offer-store", () => ({
  readAuctionArchiveOffer: async () => stored,
  listAuctionArchiveOfferSessionIds: async () => (stored ? [stored.sessionId] : []),
  createAuctionArchiveOffer: vi.fn(),
  updateAuctionArchiveOffer: async (_id: string, fn: (c: AuctionArchiveOfferDoc | null) => { next?: AuctionArchiveOfferDoc; result: unknown }) => {
    const d = fn(stored);
    if (d.next) stored = d.next;
    return d.result;
  },
}));

import { recordAuctionArchiveChoice, runAuctionArchiveReminders } from "@/lib/auction-archive-offer-service";

const NOW = Date.parse("2026-11-23T09:14:00Z");
function doc(over: Partial<AuctionArchiveOfferDoc> = {}): AuctionArchiveOfferDoc {
  return {
    sessionId: "cs_test_1",
    status: "pending",
    tokenHash: "a".repeat(64),
    createdAt: new Date(NOW).toISOString(),
    expiresAt: new Date(NOW + 30 * 864e5).toISOString(),
    locale: "lv",
    channel: "email",
    paidCents: 2499,
    summary: { vin: "WAUZZZF43PA018831", title: "Audi A4", auctions: [], photoCount: 1, manualSources: [] },
    photos: [],
    photosMissing: 0,
    previewIds: [],
    marks: [],
    history: [],
    ...over,
  };
}

describe("izvēles serviss", () => {
  beforeEach(() => {
    stored = doc();
    order.mockReset();
    order.mockResolvedValue({ amountTotal: 2499, vin: "WAUZZZF43PA018831", paymentAdjustment: null });
    push.mockClear();
    mail.mockClear();
  });

  it("klienta izvēle → statuss + paziņojums Nilam (push + e-pasts); atkārtoti - bez paziņojuma", async () => {
    const r = await recordAuctionArchiveChoice({ sessionId: "cs_test_1", choice: "archive", via: "link", nowMs: NOW + 1000 });
    expect(r.ok && r.doc.status).toBe("chose_archive");
    expect(push).toHaveBeenCalledTimes(1);
    expect(push.mock.calls[0]![0]).toMatchObject({ title: "Klients izvēlējās izsoļu arhīvu", url: "/admin/orders/cs_test_1", audience: "pro" });
    expect(mail).toHaveBeenCalledTimes(1);
    expect((mail.mock.calls[0]![0] as { to: string }).to).toBe("nils@example.test");
    await recordAuctionArchiveChoice({ sessionId: "cs_test_1", choice: "archive", via: "link", nowMs: NOW + 2000 });
    expect(push).toHaveBeenCalledTimes(1);
  });

  it("manuāla atzīme («1/2» WhatsApp) - bez paziņojuma", async () => {
    const r = await recordAuctionArchiveChoice({ sessionId: "cs_test_1", choice: "refund", via: "manual", nowMs: NOW });
    expect(r.ok && r.doc.choiceVia).toBe("manual");
    expect(push).not.toHaveBeenCalled();
  });

  it("Stripe atmaksa jau veikta → izvēle slēgta, statuss «Atmaksāts»", async () => {
    order.mockResolvedValue({ amountTotal: 2499, paymentAdjustment: { clawbackCents: 2499 } });
    const r = await recordAuctionArchiveChoice({ sessionId: "cs_test_1", choice: "archive", via: "link", nowMs: NOW });
    expect(r).toEqual({ ok: false, error: "closed" });
    expect(stored?.status).toBe("refunded");
  });

  it("cron: 3 dienas bez izvēles → vienreiz Nilam, klientam nekas", async () => {
    expect((await runAuctionArchiveReminders(NOW + 2 * 864e5)).reminded).toBe(0);
    const r = await runAuctionArchiveReminders(NOW + 3 * 864e5 + 1);
    expect(r.reminded).toBe(1);
    expect(push.mock.calls[0]![0]).toMatchObject({ title: "Klients 3 dienas nav izvēlējies" });
    expect((await runAuctionArchiveReminders(NOW + 4 * 864e5)).reminded).toBe(0);
    expect(mail.mock.calls.every((c) => (c[0] as { to: string }).to === "nils@example.test")).toBe(true);
  });
});
