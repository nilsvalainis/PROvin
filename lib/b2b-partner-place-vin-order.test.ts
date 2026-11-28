import { beforeEach, describe, expect, it, vi } from "vitest";

const seed = vi.fn(async () => ({ seeded: 1 }));
const scan = vi.fn(async () => ({ ran: true }));
const dealerJob = vi.fn(async (_args: Record<string, unknown>) => undefined);
const csddPaid = vi.fn(async (_id: string, _args: Record<string, unknown>) => null);
const dropbox = vi.fn(async (_id: string, _opts: Record<string, unknown>) => undefined);

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ after: (fn: () => unknown) => void fn() }));
vi.mock("@/lib/b2b-order-notify", () => ({ notifyAdminB2bCreditOrders: vi.fn(async () => undefined) }));
vi.mock("@/lib/admin-order-draft-store", () => ({ patchOrderDraft: vi.fn(async () => undefined) }));
vi.mock("@/lib/admin-paid-order-source-seed", () => ({ seedPaidOrderAutoSources: seed }));
vi.mock("@/lib/b2b-partner-orders", () => ({ buildPartnerOrderNotes: () => "" }));
vi.mock("@/lib/create-operator-order", () => ({ createOperatorOrderWithFields: vi.fn() }));
vi.mock("@/lib/dealer-data-job", () => ({ enqueueDealerDataJob: vi.fn(), runDealerDataJob: dealerJob }));
vi.mock("@/lib/order-vin-scan-run", () => ({ runOrderFreeVinScan: scan }));
vi.mock("@/lib/csdd-paid-auto", () => ({ enqueueCsddPaidAutoForOrder: csddPaid }));
vi.mock("@/lib/order-dropbox", () => ({ ensureOrderDropboxFolderSafe: dropbox }));

const { runPartnerCreditVinOrderFollowup } = await import("@/lib/b2b-partner-place-vin-order");

const base = { orderId: "manual_order_x1", plan: "dealer" as const, vin: "WVWZZZ1KZAW000123", listingUrl: "", dealerQueued: true };

describe("B2B partner VIN order follow-up", () => {
  beforeEach(() => {
    seed.mockClear();
    scan.mockClear();
    dealerJob.mockClear();
    csddPaid.mockClear();
    dropbox.mockClear();
  });

  it("dealer RAW also loads CSDD API and other auto sources plus VIN SCAN, then the raw dealer job", async () => {
    await runPartnerCreditVinOrderFollowup({ ...base, dealerOnlyRaw: true });
    expect(seed).toHaveBeenCalledWith("manual_order_x1", { vin: base.vin, listingUrl: null });
    expect(scan).toHaveBeenCalledWith("manual_order_x1", { vin: base.vin, listingUrl: null });
    expect(dealerJob).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: "manual_order_x1", skipTranslate: true, trigger: "webhook" }),
    );
  });

  it("dealer PRO keeps translated dealer data", async () => {
    await runPartnerCreditVinOrderFollowup(base);
    expect(seed).toHaveBeenCalledTimes(1);
    expect(scan).toHaveBeenCalledTimes(1);
    expect(dealerJob.mock.calls[0]?.[0]).not.toHaveProperty("skipTranslate");
  });

  it("still runs the dealer job when a background source fails", async () => {
    seed.mockRejectedValueOnce(new Error("csdd down"));
    await runPartnerCreditVinOrderFollowup({ ...base, dealerOnlyRaw: true });
    expect(dealerJob).toHaveBeenCalledTimes(1);
  });

  it("dīlera dati (RAW/PRO): nav CSDD maksas izziņas un BUSINESS mapes", async () => {
    await runPartnerCreditVinOrderFollowup(base);
    await runPartnerCreditVinOrderFollowup({ ...base, dealerOnlyRaw: true });
    expect(csddPaid).not.toHaveBeenCalled();
    expect(dropbox).not.toHaveBeenCalled();
  });

  it("PROVIN Business no konta: pēc CSDD sēklas BUSINESS mape un CSDD maksas izziņas rinda", async () => {
    const order: string[] = [];
    seed.mockImplementationOnce(async () => {
      order.push("seed");
      return { seeded: 1 };
    });
    csddPaid.mockImplementationOnce(async () => {
      order.push("csdd");
      return null;
    });
    await runPartnerCreditVinOrderFollowup({ ...base, plan: "business", dealerQueued: false });
    expect(dropbox).toHaveBeenCalledWith("manual_order_x1", { category: "business", vin: base.vin });
    expect(csddPaid).toHaveBeenCalledWith("manual_order_x1", { checkoutLine: "business", channel: "b2b_partner", orderVinOrPlate: base.vin });
    expect(order).toEqual(["seed", "csdd"]);
    expect(dealerJob).not.toHaveBeenCalled();
  });

  it("CSDD maksas izziņas kļūda neaptur pārējo", async () => {
    csddPaid.mockRejectedValueOnce(new Error("store down"));
    await expect(runPartnerCreditVinOrderFollowup({ ...base, plan: "business", dealerQueued: false })).resolves.toBeUndefined();
  });
});
