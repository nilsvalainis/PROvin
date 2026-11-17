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
const fetchForSave = vi.fn(async (_ref: unknown, ids: readonly string[]) => {
  const sharp = (await import("sharp")).default;
  const jpeg = await sharp({ create: { width: 40, height: 30, channels: 3, background: "#336699" } }).jpeg().toBuffer();
  return new Map(ids.filter((id) => id !== "id:failed0001").map((id) => [id, jpeg]));
});
vi.mock("@/lib/iriss-offer-source", () => ({ fetchOfferSourcePhotosForSave: fetchForSave }));

import { emptyIrissOfferRecord, emptyIrissPasutijums } from "@/lib/iriss-pasutijumi-types";
import { stockPhotoAttachment } from "@/lib/iriss-stock-photos";

const ORDER_ID = "11111111-1111-4111-8111-111111111111";
const OFFER_ID = "22222222-2222-4222-8222-222222222222";

describe("offer save copies /STOCK photos from Dropbox to storage", () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
    dirs.length = 0;
    vi.resetModules();
    vi.unstubAllEnvs();
    fetchForSave.mockClear();
  });

  async function store() {
    const dir = mkdtempSync(path.join(os.tmpdir(), "iriss-offer-dbx-"));
    dirs.push(dir);
    vi.stubEnv("ADMIN_IRISS_PASUTIJUMI_DIR", dir);
    vi.stubEnv("VERCEL", "");
    vi.resetModules();
    return import("@/lib/iriss-pasutijumi-store");
  }

  it("stores the photo, drops the proxy address, keeps the Dropbox id; failed ones stay pending", async () => {
    const orders = await store();
    const ref = { kind: "autoparks" as const, id: "car1" };
    const order = emptyIrissPasutijums(ORDER_ID, "2026-10-23T10:00:00.000Z");
    const offer = emptyIrissOfferRecord(OFFER_ID, order.createdAt, "Piedāvājums 1");
    offer.sourceRef = "autoparks:car1";
    offer.attachments = [
      stockPhotoAttachment(ref, { dropboxId: "id:photo0001", name: "IMG_1.jpg" }),
      stockPhotoAttachment(ref, { dropboxId: "id:failed0001", name: "IMG_2.jpg" }),
    ];
    order.offers = [offer];
    const saved = await orders.writeIrissPasutijums(order);
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    const [a, b] = saved.record.offers[0]!.attachments;
    expect(fetchForSave).toHaveBeenCalledWith(ref, ["id:photo0001", "id:failed0001"]);
    expect(a).toMatchObject({ dropboxId: "id:photo0001", mimeType: "image/jpeg", dataUrl: "" });
    expect(a?.blobPath).toBeTruthy();
    expect(a?.thumbBlobPath).toBeTruthy();
    expect(a?.thumbUrl).toBeUndefined();
    expect(b?.blobPath).toBeUndefined();
    expect(b?.dropboxId).toBe("id:failed0001");
    expect(saved.record.offers[0]?.sourceRef).toBe("autoparks:car1");
    const bytes = await orders.readIrissOfferAttachmentBytes(a!);
    expect(bytes?.bytes.length).toBeGreaterThan(100);
  });

  it("never copies Dropbox files for an offer without a source", async () => {
    const orders = await store();
    const order = emptyIrissPasutijums(ORDER_ID, "2026-10-23T10:00:00.000Z");
    const offer = emptyIrissOfferRecord(OFFER_ID, order.createdAt, "Piedāvājums 1");
    offer.attachments = [stockPhotoAttachment({ kind: "autoparks", id: "car1" }, { dropboxId: "id:photo0001", name: "IMG_1.jpg" })];
    order.offers = [offer];
    const saved = await orders.writeIrissPasutijums(order);
    expect(saved.ok).toBe(true);
    expect(fetchForSave).not.toHaveBeenCalled();
    if (saved.ok) expect(saved.record.offers[0]?.attachments[0]?.blobPath).toBeUndefined();
  });
});
