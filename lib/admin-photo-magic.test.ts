import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import sharp from "sharp";

import { sniffImageKind } from "@/lib/admin-photo-magic";
import { jpegFromAdminPhotoUpload } from "@/lib/admin-photo-normalize";

const SERVICE_SCREEN = path.join(process.cwd(), "lib/fixtures/checkcar-watermark-service-screen.jpg");

describe("admin photo magic", () => {
  it("atpazīst JPEG arī tad, ja vārds izskatās pēc PNG", () => {
    const jpeg = readFileSync(SERVICE_SCREEN);
    expect(sniffImageKind(jpeg)).toBe("jpeg");
  });

  it("atpazīst PNG, WebP un HEIC ftyp", async () => {
    const png = await sharp({
      create: { width: 16, height: 16, channels: 3, background: "#111" },
    })
      .png()
      .toBuffer();
    expect(sniffImageKind(png)).toBe("png");

    const header = Buffer.alloc(16, 0);
    header.write("ftyp", 4, "ascii");
    header.write("heic", 8, "ascii");
    expect(sniffImageKind(header)).toBe("heic");

    header.write("avif", 8, "ascii");
    expect(sniffImageKind(header)).toBe("avif");
  });

  it("JPEG baitus ar maldinošu .png vārdu joprojām pieņem", async () => {
    const jpeg = readFileSync(SERVICE_SCREEN);
    const out = await jpegFromAdminPhotoUpload(jpeg, 320 * 1024);
    expect(out.ok).toBe(true);
  });
});
