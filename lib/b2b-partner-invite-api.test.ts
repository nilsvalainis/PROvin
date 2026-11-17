import { beforeEach, describe, expect, it, vi } from "vitest";
import type { B2bInvitePricing, B2bPartnerInviteRecord } from "@/lib/b2b-partner-invite";
import { emptyB2bInvitePricing } from "@/lib/b2b-partner-invite";

const state = vi.hoisted(() => ({
  admin: true,
  created: [] as B2bPartnerInviteRecord[],
  open: null as B2bPartnerInviteRecord | null,
  consume: vi.fn(),
  createPartner: vi.fn(),
}));

vi.mock("@/lib/admin-auth", () => ({ getAdminSession: async () => state.admin }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: async () => ({ ok: true }) }));
vi.mock("@/lib/client-ip", () => ({ getClientIpFromRequest: () => "127.0.0.1" }));
vi.mock("@/lib/b2b-partner-notify-mail", () => ({ dispatchAdminNewPartnerEmail: async () => undefined }));
vi.mock("@/lib/b2b-partner-verify-mail", () => ({ dispatchPartnerVerifyEmail: async () => undefined }));
vi.mock("@/lib/b2b-partner-invite-store", () => ({
  listOpenB2bInvites: async () => state.created.filter((row) => !row.usedAt),
  createB2bInvite: async (pricing?: B2bInvitePricing) => {
    const record: B2bPartnerInviteRecord = {
      token: "inv_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      createdAt: "2026-11-05T00:00:00.000Z",
      expiresAt: "2026-11-19T00:00:00.000Z",
      usedAt: null,
      usedPartnerId: null,
      walletPrices: (pricing ?? emptyB2bInvitePricing()).walletPrices,
      prices: (pricing ?? emptyB2bInvitePricing()).prices,
    };
    state.created.push(record);
    return record;
  },
  getOpenB2bInvite: async (token: string) => (state.open && state.open.token === token ? state.open : null),
  consumeB2bInvite: (...args: unknown[]) => state.consume(...args),
}));
vi.mock("@/lib/b2b-partner-store", () => ({
  createB2bPartner: (...args: unknown[]) => state.createPartner(...args),
}));

const REGISTER_BODY = {
  companyName: "SIA Demo Auto",
  companyReg: "40103123456",
  companyAddress: "Brīvības iela 1, Rīga",
  contactName: "Jānis Bērziņš",
  email: "demo@provin.lv",
  phone: "+371 20000000",
  password: "Salon8xx",
  token: "inv_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  locale: "lv",
  termsAccepted: true,
};

function adminPost(body?: unknown) {
  return new Request("http://localhost/api/admin/partners/invites", {
    method: "POST",
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe("admin B2B invite create API", () => {
  beforeEach(() => {
    state.admin = true;
    state.created = [];
  });

  it("creates an invite with defaults when the body is empty", async () => {
    const { POST } = await import("@/app/api/admin/partners/invites/route");
    const res = await POST(adminPost());
    expect(res.status).toBe(201);
    const data = (await res.json()) as { invite: B2bPartnerInviteRecord & { path: string } };
    expect(data.invite.path).toBe("/partneriem/registracija?token=inv_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb");
    expect(data.invite.walletPrices).toEqual({ business: null, dealer_raw: null, dealer_pro: null });
    expect(data.invite.prices).toEqual({ business1: null, business10: null, dealer1: null, dealer10: null });
    expect(state.created[0]?.walletPrices.business).toBeNull();
  });

  it("stores validated custom prices on the invite and keeps them out of the path", async () => {
    const { POST } = await import("@/app/api/admin/partners/invites/route");
    const res = await POST(
      adminPost({
        walletPrices: { business: "69,99", dealer_raw: "", dealer_pro: "19,99" },
        prices: { business1: "50,00", business10: "", dealer1: "", dealer10: "" },
      }),
    );
    expect(res.status).toBe(201);
    const data = (await res.json()) as { invite: { path: string; walletPrices: { business: number | null }; prices: { business1: number | null } } };
    expect(data.invite.walletPrices.business).toBe(6999);
    expect(data.invite.prices.business1).toBe(5000);
    expect(data.invite.path).not.toContain("69");
    expect(data.invite.path).not.toContain("walletPrices");
    expect(state.created[0]?.walletPrices).toEqual({ business: 6999, dealer_raw: null, dealer_pro: 1999 });
  });

  it("rejects invalid prices before creating an invite", async () => {
    const { POST } = await import("@/app/api/admin/partners/invites/route");
    const res = await POST(adminPost({ walletPrices: { business: "10,00" } }));
    expect(res.status).toBe(400);
    const data = (await res.json()) as { error: string; field: string; message: string };
    expect(data.error).toBe("invalid_prices");
    expect(data.field).toBe("business");
    expect(data.message).toContain("PROVIN Business");
    expect(state.created).toEqual([]);
  });

  it("requires an admin session", async () => {
    state.admin = false;
    const { POST } = await import("@/app/api/admin/partners/invites/route");
    const res = await POST(adminPost({}));
    expect(res.status).toBe(401);
    expect(state.created).toEqual([]);
  });
});

describe("public B2B invite redeem API", () => {
  beforeEach(() => {
    state.consume.mockReset();
    state.createPartner.mockReset();
    state.open = {
      token: "inv_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      createdAt: "2026-11-05T00:00:00.000Z",
      expiresAt: "2026-11-19T00:00:00.000Z",
      usedAt: null,
      usedPartnerId: null,
      walletPrices: { business: 6999, dealer_raw: null, dealer_pro: 1999 },
      prices: { business1: 5000, business10: null, dealer1: null, dealer10: null },
    };
    state.consume.mockResolvedValue(true);
    state.createPartner.mockResolvedValue({
      ok: true,
      partner: { id: "ptr_0123456789abcdef", email: "demo@provin.lv" },
      verifyToken: "ver_test",
    });
  });

  it("applies invite prices when the partner is created and ignores body prices", async () => {
    const { POST } = await import("@/app/api/partner/register/route");
    const res = await POST(
      new Request("http://localhost/api/partner/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...REGISTER_BODY,
          walletPrices: { business: 111, dealer_raw: 111, dealer_pro: 111 },
          prices: { business1: 111, business10: 111, dealer1: 111, dealer10: 111 },
        }),
      }),
    );
    expect(res.status).toBe(200);
    expect(state.createPartner).toHaveBeenCalledTimes(1);
    const opts = state.createPartner.mock.calls[0]![2] as {
      walletPrices: B2bInvitePricing["walletPrices"];
      prices: B2bInvitePricing["prices"];
    };
    expect(opts.walletPrices).toEqual({ business: 6999, dealer_raw: null, dealer_pro: 1999 });
    expect(opts.prices).toEqual({ business1: 5000, business10: null, dealer1: null, dealer10: null });
    expect(state.consume).toHaveBeenCalledWith("inv_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", "ptr_0123456789abcdef");
  });

  it("creates a partner with catalog defaults when the invite has no custom prices", async () => {
    state.open = {
      ...state.open!,
      walletPrices: emptyB2bInvitePricing().walletPrices,
      prices: emptyB2bInvitePricing().prices,
    };
    const { POST } = await import("@/app/api/partner/register/route");
    const res = await POST(
      new Request("http://localhost/api/partner/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(REGISTER_BODY),
      }),
    );
    expect(res.status).toBe(200);
    const opts = state.createPartner.mock.calls[0]![2] as {
      walletPrices: B2bInvitePricing["walletPrices"];
      prices: B2bInvitePricing["prices"];
    };
    expect(opts.walletPrices).toEqual(emptyB2bInvitePricing().walletPrices);
    expect(opts.prices).toEqual(emptyB2bInvitePricing().prices);
  });

  it("does not create a partner for an invalid or missing invite", async () => {
    state.open = null;
    const { POST } = await import("@/app/api/partner/register/route");
    const res = await POST(
      new Request("http://localhost/api/partner/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(REGISTER_BODY),
      }),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_invite" });
    expect(state.createPartner).not.toHaveBeenCalled();
  });
});
