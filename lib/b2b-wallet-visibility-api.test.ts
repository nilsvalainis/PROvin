import { beforeEach, describe, expect, it, vi } from "vitest";
import type { B2bWalletProductId } from "@/lib/b2b-wallet";

const state = vi.hoisted(() => ({
  hidden: [] as B2bWalletProductId[],
  purchase: vi.fn(),
  updateWallet: vi.fn(),
  createOrder: vi.fn(),
}));

const partner = () => ({
  id: "ptr_0123456789abcdef",
  email: "salons@example.lv",
  phone: "+37120000000",
  contactName: "Jānis",
  companyName: "Salons",
  walletPrices: { business: null, dealer_raw: null, dealer_pro: null },
  walletHiddenProducts: state.hidden,
});

vi.mock("@/lib/b2b-partner-auth", () => ({ resolveActiveB2bPartner: async () => partner() }));
vi.mock("@/lib/rate-limit-memory", () => ({ checkRateLimit: () => ({ ok: true }) }));
vi.mock("@/lib/b2b-wallet-store", () => ({ updateB2bWallet: state.updateWallet }));
vi.mock("@/lib/b2b-partner-place-vin-order", () => ({
  createPartnerCreditVinOrder: state.createOrder,
  schedulePartnerCreditVinOrderFollowups: vi.fn(),
}));

function buyRequest(product: B2bWalletProductId): Request {
  const body: Record<string, unknown> = { product, vin: "WVWZZZ1KZAW000001" };
  if (product === "business") body.auditPurpose = "client";
  if (product === "dealer_pro") body.reportLang = "de";
  return new Request("http://localhost/api/partner/wallet/purchase", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": "test_key_0001" },
    body: JSON.stringify(body),
  });
}

describe("hidden wallet products cannot be ordered", () => {
  beforeEach(() => {
    state.hidden = [];
    state.updateWallet.mockReset();
    state.createOrder.mockReset();
  });

  it.each<B2bWalletProductId>(["business", "dealer_raw", "dealer_pro"])(
    "purchase API rejects hidden %s with 403 before touching the wallet",
    async (product) => {
      state.hidden = [product];
      const { POST } = await import("@/app/api/partner/wallet/purchase/route");
      const res = await POST(buyRequest(product));
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ error: "product_hidden" });
      expect(state.updateWallet).not.toHaveBeenCalled();
      expect(state.createOrder).not.toHaveBeenCalled();
    },
  );

  it("still lets the partner buy a product that is not hidden", async () => {
    state.hidden = ["dealer_raw"];
    state.updateWallet.mockResolvedValueOnce({ ok: false, balanceCents: 0 });
    const { POST } = await import("@/app/api/partner/wallet/purchase/route");
    const res = await POST(buyRequest("dealer_pro"));
    expect(res.status).toBe(402);
    expect(state.updateWallet).toHaveBeenCalledTimes(1);
  });

  it("does not reject business without reportLang", async () => {
    state.updateWallet.mockResolvedValueOnce({ ok: false, balanceCents: 0 });
    const { POST } = await import("@/app/api/partner/wallet/purchase/route");
    const res = await POST(buyRequest("business"));
    expect(res.status).toBe(402);
    expect(state.updateWallet).toHaveBeenCalledTimes(1);
  });

  it("rejects dealer_pro without reportLang", async () => {
    const { POST } = await import("@/app/api/partner/wallet/purchase/route");
    const res = await POST(
      new Request("http://localhost/api/partner/wallet/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": "test_key_nolan" },
        body: JSON.stringify({ product: "dealer_pro", vin: "WVWZZZ1KZAW000001" }),
      }),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "report_lang" });
    expect(state.updateWallet).not.toHaveBeenCalled();
  });

  it("purchaseB2bWalletProduct refuses hidden products on its own", async () => {
    const { purchaseB2bWalletProduct } = await import("@/lib/b2b-wallet-purchase");
    const result = await purchaseB2bWalletProduct({
      partner: { ...partner(), walletHiddenProducts: ["business"] },
      product: "business",
      vin: "WVWZZZ1KZAW000001",
      listingUrl: "",
      auditPurpose: "client",
      reportLang: null,
      idempotencyKey: "test_key_0002",
    });
    expect(result).toMatchObject({ ok: false, error: "product_hidden" });
    expect(state.updateWallet).not.toHaveBeenCalled();
  });
});
