import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import {
  applyAdminInputToRecord,
  buildClientLinkCheckoutSessionParams,
  buildClientLinkEmailCopy,
  buildClientLinkStripeMetadata,
  buildClientLinkWhatsAppText,
  buildClientLinkWhatsAppUrl,
  CLIENT_LINK_DEFAULT_AMOUNT_CENTS,
  CLIENT_LINK_DEFAULT_PRODUCT,
  CLIENT_LINK_FULFILLMENT,
  CLIENT_LINK_PATH_PREFIX,
  clientLinkAbsoluteUrl,
  clientLinkHashFromStripeMetadata,
  clientLinkPublicPath,
  clientLinkPublicView,
  defaultClientLinkAdminInput,
  expiresAtFromCreated,
  formatClientLinkAmount,
  isClientLinkExpired,
  isClientLinkPath,
  isClientLinkUsable,
  isSafeClientLinkToken,
  normalizeClientLinkAdminInput,
  parseClientLinkRecord,
  parseEurToCents,
  validateClientLinkSubmission,
} from "@/lib/client-link";
import { clientLinkHashesEqual, hashClientLinkToken, newClientLinkToken } from "@/lib/client-link-crypto";

describe("client link token", () => {
  it("is at least 128 bits, unique, URL-safe, and stored only as sha256", () => {
    const a = newClientLinkToken();
    const b = newClientLinkToken();
    expect(a).not.toBe(b);
    expect(isSafeClientLinkToken(a)).toBe(true);
    expect(Buffer.from(a, "base64url").length).toBeGreaterThanOrEqual(16);
    const hash = hashClientLinkToken(a);
    expect(hash).toBe(createHash("sha256").update(a, "utf8").digest("hex"));
    expect(hash).toHaveLength(64);
    expect(hash).not.toBe(a);
    expect(clientLinkHashesEqual(hash, hashClientLinkToken(a))).toBe(true);
    expect(clientLinkHashesEqual(hash, hashClientLinkToken(b))).toBe(false);
  });

  it("rejects short or odd tokens", () => {
    expect(isSafeClientLinkToken("abc")).toBe(false);
    expect(isSafeClientLinkToken("../../../etc/passwd")).toBe(false);
    expect(isSafeClientLinkToken("a".repeat(24))).toBe(true);
  });
});

describe("client link paths", () => {
  it("is /s/[token] and is not a site-indexable prefix match for /sludinajumi", () => {
    expect(clientLinkPublicPath("k70mToken")).toBe("/s/k70mToken");
    expect(isClientLinkPath("/s")).toBe(true);
    expect(isClientLinkPath("/s/abc")).toBe(true);
    expect(isClientLinkPath("/sludinajumi")).toBe(false);
    expect(isClientLinkPath("/lv/s/abc")).toBe(false);
    expect(CLIENT_LINK_PATH_PREFIX).toBe("/s");
    expect(clientLinkAbsoluteUrl("https://www.provin.lv", "tok")).toBe("https://www.provin.lv/s/tok");
  });
});

describe("amount and expiry", () => {
  it("parses Latvian euro amounts", () => {
    expect(parseEurToCents("99,99 €")).toBe(9999);
    expect(parseEurToCents("99.99")).toBe(9999);
    expect(parseEurToCents("1")).toBe(100);
    expect(parseEurToCents("0,50")).toBeNull();
    expect(parseEurToCents("abc")).toBeNull();
    expect(formatClientLinkAmount(9999)).toBe("99,99 €");
  });

  it("expires after the chosen hours from createdAt", () => {
    const created = "2026-10-14T10:00:00.000Z";
    const exp = expiresAtFromCreated(created, 48);
    expect(Date.parse(exp) - Date.parse(created)).toBe(48 * 60 * 60 * 1000);
    expect(isClientLinkExpired(exp, Date.parse(created) + 47 * 60 * 60 * 1000)).toBe(false);
    expect(isClientLinkExpired(exp, Date.parse(created) + 48 * 60 * 60 * 1000)).toBe(true);
  });

  it("is unusable after payment even if time remains", () => {
    expect(isClientLinkUsable({ status: "paid", expiresAt: "2099-01-01T00:00:00.000Z" })).toBe(false);
    expect(isClientLinkUsable({ status: "open", expiresAt: "2099-01-01T00:00:00.000Z" })).toBe(true);
  });
});

describe("admin input and submission", () => {
  it("defaults to PROVIN AUDITS PRO at 99,99 with email/VIN/listing required", () => {
    const d = defaultClientLinkAdminInput();
    expect(d.productName).toBe(CLIENT_LINK_DEFAULT_PRODUCT);
    expect(d.amountCents).toBe(CLIENT_LINK_DEFAULT_AMOUNT_CENTS);
    expect(d.require).toEqual({ email: true, vin: true, listingUrl: true, phone: false });
    expect(d.validityHours).toBe(48);
  });

  it("normalizes VIN prefill and rejects a listing homepage", () => {
    const ok = normalizeClientLinkAdminInput({
      prefillVin: " wbaff41030l065449 ",
      require: { email: true, vin: true, listingUrl: false, phone: false },
    });
    expect("error" in ok).toBe(false);
    if ("error" in ok) return;
    expect(ok.prefillVin).toBe("WBAFF41030L065449");

    const bad = normalizeClientLinkAdminInput({ prefillListingUrl: "https://ss.com/" });
    expect(bad).toEqual({ error: "invalid_listing" });
  });

  it("requires only the fields the admin selected", () => {
    const record = {
      require: { email: true, vin: true, listingUrl: false, phone: false },
      prefillVin: "",
      prefillListingUrl: "",
      recipientChannel: "email" as const,
      recipient: "ops@provin.lv",
    };
    const missingVin = validateClientLinkSubmission(
      record,
      { email: "a@b.lv", vin: "", listingUrl: "", phone: "" },
      true,
    );
    expect(missingVin).toMatchObject({ ok: false, error: "vin" });

    const ok = validateClientLinkSubmission(
      record,
      { email: "klients@piemers.lv", vin: "WBAFF41030L065449", listingUrl: "", phone: "" },
      true,
    );
    expect(ok.ok).toBe(true);
    if (!ok.ok) return;
    expect(ok.resolved.email).toBe("klients@piemers.lv");
    expect(ok.resolved.vin).toBe("WBAFF41030L065449");

    const shortVin = validateClientLinkSubmission(
      record,
      { email: "klients@piemers.lv", vin: "W0VZCYHZXN684325", listingUrl: "", phone: "" },
      true,
    );
    expect(shortVin).toMatchObject({ ok: false, error: "vin_length" });
  });

  it("requires withdrawal consent", () => {
    const record = {
      require: { email: false, vin: false, listingUrl: false, phone: false },
      prefillVin: "",
      prefillListingUrl: "",
      recipientChannel: "email" as const,
      recipient: "a@b.lv",
    };
    expect(validateClientLinkSubmission(record, { email: "", vin: "", listingUrl: "", phone: "" }, false)).toEqual({
      ok: false,
      error: "consent",
    });
  });
});

describe("public view, stripe and messages", () => {
  const record = parseClientLinkRecord({
    tokenHash: "a".repeat(64),
    createdAt: "2026-10-14T10:00:00.000Z",
    expiresAt: "2026-10-16T10:00:00.000Z",
    status: "open",
    productName: CLIENT_LINK_DEFAULT_PRODUCT,
    amountCents: 9999,
    recipientChannel: "email",
    recipient: "klients@piemers.lv",
    prefillVin: "WBAFF41030L065449",
    prefillListingUrl: "https://www.ss.com/msg/lv/transport/cars/bmw/x5/abc.html",
    require: { email: true, vin: true, listingUrl: true, phone: false },
  });

  it("parses a stored record without keeping a plaintext token", () => {
    expect(record?.tokenHash).toBe("a".repeat(64));
    expect(JSON.stringify(record)).not.toMatch(/token[^H]/);
  });

  it("exposes prefilled email/VIN/listing to the client form", () => {
    expect(record).not.toBeNull();
    const view = clientLinkPublicView(record!);
    expect(view.prefillEmail).toBe("klients@piemers.lv");
    expect(view.prefillVin).toBe("WBAFF41030L065449");
    expect(view.productName).toBe(CLIENT_LINK_DEFAULT_PRODUCT);
  });

  it("builds Stripe metadata that creates a normal audit order after payment", () => {
    const meta = buildClientLinkStripeMetadata({
      tokenHash: "b".repeat(64),
      vin: "WBAFF41030L065449",
      listingUrl: "https://www.ss.com/msg/lv/x/1.html",
      phone: "+37120000000",
    });
    expect(meta.fulfillment).toBe(CLIENT_LINK_FULFILLMENT);
    expect(meta.checkout_line).toBe("audit");
    expect(meta.client_link_hash).toBe("b".repeat(64));
    expect(clientLinkHashFromStripeMetadata(meta)).toBe("b".repeat(64));
    expect(clientLinkHashFromStripeMetadata({ fulfillment: "order_upsell" })).toBeNull();
  });

  it("points Checkout cancel back to /s/[token] and success to paldies", () => {
    const params = buildClientLinkCheckoutSessionParams({
      origin: "https://www.provin.lv",
      token: "k70mTokenValue______",
      tokenHash: "c".repeat(64),
      productName: CLIENT_LINK_DEFAULT_PRODUCT,
      amountCents: 9999,
      email: "a@b.lv",
      vin: "WBAFF41030L065449",
      listingUrl: "",
      phone: "",
    });
    expect(params.line_items[0].price_data.unit_amount).toBe(9999);
    expect(params.success_url).toContain("/lv/paldies?session_id={CHECKOUT_SESSION_ID}");
    expect(params.cancel_url).toBe("https://www.provin.lv/s/k70mTokenValue______");
    expect(params.customer_email).toBe("a@b.lv");
  });

  it("WhatsApp and email copy use wa.me, include the URL, and have no unicode dashes", () => {
    const url = "https://www.provin.lv/s/k70mTokenValue______";
    const text = buildClientLinkWhatsAppText({
      url,
      productName: CLIENT_LINK_DEFAULT_PRODUCT,
      expiresAt: "2026-10-16T16:50:00.000Z",
      amountCents: 9999,
    });
    expect(text).toContain(url);
    expect(text).toContain("99,99 €");
    expect(text).not.toMatch(/[\u2012\u2013\u2014\u2015\u2212]/);
    expect(buildClientLinkWhatsAppUrl("20000000", text)).toMatch(/^https:\/\/wa\.me\/37120000000\?text=/);
    expect(buildClientLinkWhatsAppUrl("", text)).toMatch(/^https:\/\/wa\.me\/\?text=/);
    const email = buildClientLinkEmailCopy({
      url,
      productName: CLIENT_LINK_DEFAULT_PRODUCT,
      expiresAt: "2026-10-16T16:50:00.000Z",
      amountCents: 9999,
    });
    expect(email.subject).toContain("PROVIN AUDITS PRO");
    expect(email.text).toContain(url);
    expect(email.text).not.toMatch(/[\u2012\u2013\u2014\u2015\u2212]/);
  });

  it("keeps token hash when admin updates amount", () => {
    expect(record).not.toBeNull();
    const next = applyAdminInputToRecord(record!, {
      ...defaultClientLinkAdminInput(),
      amountCents: 7999,
      validityHours: 24,
    });
    expect(next.tokenHash).toBe(record!.tokenHash);
    expect(next.amountCents).toBe(7999);
    expect(Date.parse(next.expiresAt) - Date.parse(next.createdAt)).toBe(24 * 60 * 60 * 1000);
  });
});
