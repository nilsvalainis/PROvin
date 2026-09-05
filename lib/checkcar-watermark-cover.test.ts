import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import sharp from "sharp";

import { coverCheckcarVinWatermark } from "@/lib/checkcar-watermark-cover";
import { fixedCheckcarWatermarkBox, isCheckcarGray, isCheckcarVinRed } from "@/lib/checkcar-watermark-mask";

const SERVICE_SCREEN_FIXTURE = path.join(
  process.cwd(),
  "lib/fixtures/checkcar-watermark-service-screen.jpg",
);

async function jpegFromSvg(svg: string): Promise<Buffer> {
  return sharp(Buffer.from(svg)).jpeg({ quality: 92 }).toBuffer();
}

function expectCenteredStrip(box: { x: number; y: number; w: number; h: number }, width: number, height: number) {
  const expected = fixedCheckcarWatermarkBox(width, height);
  expect(box).toEqual(expected);
  expect(Math.abs(box.x + box.w / 2 - width / 2)).toBeLessThanOrEqual(1);
  expect(Math.abs(box.y + box.h / 2 - height / 2)).toBeLessThanOrEqual(1);
}

describe("checkcar watermark cover", () => {
  it("atpazīst sarkano VIN un pelēko CHECKCAR krāsu", () => {
    expect(isCheckcarVinRed(165, 40, 46)).toBe(true);
    expect(isCheckcarVinRed(190, 158, 155)).toBe(true);
    expect(isCheckcarVinRed(20, 18, 16)).toBe(false);
    expect(isCheckcarVinRed(240, 200, 40)).toBe(false);
    expect(isCheckcarGray(160, 158, 156)).toBe(true);
    expect(isCheckcarGray(12, 12, 12)).toBe(false);
    expect(isCheckcarGray(250, 250, 250)).toBe(false);
  });

  it("fiksē joslu tieši kadra vidū", () => {
    const box = fixedCheckcarWatermarkBox(640, 360);
    expectCenteredStrip(box, 640, 360);
    expect(box.w).toBe(Math.round(640 * 0.66));
    expect(box.h).toBe(Math.round(360 * 0.12));
  });

  it("visām bildēm uzliek to pašu centra joslu", async () => {
    const letters = [
      ...["80", "116", "152", "188", "224", "260", "296", "332"].map(
        (x) => `<rect x="${x}" y="168" width="28" height="36" fill="#c4c4c4"/>`,
      ),
      `<rect x="380" y="168" width="28" height="36" fill="#c81e24"/>`,
      `<rect x="416" y="168" width="10" height="36" fill="#c81e24"/>`,
      `<rect x="434" y="168" width="28" height="36" fill="#c81e24"/>`,
    ].join("");
    const light = await jpegFromSvg(
      `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="#ececec"/>${letters}</svg>`,
    );
    const dark = await jpegFromSvg(
      `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="#121214"/>${letters}</svg>`,
    );

    const a = await coverCheckcarVinWatermark(light);
    const b = await coverCheckcarVinWatermark(dark);
    expect(a.covered).toBe(true);
    expect(b.covered).toBe(true);
    expect(a.hit!.box).toEqual(b.hit!.box);
    expectCenteredStrip(a.hit!.box, 640, 360);

    const outside = await sharp(a.jpeg)
      .extract({ left: 20, top: 20, width: 8, height: 8 })
      .raw()
      .toBuffer();
    expect(outside[0]).toBeGreaterThan(200);
    expect(outside[1]).toBeGreaterThan(200);
  });

  it("otro reizi to pašu centra joslu vairs nepārkodē", async () => {
    const jpeg = await sharp({
      create: { width: 640, height: 360, channels: 3, background: "#334155" },
    })
      .jpeg({ quality: 85 })
      .toBuffer();

    const first = await coverCheckcarVinWatermark(jpeg);
    expect(first.covered).toBe(true);
    expectCenteredStrip(first.hit!.box, 640, 360);

    const second = await coverCheckcarVinWatermark(first.jpeg);
    expect(second.covered).toBe(false);
    expect(second.jpeg).toBe(first.jpeg);
  });

  it("aizklāj arī foto bez atsevišķa uzraksta meklējuma", async () => {
    const jpeg = await sharp({
      create: { width: 640, height: 400, channels: 3, background: "#111111" },
    })
      .jpeg({ quality: 85 })
      .toBuffer();

    const result = await coverCheckcarVinWatermark(jpeg);
    expect(result.covered).toBe(true);
    expectCenteredStrip(result.hit!.box, 640, 400);
  });

  it("aizklāj CheckCar ūdenszīmi uz servisa ekrāna foto centrā", async () => {
    const jpeg = readFileSync(SERVICE_SCREEN_FIXTURE);
    const meta = await sharp(jpeg).metadata();
    const first = await coverCheckcarVinWatermark(jpeg);
    expect(first.covered).toBe(true);
    expectCenteredStrip(first.hit!.box, meta.width!, meta.height!);
    const box = first.hit!.box;
    const sample = await sharp(first.jpeg)
      .extract({ left: box.x + Math.floor(box.w / 2), top: box.y + Math.floor(box.h / 2), width: 1, height: 1 })
      .raw()
      .toBuffer();
    expect(Math.abs(sample[0]! - sample[1]!)).toBeLessThan(8);
    expect(Math.abs(sample[1]! - sample[2]!)).toBeLessThan(8);
  });
});
