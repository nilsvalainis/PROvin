import { describe, expect, it } from "vitest";
import sharp from "sharp";

import {
  ADMIN_PHOTO_UPLOAD_MAX_SOURCE_BYTES,
  isHeicMagicBuffer,
  isLikelyHeicImageFile,
  jpegFromAdminPhotoUpload,
} from "@/lib/admin-photo-normalize";
import { jpegWithCheckcarWatermarkCovered } from "@/lib/checkcar-watermark-cover";

describe("admin photo normalize", () => {
  it("atpazīst HEIC faila vārdu un ftyp maģiju", () => {
    expect(isLikelyHeicImageFile({ name: "IMG_1234.HEIC", type: "" })).toBe(true);
    expect(isLikelyHeicImageFile({ name: "photo.jpg", type: "image/jpeg" })).toBe(false);
    expect(isLikelyHeicImageFile({ name: "x", type: "image/heif" })).toBe(true);

    const header = Buffer.alloc(16, 0);
    header.write("ftyp", 4, "ascii");
    header.write("heic", 8, "ascii");
    expect(isHeicMagicBuffer(header)).toBe(true);
    expect(isHeicMagicBuffer(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe(false);
  });

  it("JPEG atstāj JPEG un ietilpina store limitā", async () => {
    const jpeg = await sharp({
      create: { width: 320, height: 240, channels: 3, background: "#334155" },
    })
      .jpeg({ quality: 80 })
      .toBuffer();

    const out = await jpegFromAdminPhotoUpload(jpeg, 320 * 1024);
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.jpeg[0]).toBe(0xff);
      expect(out.jpeg[1]).toBe(0xd8);
    }
  });

  it("PNG pārveido par JPEG", async () => {
    const png = await sharp({
      create: { width: 200, height: 160, channels: 3, background: "#0f172a" },
    })
      .png()
      .toBuffer();

    const out = await jpegFromAdminPhotoUpload(png, 320 * 1024);
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.jpeg[0]).toBe(0xff);
      expect(out.jpeg[1]).toBe(0xd8);
    }
  });

  it("tukšu un pārāk lielu avotu noraida", async () => {
    expect(await jpegFromAdminPhotoUpload(Buffer.alloc(0), 1000)).toEqual({
      ok: false,
      error: "invalid_jpeg",
    });
    const huge = Buffer.alloc(ADMIN_PHOTO_UPLOAD_MAX_SOURCE_BYTES + 1);
    expect(await jpegFromAdminPhotoUpload(huge, 1000)).toEqual({
      ok: false,
      error: "file_too_large",
    });
  });

  it("ūdenszīmes kļūda nebojā saglabājamo JPEG", async () => {
    const junk = Buffer.from("not-an-image");
    const out = await jpegWithCheckcarWatermarkCovered(junk);
    expect(out).toBe(junk);
  });
});
