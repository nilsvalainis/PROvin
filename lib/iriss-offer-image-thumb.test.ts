import sharp from "sharp";
import { describe, expect, it } from "vitest";
import {
  IRISS_OFFER_THUMB_MAX_EDGE,
  irissOfferThumbBlobPath,
  renderIrissOfferThumbJpeg,
} from "@/lib/iriss-offer-image-thumb";

describe("IRISS offer image thumbnails", () => {
  it("builds a private blob path next to the full image", () => {
    expect(irissOfferThumbBlobPath("iriss-pasutijumi/offers/ord/off/img")).toBe(
      "iriss-pasutijumi/offers/ord/off/img-thumb",
    );
    expect(irissOfferThumbBlobPath("offers/ord/off/img-thumb")).toBe("offers/ord/off/img-thumb");
    expect(irissOfferThumbBlobPath("../secret")).toBe("");
  });

  it("renders a small jpeg for the sorter grid", async () => {
    const source = await sharp({
      create: { width: 800, height: 500, channels: 3, background: { r: 20, g: 90, b: 160 } },
    })
      .jpeg()
      .toBuffer();
    const thumb = await renderIrissOfferThumbJpeg(source);
    expect(thumb).toBeTruthy();
    const meta = await sharp(thumb!).metadata();
    expect(meta.format).toBe("jpeg");
    expect(meta.width ?? 0).toBeLessThanOrEqual(IRISS_OFFER_THUMB_MAX_EDGE);
    expect(meta.height ?? 0).toBeLessThanOrEqual(IRISS_OFFER_THUMB_MAX_EDGE);
    expect(thumb!.length).toBeLessThan(source.length);
  });
});
