import { describe, expect, it } from "vitest";
import { ATTR_COOKIE_NAME } from "@/lib/cookie-consent";
import {
  adminAttributionFromStripeMetadata,
  inferChannel,
  mergeAttributionCookie,
  orderHasAdAttribution,
  parseAdminOrderAttribution,
  parseAttrCookieValue,
  parsePendingAttr,
  parseVisitFromSearch,
  serializeStripeAttr,
  STRIPE_ATTR_FBCLID_KEY,
  STRIPE_ATTR_LAND_FIRST_KEY,
  STRIPE_ATTR_LAND_LAST_KEY,
  STRIPE_ATTR_METADATA_MAX,
  stripeAttributionMetadata,
  stripeAttributionMetadataFromRequest,
  touchHasMarketingSignal,
} from "@/lib/ad-attribution";

describe("parseVisitFromSearch", () => {
  it("parses UTM and click ids from the landing query", () => {
    const touch = parseVisitFromSearch({
      pathname: "/lv",
      search: "?utm_source=google&utm_campaign=vin&utm_term=audi%20a4&gclid=ABC123&fbclid=fb1&ttclid=tt1&gbraid=gb&wbraid=wb",
      referrer: "https://www.google.com/",
    });
    expect(touch.src).toBe("google");
    expect(touch.cmp).toBe("vin");
    expect(touch.term).toBe("audi a4");
    expect(touch.gclid).toBe("ABC123");
    expect(touch.fbclid).toBe("fb1");
    expect(touch.ttclid).toBe("tt1");
    expect(touch.gbraid).toBe("gb");
    expect(touch.wbraid).toBe("wb");
    expect(touch.land).toContain("gclid=ABC123");
    expect(touch.ref).toContain("google.com");
    expect(touchHasMarketingSignal(touch)).toBe(true);
    expect(inferChannel(touch)).toBe("google");
  });

  it("maps fbclid to meta and ttclid to tiktok", () => {
    expect(inferChannel(parseVisitFromSearch({ pathname: "/", search: "?fbclid=x" }))).toBe("meta");
    expect(inferChannel(parseVisitFromSearch({ pathname: "/", search: "?ttclid=x" }))).toBe("tiktok");
  });

  it("treats Google referrer without a click id as organic search", () => {
    expect(
      inferChannel(parseVisitFromSearch({ pathname: "/lv", search: "", referrer: "https://www.google.com/search?q=provin" })),
    ).toBe("organic_google");
  });

  it("treats an empty or own-site referrer as direct", () => {
    expect(inferChannel(parseVisitFromSearch({ pathname: "/lv", search: "", referrer: "" }))).toBe("direct");
    expect(inferChannel(parseVisitFromSearch({ pathname: "/lv", search: "", referrer: "https://provin.lv/lv" }))).toBe(
      "direct",
    );
  });
});

describe("mergeAttributionCookie", () => {
  it("keeps first touch and updates last when a new click arrives", () => {
    const first = parseVisitFromSearch({ pathname: "/lv", search: "?utm_source=tiktok&utm_campaign=q1&ttclid=old" });
    const existing = mergeAttributionCookie({
      existing: null,
      pending: first,
      visit: first,
      consentAt: "2026-01-01T00:00:00.000Z",
    });
    const nextVisit = parseVisitFromSearch({
      pathname: "/lv",
      search: "?utm_source=google&utm_campaign=q2&gclid=NEW&utm_term=golf",
    });
    const merged = mergeAttributionCookie({
      existing,
      pending: first,
      visit: nextVisit,
      consentAt: "2026-02-01T00:00:00.000Z",
    });
    expect(merged.first.cmp).toBe("q1");
    expect(merged.first.ttclid).toBe("old");
    expect(merged.last.gclid).toBe("NEW");
    expect(merged.last.cmp).toBe("q2");
    expect(merged.consentAt).toBe("2026-01-01T00:00:00.000Z");
  });

  it("does not overwrite last touch with an organic navigation", () => {
    const first = parseVisitFromSearch({ pathname: "/", search: "?gclid=KEEP" });
    const existing = mergeAttributionCookie({
      existing: null,
      pending: first,
      visit: first,
      consentAt: "2026-01-01T00:00:00.000Z",
    });
    const organic = parseVisitFromSearch({ pathname: "/lv/pakalpojumi", search: "", referrer: "" });
    const merged = mergeAttributionCookie({
      existing,
      pending: first,
      visit: organic,
      consentAt: "2026-01-02T00:00:00.000Z",
    });
    expect(merged.last.gclid).toBe("KEEP");
  });
});

describe("cookie encode/decode", () => {
  it("reads the legacy firstLanding cookie shape", () => {
    const legacy = encodeURIComponent(
      JSON.stringify({
        firstLanding: "/lv?utm_source=google&gclid=LEGACY",
        utm: { utm_source: "google", utm_campaign: "old" },
        referrer: "https://google.com",
        consentAt: "2026-03-01T00:00:00.000Z",
      }),
    );
    const parsed = parseAttrCookieValue(legacy);
    expect(parsed?.first.gclid).toBe("LEGACY");
    expect(parsed?.first.src).toBe("google");
    expect(parsed?.last.cmp).toBe("old");
  });

  it("reads pending session JSON including the old {utm,path} shape", () => {
    const pending = parsePendingAttr(
      JSON.stringify({
        utm: { utm_source: "tiktok", utm_campaign: "spring" },
        path: "/en?utm_source=tiktok&utm_campaign=spring&ttclid=tt9",
        t: 1,
      }),
    );
    expect(pending?.src).toBe("tiktok");
    expect(pending?.cmp).toBe("spring");
    expect(pending?.ttclid).toBe("tt9");
  });
});

describe("Stripe metadata", () => {
  it("writes one compact attr key and stays under 500 chars", () => {
    const visit = parseVisitFromSearch({
      pathname: "/lv",
      search: "?utm_source=google&utm_campaign=vin-audit&utm_term=bmw&gclid=Cj0KCQjw",
    });
    const cookie = mergeAttributionCookie({
      existing: null,
      pending: visit,
      visit,
      consentAt: "2026-04-01T00:00:00.000Z",
    });
    const meta = stripeAttributionMetadata(cookie);
    expect(meta.attr).toBeTruthy();
    expect(meta.attr.length).toBeLessThanOrEqual(STRIPE_ATTR_METADATA_MAX);
    expect(meta[STRIPE_ATTR_LAND_FIRST_KEY]).toBeTruthy();
    expect(meta[STRIPE_ATTR_LAND_LAST_KEY]).toBeTruthy();
    const admin = adminAttributionFromStripeMetadata(meta);
    expect(admin?.channel).toBe("google");
    expect(admin?.campaign).toBe("vin-audit");
    expect(admin?.term).toBe("bmw");
    expect(admin?.gclid).toBe("Cj0KCQjw");
    expect(admin?.firstLanding).toBeTruthy();
    expect(admin?.lastLanding).toBeTruthy();
    expect(orderHasAdAttribution(admin)).toBe(true);
  });

  it("returns empty metadata without a cookie (no consent)", () => {
    expect(stripeAttributionMetadata(null)).toEqual({});
    expect(stripeAttributionMetadataFromRequest(null, ATTR_COOKIE_NAME)).toEqual({});
    expect(adminAttributionFromStripeMetadata({})).toBeNull();
    expect(parseAdminOrderAttribution(undefined)).toBeNull();
    expect(orderHasAdAttribution(null)).toBe(false);
  });

  it("reads attr from a Cookie header", () => {
    const visit = parseVisitFromSearch({ pathname: "/", search: "?fbclid=FACE" });
    const cookie = mergeAttributionCookie({
      existing: null,
      pending: visit,
      visit,
      consentAt: "2026-04-01T00:00:00.000Z",
    });
    const header = `${ATTR_COOKIE_NAME}=${encodeURIComponent(JSON.stringify(cookie))}`;
    const meta = stripeAttributionMetadataFromRequest(header, ATTR_COOKIE_NAME);
    expect(adminAttributionFromStripeMetadata(meta)?.fbclid).toBe("FACE");
    expect(adminAttributionFromStripeMetadata(meta)?.channel).toBe("meta");
  });

  it("slims oversized payloads instead of overflowing Stripe", () => {
    const long = "x".repeat(400);
    const json = serializeStripeAttr({
      v: 1,
      consentAt: "2026-01-01T00:00:00.000Z",
      first: { land: long, ref: long, src: "google", cmp: "huge", gclid: "G1" },
      last: { land: long, ref: long, src: "google", cmp: "huge", gclid: "G1" },
    });
    expect(json.length).toBeLessThanOrEqual(STRIPE_ATTR_METADATA_MAX);
    expect(json).toContain("G1");
  });

  it("keeps a realistic 120-char fbclid, utm_content and landings under Stripe limits", () => {
    const fbclid = `IwY2xjegH3${"AbCdEfGhIj0123456789".repeat(6)}`.slice(0, 120);
    expect(fbclid).toHaveLength(120);
    const visit = parseVisitFromSearch({
      pathname: "/lv",
      search: `?utm_source=facebook&utm_medium=paid&utm_campaign=vin-audit&utm_term=audi&utm_content=reels-q4&fbclid=${fbclid}`,
      referrer: "https://www.facebook.com/",
    });
    expect(visit.fbclid).toBe(fbclid);
    expect(visit.cnt).toBe("reels-q4");
    const cookie = mergeAttributionCookie({
      existing: null,
      pending: visit,
      visit,
      consentAt: "2026-10-17T00:00:00.000Z",
    });
    const meta = stripeAttributionMetadata(cookie);
    for (const [key, value] of Object.entries(meta)) {
      expect(value.length, key).toBeLessThanOrEqual(STRIPE_ATTR_METADATA_MAX);
    }
    expect(meta[STRIPE_ATTR_LAND_FIRST_KEY]).toContain("/lv");
    expect(meta[STRIPE_ATTR_LAND_LAST_KEY]).toContain("/lv");
    const packed = JSON.parse(meta.attr) as { last?: { cnt?: string; land?: string }; first?: { cnt?: string; land?: string } };
    expect(packed.last?.cnt ?? packed.first?.cnt).toBe("reels-q4");
    expect(packed.last?.land).toBeUndefined();
    const admin = adminAttributionFromStripeMetadata(meta);
    expect(admin?.channel).toBe("meta");
    expect(admin?.fbclid).toBe(fbclid);
    expect(admin?.content).toBe("reels-q4");
    expect(admin?.campaign).toBe("vin-audit");
    expect(admin?.firstLanding).toContain("/lv");
    expect(admin?.lastLanding).toContain("/lv");
  });

  it("splits a long fbclid into attr_fbclid when both touches are full", () => {
    const fbclid = `IwY2xjegH3${"XyZ9876543210AbCdEfGh".repeat(6)}`.slice(0, 120);
    const fat = (id: string) => ({
      src: "facebook".repeat(10).slice(0, 80),
      med: "paidsocial".repeat(8).slice(0, 80),
      cmp: "provin-vin-audit-meta-reels".repeat(4).slice(0, 80),
      term: "audi-a4-used-latvia".repeat(4).slice(0, 80),
      cnt: "carousel-october-2026-vin".repeat(4).slice(0, 80),
      fbclid: id,
      land: `/lv?utm_content=carousel&fbclid=${id}`,
      ref: "https://www.facebook.com/ads/link/?foo=1".repeat(4).slice(0, 160),
    });
    const cookie = {
      v: 1 as const,
      consentAt: "2026-10-17T00:00:00.000Z",
      first: fat(`${fbclid}a`.slice(0, 120)),
      last: fat(fbclid),
    };
    const meta = stripeAttributionMetadata(cookie);
    for (const [key, value] of Object.entries(meta)) {
      expect(value.length, key).toBeLessThanOrEqual(STRIPE_ATTR_METADATA_MAX);
    }
    expect(meta[STRIPE_ATTR_FBCLID_KEY]).toBe(fbclid);
    expect(meta[STRIPE_ATTR_LAND_FIRST_KEY]).toContain("fbclid=");
    expect(meta[STRIPE_ATTR_LAND_LAST_KEY]).toContain(fbclid);
    const admin = adminAttributionFromStripeMetadata(meta);
    expect(admin?.fbclid).toBe(fbclid);
    expect(admin?.content).toBe("carousel-october-2026-vin".repeat(4).slice(0, 80));
    expect(admin?.firstLanding).toBeTruthy();
    expect(admin?.lastLanding).toBeTruthy();
  });
});
