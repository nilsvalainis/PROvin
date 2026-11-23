import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { AUCTION_ARCHIVE_PDF_PHOTO_MAX_PX, collectAuctionArchivePhotoSources, shrinkAuctionArchivePdfPhoto } from "@/lib/auction-archive-offer-photos";
import { isAllowedVinScanAuctionPhotoUrl } from "@/lib/order-vin-scan-photos";

describe("PDF bilžu samazināšana (~84 bildes)", () => {
  it("liela bilde → garākā mala ≤1600 px, JPEG; maza paliek kā ir; bojāta - null", async () => {
    const big = await sharp({ create: { width: 3200, height: 2400, channels: 3, background: "#808080" } }).png().toBuffer();
    const out = await shrinkAuctionArchivePdfPhoto(big);
    const meta = await sharp(out!).metadata();
    expect(meta.format).toBe("jpeg");
    expect(Math.max(meta.width ?? 0, meta.height ?? 0)).toBe(AUCTION_ARCHIVE_PDF_PHOTO_MAX_PX);
    const small = await sharp({ create: { width: 800, height: 600, channels: 3, background: "#808080" } }).jpeg().toBuffer();
    expect(await shrinkAuctionArchivePdfPhoto(small)).toBe(small);
    expect(await shrinkAuctionArchivePdfPhoto(Buffer.from("nav bilde"))).toBeNull();
  });
});

describe("BCA bildes (ImageUrls)", () => {
  const bcaUrl = (n: number) => `https://bcamediaprod.blob.core.windows.net/public/images/vehicle/IT/XX000XX/${n}`;

  it("BCA bilžu hosti ir atļauti - tikai precīzi, ne viss windows.net", () => {
    expect(isAllowedVinScanAuctionPhotoUrl(bcaUrl(1))).toBe(true);
    expect(isAllowedVinScanAuctionPhotoUrl("https://www.bcaimage.com/x.jpg")).toBe(true);
    expect(isAllowedVinScanAuctionPhotoUrl("https://evil.blob.core.windows.net/x.jpg")).toBe(false);
    expect(isAllowedVinScanAuctionPhotoUrl("https://bcamediaprod.blob.core.windows.net.evil.com/x.jpg")).toBe(false);
  });

  it("vecs ieraksts ar tukšu photoUrls: saites ņem no avota datu ImageUrls", () => {
    const record = {
      site: "bca",
      id: "8001",
      date: "2026-10-21",
      venue: "BCA",
      photoDate: "2026-10-21",
      photoUrls: [],
      fields: [{ key: "mileage", label: "Nobraukums", value: "193320" }],
      raw: null,
      rawHistory: null,
      rawDetail: { car_identification: { ImageUrls: [bcaUrl(1), bcaUrl(2), "https://evil.example.com/x.jpg"] } },
      rawImages: null,
      photos: [],
    };
    const sources = collectAuctionArchivePhotoSources({ vin: "WAUZZZF43PA018831", sessionId: "cs_test_1", block: { thecarapiRecords: [record], photoGroups: [] } });
    expect(sources.map((s) => s.url)).toEqual([bcaUrl(1), bcaUrl(2)]);
    expect(sources.every((s) => s.auctionKey === "bca:8001")).toBe(true);
  });
});
