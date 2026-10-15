import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@vercel/blob", () => ({
  get: vi.fn(async () => {
    throw new Error("blob disabled in test");
  }),
  put: vi.fn(async () => {
    throw new Error("blob disabled in test");
  }),
  del: vi.fn(async () => undefined),
  list: vi.fn(async () => ({ blobs: [] })),
}));

import { isIrissOfferLinkUsable } from "@/lib/iriss-offer-client-link";
import { hashIrissOfferLinkToken } from "@/lib/iriss-offer-client-link-token";
import { emptyIrissOfferRecord, emptyIrissPasutijums } from "@/lib/iriss-pasutijumi-types";

const ORDER_ID = "11111111-1111-4111-8111-111111111111";
const OFFER_ID = "22222222-2222-4222-8222-222222222222";
const PHOTO_ID = "33333333-3333-4333-8333-333333333333";
const PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

describe("IRISS offer client link store", () => {
  const dirs: string[] = [];

  afterEach(() => {
    for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
    dirs.length = 0;
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  async function load(dir: string) {
    vi.unstubAllEnvs();
    vi.stubEnv("ADMIN_IRISS_PASUTIJUMI_DIR", dir);
    vi.stubEnv("VERCEL", "");
    vi.resetModules();
    const store = await import("@/lib/iriss-offer-client-link-store");
    const orders = await import("@/lib/iriss-pasutijumi-store");
    const loadPage = await import("@/lib/iriss-offer-client-link-load");
    return { store, orders, loadPage };
  }

  it("round-trips a private token, counts views, and hides admin data", async () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "iriss-offer-link-"));
    dirs.push(dir);
    const { store, orders, loadPage } = await load(dir);
    const now = "2026-10-15T08:00:00.000Z";
    const order = emptyIrissPasutijums(ORDER_ID, now);
    order.clientFirstName = "Sekreta";
    order.clientLastName = "Persona";
    order.phone = "+37120000000";
    order.email = "secret-admin@example.com";
    order.notes = "SECRET-ADMIN-NOTE-ZZZZ";
    order.listingLinkEcarstrade = ["https://secret-listing.example/car/12345678"];
    const offer = emptyIrissOfferRecord(OFFER_ID, now, "Piedāvājums 1");
    offer.brandModel = "Audi A4";
    offer.carPrice = "12000";
    offer.attachments = [
      { id: PHOTO_ID, name: "a.png", mimeType: "image/png", size: 70, dataUrl: PNG },
    ];
    order.offers = [offer];
    const saved = await orders.writeIrissPasutijums(order);
    expect(saved.ok).toBe(true);

    const created = await store.createIrissOfferClientLink({
      orderId: ORDER_ID,
      offerId: OFFER_ID,
      expiresInDays: 7,
      nowMs: Date.parse(now),
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.record.token.length).toBeGreaterThanOrEqual(16);
    expect(created.record.tokenHash).toBe(hashIrissOfferLinkToken(created.record.token));
    expect(isIrissOfferLinkUsable(created.record, Date.parse("2026-10-20T00:00:00.000Z"))).toBe(true);
    expect(isIrissOfferLinkUsable(created.record, Date.parse("2026-10-30T00:00:00.000Z"))).toBe(false);

    const found = await store.readIrissOfferClientLinkByToken(created.record.token);
    expect(found?.offerId).toBe(OFFER_ID);
    expect(await store.readIrissOfferClientLinkByToken("b".repeat(24))).toBeNull();
    expect(await store.readIrissOfferClientLinkByToken(ORDER_ID)).toBeNull();

    const viewed = await store.recordIrissOfferLinkView(created.record.tokenHash, Date.parse("2026-10-15T09:00:00.000Z"));
    const viewedAgain = await store.recordIrissOfferLinkView(created.record.tokenHash, Date.parse("2026-10-15T10:00:00.000Z"));
    expect(viewedAgain?.viewCount).toBe(2);
    expect(viewedAgain?.firstViewedAt).toBe(viewed?.firstViewedAt);

    const asked = await store.respondIrissOfferClientLink(
      created.record.tokenHash,
      "question",
      "Vai cena ir galīga?",
      Date.parse("2026-10-15T11:00:00.000Z"),
    );
    expect(asked.ok).toBe(true);
    if (!asked.ok) return;
    const approved = await store.respondIrissOfferClientLink(
      created.record.tokenHash,
      "approve",
      "",
      Date.parse("2026-10-15T12:00:00.000Z"),
    );
    expect(approved.ok).toBe(true);
    if (!approved.ok) return;
    expect(approved.record.decision).toBe("approve");
    expect(approved.record.question).toContain("galīga");
    const flipped = await store.respondIrissOfferClientLink(
      created.record.tokenHash,
      "decline",
      "",
      Date.parse("2026-10-15T13:00:00.000Z"),
    );
    expect(flipped.ok).toBe(true);
    if (!flipped.ok) return;
    expect(flipped.record.decision).toBe("approve");

    const admin = await store.readIrissOfferClientLinksForOrder(ORDER_ID);
    expect(admin).toHaveLength(1);
    expect(admin[0]?.status).toBe("approved");
    expect(admin[0]?.statusLabel).toBe("Apstiprināts");
    expect(admin[0]?.path.startsWith("/p/")).toBe(true);
    expect(admin[0]?.path).not.toContain(ORDER_ID);
    expect(JSON.stringify(admin)).not.toContain("SECRET-ADMIN-NOTE");
    expect(JSON.stringify(admin)).not.toContain("secret-admin@example.com");

    const view = await loadPage.loadIrissOfferPublicView(created.record.token, Date.parse("2026-10-15T12:30:00.000Z"));
    expect(view?.brandModel).toBe("Audi A4");
    expect(view?.decision).toBe("approve");
    expect(view?.photos).toEqual([{ id: PHOTO_ID }]);
    const blob = JSON.stringify(view);
    expect(blob).not.toContain(ORDER_ID);
    expect(blob).not.toContain(OFFER_ID);
    expect(blob).not.toContain(created.record.token);
    expect(blob).not.toContain("SECRET-ADMIN-NOTE");
    expect(blob).not.toContain("secret-listing.example");
    expect(blob).not.toContain("+37120000000");

    const photo = await loadPage.readIrissOfferPublicPhoto(created.record.token, PHOTO_ID, Date.parse("2026-10-15T12:30:00.000Z"));
    expect(photo?.mimeType).toBe("image/png");
    expect(photo?.bytes.length).toBeGreaterThan(8);
    expect(await loadPage.readIrissOfferPublicPhoto(created.record.token, "../etc/passwd")).toBeNull();

    const replaced = await store.createIrissOfferClientLink({
      orderId: ORDER_ID,
      offerId: OFFER_ID,
      expiresInDays: null,
      nowMs: Date.parse("2026-10-16T08:00:00.000Z"),
    });
    expect(replaced.ok).toBe(true);
    if (!replaced.ok) return;
    const old = await store.readIrissOfferClientLinkByToken(created.record.token);
    expect(old?.revokedAt).not.toBe("");
    expect(isIrissOfferLinkUsable(old!)).toBe(false);
    expect(await loadPage.loadIrissOfferPublicView(created.record.token)).toBeNull();
    expect(await loadPage.loadIrissOfferPublicView(replaced.record.token)).not.toBeNull();

    const revoked = await store.revokeIrissOfferClientLink(ORDER_ID, OFFER_ID, Date.parse("2026-10-17T08:00:00.000Z"));
    expect(revoked.ok).toBe(true);
    expect(await loadPage.loadIrissOfferPublicView(replaced.record.token)).toBeNull();
    expect((await store.readIrissOfferClientLinksForOrder(ORDER_ID))[0]?.status).toBe("revoked");
  });

  it("rejects a file whose token does not hash to the stored hash", async () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "iriss-offer-link-"));
    dirs.push(dir);
    const { store } = await load(dir);
    const created = await store.createIrissOfferClientLink({
      orderId: ORDER_ID,
      offerId: OFFER_ID,
      expiresInDays: null,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const fs = await import("node:fs/promises");
    const file = path.join(dir, "offer-links", "tokens", `${created.record.tokenHash}.json`);
    const swapped = { ...created.record, token: "c".repeat(24) };
    await fs.writeFile(file, JSON.stringify(swapped), "utf8");
    expect(await store.readIrissOfferClientLinkByToken(created.record.token)).toBeNull();
    expect(await store.readIrissOfferClientLinkByToken(swapped.token)).toBeNull();
  });
});
