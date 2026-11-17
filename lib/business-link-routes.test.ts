/**
 * PROVIN Business saites maršruti: admin izveide, publiskais checkout (fiksēta summa),
 * nederīgs / izmantots / beidzies tokens. Krātuve ir pagaidu mape, Stripe aizstāts (nekas netiek sūtīts).
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "business-link-test-"));

const state = vi.hoisted(() => ({
  admin: true,
  created: [] as Record<string, unknown>[],
  expired: [] as string[],
  seq: 0,
}));

vi.mock("@/lib/admin-order-draft-store", () => ({
  getOrderDraftStorageDir: () => tmpDir,
  getOrderDraftBlobConfig: () => null,
}));
vi.mock("@/lib/admin-auth", () => ({ getAdminSession: async () => (state.admin ? { ok: true } : null) }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: async () => ({ ok: true, retryAfterSec: 0 }) }));
vi.mock("@/lib/meta-capi", () => ({
  checkoutMetaClientFields: () => ({}),
  notifyMetaInitiateCheckout: async () => undefined,
  resolveInitiateCheckoutValueEur: () => 69.99,
  stripeMetaCapiMetadataFromRequest: () => ({}),
}));
vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({
    checkout: {
      sessions: {
        create: async (params: Record<string, unknown>) => {
          state.created.push(params);
          state.seq += 1;
          return { id: `cs_test_${state.seq}`, url: `https://checkout.stripe.test/${state.seq}`, amount_total: 6999 };
        },
        expire: async (id: string) => {
          state.expired.push(id);
          return { id };
        },
      },
    },
  }),
}));

import { POST as adminPOST } from "@/app/api/admin/business-links/route";
import { POST as checkoutPOST } from "@/app/api/business-link/checkout/route";
import { consumeBusinessLinkByHash, readBusinessLinkByToken } from "@/lib/business-link-store";

const VIN = "WBAFF41030L065449";

function json(url: string, body: unknown): Request {
  return new Request(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

async function createLink(body: Record<string, unknown> = {}): Promise<{ id: string; url: string; token: string }> {
  const res = await adminPOST(json("http://localhost/api/admin/business-links", body));
  expect(res.status).toBe(200);
  const data = (await res.json()) as { id: string; url: string };
  return { ...data, token: data.url.split("/b/")[1] ?? "" };
}

function checkout(token: string, extra: Record<string, unknown> = {}) {
  return checkoutPOST(
    json("http://localhost/api/business-link/checkout", { token, email: "klients@piemers.lv", vin: VIN, withdrawalConsent: true, ...extra }),
  );
}

beforeEach(() => {
  state.admin = true;
  state.created = [];
  state.expired = [];
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("admin business link create", () => {
  it("requires admin", async () => {
    state.admin = false;
    const res = await adminPOST(json("http://localhost/api/admin/business-links", {}));
    expect(res.status).toBe(401);
  });

  it("creates a unique /b/ link and stores only the token hash", async () => {
    const a = await createLink({ amountCents: 1 });
    const b = await createLink();
    expect(a.url).toMatch(/\/b\/[A-Za-z0-9_-]{20,32}$/);
    expect(a.token).not.toBe(b.token);
    expect(a.id).toMatch(/^[a-f0-9]{64}$/);
    const files = fs.readdirSync(path.join(tmpDir, "business_links"));
    expect(files).toContain(`${a.id}.json`);
    const stored = fs.readFileSync(path.join(tmpDir, "business_links", `${a.id}.json`), "utf8");
    expect(stored).not.toContain(a.token);
    expect(stored).not.toContain("amountCents");
  });

  it("rejects invalid validity", async () => {
    const res = await adminPOST(json("http://localhost/api/admin/business-links", { validityHours: 3 }));
    expect(res.status).toBe(400);
  });
});

describe("business link checkout", () => {
  it("charges a fixed 6999 cents regardless of client input", async () => {
    const { token, id } = await createLink();
    const res = await checkout(token, { amountCents: 100, unit_amount: 1, checkoutLine: "audit" });
    expect(res.status).toBe(200);
    expect(((await res.json()) as { url: string }).url).toContain("checkout.stripe.test");
    const params = state.created[0] as {
      line_items: { price_data: { unit_amount: number } }[];
      metadata: Record<string, string>;
      customer_email: string;
    };
    expect(params.line_items[0].price_data.unit_amount).toBe(6999);
    expect(params.metadata.checkout_line).toBe("business");
    expect(params.metadata.fulfillment).toBe("business_link");
    expect(params.metadata.business_link_hash).toBe(id);
    expect(params.metadata.vin).toBe(VIN);
    expect(params.customer_email).toBe("klients@piemers.lv");
  });

  it("expires the previous unpaid Stripe session when a new one is started", async () => {
    const { token } = await createLink();
    await checkout(token);
    await checkout(token);
    expect(state.expired).toHaveLength(1);
    const rec = await readBusinessLinkByToken(token);
    expect(rec?.lastStripeCheckoutSessionId).toBeTruthy();
    expect(state.expired[0]).not.toBe(rec?.lastStripeCheckoutSessionId);
  });

  it("returns 404 for malformed and unknown tokens", async () => {
    expect((await checkout("../../etc")).status).toBe(404);
    expect((await checkout("x".repeat(24))).status).toBe(404);
    expect(state.created).toHaveLength(0);
  });

  it("returns 404 once the link is paid (single use)", async () => {
    const { token, id } = await createLink();
    const consumed = await consumeBusinessLinkByHash(id, "cs_paid_1");
    expect(consumed).toMatchObject({ ok: true, already: false });
    expect(await consumeBusinessLinkByHash(id, "cs_paid_1")).toMatchObject({ ok: true, already: true });
    expect((await checkout(token)).status).toBe(404);
    expect(state.created).toHaveLength(0);
  });

  it("returns 404 for an expired link", async () => {
    const { token, id } = await createLink({ validityHours: 1 });
    const file = path.join(tmpDir, "business_links", `${id}.json`);
    const doc = JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, unknown>;
    fs.writeFileSync(file, JSON.stringify({ ...doc, expiresAt: "2020-01-01T00:00:00.000Z" }));
    expect((await checkout(token)).status).toBe(404);
  });

  it("validates consent and VIN before creating a session", async () => {
    const { token } = await createLink();
    const noConsent = await checkout(token, { withdrawalConsent: false });
    expect(noConsent.status).toBe(400);
    expect(((await noConsent.json()) as { error: string }).error).toBe("consent");
    const noVin = await checkout(token, { vin: "" });
    expect(((await noVin.json()) as { error: string }).error).toBe("vin");
    expect(state.created).toHaveLength(0);
  });
});
