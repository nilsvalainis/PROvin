import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { AUCTION_ARCHIVE_PDF_PHOTO_MAX_PX, shrinkAuctionArchivePdfPhoto } from "@/lib/auction-archive-offer-photos";

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
