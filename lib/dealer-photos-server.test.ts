import { describe, expect, it, vi } from "vitest";
import sharp from "sharp";

vi.mock("server-only", () => ({}));

import { readDealerPhotosForPdf } from "@/lib/dealer-photos-server";

const id = (p: string, c: string) => `${p}_ph_${c.repeat(24)}`;

async function jpeg(w: number, h: number): Promise<Buffer> {
  const raw = Buffer.alloc(w * h * 3);
  for (let i = 0; i < raw.length; i++) raw[i] = (i * 37) % 256;
  return sharp(raw, { raw: { width: w, height: h, channels: 3 } }).jpeg({ quality: 95 }).toBuffer();
}

describe("readDealerPhotosForPdf", () => {
  it("shrinks large photos, blurs marked ones, skips missing", async () => {
    const big = await jpeg(2400, 1600);
    const a = id("ar", "a");
    const b = id("ih", "b");
    const c = id("la", "c");
    const read = vi.fn(async (_s: string, pid: string) => (pid === c ? null : big));
    const r = await readDealerPhotosForPdf({
      sessionId: "cs_1",
      items: [
        { id: a, blur: false },
        { id: b, blur: true },
        { id: c, blur: false },
        { id: a, blur: false },
      ],
      deps: { read },
    });
    expect(r.missing).toEqual([c]);
    expect(read).toHaveBeenCalledTimes(3);
    const bufA = Buffer.from(r.dataUrls[a]!.split(",")[1]!, "base64");
    const bufB = Buffer.from(r.dataUrls[b]!.split(",")[1]!, "base64");
    const ma = await sharp(bufA).metadata();
    const mb = await sharp(bufB).metadata();
    expect(Math.max(ma.width ?? 0, ma.height ?? 0)).toBeLessThanOrEqual(1600);
    expect(Math.max(mb.width ?? 0, mb.height ?? 0)).toBeLessThanOrEqual(1200);
    // Izplūdināta bilde ir daudz mazāka (detaļas pazudušas).
    expect(bufB.length).toBeLessThan(bufA.length / 2);
  });
});
