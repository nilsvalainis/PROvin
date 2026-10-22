import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UnpaidOrderRow } from "@/lib/admin-unpaid-orders-core";

vi.mock("server-only", () => ({}));

const listUnpaidAdminOrders = vi.fn();
const sendAdminPush = vi.fn();
const clientMail = vi.fn();
let stored: Record<string, string> = {};
let durable = true;

vi.mock("@/lib/admin-unpaid-orders", () => ({ listUnpaidAdminOrders: (...a: unknown[]) => listUnpaidAdminOrders(...a) }));
vi.mock("@/lib/admin-push", () => ({ sendAdminPush: (...a: unknown[]) => sendAdminPush(...a) }));
vi.mock("@/lib/email/send-transactional", () => ({
  trySendUnpaidOrderReminderEmail: (...a: unknown[]) => clientMail(...a),
  isSmtpConfigured: () => true,
}));
vi.mock("@/lib/cron-notify-dedupe-store", () => ({
  isCronNotifyStoreDurable: () => durable,
  readCronNotifyEntries: async () => ({ ...stored }),
  writeCronNotifyEntries: async (_s: string, e: Record<string, string>) => {
    stored = { ...e };
    return true;
  },
}));

import { runUnpaidOrdersAdminReminder } from "@/lib/admin-unpaid-remind-cron";
import { cronSecretGate } from "@/lib/cron-bearer";
import { pruneCronNotifyEntries } from "@/lib/cron-notify-entries";

function row(id: string, over: Partial<UnpaidOrderRow> = {}): UnpaidOrderRow {
  return {
    sessionId: id,
    aliasSessionIds: [],
    email: "klients@example.com",
    vin: "WBA3A5C50CF256551",
    created: 1_790_000_000,
    amountTotal: 3900,
    currency: "EUR",
    status: "expired",
    paymentStatus: "unpaid",
    checkoutLine: "audit",
    productName: "Audits",
    ageHours: 30,
    attemptCount: 1,
    hasValidEmail: true,
    remindedAt: null,
    hidden: false,
    paymentPublicUrl: null,
    remindable: true,
    ...over,
  };
}

const NOW = Date.parse("2026-10-22T07:00:00Z");

describe("neapmaksāto pasūtījumu cron", () => {
  beforeEach(() => {
    stored = {};
    durable = true;
    listUnpaidAdminOrders.mockReset();
    sendAdminPush.mockReset().mockResolvedValue({ sent: 1, removed: 0 });
    clientMail.mockReset();
  });

  it("ziņo tikai Nilam (admin push), klientam neko nesūta", async () => {
    listUnpaidAdminOrders.mockResolvedValue({ rows: [row("cs_a"), row("cs_b")], stripeError: null });
    const r = await runUnpaidOrdersAdminReminder(NOW);
    expect(r).toMatchObject({ ok: true, notified: 2, pushSent: 1 });
    expect(sendAdminPush).toHaveBeenCalledTimes(1);
    const msg = sendAdminPush.mock.calls[0]![0];
    expect(msg.audience).toBe("pro");
    expect(msg.body).toContain("2 neapmaksāti");
    expect(msg.body).not.toContain("klients@example.com");
    expect(clientMail).not.toHaveBeenCalled();
  });

  it("to pašu pasūtījumu atkārtoti neziņo (dedupe)", async () => {
    listUnpaidAdminOrders.mockResolvedValue({ rows: [row("cs_a")], stripeError: null });
    await runUnpaidOrdersAdminReminder(NOW);
    const second = await runUnpaidOrdersAdminReminder(NOW + 24 * 3600_000);
    expect(second.skipped).toBe("no_new");
    expect(sendAdminPush).toHaveBeenCalledTimes(1);
  });

  it("izlaiž jau atgādinātos, paslēptos un bez e-pasta", async () => {
    listUnpaidAdminOrders.mockResolvedValue({
      rows: [
        row("cs_r", { remindedAt: "2026-10-20T10:00:00Z", remindable: false }),
        row("cs_h", { hidden: true, remindable: false }),
        row("cs_e", { hasValidEmail: false, remindable: false }),
      ],
      stripeError: null,
    });
    const r = await runUnpaidOrdersAdminReminder(NOW);
    expect(r.skipped).toBe("no_new");
    expect(sendAdminPush).not.toHaveBeenCalled();
  });

  it("ja push nav piegādāts, neatzīmē kā ziņotu", async () => {
    sendAdminPush.mockResolvedValue({ sent: 0, removed: 0 });
    listUnpaidAdminOrders.mockResolvedValue({ rows: [row("cs_a")], stripeError: null });
    const r = await runUnpaidOrdersAdminReminder(NOW);
    expect(r.skipped).toBe("push_not_delivered");
    expect(stored).toEqual({});
  });

  it("bez noturīgas krātuves nesūta (lai nespamo)", async () => {
    durable = false;
    listUnpaidAdminOrders.mockResolvedValue({ rows: [row("cs_a")], stripeError: null });
    expect((await runUnpaidOrdersAdminReminder(NOW)).skipped).toBe("store_not_durable");
    expect(sendAdminPush).not.toHaveBeenCalled();
  });

  it("veci dedupe ieraksti tiek izmesti", () => {
    const e = { old: "2026-01-01T00:00:00Z", fresh: "2026-10-21T00:00:00Z", bad: "x" };
    expect(Object.keys(pruneCronNotifyEntries(e, NOW, 14 * 24 * 3600_000))).toEqual(["fresh"]);
  });
});

describe("cron vārti un grafiks", () => {
  it("CRON_SECRET obligāts", () => {
    expect(cronSecretGate("Bearer x", [undefined])).toMatchObject({ ok: false, status: 503 });
    expect(cronSecretGate(null, ["s3cret"])).toMatchObject({ ok: false, status: 401 });
    expect(cronSecretGate("Bearer nope", ["s3cret"])).toMatchObject({ ok: false, status: 403 });
    expect(cronSecretGate("Bearer s3cret", ["s3cret"])).toEqual({ ok: true });
  });

  it("vercel.json ieplāno cron reizi dienā", () => {
    const vercel = JSON.parse(readFileSync(path.join(process.cwd(), "vercel.json"), "utf8")) as {
      crons: Array<{ path: string; schedule: string }>;
    };
    expect(vercel.crons.find((c) => c.path === "/api/cron/unpaid-orders-remind")?.schedule).toBe("0 7 * * *");
  });
});
