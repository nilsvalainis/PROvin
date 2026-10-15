import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { emptyIrissOfferRecord, emptyIrissPasutijums } from "@/lib/iriss-pasutijumi-types";
import {
  IRISS_OFFER_LINK_PATH_PREFIX,
  IRISS_OFFER_PUBLIC_BRAND,
  IRISS_OFFER_PUBLIC_LEGAL,
  applyIrissOfferLinkResponse,
  applyIrissOfferLinkRevoke,
  applyIrissOfferLinkView,
  buildIrissOfferClientLinkMailto,
  buildIrissOfferClientLinkMessage,
  buildIrissOfferClientLinkWhatsAppUrl,
  irissOfferLinkRequestIsSameOrigin,
  buildIrissOfferPublicView,
  formatIrissOfferLinkStamp,
  irissOfferClientLinkAbsoluteUrl,
  irissOfferClientLinkPublicPath,
  irissOfferClientLinkStatus,
  irissOfferClientLinkStatusLabel,
  irissOfferLinkExpiresAt,
  irissOfferPublicViewContainsSecret,
  irissOfferPublicViewKeys,
  isIrissOfferLinkPath,
  isIrissOfferLinkUsable,
  isIrissOfferPublicImageMime,
  isSafeIrissOfferAttachmentId,
  isSafeIrissOfferLinkToken,
  parseIrissOfferClientLinkRecord,
  parseIrissOfferLinkExpiryDays,
  sanitizeIrissOfferQuestion,
  toIrissOfferClientLinkAdminView,
  type IrissOfferClientLinkRecord,
} from "@/lib/iriss-offer-client-link";
import {
  hashIrissOfferLinkToken,
  irissOfferLinkHashesEqual,
  newIrissOfferLinkToken,
} from "@/lib/iriss-offer-client-link-token";

const ORDER_ID = "11111111-1111-4111-8111-111111111111";
const OFFER_ID = "22222222-2222-4222-8222-222222222222";

function sampleRecord(token: string, patch: Partial<IrissOfferClientLinkRecord> = {}): IrissOfferClientLinkRecord {
  const now = "2026-10-15T08:00:00.000Z";
  return {
    tokenHash: hashIrissOfferLinkToken(token),
    token,
    orderId: ORDER_ID,
    offerId: OFFER_ID,
    createdAt: now,
    expiresAt: "",
    revokedAt: "",
    firstViewedAt: "",
    lastViewedAt: "",
    viewCount: 0,
    decision: "",
    decidedAt: "",
    question: "",
    questionAt: "",
    ...patch,
  };
}

describe("IRISS offer client link token", () => {
  it("is 16+ url-safe chars, unique, and stored as sha256", () => {
    const a = newIrissOfferLinkToken();
    const b = newIrissOfferLinkToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(16);
    expect(isSafeIrissOfferLinkToken(a)).toBe(true);
    expect(Buffer.from(a, "base64url").length).toBeGreaterThanOrEqual(16);
    const hash = hashIrissOfferLinkToken(a);
    expect(hash).toBe(createHash("sha256").update(a, "utf8").digest("hex"));
    expect(hash).not.toBe(a);
    expect(irissOfferLinkHashesEqual(hash, hashIrissOfferLinkToken(a))).toBe(true);
    expect(irissOfferLinkHashesEqual(hash, hashIrissOfferLinkToken(b))).toBe(false);
  });

  it("rejects short, path, and dotted tokens", () => {
    expect(isSafeIrissOfferLinkToken("short-token")).toBe(false);
    expect(isSafeIrissOfferLinkToken("../etc/passwd-token")).toBe(false);
    expect(isSafeIrissOfferLinkToken("a".repeat(15))).toBe(false);
    expect(isSafeIrissOfferLinkToken("a".repeat(16))).toBe(true);
    expect(isSafeIrissOfferLinkToken(`${ORDER_ID}`)).toBe(true);
  });
});

describe("IRISS offer client link paths", () => {
  it("uses /p and does not swallow /partneriem or /pasutit", () => {
    const token = "a".repeat(16);
    expect(irissOfferClientLinkPublicPath(token)).toBe(`/p/${token}`);
    expect(irissOfferClientLinkPublicPath(token)).not.toContain(ORDER_ID);
    expect(isIrissOfferLinkPath("/p")).toBe(true);
    expect(isIrissOfferLinkPath(`/p/${token}`)).toBe(true);
    expect(isIrissOfferLinkPath("/partneriem")).toBe(false);
    expect(isIrissOfferLinkPath("/pasutit")).toBe(false);
    expect(isIrissOfferLinkPath("/paldies")).toBe(false);
    expect(isIrissOfferLinkPath("/lv/p/abc")).toBe(false);
    expect(IRISS_OFFER_LINK_PATH_PREFIX).toBe("/p");
    expect(irissOfferClientLinkAbsoluteUrl("https://www.provin.lv/", token)).toBe(`https://www.provin.lv/p/${token}`);
  });
});

describe("IRISS offer client link status", () => {
  const token = newIrissOfferLinkToken();

  it("moves sent, viewed, answered, approved, declined, revoked", () => {
    const sent = sampleRecord(token);
    expect(irissOfferClientLinkStatus(sent)).toBe("sent");
    expect(irissOfferClientLinkStatusLabel(sent)).toBe("Nosūtīts");

    const viewed = applyIrissOfferLinkView(sent, "2026-10-15T09:00:00.000Z");
    expect(viewed?.viewCount).toBe(1);
    expect(viewed?.firstViewedAt).toBe("2026-10-15T09:00:00.000Z");
    const viewedAgain = applyIrissOfferLinkView(viewed!, "2026-10-15T10:00:00.000Z");
    expect(viewedAgain?.viewCount).toBe(2);
    expect(viewedAgain?.firstViewedAt).toBe(viewed?.firstViewedAt);
    expect(irissOfferClientLinkStatus(viewedAgain!)).toBe("viewed");
    expect(irissOfferClientLinkStatusLabel(viewedAgain!)).toBe("Skatīts");

    const asked = applyIrissOfferLinkResponse(viewedAgain!, "question", "Vai ir servisa grāmata?", "2026-10-15T11:00:00.000Z");
    expect(asked.ok).toBe(true);
    if (!asked.ok) return;
    expect(irissOfferClientLinkStatus(asked.record)).toBe("answered");
    expect(irissOfferClientLinkStatusLabel(asked.record)).toBe("Atbildēts");

    const approved = applyIrissOfferLinkResponse(asked.record, "approve", "", "2026-10-15T12:00:00.000Z");
    expect(approved.ok).toBe(true);
    if (!approved.ok) return;
    expect(irissOfferClientLinkStatus(approved.record)).toBe("approved");
    expect(approved.record.question).toContain("servisa");

    const flipped = applyIrissOfferLinkResponse(approved.record, "decline", "", "2026-10-15T13:00:00.000Z");
    expect(flipped.ok).toBe(true);
    if (!flipped.ok) return;
    expect(flipped.unchanged).toBe(true);
    expect(flipped.record.decision).toBe("approve");

    const revoked = applyIrissOfferLinkRevoke(flipped.record, "2026-10-15T14:00:00.000Z");
    expect(irissOfferClientLinkStatus(revoked)).toBe("revoked");
    expect(irissOfferClientLinkStatusLabel(revoked)).toBe("Atsaukts");
    expect(isIrissOfferLinkUsable(revoked)).toBe(false);
    expect(applyIrissOfferLinkView(revoked, "2026-10-15T15:00:00.000Z")).toBeNull();
  });

  it("declines once and rejects an empty question", () => {
    const declined = applyIrissOfferLinkResponse(sampleRecord(token), "decline", "", "2026-10-15T09:00:00.000Z");
    expect(declined.ok).toBe(true);
    if (!declined.ok) return;
    expect(irissOfferClientLinkStatus(declined.record)).toBe("declined");
    const again = applyIrissOfferLinkResponse(declined.record, "approve", "", "2026-10-15T10:00:00.000Z");
    expect(again.ok).toBe(true);
    if (!again.ok) return;
    expect(again.record.decision).toBe("decline");
    const empty = applyIrissOfferLinkResponse(sampleRecord(token), "question", "   ", "2026-10-15T09:00:00.000Z");
    expect(empty.ok).toBe(false);
  });

  it("expires when a deadline is set and stays open without one", () => {
    expect(parseIrissOfferLinkExpiryDays(null)).toBeNull();
    expect(parseIrissOfferLinkExpiryDays("0")).toBeNull();
    expect(parseIrissOfferLinkExpiryDays(14)).toBe(14);
    expect(parseIrissOfferLinkExpiryDays(0.5)).toBe("invalid");
    const created = "2026-10-01T00:00:00.000Z";
    const exp = irissOfferLinkExpiresAt(created, 7);
    const open = sampleRecord(token, { expiresAt: exp });
    expect(isIrissOfferLinkUsable(open, Date.parse("2026-10-07T00:00:00.000Z"))).toBe(true);
    expect(isIrissOfferLinkUsable(open, Date.parse("2026-10-09T00:00:00.000Z"))).toBe(false);
    expect(isIrissOfferLinkUsable(sampleRecord(token), Date.parse("2030-01-01T00:00:00.000Z"))).toBe(true);
  });

  it("caps the question and drops tags", () => {
    expect(sanitizeIrissOfferQuestion("<b>Sveiki</b>")).toBe("Sveiki");
    expect(sanitizeIrissOfferQuestion("a".repeat(500)).length).toBe(400);
  });
});

describe("IRISS offer public view", () => {
  it("shows one offer and leaves out order and admin fields", () => {
    const order = emptyIrissPasutijums(ORDER_ID, "2026-10-15T08:00:00.000Z");
    order.clientFirstName = "Sekreta";
    order.clientLastName = "Persona";
    order.phone = "+37120000000";
    order.email = "secret-admin@example.com";
    order.notes = "SECRET-ADMIN-NOTE-ZZZZ";
    order.totalBudget = "SECRET-BUDGET-99999";
    order.listingLinkEcarstrade = ["https://secret-listing.example/car/12345678"];
    const offer = emptyIrissOfferRecord(OFFER_ID, order.createdAt, "Piedāvājums 1");
    offer.brandModel = "BMW 320d";
    offer.firstRegistration = "2018";
    offer.odometerReading = "145000 km";
    offer.transmission = "Automāts";
    offer.location = "Vācija";
    offer.vin = "WBA12345678901234";
    offer.carPrice = "15000";
    offer.deliveryPrice = "500";
    offer.commissionFee = "1190";
    offer.offerValidDays = "7";
    offer.hasFullServiceHistory = true;
    offer.summary = "<script>alert(1)</script> Tīrs auto";
    offer.attachments = [
      {
        id: "33333333-3333-4333-8333-333333333333",
        name: "a.png",
        mimeType: "image/png",
        size: 10,
        dataUrl: "data:image/png;base64,aaaa",
      },
      {
        id: "44444444-4444-4444-8444-444444444444",
        name: "x.svg",
        mimeType: "image/svg+xml",
        size: 10,
        dataUrl: "data:image/svg+xml;base64,aaaa",
      },
    ];
    const view = buildIrissOfferPublicView(offer, { decision: "", question: "" });
    const blob = JSON.stringify(view);
    expect(view.brand).toBe(IRISS_OFFER_PUBLIC_BRAND);
    expect(view.legalName).toBe(IRISS_OFFER_PUBLIC_LEGAL);
    expect(view.brandModel).toBe("BMW 320d");
    expect(view.total).toContain("€");
    expect(view.prices.map((row) => row.label)).toEqual(["Auto", "Piegāde", "Komisija"]);
    expect(view.checks).toEqual(["Pilna servisa vēsture"]);
    expect(view.notes).toBe("Tīrs auto");
    expect(view.notes).not.toContain("alert");
    expect(view.notes).not.toContain("<script>");
    expect(view.photos).toEqual([{ id: "33333333-3333-4333-8333-333333333333" }]);
    expect(view.validDays).toBe("7 dienas");
    expect(Object.keys(view)).toEqual([...irissOfferPublicViewKeys()]);
    expect(blob).not.toContain(order.id);
    expect(blob).not.toContain(order.phone);
    expect(blob).not.toContain(order.email);
    expect(blob).not.toContain(order.notes);
    expect(blob).not.toContain(order.clientFirstName);
    expect(blob).not.toContain("SECRET-BUDGET");
    expect(blob).not.toContain("secret-listing.example");
    expect(blob).not.toContain("data:image");
    expect(blob).not.toContain("blobPath");
    expect(blob).not.toContain("PROVIN");
    expect(blob).not.toContain("\u2014");
    expect(blob).not.toContain("\u2013");
    expect(irissOfferPublicViewContainsSecret(view, order.id)).toBe(false);
    expect(isIrissOfferPublicImageMime("image/svg+xml")).toBe(false);
    expect(isIrissOfferPublicImageMime("image/jpeg")).toBe(true);
    expect(isSafeIrissOfferAttachmentId("../etc/passwd")).toBe(false);
    expect(isSafeIrissOfferAttachmentId("33333333-3333-4333-8333-333333333333")).toBe(true);
  });
});

describe("IRISS offer client link share copy", () => {
  it("uses Dzintarzeme Auto on WhatsApp and email", () => {
    const url = "https://www.provin.lv/p/aaaaaaaaaaaaaaaa";
    const message = buildIrissOfferClientLinkMessage({ url, vehicle: "BMW 320d" });
    const wa = buildIrissOfferClientLinkWhatsAppUrl("+37120000000", message.text);
    const mail = buildIrissOfferClientLinkMailto("anna@example.com", message);
    expect(message.subject.startsWith("Dzintarzeme Auto: piedāvājums")).toBe(true);
    expect(message.text).toContain(url);
    expect(message.text).toContain("SIA ĪRISS");
    expect(message.text).not.toContain("PROVIN");
    expect(wa.startsWith("https://wa.me/37120000000?text=")).toBe(true);
    expect(decodeURIComponent(wa)).toContain(url);
    expect(mail.startsWith("mailto:anna@example.com?")).toBe(true);
    expect(message.subject).not.toContain("\u2014");
    expect(message.text).not.toContain("\u2014");
    expect(formatIrissOfferLinkStamp("2026-10-15T08:00:00.000Z")).toMatch(/^\d{2}\.\d{2} \d{2}:\d{2}$/);
    expect(
      irissOfferLinkRequestIsSameOrigin({
        url: "https://www.provin.lv/api/iriss-offer-link/respond",
        headers: { get: () => "https://www.provin.lv" },
      }),
    ).toBe(true);
    expect(
      irissOfferLinkRequestIsSameOrigin({
        url: "https://www.provin.lv/api/iriss-offer-link/respond",
        headers: { get: () => "https://evil.example" },
      }),
    ).toBe(false);
  });
});

describe("IRISS offer client link record parse", () => {
  it("drops a record whose token does not match the hash shape", () => {
    const token = newIrissOfferLinkToken();
    const rec = sampleRecord(token);
    expect(parseIrissOfferClientLinkRecord(rec)?.token).toBe(token);
    expect(parseIrissOfferClientLinkRecord({ ...rec, tokenHash: "abc" })).toBeNull();
    expect(parseIrissOfferClientLinkRecord({ ...rec, orderId: "1" })).toBeNull();
    expect(parseIrissOfferClientLinkRecord({ ...rec, token: "short" })).toBeNull();
    const admin = toIrissOfferClientLinkAdminView(rec);
    expect(admin.path).toBe(`/p/${token}`);
    expect(admin.statusLabel).toBe("Nosūtīts");
    expect(JSON.stringify(admin)).not.toContain(ORDER_ID);
  });
});
