import { describe, expect, it } from "vitest";
import {
  IRISS_OFFER_DISPLAY_DEFAULT_WIDTH,
  IRISS_OFFER_PUBLIC_PHOTO_CACHE_CONTROL,
  beginIrissOfferStripDrag,
  endIrissOfferStripDrag,
  irissOfferPublicHeroSrcSet,
  irissOfferPublicPhotoUrl,
  irissOfferThumbLoadingMode,
  isOfferHeroImageReady,
  moveIrissOfferStripDrag,
  pickIrissOfferDisplayWidth,
  shouldServeOriginalOfferDisplay,
} from "@/lib/iriss-offer-public-photo";

describe("IRISS public offer photo URLs", () => {
  it("keeps thumbs on the small variant and hero on the stored full file", () => {
    expect(irissOfferPublicPhotoUrl("tok", "img-1", "thumb")).toBe("/p/tok/photo/img-1?v=thumb");
    expect(irissOfferPublicPhotoUrl("tok", "img-1", "full")).toBe("/p/tok/photo/img-1");
    expect(irissOfferPublicPhotoUrl("tok", "img-1", "display", 480)).toBe("/p/tok/photo/img-1?v=display&w=480");
    expect(irissOfferPublicHeroSrcSet("tok", "img-1")).toBe(
      "/p/tok/photo/img-1?v=display&w=480 480w, /p/tok/photo/img-1 1600w",
    );
    expect(irissOfferPublicHeroSrcSet("tok", "img-1")).not.toContain("w=800");
    expect(irissOfferPublicHeroSrcSet("tok", "img-1")).not.toContain("w=1280");
  });

  it("allows only the fixed display widths", () => {
    expect(pickIrissOfferDisplayWidth("480")).toBe(480);
    expect(pickIrissOfferDisplayWidth("4000")).toBe(IRISS_OFFER_DISPLAY_DEFAULT_WIDTH);
    expect(pickIrissOfferDisplayWidth(null)).toBe(IRISS_OFFER_DISPLAY_DEFAULT_WIDTH);
  });

  it("serves the original when Sharp would not enlarge anyway", () => {
    expect(shouldServeOriginalOfferDisplay(1200, 1280)).toBe(true);
    expect(shouldServeOriginalOfferDisplay(800, 800)).toBe(true);
    expect(shouldServeOriginalOfferDisplay(2048, 1280)).toBe(false);
    expect(shouldServeOriginalOfferDisplay(1200, 480)).toBe(false);
    expect(shouldServeOriginalOfferDisplay(0, 800)).toBe(false);
  });

  it("marks cached/SSR images as ready so LQIP does not stick", () => {
    expect(isOfferHeroImageReady({ complete: true, naturalWidth: 1200 })).toBe(true);
    expect(isOfferHeroImageReady({ complete: true, naturalWidth: 0 })).toBe(false);
    expect(isOfferHeroImageReady({ complete: false, naturalWidth: 0 })).toBe(false);
  });

  it("eager-loads nearby thumbs and lazy-loads the rest", () => {
    expect(irissOfferThumbLoadingMode(0, 0)).toBe("eager");
    expect(irissOfferThumbLoadingMode(2, 0)).toBe("eager");
    expect(irissOfferThumbLoadingMode(7, 0)).toBe("eager");
    expect(irissOfferThumbLoadingMode(12, 0)).toBe("lazy");
    expect(irissOfferThumbLoadingMode(14, 15)).toBe("eager");
  });

  it("publishes photo bytes to the CDN, not only the private browser cache", () => {
    expect(IRISS_OFFER_PUBLIC_PHOTO_CACHE_CONTROL).toContain("public");
    expect(IRISS_OFFER_PUBLIC_PHOTO_CACHE_CONTROL).not.toContain("private");
  });
});

describe("IRISS public offer thumb strip drag", () => {
  it("treats a short click as a click, not a drag", () => {
    const drag = beginIrissOfferStripDrag({ pointerId: 1, startX: 100, startScrollLeft: 40 });
    expect(moveIrissOfferStripDrag(drag, { pointerId: 1, clientX: 104, buttons: 1, pointerType: "mouse" })).toEqual({
      action: "hold",
    });
    expect(endIrissOfferStripDrag(drag)).toEqual({ suppressClick: false });
  });

  it("starts scrolling only after the threshold and asks for capture once", () => {
    const drag = beginIrissOfferStripDrag({ pointerId: 7, startX: 100, startScrollLeft: 40 });
    const first = moveIrissOfferStripDrag(drag, { pointerId: 7, clientX: 130, buttons: 1, pointerType: "mouse" });
    expect(first.action).toBe("scroll");
    if (first.action !== "scroll") return;
    expect(first.capture).toBe(true);
    expect(first.scrollLeft).toBe(10);
    expect(first.drag.dragged).toBe(true);
    const second = moveIrissOfferStripDrag(first.drag, { pointerId: 7, clientX: 140, buttons: 1, pointerType: "mouse" });
    expect(second.action).toBe("scroll");
    if (second.action !== "scroll") return;
    expect(second.capture).toBe(false);
    expect(endIrissOfferStripDrag(second.drag)).toEqual({ suppressClick: true });
  });

  it("ends the session if the mouse button is already up so the strip cannot stick", () => {
    const drag = beginIrissOfferStripDrag({ pointerId: 2, startX: 50, startScrollLeft: 0 });
    expect(moveIrissOfferStripDrag(drag, { pointerId: 2, clientX: 80, buttons: 0, pointerType: "mouse" })).toEqual({
      action: "end",
      suppressClick: false,
    });
  });

  it("ignores moves from another pointer", () => {
    const drag = beginIrissOfferStripDrag({ pointerId: 1, startX: 10, startScrollLeft: 0 });
    expect(moveIrissOfferStripDrag(drag, { pointerId: 9, clientX: 80, buttons: 1, pointerType: "mouse" })).toEqual({
      action: "ignore",
    });
  });
});
