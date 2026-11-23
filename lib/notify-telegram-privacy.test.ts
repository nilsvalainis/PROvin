import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/admin-push", () => ({ sendAdminPush: vi.fn() }));
vi.mock("@/lib/email/send-transactional", () => ({}));

import { formatAdminTelegramOrderMessage, telegramNameInitial } from "@/lib/notify";

describe("Telegram paziņojums bez klienta kontaktiem", () => {
  it("tikai iniciālis, VIN, summa un saite", () => {
    const text = formatAdminTelegramOrderMessage(
      {
        sessionId: "cs_test_1",
        customerName: "jānis Bērziņš",
        customerEmail: "janis@example.com",
        customerPhone: "+37120000000",
        vin: "WBA5R1C0XLFH42873",
        notes: "Lūdzu piezvanīt",
        amountTotal: "24.99",
        currency: "eur",
      } as never,
      "https://www.provin.lv",
    );
    expect(text).toContain("J.");
    expect(text).not.toContain("Bērziņš");
    expect(text).not.toContain("janis@example.com");
    expect(text).not.toContain("+37120000000");
    expect(text).not.toContain("piezvanīt");
    expect(text).toContain("https://www.provin.lv/admin/orders/cs_test_1");
    expect(telegramNameInitial("")).toBe("-");
  });
});
