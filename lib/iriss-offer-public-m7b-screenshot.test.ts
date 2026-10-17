/**
 * Optional visual check for M7b + logo. Run with dev server and seed dir:
 *   ADMIN_IRISS_PASUTIJUMI_DIR=/tmp/iriss-m7b CAPTURE_IRISS_M7B=1 PREVIEW_URL=http://localhost:3040 npm test -- lib/iriss-offer-public-m7b-screenshot.test.ts
 */
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
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

import { chromium } from "playwright";
import { emptyIrissOfferRecord, emptyIrissPasutijums } from "@/lib/iriss-pasutijumi-types";

const ORDER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OFFER_WITH_PHOTOS = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const OFFER_NO_PHOTOS = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const PHOTO_A = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const PHOTO_B = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mNk+M9Qz0AEYBxVSF+FABJADveWkH6aAAAAAElFTkSuQmCC";

const OUT_DIR = "/opt/cursor/artifacts";

describe("IRISS offer M7b screenshots", () => {
  const dirs: string[] = [];

  afterEach(() => {
    for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
    dirs.length = 0;
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  async function seed(dir: string) {
    vi.unstubAllEnvs();
    vi.stubEnv("ADMIN_IRISS_PASUTIJUMI_DIR", dir);
    vi.stubEnv("VERCEL", "");
    vi.resetModules();
    const store = await import("@/lib/iriss-offer-client-link-store");
    const orders = await import("@/lib/iriss-pasutijumi-store");
    const now = "2026-10-17T10:00:00.000Z";

    const order = emptyIrissPasutijums(ORDER_ID, now);
    const withPhotos = emptyIrissOfferRecord(OFFER_WITH_PHOTOS, now, "Ar foto");
    withPhotos.brandModel = "Audi A6 3.0 V6 TDI quattro";
    withPhotos.firstRegistration = "2012-06-13";
    withPhotos.odometerReading = "300 271 km";
    withPhotos.transmission = "Automātiskā";
    withPhotos.vin = "F18B2CD103D3420F3";
    withPhotos.carPrice = "8499";
    withPhotos.attachments = [
      { id: PHOTO_A, name: "a.png", mimeType: "image/png", size: 80, dataUrl: PNG },
      { id: PHOTO_B, name: "b.png", mimeType: "image/png", size: 80, dataUrl: PNG },
    ];

    const noPhotos = emptyIrissOfferRecord(OFFER_NO_PHOTOS, now, "Bez foto");
    noPhotos.brandModel = "Audi A6 3.0 V6 TDI quattro";
    noPhotos.firstRegistration = "2012-06-13";
    noPhotos.odometerReading = "300 271 km";
    noPhotos.transmission = "Automātiskā";
    noPhotos.vin = "F18B2CD103D3420F3";
    noPhotos.carPrice = "8499";

    order.offers = [withPhotos, noPhotos];
    await orders.writeIrissPasutijums(order);

    const linkWith = await store.createIrissOfferClientLink({
      orderId: ORDER_ID,
      offerId: OFFER_WITH_PHOTOS,
      expiresInDays: 14,
      nowMs: Date.parse(now),
    });
    const linkNo = await store.createIrissOfferClientLink({
      orderId: ORDER_ID,
      offerId: OFFER_NO_PHOTOS,
      expiresInDays: 14,
      nowMs: Date.parse(now),
    });
    if (!linkWith.ok || !linkNo.ok) throw new Error("link create failed");
    return { withPhotos: linkWith.record.token, noPhotos: linkNo.record.token };
  }

  it("writes desktop/mobile PNGs when CAPTURE_IRISS_M7B=1", async () => {
    if (process.env.CAPTURE_IRISS_M7B !== "1") return;

    const base = process.env.PREVIEW_URL?.trim() || "http://localhost:3040";
    const dir = process.env.ADMIN_IRISS_PASUTIJUMI_DIR?.trim() || mkdtempSync(path.join(os.tmpdir(), "iriss-m7b-"));
    if (!process.env.ADMIN_IRISS_PASUTIJUMI_DIR) dirs.push(dir);

    const tokens = await seed(dir);
    mkdirSync(OUT_DIR, { recursive: true });

    const browser = await chromium.launch();
    const cases = [
      { name: "with-photos", token: tokens.withPhotos },
      { name: "no-photos", token: tokens.noPhotos },
    ] as const;

    for (const { name, token } of cases) {
      for (const [viewportName, viewport] of [
        ["desktop", { width: 1440, height: 900 }],
        ["mobile", { width: 390, height: 844 }],
      ] as const) {
        const page = await browser.newPage({ viewport });
        const url = `${base.replace(/\/$/, "")}/p/${token}`;
        const res = await page.goto(url, { waitUntil: "networkidle", timeout: 120_000 });
        expect(res?.ok()).toBe(true);

        const logo = page.locator('img[alt="Dzintarzeme Auto"]').first();
        await logo.waitFor({ state: "visible", timeout: 30_000 });
        const naturalWidth = await logo.evaluate((el: HTMLImageElement) => el.naturalWidth);
        expect(naturalWidth).toBeGreaterThan(0);

        const gutterBg = await page.evaluate(() => {
          const body = getComputedStyle(document.body);
          const html = getComputedStyle(document.documentElement);
          return { body: body.backgroundColor, html: html.backgroundColor, bodyImage: body.backgroundImage };
        });
        expect(gutterBg.bodyImage).toBe("none");
        for (const c of [gutterBg.body, gutterBg.html]) {
          expect(c).toMatch(/244,\s*244,\s*245/);
        }

        const out = path.join(OUT_DIR, `m7b-offer-${name}-${viewportName}.png`);
        await page.screenshot({ path: out, fullPage: true });
        await page.close();
      }
    }

    await browser.close();
  }, 180_000);

  it("writes production PNGs when CAPTURE_IRISS_M7B_PROD=1", async () => {
    if (process.env.CAPTURE_IRISS_M7B_PROD !== "1") return;
    const url =
      process.env.PROD_OFFER_URL?.trim() || "https://www.provin.lv/p/vo39bYp8IgbEBGfU11vdZrpd";
    mkdirSync(OUT_DIR, { recursive: true });
    const browser = await chromium.launch();
    for (const [viewportName, viewport] of [
      ["desktop-1280", { width: 1280, height: 900 }],
      ["mobile-390", { width: 390, height: 844 }],
    ] as const) {
      const page = await browser.newPage({ viewport });
      const res = await page.goto(url, { waitUntil: "networkidle", timeout: 120_000 });
      expect(res?.ok()).toBe(true);
      const gutterBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
      expect(gutterBg).toMatch(/244,\s*244,\s*245/);
      await page.locator('img[alt="Dzintarzeme Auto"]').first().waitFor({ state: "visible", timeout: 30_000 });
      const out = path.join(OUT_DIR, `m7b-prod-offer-${viewportName}.png`);
      await page.screenshot({ path: out, fullPage: true });
      await page.close();
    }
    await browser.close();
  }, 180_000);
});
