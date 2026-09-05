import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import sharp from "sharp";

import { coverCheckcarVinWatermark } from "@/lib/checkcar-watermark-cover";
import { isCheckcarGray, isCheckcarVinRed } from "@/lib/checkcar-watermark-mask";

const SERVICE_SCREEN_FIXTURE = path.join(
  process.cwd(),
  "lib/fixtures/checkcar-watermark-service-screen.jpg",
);

async function jpegFromSvg(svg: string): Promise<Buffer> {
  return sharp(Buffer.from(svg)).jpeg({ quality: 92 }).toBuffer();
}

describe("checkcar watermark cover", () => {
  it("atpazīst sarkano VIN un pelēko CHECKCAR krāsu", () => {
    expect(isCheckcarVinRed(165, 40, 46)).toBe(true);
    expect(isCheckcarVinRed(20, 18, 16)).toBe(false);
    expect(isCheckcarVinRed(240, 200, 40)).toBe(false);
    expect(isCheckcarGray(160, 158, 156)).toBe(true);
    expect(isCheckcarGray(12, 12, 12)).toBe(false);
    expect(isCheckcarGray(250, 250, 250)).toBe(false);
  });

  it("aizklāj sintētisko CHECKCAR.VIN un otro reizi vairs neskāra", async () => {
    const letters = [
      ...["80", "116", "152", "188", "224", "260", "296", "332"].map(
        (x) => `<rect x="${x}" y="168" width="28" height="36" fill="#b8b8b8"/>`,
      ),
      `<rect x="380" y="168" width="28" height="36" fill="#c81e24"/>`,
      `<rect x="416" y="168" width="10" height="36" fill="#c81e24"/>`,
      `<rect x="434" y="168" width="28" height="36" fill="#c81e24"/>`,
    ].join("");
    const jpeg = await jpegFromSvg(
      `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="#121214"/>${letters}</svg>`,
    );

    const first = await coverCheckcarVinWatermark(jpeg);
    expect(first.covered).toBe(true);
    expect(first.hit?.vinLetters).toBeGreaterThanOrEqual(2);
    expect(first.hit?.grayLetters).toBeGreaterThanOrEqual(3);
    expect(first.jpeg.equals(jpeg)).toBe(false);

    const second = await coverCheckcarVinWatermark(first.jpeg);
    expect(second.covered).toBe(false);
    expect(second.jpeg).toBe(first.jpeg);
  });

  it("tumšu foto bez ūdenszīmes atstāj neskartu", async () => {
    const jpeg = await sharp({
      create: { width: 640, height: 400, channels: 3, background: "#111111" },
    })
      .jpeg({ quality: 85 })
      .toBuffer();

    const result = await coverCheckcarVinWatermark(jpeg);
    expect(result.covered).toBe(false);
    expect(result.jpeg).toBe(jpeg);
  });

  it("aizklāj CheckCar ūdenszīmi uz servisa ekrāna foto", async () => {
    const jpeg = readFileSync(SERVICE_SCREEN_FIXTURE);
    const first = await coverCheckcarVinWatermark(jpeg);
    expect(first.covered).toBe(true);
    expect(first.hit?.grayLetters ?? 0).toBeGreaterThanOrEqual(4);
    expect((first.hit?.vinLetters ?? 0) + (first.hit?.grayLetters ?? 0)).toBeGreaterThanOrEqual(6);
    const box = first.hit!.box;
    const sample = await sharp(first.jpeg)
      .extract({ left: box.x + Math.floor(box.w / 2), top: box.y + Math.floor(box.h / 2), width: 1, height: 1 })
      .raw()
      .toBuffer();
    expect(Math.abs(sample[0]! - sample[1]!)).toBeLessThan(8);
    expect(Math.abs(sample[1]! - sample[2]!)).toBeLessThan(8);

    const second = await coverCheckcarVinWatermark(first.jpeg);
    expect(second.covered).toBe(false);
  });

  it("sarkanu taisnstūri neuzskata par VIN burtiem", async () => {
    const bar = await sharp({
      create: { width: 200, height: 40, channels: 3, background: "#c4282d" },
    })
      .png()
      .toBuffer();
    const jpeg = await sharp({
      create: { width: 640, height: 400, channels: 3, background: "#111111" },
    })
      .composite([{ input: bar, left: 220, top: 180 }])
      .jpeg({ quality: 85 })
      .toBuffer();

    const result = await coverCheckcarVinWatermark(jpeg);
    expect(result.covered).toBe(false);
  });
});
