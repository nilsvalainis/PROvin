import { describe, expect, it } from "vitest";
import { b2bWalletTopupProductLabel } from "@/lib/b2b-wallet-topup-label";

describe("maka papildināšanas Stripe nosaukums", () => {
  it("partnera valodā, LV pēc noklusējuma", () => {
    expect(b2bWalletTopupProductLabel("lv")).toBe("IRISS konta papildināšana");
    expect(b2bWalletTopupProductLabel("en")).toBe("IRISS account top-up");
    expect(b2bWalletTopupProductLabel("de")).toBe("IRISS Kontoaufladung");
    expect(b2bWalletTopupProductLabel("ru")).toBe("Пополнение счёта IRISS");
    expect(b2bWalletTopupProductLabel("xx")).toBe("IRISS konta papildināšana");
  });
});
