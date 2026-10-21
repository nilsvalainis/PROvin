import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  adminPushMorningMessage,
  adminPushNewOrderMessage,
  adminPushQuickEvalMessage,
  pushVinTail,
  safeAdminPushUrl,
} from "@/lib/admin-push-shared";

vi.mock("server-only", () => ({}));

const sendNotification = vi.fn();
vi.mock("web-push", () => ({ default: { setVapidDetails: vi.fn(), sendNotification } }));

describe("push teksti", () => {
  it("bez klienta datiem, tikai VIN beigas un summa", () => {
    const m = adminPushNewOrderMessage({ sessionId: "cs_1", vin: "WBA3A5C50CF256551", amountTotal: "39.00", currency: "EUR" });
    expect(m.body).toBe("VIN …256551 · 39.00 €");
    expect(m.url).toBe("/admin/orders/cs_1");
    expect(pushVinTail(null)).toBe("");
    expect(adminPushQuickEvalMessage({ id: "p1", vin: null }).body).toBe("Sludinājums gaida atbildi");
    expect(adminPushMorningMessage({ open: 4, urgent: 1, overdue: 0, newPeeksLast24h: 2 }).body).toBe(
      "4 atvērti · 1 steidzami · 2 jauni ātrie",
    );
  });

  it("saite tikai uz /admin", () => {
    expect(safeAdminPushUrl("/admin/orders/x")).toBe("/admin/orders/x");
    expect(safeAdminPushUrl("https://evil.example")).toBe("/admin");
    expect(safeAdminPushUrl("//evil.example/admin")).toBe("/admin");
  });
});

describe("sūtīšana", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "push-"));
  beforeAll(() => {
    vi.stubEnv("ADMIN_IRISS_LOGISTICS_DIR", dir);
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("VAPID_PUBLIC_KEY", "pub");
    vi.stubEnv("VAPID_PRIVATE_KEY", "priv");
  });
  afterAll(() => {
    vi.unstubAllEnvs();
    rmSync(dir, { recursive: true, force: true });
  });

  it("PRO ziņa tikai adminam, mirušās ierīces izņem", async () => {
    const store = await import("@/lib/admin-push-store");
    const { sendAdminPush } = await import("@/lib/admin-push");
    const keys = { p256dh: "k", auth: "a" };
    await store.saveAdminPushSubscription({ endpoint: "https://push/admin-ok", keys, userKey: "admin", createdAt: "x" });
    await store.saveAdminPushSubscription({ endpoint: "https://push/admin-gone", keys, userKey: "admin", createdAt: "x" });
    await store.saveAdminPushSubscription({ endpoint: "https://push/staff", keys, userKey: "staff:1", createdAt: "x" });
    sendNotification.mockImplementation(async (sub: { endpoint: string }) => {
      if (sub.endpoint.endsWith("gone")) throw Object.assign(new Error("gone"), { statusCode: 410 });
    });
    const r = await sendAdminPush(adminPushQuickEvalMessage({ id: "p", vin: null }));
    expect(r).toEqual({ sent: 1, removed: 1 });
    expect(sendNotification.mock.calls.map((c) => c[0].endpoint).sort()).toEqual(["https://push/admin-gone", "https://push/admin-ok"]);
    expect((await store.listAdminPushSubscriptions()).map((s) => s.endpoint).sort()).toEqual(["https://push/admin-ok", "https://push/staff"]);
  });
});
