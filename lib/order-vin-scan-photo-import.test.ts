import { afterEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/admin-cc-vin-photo-store", () => ({
  CC_VIN_PHOTO_MAX_BYTES: 320 * 1024,
  makeCcVinPhotoId: vi.fn(() => `ih_ph_${"ab".repeat(12)}`),
  writeCcVinPhotoJpeg: vi.fn(async () => undefined),
}));

describe("VIN SCAN izsoļu foto imports", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("ielādē visus URL, dublētos izlaiž pēc URL/hash, failed paliek sarakstā", async () => {
    const jpeg = await sharp({
      create: { width: 40, height: 30, channels: 3, background: "#112233" },
    })
      .jpeg({ quality: 70 })
      .toBuffer();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (String(url).includes("fail")) return new Response(null, { status: 500 });
        return new Response(new Uint8Array(jpeg), { status: 200, headers: { "Content-Type": "image/jpeg" } });
      }),
    );
    const { importVinScanAuctionPhotoGroupsToCcVin } = await import("@/lib/order-vin-scan-photo-import");
    const store = await import("@/lib/admin-cc-vin-photo-store");
    vi.mocked(store.makeCcVinPhotoId)
      .mockReturnValueOnce(`ih_ph_${"11".repeat(12)}`)
      .mockReturnValueOnce(`ih_ph_${"22".repeat(12)}`);

    const result = await importVinScanAuctionPhotoGroupsToCcVin(
      "cs_test_session",
      [
        {
          title: "JoJ · Copart · lots 1 · 2026",
          urls: [
            "https://cs.copart.com/p/1.jpg",
            "https://cs.copart.com/p/1.jpg",
            "https://cs.copart.com/p/fail.jpg",
            "https://cs.copart.com/p/2.jpg",
          ],
        },
      ],
      { existingCount: 0, existingSourceUrls: ["https://cs.copart.com/p/2.jpg"] },
    );
    expect(result.imported).toBe(1);
    expect(result.failedUrls).toContain("https://cs.copart.com/p/fail.jpg");
    expect(result.groups[0]?.photos[0]?.sourceUrl).toBe("https://cs.copart.com/p/1.jpg");
    expect(result.groups[0]?.photos[0]?.contentHash).toHaveLength(64);
  });
});
