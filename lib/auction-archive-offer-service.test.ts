import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuctionArchiveOfferDoc } from "@/lib/auction-archive-offer";

vi.mock("server-only", () => ({}));
const order = vi.fn();
vi.mock("@/lib/admin-orders", () => ({ getCheckoutSessionDetail: (id: string) => order(id) }));
vi.mock("@/lib/admin-order-draft-store", () => ({ readOrderDraft: async () => null }));
const push = vi.fn(async (_m: unknown) => ({ sent: 1, removed: 0 }));
vi.mock("@/lib/admin-push", () => ({ sendAdminPush: (m: unknown) => push(m) }));
const mail = vi.fn(async (_o: unknown) => true);
const clientMail = vi.fn(async (_o: unknown) => true);
vi.mock("@/lib/email/send-transactional", () => ({
  trySendDealerDataOperatorEmail: (o: unknown) => mail(o),
  trySendAuctionArchiveClientEmail: (o: unknown) => clientMail(o),
}));
vi.mock("@/lib/notify", () => ({ getAdminOrderNotifyEmail: () => "nils@example.test" }));

let stored: AuctionArchiveOfferDoc | null = null;
vi.mock("@/lib/auction-archive-offer-store", () => ({
  readAuctionArchiveOffer: async () => stored,
  listAuctionArchiveOfferSessionIds: async () => (stored ? [stored.sessionId] : []),
  createAuctionArchiveOffer: vi.fn(),
  issueAuctionArchiveReminder: async (
    _id: string,
    due: (d: AuctionArchiveOfferDoc) => boolean,
    mark: (d: AuctionArchiveOfferDoc, h: string) => AuctionArchiveOfferDoc,
  ) => {
    if (!stored || !due(stored)) return null;
    stored = mark(stored, "b".repeat(64));
    return { doc: stored, token: "T".repeat(43) };
  },
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
    order.mockResolvedValue({ amountTotal: 2499, vin: "WAUZZZF43PA018831", paymentAdjustment: null, paymentStatus: "paid", customerEmail: "klients@example.test" });
    push.mockClear();
    mail.mockClear();
    clientMail.mockClear();
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

  const O = { origin: "https://www.provin.lv" };

  it("cron e-pasts: 3 dienas bez izvēles → vienreiz Nilam UN vienreiz klientam (tās pašas 2 pogas, jaunā saite)", async () => {
    stored = doc({ sentTo: "sanemejs@example.test", previewIds: [] });
    expect((await runAuctionArchiveReminders(NOW + 2 * 864e5, O)).reminded).toBe(0);
    const r = await runAuctionArchiveReminders(NOW + 3 * 864e5 + 1, O);
    expect(r).toMatchObject({ reminded: 1, clientEmails: 1 });
    expect(push.mock.calls[0]![0]).toMatchObject({ title: "Klients 3 dienas nav izvēlējies" });
    expect((push.mock.calls[0]![0] as { body: string }).body).toContain("Klientam automātiski nosūtīts atgādinājums");
    const m = clientMail.mock.calls[0]![0] as { to: string; subject: string; html: string; text: string };
    expect(m.to).toBe("sanemejs@example.test");
    expect(m.subject).toMatch(/^Atgādinājums: izsoļu arhīvs vai atmaksa/);
    expect(m.html).toContain(`https://www.provin.lv/lv/izvele/${"T".repeat(43)}?v=archive`);
    expect(m.html).toContain(`https://www.provin.lv/lv/izvele/${"T".repeat(43)}?v=refund`);
    expect(m.html).not.toContain("Izsoles cenas");
    expect(stored?.clientRemindedAt).toBeTruthy();
    expect(stored?.reminderTokenHash).toBe("b".repeat(64));
    expect(stored?.history.map((h) => h.event)).toEqual(["admin_reminded", "client_reminded"]);
    expect((await runAuctionArchiveReminders(NOW + 4 * 864e5, O)).reminded).toBe(0);
    expect(clientMail).toHaveBeenCalledTimes(1);
    expect(mail.mock.calls.every((c) => (c[0] as { to: string }).to === "nils@example.test")).toBe(true);
  });

  it("cron WhatsApp: klientam nekas, Nilam gatavs WhatsApp teksts ar saiti", async () => {
    stored = doc({ channel: "whatsapp" });
    const r = await runAuctionArchiveReminders(NOW + 3 * 864e5 + 1, O);
    expect(r).toMatchObject({ reminded: 1, clientEmails: 0 });
    expect(clientMail).not.toHaveBeenCalled();
    const text = (mail.mock.calls[0]![0] as { text: string }).text;
    expect(text).toContain("WhatsApp teksts kopēšanai");
    expect(text).toContain(`https://www.provin.lv/lv/izvele/${"T".repeat(43)}`);
  });

  it("cron: izvēle jau izdarīta vai atsaukts → nekas netiek sūtīts", async () => {
    for (const status of ["chose_archive", "chose_refund", "withdrawn", "archive_sent", "refunded"] as const) {
      stored = doc({ status });
      const r = await runAuctionArchiveReminders(NOW + 5 * 864e5, O);
      expect(r.reminded).toBe(0);
    }
    expect(clientMail).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it("cron: atgādinājums klienta valodā (piedāvājuma locale); B2B paraksts tikai «PROVIN»", async () => {
    stored = doc({ locale: "de", sentTo: "kunde@example.test" });
    order.mockResolvedValue({ amountTotal: 2499, vin: "WAUZZZF43PA018831", paymentAdjustment: null, paymentStatus: "paid", customerEmail: "kunde@example.test", partnerId: "p_1" });
    await runAuctionArchiveReminders(NOW + 3 * 864e5 + 1, O);
    const m = clientMail.mock.calls[0]![0] as { subject: string; html: string; text: string };
    expect(m.subject).toMatch(/^Erinnerung: Auktionsarchiv oder Rückerstattung/);
    expect(m.html).toContain('<html lang="de"');
    expect(m.html).toContain(`https://www.provin.lv/de/izvele/${"T".repeat(43)}?v=archive`);
    expect(m.text).toContain("Auswählen und bestätigen:");
    expect(m.text).not.toMatch(/Labdien|Atgādinām|Nils Valainis|PROVIN\.LV/);
    expect(m.text).toMatch(/\nPROVIN\n\nAuswählen/);
  });

  it("cron WhatsApp: teksts Nilam klienta valodā", async () => {
    stored = doc({ channel: "whatsapp", locale: "en" });
    await runAuctionArchiveReminders(NOW + 3 * 864e5 + 1, O);
    const text = (mail.mock.calls[0]![0] as { text: string }).text;
    expect(text).toContain("A reminder about the car with VIN WAUZZZF43PA018831");
    expect(text).toContain(`https://www.provin.lv/en/izvele/${"T".repeat(43)}`);
  });

  it("cron: klienta e-pasts neizdodas → Nilam «NEIZDEVĀS», atzīme clientRemindedAt netiek likta", async () => {
    clientMail.mockResolvedValueOnce(false);
    const r = await runAuctionArchiveReminders(NOW + 3 * 864e5 + 1, O);
    expect(r).toMatchObject({ reminded: 1, clientEmails: 0 });
    expect((push.mock.calls[0]![0] as { body: string }).body).toContain("NEIZDEVĀS");
    expect(stored?.clientRemindedAt).toBeUndefined();
  });
});
