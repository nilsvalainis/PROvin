import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ATTR_COOKIE_NAME, CONSENT_COOKIE_NAME } from "@/lib/cookie-consent";
import { encodeAttrCookieValue } from "@/lib/ad-attribution";
import {
  buildMetaCapiEvent,
  buildMetaCapiRequestBody,
  buildMetaCapiUserData,
  buildStripeMetaCapiParts,
  collectMetaCapiContextFromRequest,
  deriveMetaFbc,
  getMetaCapiAccessToken,
  hashMetaEmail,
  hashMetaPhone,
  isMetaCapiConfigured,
  metaCapiContextFromStripeMetadata,
  metaCapiEventsUrl,
  normalizeMetaEmail,
  normalizeMetaPhone,
  notifyMetaCapiEvent,
  parseMetaCapiAccessToken,
  purchaseEventSourceUrl,
  resolveInitiateCheckoutValueEur,
  sendMetaCapiEvents,
  shouldSendMetaCapi,
  STRIPE_META_CONSENT_KEY,
  STRIPE_META_FBP_KEY,
  STRIPE_META_PACK_KEY,
  STRIPE_META_UA_KEY,
} from "./meta-capi";

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

describe("env no-op", () => {
  const prevPixel = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  const prevToken = process.env.META_CAPI_ACCESS_TOKEN;

  afterEach(() => {
    if (prevPixel == null) delete process.env.NEXT_PUBLIC_META_PIXEL_ID;
    else process.env.NEXT_PUBLIC_META_PIXEL_ID = prevPixel;
    if (prevToken == null) delete process.env.META_CAPI_ACCESS_TOKEN;
    else process.env.META_CAPI_ACCESS_TOKEN = prevToken;
  });

  it("is a no-op when pixel or token is missing", () => {
    delete process.env.NEXT_PUBLIC_META_PIXEL_ID;
    delete process.env.META_CAPI_ACCESS_TOKEN;
    expect(isMetaCapiConfigured()).toBe(false);
    expect(getMetaCapiAccessToken()).toBeNull();
    expect(parseMetaCapiAccessToken("")).toBeNull();
    expect(shouldSendMetaCapi({ consentGranted: true, pixelId: null, accessToken: "token_123456789012" })).toBe(
      false,
    );
    expect(shouldSendMetaCapi({ consentGranted: true, pixelId: "1234567890", accessToken: null })).toBe(false);
  });
});

describe("hashing and normalization", () => {
  it("lowercases and trims email before SHA-256", () => {
    expect(normalizeMetaEmail("  Foo@Example.COM ")).toBe("foo@example.com");
    expect(hashMetaEmail("  Foo@Example.COM ")).toBe(sha256("foo@example.com"));
    expect(hashMetaEmail("")).toBeNull();
    expect(hashMetaEmail("not-an-email")).toBeNull();
  });

  it("normalizes Latvian phones to digits with country code", () => {
    expect(normalizeMetaPhone("+371 29 502 039")).toBe("37129502039");
    expect(normalizeMetaPhone("29502039")).toBe("37129502039");
    expect(normalizeMetaPhone("0037129502039")).toBe("37129502039");
    expect(hashMetaPhone("+371 29 502 039")).toBe(sha256("37129502039"));
    expect(hashMetaPhone("   ")).toBeNull();
  });
});

describe("payload builder and dedup event_id", () => {
  it("builds a website Purchase with hashed user_data and session id event_id", () => {
    const event = buildMetaCapiEvent({
      eventName: "Purchase",
      eventId: "cs_test_order1",
      value: 99.99,
      eventSourceUrl: "https://www.provin.lv/lv/paldies?session_id=cs_test_order1",
      userData: {
        email: "Buyer@Example.com",
        phone: "29502039",
        clientIp: "1.2.3.4",
        clientUserAgent: "Mozilla/5.0",
        fbp: "fb.1.1710000000.123456",
        fbc: "fb.1.1710000000.IwAR",
      },
      eventTime: 1_700_000_000,
    });
    expect(event).toEqual({
      event_name: "Purchase",
      event_time: 1_700_000_000,
      event_id: "cs_test_order1",
      event_source_url: "https://www.provin.lv/lv/paldies?session_id=cs_test_order1",
      action_source: "website",
      user_data: {
        em: [sha256("buyer@example.com")],
        ph: [sha256("37129502039")],
        client_ip_address: "1.2.3.4",
        client_user_agent: "Mozilla/5.0",
        fbp: "fb.1.1710000000.123456",
        fbc: "fb.1.1710000000.IwAR",
      },
      custom_data: { currency: "EUR", value: 99.99 },
    });
    expect(event?.event_id).toBe("cs_test_order1");
    expect(metaCapiEventsUrl("1234567890")).toBe("https://graph.facebook.com/v21.0/1234567890/events");
  });

  it("uses the same InitiateCheckout event_id the browser will send", () => {
    const event = buildMetaCapiEvent({
      eventName: "InitiateCheckout",
      eventId: "11111111-2222-4333-8444-555555555555",
      value: 39.99,
      eventSourceUrl: "https://www.provin.lv/lv",
      userData: {},
    });
    expect(event?.event_id).toBe("11111111-2222-4333-8444-555555555555");
    expect(event?.event_name).toBe("InitiateCheckout");
    expect(event?.custom_data).toEqual({ currency: "EUR", value: 39.99 });
  });

  it("skips empty or zero-value events", () => {
    expect(
      buildMetaCapiEvent({
        eventName: "Purchase",
        eventId: "",
        value: 10,
        eventSourceUrl: "https://www.provin.lv/lv/paldies",
        userData: {},
      }),
    ).toBeNull();
    expect(
      buildMetaCapiEvent({
        eventName: "Purchase",
        eventId: "cs_x",
        value: 0,
        eventSourceUrl: "https://www.provin.lv/lv/paldies",
        userData: {},
      }),
    ).toBeNull();
    expect(buildMetaCapiRequestBody({ events: [] })).toBeNull();
    expect(buildMetaCapiRequestBody({ events: [], testEventCode: "TEST12345" })).toBeNull();
  });
});

describe("no CAPI without consent", () => {
  it("does not send when consent was not granted at checkout", async () => {
    const fetchImpl = vi.fn();
    expect(
      shouldSendMetaCapi({
        consentGranted: false,
        pixelId: "1234567890",
        accessToken: "token_123456789012",
      }),
    ).toBe(false);
    await notifyMetaCapiEvent({
      eventName: "Purchase",
      eventId: "cs_test_order1",
      value: 99.99,
      eventSourceUrl: "https://www.provin.lv/lv/paldies?session_id=cs_test_order1",
      consentGranted: false,
      userData: { email: "a@b.c" },
    });
    expect(fetchImpl).not.toHaveBeenCalled();
    const sent = await sendMetaCapiEvents({
      events: [],
      pixelId: "1234567890",
      accessToken: "token_123456789012",
      fetchImpl,
    });
    expect(sent).toEqual({ ok: true, skipped: "empty" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("skips the network call when env is missing even if consent is granted", async () => {
    const fetchImpl = vi.fn();
    const sent = await sendMetaCapiEvents({
      events: [
        buildMetaCapiEvent({
          eventName: "Purchase",
          eventId: "cs_x",
          value: 10,
          eventSourceUrl: "https://www.provin.lv/lv/paldies",
          userData: {},
        })!,
      ],
      pixelId: null,
      accessToken: "token_123456789012",
      fetchImpl,
    });
    expect(sent).toEqual({ ok: true, skipped: "env" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("fbc derivation and Stripe metadata overflow", () => {
  it("derives fbc from fbclid when _fbc is missing", () => {
    expect(deriveMetaFbc({ fbcCookie: "fb.1.1.existing", fbclid: "ABC" })).toBe("fb.1.1.existing");
    expect(deriveMetaFbc({ fbcCookie: null, fbclid: "IwAR123", nowMs: 1_700_000_000_000 })).toBe(
      "fb.1.1700000000.IwAR123",
    );
    expect(deriveMetaFbc({ fbcCookie: null, fbclid: null })).toBeNull();
  });

  it("packs consent, fbp, fbc and overflows a long user-agent", () => {
    const extras = buildStripeMetaCapiParts({
      consent: true,
      fbp: "fb.1.1710000000.123456",
      fbc: "fb.1.1710000000.IwAR",
      ip: "2001:db8::1",
      ua: "Mozilla/5.0 ".repeat(80),
    });
    expect(extras[STRIPE_META_CONSENT_KEY]).toBe("1");
    expect(extras[STRIPE_META_PACK_KEY]).toContain("fb.1.1710000000.123456");
    expect(extras[STRIPE_META_UA_KEY]?.length).toBeLessThanOrEqual(500);
    const restored = metaCapiContextFromStripeMetadata(extras);
    expect(restored.consent).toBe(true);
    expect(restored.fbp).toBe("fb.1.1710000000.123456");
    expect(restored.fbc).toBe("fb.1.1710000000.IwAR");
  });

  it("reads consent and cookies from the checkout request", () => {
    const attr = encodeAttrCookieValue({
      v: 1,
      first: { fbclid: "ClickFromAttr" },
      last: { fbclid: "ClickFromAttr" },
      consentAt: "2026-01-01T00:00:00.000Z",
    });
    const req = new Request("https://www.provin.lv/api/checkout", {
      headers: {
        cookie: `${CONSENT_COOKIE_NAME}=1; _fbp=fb.1.1710000000.9; ${ATTR_COOKIE_NAME}=${attr}`,
        "user-agent": "TestAgent/1.0",
        "x-forwarded-for": "8.8.8.8",
      },
    });
    const ctx = collectMetaCapiContextFromRequest(req);
    expect(ctx.consent).toBe(true);
    expect(ctx.fbp).toBe("fb.1.1710000000.9");
    expect(ctx.fbc).toMatch(/^fb\.1\.\d+\.ClickFromAttr$/);
    expect(ctx.ip).toBe("8.8.8.8");
    expect(ctx.ua).toBe("TestAgent/1.0");
  });

  it("does not treat missing consent cookies as granted", () => {
    const req = new Request("https://www.provin.lv/api/checkout", {
      headers: { "user-agent": "TestAgent/1.0" },
    });
    expect(collectMetaCapiContextFromRequest(req).consent).toBe(false);
    expect(metaCapiContextFromStripeMetadata({}).consent).toBe(false);
    expect(metaCapiContextFromStripeMetadata({ [STRIPE_META_FBP_KEY]: "fb.1.1.1" }).consent).toBe(false);
  });
});

describe("value and hashed user_data helpers", () => {
  it("converts Stripe cents and omits empty hashes", () => {
    expect(resolveInitiateCheckoutValueEur(3999)).toBe(39.99);
    expect(resolveInitiateCheckoutValueEur(null, 9999)).toBe(99.99);
    expect(resolveInitiateCheckoutValueEur(null, null)).toBeNull();
    expect(buildMetaCapiUserData({})).toEqual({});
    expect(purchaseEventSourceUrl("cs_live_1")).toContain("session_id=cs_live_1");
  });
});
