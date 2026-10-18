import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyB2bWalletBulkPurchase,
  applyB2bWalletTopup,
  emptyB2bWallet,
  type B2bWallet,
  type B2bWalletPriceOverrides,
  type B2bWalletProductId,
} from "@/lib/b2b-wallet";

const VIN_A = "WVWZZZ3HZHE703058";
const VIN_B = "WVWZZZ1JZXW000001";
const VIN_C = "WVWZZZ1KZAW000001";

const state = vi.hoisted(() => ({
  wallet: null as unknown as B2bWallet,
  hidden: [] as B2bWalletProductId[],
  prices: { business: null, dealer_raw: null, dealer_pro: null } as B2bWalletPriceOverrides,
  already: new Map<string, { id: string; created: number; reportReady: boolean }>(),
  failVins: new Set<string>(),
  createOrder: vi.fn(),
  followups: vi.fn(),
  writes: 0,
  stripe: vi.fn(),
}));

const partner = () => ({
  id: "ptr_0123456789abcdef",
  email: "salons@example.lv",
  phone: "+37120000000",
  contactName: "Jānis",
  companyName: "Salons",
  walletPrices: state.prices,
  walletHiddenProducts: state.hidden,
});

vi.mock("@/lib/b2b-partner-auth", () => ({ resolveActiveB2bPartner: async () => partner() }));
vi.mock("@/lib/rate-limit-memory", () => ({ checkRateLimit: () => ({ ok: true }) }));
vi.mock("@/lib/stripe", () => ({ getStripe: state.stripe }));
vi.mock("@/lib/b2b-wallet-store", () => ({
  readB2bWallet: async () => state.wallet,
  updateB2bWallet: async <R>(_id: string, fn: (w: B2bWallet) => { value: R; next?: B2bWallet }) => {
    const r = fn(state.wallet);
    if (r.next) {
      state.wallet = r.next;
      state.writes += 1;
    }
    return r.value;
  },
}));
vi.mock("@/lib/b2b-partner-vin-dedup", () => ({
  findPartnerVinOrdersMap: async ({ vins }: { vins: string[] }) =>
    new Map([...state.already].filter(([vin]) => vins.includes(vin))),
}));
vi.mock("@/lib/b2b-partner-place-vin-order", () => ({
  createPartnerCreditVinOrder: state.createOrder,
  schedulePartnerCreditVinOrderFollowups: state.followups,
}));

function funded(cents: number): B2bWallet {
  return applyB2bWalletTopup(emptyB2bWallet(), { amountCents: cents, sessionId: "cs_test" }).wallet;
}

type Item = { vin: string; auditPurpose?: string; listingUrl?: string; reorder?: boolean };

function bulkRequest(product: B2bWalletProductId, items: Item[], key = "bulk_key_0001"): Request {
  const body: Record<string, unknown> = {
    product,
    items: items.map((item) => (product === "business" ? { auditPurpose: "client", ...item } : item)),
  };
  if (product === "dealer_pro") body.reportLang = "de";
  return new Request("http://localhost/api/partner/wallet/bulk", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(key ? { "Idempotency-Key": key } : {}) },
    body: JSON.stringify(body),
  });
}

async function post(req: Request) {
  const { POST } = await import("@/app/api/partner/wallet/bulk/route");
  const res = await POST(req);
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

let orderSeq = 0;

beforeEach(() => {
  state.wallet = funded(10_000);
  state.hidden = [];
  state.prices = { business: null, dealer_raw: null, dealer_pro: null };
  state.already = new Map();
  state.failVins = new Set();
  state.writes = 0;
  state.followups.mockReset();
  state.stripe.mockReset();
  state.createOrder.mockReset();
  state.createOrder.mockImplementation(async ({ vin }: { vin: string }) =>
    state.failVins.has(vin)
      ? { ok: false, error: "queue_failed" }
      : { ok: true, orderId: `ord_${++orderSeq}`, dealerQueued: false },
  );
});

describe("applyB2bWalletBulkPurchase", () => {
  it("charges every new VIN in one step, or none when the balance is short", () => {
    const ok = applyB2bWalletBulkPurchase(funded(5000), {
      product: "dealer_raw",
      priceCents: 1999,
      bulkKey: "k1",
      items: [{ vin: VIN_A }, { vin: VIN_B }],
    });
    expect(ok.ok && ok.charged.map((row) => row.vin)).toEqual([VIN_A, VIN_B]);
    expect(ok.ok && ok.wallet.balanceCents).toBe(5000 - 2 * 1999);

    const short = applyB2bWalletBulkPurchase(funded(3000), {
      product: "dealer_raw",
      priceCents: 1999,
      bulkKey: "k2",
      items: [{ vin: VIN_A }, { vin: VIN_B }],
    });
    expect(short).toEqual({ ok: false, reason: "insufficient", balanceCents: 3000, needCents: 3998, count: 2 });
  });

  it("does not charge the same VIN twice for the same request key", () => {
    const first = applyB2bWalletBulkPurchase(funded(5000), {
      product: "dealer_pro",
      priceCents: 2499,
      bulkKey: "k3",
      items: [{ vin: VIN_A }],
    });
    if (!first.ok) throw new Error("expected ok");
    const again = applyB2bWalletBulkPurchase(first.wallet, {
      product: "dealer_pro",
      priceCents: 2499,
      bulkKey: "k3",
      items: [{ vin: VIN_A }, { vin: VIN_B }],
    });
    if (!again.ok) throw new Error("expected ok");
    expect(again.duplicates.map((row) => row.vin)).toEqual([VIN_A]);
    expect(again.charged.map((row) => row.vin)).toEqual([VIN_B]);
    expect(again.wallet.balanceCents).toBe(5000 - 2 * 2499);
  });

  it("skips flagged VINs and ignores repeated VINs in the input", () => {
    const r = applyB2bWalletBulkPurchase(funded(5000), {
      product: "business",
      priceCents: 7999,
      bulkKey: "k4",
      items: [{ vin: VIN_A, skip: true }, { vin: VIN_A }],
    });
    expect(r).toMatchObject({ ok: true, skipped: [VIN_A], charged: [] });
  });
});

describe("POST /api/partner/wallet/bulk", () => {
  it.each<B2bWalletProductId>(["business", "dealer_raw", "dealer_pro"])(
    "rejects hidden %s with 403 before touching the wallet",
    async (product) => {
      state.hidden = [product];
      const { status, body } = await post(bulkRequest(product, [{ vin: VIN_A }]));
      expect(status).toBe(403);
      expect(body).toEqual({ error: "product_hidden" });
      expect(state.writes).toBe(0);
      expect(state.createOrder).not.toHaveBeenCalled();
    },
  );

  it("charges the partner's custom price per VIN and marks each order", async () => {
    state.prices = { business: null, dealer_raw: 1500, dealer_pro: null };
    const { status, body } = await post(bulkRequest("dealer_raw", [{ vin: VIN_A }, { vin: VIN_B }]));
    expect(status).toBe(200);
    expect(body).toMatchObject({ ok: true, priceCents: 1500, chargedCents: 3000, balanceCents: 7000 });
    expect((body.accepted as unknown[]).length).toBe(2);
    const notes = state.createOrder.mock.calls.map((call) => (call[0] as { extraNoteParts: string[] }).extraNoteParts);
    expect(notes.every((parts) => parts.includes("wallet_cents=1500") && parts.includes("wallet_product=dealer_raw"))).toBe(true);
    expect(state.followups.mock.calls[0]![0]).toHaveLength(2);
    expect((state.followups.mock.calls[0]![0] as { dealerOnlyRaw: boolean }[])[0]!.dealerOnlyRaw).toBe(true);
  });

  it("uses the default price when there is no custom price", async () => {
    const { body } = await post(bulkRequest("dealer_pro", [{ vin: VIN_A }]));
    expect(body).toMatchObject({ priceCents: 2499, chargedCents: 2499, balanceCents: 10_000 - 2499 });
    const parts = (state.createOrder.mock.calls[0]![0] as { extraNoteParts: string[] }).extraNoteParts;
    expect(parts).toContain("report_lang=de");
  });

  it("refunds a VIN whose order could not be queued and keeps the rest", async () => {
    state.failVins = new Set([VIN_B]);
    const { status, body } = await post(bulkRequest("dealer_raw", [{ vin: VIN_A }, { vin: VIN_B }]));
    expect(status).toBe(200);
    expect(body.failed).toEqual([{ vin: VIN_B, error: "queue_failed", refunded: true }]);
    expect((body.accepted as { vin: string }[]).map((row) => row.vin)).toEqual([VIN_A]);
    expect(body).toMatchObject({ chargedCents: 1999, balanceCents: 10_000 - 1999 });
    expect(state.wallet.txns.filter((txn) => txn.kind === "refund")).toHaveLength(1);
  });

  it("skips VINs already ordered unless the partner asked to reorder", async () => {
    state.already = new Map([[VIN_A, { id: "ord_old", created: 1, reportReady: true }]]);
    const skip = await post(bulkRequest("dealer_raw", [{ vin: VIN_A }, { vin: VIN_B }], "bulk_key_0002"));
    expect(skip.body).toMatchObject({ skipped: [VIN_A], chargedCents: 1999 });

    const reorder = await post(bulkRequest("dealer_raw", [{ vin: VIN_A, reorder: true }], "bulk_key_0003"));
    expect(reorder.body).toMatchObject({ skipped: [], chargedCents: 1999 });
  });

  it("replaying the same request does not charge again", async () => {
    const first = await post(bulkRequest("dealer_raw", [{ vin: VIN_A }, { vin: VIN_B }]));
    const balance = state.wallet.balanceCents;
    const again = await post(bulkRequest("dealer_raw", [{ vin: VIN_A }, { vin: VIN_B }]));
    expect(state.wallet.balanceCents).toBe(balance);
    expect(state.createOrder).toHaveBeenCalledTimes(2);
    expect((again.body.accepted as { orderId: string; duplicate: boolean }[]).map((row) => row.duplicate)).toEqual([
      true,
      true,
    ]);
    expect((again.body.accepted as { orderId: string }[]).map((row) => row.orderId)).toEqual(
      (first.body.accepted as { orderId: string }[]).map((row) => row.orderId),
    );
  });

  it("returns 402 and creates nothing when the balance does not cover all VINs", async () => {
    state.wallet = funded(9000);
    const { status, body } = await post(bulkRequest("business", [{ vin: VIN_A }, { vin: VIN_B }]));
    expect(status).toBe(402);
    expect(body).toMatchObject({ error: "insufficient", needCents: 2 * 7999, count: 2 });
    expect(state.wallet.balanceCents).toBe(9000);
    expect(state.createOrder).not.toHaveBeenCalled();
  });

  it("rejects duplicate VINs, missing audit purpose and a missing idempotency key", async () => {
    expect((await post(bulkRequest("dealer_raw", [{ vin: VIN_A }, { vin: VIN_A }]))).body).toEqual({
      error: "duplicate_vin",
    });
    expect(
      (await post(bulkRequest("business", [{ vin: VIN_C, auditPurpose: "" }]))).body,
    ).toEqual({ error: "audit_purpose" });
    expect((await post(bulkRequest("dealer_raw", [{ vin: VIN_A }], ""))).status).toBe(400);
    expect(state.writes).toBe(0);
  });
});

describe("legacy pack checkout is closed", () => {
  it("returns 410 without creating a Stripe session", async () => {
    const { POST } = await import("@/app/api/checkout/partner/route");
    const res = await POST();
    expect(res.status).toBe(410);
    expect(await res.json()).toEqual({ error: "legacy_packs_closed" });
    expect(state.stripe).not.toHaveBeenCalled();
  });
});
