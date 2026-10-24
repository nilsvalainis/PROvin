import sharp from "sharp";
import { describe, expect, it } from "vitest";
import {
  IRISS_OFFER_DISPLAY_DEFAULT_WIDTH,
  IRISS_OFFER_DISPLAY_WIDTHS,
  IRISS_OFFER_THUMB_MAX_EDGE,
  irissOfferImageMimeForFormat,
  irissOfferThumbBlobPath,
  pickIrissOfferDisplayWidth,
  pickIrissOfferImageFormat,
  renderIrissOfferDisplayImage,
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

  it("renders a resized display rendition in the negotiated format", async () => {
    const source = await sharp({
      create: { width: 2000, height: 1200, channels: 3, background: { r: 10, g: 60, b: 120 } },
    })
      .jpeg()
      .toBuffer();
    const webp = await renderIrissOfferDisplayImage(source, 480, "webp");
    expect(webp).toBeTruthy();
    const meta = await sharp(webp!).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.width ?? 0).toBeLessThanOrEqual(480);
    expect(webp!.length).toBeLessThan(source.length);
  });

  it("only allows a fixed set of display widths - prevents arbitrary ?w= resource abuse", () => {
    for (const w of IRISS_OFFER_DISPLAY_WIDTHS) {
      expect(pickIrissOfferDisplayWidth(String(w))).toBe(w);
    }
    expect(pickIrissOfferDisplayWidth("4000")).toBe(IRISS_OFFER_DISPLAY_DEFAULT_WIDTH);
    expect(pickIrissOfferDisplayWidth("not-a-number")).toBe(IRISS_OFFER_DISPLAY_DEFAULT_WIDTH);
    expect(pickIrissOfferDisplayWidth(null)).toBe(IRISS_OFFER_DISPLAY_DEFAULT_WIDTH);
  });

  it("picks the best image format the browser's Accept header advertises", () => {
    expect(pickIrissOfferImageFormat("image/avif,image/webp,image/*,*/*;q=0.8")).toBe("avif");
    expect(pickIrissOfferImageFormat("image/webp,image/*,*/*;q=0.8")).toBe("webp");
    expect(pickIrissOfferImageFormat("image/png,image/*;q=0.8")).toBe("jpeg");
    expect(pickIrissOfferImageFormat(null)).toBe("jpeg");
  });

  it("maps formats to their mime type", () => {
    expect(irissOfferImageMimeForFormat("avif")).toBe("image/avif");
    expect(irissOfferImageMimeForFormat("webp")).toBe("image/webp");
    expect(irissOfferImageMimeForFormat("jpeg")).toBe("image/jpeg");
  });
});
