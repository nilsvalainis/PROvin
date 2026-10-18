import { afterEach, describe, expect, it, vi } from "vitest";
import { CONSENT_STORAGE_KEY } from "@/lib/cookie-consent";
import {
  applyMetaConsent,
  buildMetaPixelInitSnippet,
  createMetaEventId,
  getMetaPixelId,
  metaViewContentForPath,
  parseMetaPixelId,
  shouldFireMetaBrowserEvent,
  shouldLoadMetaPixel,
  trackMetaInitiateCheckout,
  trackMetaStandardEvent,
} from "./meta-pixel";

describe("parseMetaPixelId / getMetaPixelId", () => {
  const previous = process.env.NEXT_PUBLIC_META_PIXEL_ID;

  afterEach(() => {
    if (previous == null) delete process.env.NEXT_PUBLIC_META_PIXEL_ID;
    else process.env.NEXT_PUBLIC_META_PIXEL_ID = previous;
  });

  it("is a no-op when env is missing or empty", () => {
    delete process.env.NEXT_PUBLIC_META_PIXEL_ID;
    expect(getMetaPixelId()).toBeNull();
    expect(parseMetaPixelId("")).toBeNull();
    expect(parseMetaPixelId("   ")).toBeNull();
    expect(parseMetaPixelId("0")).toBeNull();
  });

  it("accepts a numeric Pixel ID", () => {
    expect(parseMetaPixelId("123456789012345")).toBe("123456789012345");
    expect(parseMetaPixelId("28572303665771966")).toBe("28572303665771966");
    process.env.NEXT_PUBLIC_META_PIXEL_ID = "9876543210";
    expect(getMetaPixelId()).toBe("9876543210");
  });

  it("rejects unsafe IDs", () => {
    expect(parseMetaPixelId("<script>")).toBeNull();
    expect(parseMetaPixelId("abc")).toBeNull();
    expect(parseMetaPixelId("12")).toBeNull();
  });
});

describe("consent gating", () => {
  it("does not load the pixel before analytics consent", () => {
    expect(
      shouldLoadMetaPixel({
        pixelId: "1234567890",
        analyticsConsent: false,
        pathname: "/lv",
        hostname: "www.provin.lv",
      }),
    ).toBe(false);
    expect(shouldFireMetaBrowserEvent({ analyticsConsent: false, fbqReady: true })).toBe(false);
  });

  it("loads after consent on the public site and skips admin/demo/api", () => {
    expect(
      shouldLoadMetaPixel({
        pixelId: "1234567890",
        analyticsConsent: true,
        pathname: "/lv",
        hostname: "www.provin.lv",
      }),
    ).toBe(true);
    expect(
      shouldLoadMetaPixel({
        pixelId: "1234567890",
        analyticsConsent: true,
        pathname: "/admin",
        hostname: "www.provin.lv",
      }),
    ).toBe(false);
    expect(
      shouldLoadMetaPixel({
        pixelId: "1234567890",
        analyticsConsent: true,
        pathname: "/lv/demo",
        hostname: "www.provin.lv",
      }),
    ).toBe(false);
    expect(
      shouldLoadMetaPixel({
        pixelId: "1234567890",
        analyticsConsent: true,
        pathname: "/api/checkout",
        hostname: "www.provin.lv",
      }),
    ).toBe(false);
    expect(
      shouldLoadMetaPixel({
        pixelId: null,
        analyticsConsent: true,
        pathname: "/lv",
      }),
    ).toBe(false);
  });

  it("does not fire browser events without fbq or stored consent", () => {
    expect(trackMetaStandardEvent("PageView", {}, "evt-1", null, true)).toBe(false);
    expect(trackMetaStandardEvent("PageView", {}, "evt-1", vi.fn(), false)).toBe(false);
    const fbq = vi.fn();
    expect(trackMetaStandardEvent("Lead", { content_name: "vin" }, "lead-1", fbq, true)).toBe(true);
    expect(fbq).toHaveBeenCalledWith("track", "Lead", { content_name: "vin" }, { eventID: "lead-1" });
  });
});

describe("ViewContent routes", () => {
  it("fires on home pricing and /pakalpojumi dealer-data pages", () => {
    expect(metaViewContentForPath("/lv")).toEqual({
      content_name: "pricing",
      content_ids: ["mini", "audits", "dealer"],
      content_type: "product",
    });
    expect(metaViewContentForPath("/en")).toMatchObject({ content_name: "pricing" });
    expect(metaViewContentForPath("/lv/pakalpojumi")).toEqual({
      content_name: "dealer-data",
      content_ids: ["dealer"],
      content_type: "product",
    });
    expect(metaViewContentForPath("/de/pakalpojumi")).toMatchObject({ content_name: "dealer-data" });
    expect(metaViewContentForPath("/lv/paldies")).toBeNull();
    expect(metaViewContentForPath("/admin")).toBeNull();
  });
});

describe("event IDs and consent revoke/grant", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses a generated uuid for non-Purchase events", () => {
    expect(createMetaEventId(() => "11111111-2222-4333-8444-555555555555")).toBe(
      "11111111-2222-4333-8444-555555555555",
    );
    const fbq = vi.fn();
    expect(trackMetaStandardEvent("Lead", { content_name: "vin" }, "lead-uuid", fbq, true)).toBe(true);
    expect(fbq.mock.calls[0][3]).toEqual({ eventID: "lead-uuid" });
  });

  it("uses Stripe checkout session id as Purchase eventID", () => {
    const fbq = vi.fn();
    expect(trackMetaStandardEvent("Purchase", { value: 99.99, currency: "EUR" }, "cs_test_abc", fbq, true)).toBe(
      true,
    );
    expect(fbq).toHaveBeenCalledWith(
      "track",
      "Purchase",
      { value: 99.99, currency: "EUR" },
      { eventID: "cs_test_abc" },
    );
  });

  it("grants and revokes fbq consent", () => {
    const fbq = vi.fn();
    vi.stubGlobal("window", { fbq });
    applyMetaConsent(true);
    applyMetaConsent(false);
    expect(fbq).toHaveBeenNthCalledWith(1, "consent", "grant");
    expect(fbq).toHaveBeenNthCalledWith(2, "consent", "revoke");
  });

  it("builds an init snippet that grants consent and never loads without an ID", () => {
    const snippet = buildMetaPixelInitSnippet("123456789012345");
    expect(snippet).toContain("fbevents.js");
    expect(snippet).toContain("fbq('consent','grant')");
    expect(snippet).toContain("fbq('init','123456789012345')");
    expect(snippet).not.toContain("track");
    expect(buildMetaPixelInitSnippet("")).toBe("");
  });
});

describe("InitiateCheckout browser helper", () => {
  it("requires a positive value", () => {
    const fbq = vi.fn();
    expect(trackMetaStandardEvent("InitiateCheckout", { value: 39.99, currency: "EUR" }, "ic-1", fbq, true)).toBe(
      true,
    );
    expect(trackMetaInitiateCheckout({ eventId: "ic-1", value: 0 })).toBe(false);
    expect(trackMetaInitiateCheckout({ eventId: "ic-1", value: -1 })).toBe(false);
  });
});

describe("stored consent key", () => {
  it("reads provin_cookie_consent the same way as GA ads_storage", () => {
    expect(CONSENT_STORAGE_KEY).toBe("provin_cookie_consent");
  });
});
