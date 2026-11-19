/** Piegādes API: tikai admins, e-pasts tikai ar apstiprinājumu, Autoparks tikai esošam auto. Viss mock. */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const state = vi.hoisted(() => ({
  admin: true,
  record: null as Record<string, unknown> | null,
  sent: [] as unknown[],
  autoparks: [] as unknown[],
  deliveries: [] as unknown[],
}));

vi.mock("@/lib/admin-auth", () => ({ getAdminSession: async () => state.admin }));
vi.mock("@/lib/dealer-check-actor", () => ({ currentDealerCheckCreatorId: async () => "env-admin" }));
vi.mock("@/lib/dealer-check-store", () => ({
  readOwnedDealerCheck: async (id: string) => (state.record && state.record.id === id ? state.record : null),
  addDealerCheckDelivery: async (_id: string, d: unknown) => {
    state.deliveries.push(d);
    return { ...state.record, deliveries: state.deliveries };
  },
}));
vi.mock("@/lib/email/send-transactional", () => ({ isSmtpConfigured: () => true }));
vi.mock("@/lib/dealer-check-platform", () => ({
  findDealerCheckAutoparksCar: async () => null,
  deliverDealerCheckToAutoparks: async () => {
    state.autoparks.push(1);
    return { ok: false, error: "not_in_autoparks" };
  },
  sendDealerCheckEmail: async (_r: unknown, input: { to: string }) => {
    state.sent.push(input);
    return { ok: true, to: input.to };
  },
}));

import { GET, POST } from "@/app/api/admin/dealer-check/deliver/route";
import { irissMobileMenuItemsFor } from "@/lib/iriss-mobile-menu";
import { irissMenuCatalog } from "@/lib/admin-menu-catalog";
import { DEALER_CHECK_IRISS_PAGE_PATH, type DealerCheckDelivery } from "@/lib/dealer-check";
import { dealerCheckDeliveryErrorLv, dealerCheckDeliveryLine, dealerCheckServerPdfHref } from "@/lib/dealer-check-delivery";

const ID = "dc-route-0001";

function post(body: Record<string, unknown>) {
  return POST(
    new Request("http://x/api/admin/dealer-check/deliver", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

beforeEach(() => {
  state.admin = true;
  state.record = {
    id: ID,
    vin: "WBA8A71070K896936",
    template: "cits",
    vehicle: { make: "BMW", model: "320d" },
  };
  state.sent = [];
  state.autoparks = [];
  state.deliveries = [];
});

describe("dīlera datu piegādes API", () => {
  it("bez admina - 401", async () => {
    state.admin = false;
    expect((await post({ id: ID, action: "email", to: "a@b.lv", subject: "a", text: "b", confirmed: true })).status).toBe(401);
    expect(state.sent).toHaveLength(0);
  });

  it("GET: auto nav Autoparkā, e-pasta noklusējuma teksts", async () => {
    const res = await GET(new Request(`http://x/api/admin/dealer-check/deliver?id=${ID}`));
    const body = (await res.json()) as { autoparks: unknown; email: { subject: string } };
    expect(body.autoparks).toBeNull();
    expect(body.email.subject).toContain("WBA8A71070K896936");
  });

  it("e-pasts bez apstiprinājuma netiek sūtīts", async () => {
    const res = await post({ id: ID, action: "email", to: "a@b.lv", subject: "a", text: "b" });
    expect(res.status).toBe(400);
    expect(state.sent).toHaveLength(0);
  });

  it("e-pasts ar apstiprinājumu - sūta un ieraksta žurnālā", async () => {
    const res = await post({ id: ID, action: "email", to: "a@b.lv", subject: "a", text: "b", confirmed: true });
    expect(res.status).toBe(200);
    expect(state.sent).toHaveLength(1);
    expect(state.deliveries).toMatchObject([{ kind: "email", target: "a@b.lv" }]);
  });

  it("Autoparks: auto nav parkā - 409, žurnālā nekas", async () => {
    const res = await post({ id: ID, action: "autoparks" });
    expect(res.status).toBe(409);
    expect(state.deliveries).toHaveLength(0);
  });

  it("svešs ieraksts - 404", async () => {
    expect((await post({ id: "dc-other-0001", action: "autoparks" })).status).toBe(404);
  });
});

describe("Dīlera dati IRISS izvēlnē", () => {
  it("adminam ir, darbiniekam nav (maksā naudu)", () => {
    const admin = irissMobileMenuItemsFor([], true).map((i) => i.href);
    expect(admin).toContain(DEALER_CHECK_IRISS_PAGE_PATH);
    const staff = irissMobileMenuItemsFor(["logistika", "pavadzimes", "vin", "pasutijumi"], false).map((i) => i.href);
    expect(staff).not.toContain(DEALER_CHECK_IRISS_PAGE_PATH);
    expect(irissMenuCatalog(["logistika", "vin"], false).some((i) => i.href === DEALER_CHECK_IRISS_PAGE_PATH)).toBe(false);
    expect(irissMenuCatalog([], true).some((i) => i.href === DEALER_CHECK_IRISS_PAGE_PATH)).toBe(true);
  });
});

describe("piegādes UI teksti", () => {
  it("kļūdas latviski, bez garās domuzīmes", () => {
    for (const code of ["not_in_autoparks", "not_linked", "verify_failed", "invalid_email", "smtp_not_configured", ""]) {
      const t = dealerCheckDeliveryErrorLv(code);
      expect(t.length).toBeGreaterThan(5);
      expect(t).not.toMatch(/[—–]/);
    }
  });

  it("žurnāla rinda un PDF saite", () => {
    const d: DealerCheckDelivery = { kind: "autoparks", at: "2026-11-19T10:00:00.000Z", target: "BMW 320d", path: "/STOCK/x.pdf" };
    expect(dealerCheckDeliveryLine(d)).toContain("Autoparks + STOCK · BMW 320d");
    expect(dealerCheckDeliveryLine({ kind: "email", at: "2026-11-19T10:00:00.000Z", target: "a@b.lv" })).toContain("e-pasts · a@b.lv");
    expect(dealerCheckServerPdfHref("dc-1")).toBe("/api/admin/dealer-check/server-pdf?id=dc-1");
  });
});
