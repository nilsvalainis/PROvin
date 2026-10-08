import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { handleIrissListingsLogin, parseIrissLoginRequest, pickTestReadSource } from "@/lib/iriss-listings-login";
import type { IrissRelayConfig } from "@/lib/iriss-listings-relay";
import type { IrissListingsLatestView } from "@/lib/iriss-listings-types";

const cfg: IrissRelayConfig = { baseUrl: "https://csdd-relay.provin.lv/listings", token: "t0ken-t0ken-t0ken-t0ken", timeoutMs: 20_000 };
const token = "cd".repeat(32);

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const latest: IrissListingsLatestView = {
  version: 2,
  generatedAt: "2026-10-08T04:00:00.000Z",
  summary: {
    startedAt: "2026-10-08T04:00:00.000Z",
    finishedAt: "2026-10-08T04:10:00.000Z",
    runId: "r",
    totalSources: 1,
    okCount: 1,
    loginRequiredCount: 0,
    blockedByWafCount: 0,
    parseFailedCount: 0,
    fetchFailedCount: 0,
    relayNotConfiguredCount: 0,
    skippedCount: 0,
    vehicleCount: 0,
    newCount: 0,
    priceChangedCount: 0,
    goneCount: 0,
  },
  sources: [
    {
      id: "s1",
      orderId: "o1",
      orderBrandModel: "Volvo XC60",
      platform: "auto1",
      sourceUrl: "https://www.auto1.com/en/app/merchant/cars?q=volvo",
      status: "login_required",
      note: "",
      vehicleCount: 0,
      pagesFetched: 0,
      pageCount: 0,
      fetchedAt: "2026-10-08T04:05:00.000Z",
    },
  ],
  vehicles: [],
};

describe("parseIrissLoginRequest", () => {
  it("accepts start/close/verify and listing platform names", () => {
    expect(parseIrissLoginRequest({ platform: "auto1", action: "start" })).toEqual({ platform: "auto1", action: "start" });
    expect(parseIrissLoginRequest({ platform: "openline", action: "close" })).toEqual({ platform: "openline", action: "close" });
    expect(parseIrissLoginRequest({ platform: "autobid", action: "verify" })).toEqual({ platform: "autobid", action: "verify" });
    expect(parseIrissLoginRequest({ platform: "openlane", action: "start" })).toMatchObject({ error: expect.stringContaining("platform") });
    expect(parseIrissLoginRequest({ platform: "auto1", action: "hack" })).toMatchObject({ error: expect.stringContaining("action") });
  });
});

describe("pickTestReadSource", () => {
  it("prefers an existing order source, else the probe URL", () => {
    expect(pickTestReadSource(latest, "auto1").sourceUrl).toContain("auto1.com");
    expect(pickTestReadSource(latest, "auto1").orderId).toBe("o1");
    expect(pickTestReadSource(latest, "openline").orderId).toBe("login-test");
    expect(pickTestReadSource(null, "autobid").sourceUrl).toContain("autobid.de");
  });
});

describe("handleIrissListingsLogin", () => {
  it("returns 503 when the relay is not configured", async () => {
    const r = await handleIrissListingsLogin({ platform: "auto1", action: "start" }, { cfg: null, latest });
    expect(r.status).toBe(503);
    expect(String(r.body.error)).toContain("IRISS_LISTINGS_RELAY");
  });

  it("start returns a vncUrl and never echoes the relay bearer", async () => {
    const fetchImpl = async () => jsonResponse(200, { ok: true, platform: "auto1", vncToken: token, vncReady: true, minutes: 15, startedAt: "2026-10-08T08:00:00.000Z" });
    const r = await handleIrissListingsLogin({ platform: "auto1", action: "start" }, { cfg, latest, fetchImpl });
    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(true);
    expect(String(r.body.vncUrl)).toContain(`/listings/vnc/${token}/vnc.html`);
    expect(JSON.stringify(r.body)).not.toContain(cfg.token);
  });

  it("close runs session check + one-page test read", async () => {
    const seen: string[] = [];
    const fetchImpl = async (url: string) => {
      seen.push(url);
      if (url.endsWith("/login/auto1/close")) return jsonResponse(200, { ok: true, platform: "auto1", loggedIn: true, session: "ok", why: "closed" });
      if (url.endsWith("/session/check")) return jsonResponse(200, { ok: true, status: "ok", note: "session_ok" });
      if (url.endsWith("/fetch")) return jsonResponse(200, { status: "ok", items: [{ externalId: "1", title: "Volvo" }], note: "1 auto" });
      return jsonResponse(404, {});
    };
    const r = await handleIrissListingsLogin({ platform: "auto1", action: "close" }, { cfg, latest, fetchImpl });
    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(true);
    expect(r.body.session).toBe("ok");
    expect((r.body.testRead as { vehicleCount?: number } | null)?.vehicleCount).toBe(1);
    expect(seen.some((u) => u.endsWith("/session/check"))).toBe(true);
    expect(seen.some((u) => u.endsWith("/fetch"))).toBe(true);
  });

  it("verify reports login_required without inventing a success", async () => {
    const fetchImpl = async (url: string) => {
      if (url.endsWith("/session/check")) return jsonResponse(200, { ok: false, status: "login_required", note: "Auto1 merchant sesija beigusies" });
      throw new Error(`unexpected ${url}`);
    };
    const r = await handleIrissListingsLogin({ platform: "auto1", action: "verify" }, { cfg, latest, fetchImpl });
    expect(r.body.ok).toBe(false);
    expect(r.body.session).toBe("login_required");
    expect(r.body.testRead).toBeNull();
  });
});
