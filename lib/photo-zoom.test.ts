import { describe, expect, it } from "vitest";
import {
  clampPhotoPan,
  photoSwipeStep,
  clampPhotoZoom,
  photoZoomPercent,
  pinchPhotoZoom,
  stepPhotoZoom,
  togglePhotoZoom,
} from "@/lib/photo-zoom";

describe("photo zoom", () => {
  it("steps with + and - between 100% and 400%", () => {
    expect(stepPhotoZoom(1, 1)).toBe(1.5);
    expect(stepPhotoZoom(1.5, 1)).toBe(2);
    expect(stepPhotoZoom(4, 1)).toBe(4);
    expect(stepPhotoZoom(2, -1)).toBe(1.5);
    expect(stepPhotoZoom(1, -1)).toBe(1);
    expect(stepPhotoZoom(2.4, -1)).toBe(2);
  });

  it("toggles 1x and 2x on double click", () => {
    expect(togglePhotoZoom(1)).toBe(2);
    expect(togglePhotoZoom(3)).toBe(1);
  });

  it("pinches within limits", () => {
    expect(pinchPhotoZoom(1, 100, 200)).toBe(2);
    expect(pinchPhotoZoom(2, 100, 1000)).toBe(4);
    expect(pinchPhotoZoom(2, 100, 10)).toBe(1);
    expect(pinchPhotoZoom(2, 0, 10)).toBe(2);
    expect(clampPhotoZoom(Number.NaN)).toBe(1);
  });

  it("shows percent", () => {
    expect(photoZoomPercent(2)).toBe("200%");
    expect(photoZoomPercent(1.5)).toBe("150%");
  });

  it("keeps the picture inside the view while panning", () => {
    expect(clampPhotoPan({ scale: 2, x: 999, y: -999 }, { width: 400, height: 300 })).toEqual({ scale: 2, x: 200, y: -150 });
    expect(clampPhotoPan({ scale: 1, x: 50, y: 50 }, { width: 400, height: 300 })).toEqual({ scale: 1, x: 0, y: 0 });
  });
});

describe("photoSwipeStep (FABLE F3: 60 bildes telefonā tikai ar bultām)", () => {
  it("pa kreisi = nākamā, pa labi = iepriekšējā", () => {
    expect(photoSwipeStep({ x: 320, y: 400 }, { x: 80, y: 410 }, 1)).toBe(1);
    expect(photoSwipeStep({ x: 80, y: 400 }, { x: 320, y: 390 }, 1)).toBe(-1);
  });
  it("īss, vertikāls vai pietuvināts vilciens nepāršķir", () => {
    expect(photoSwipeStep({ x: 200, y: 400 }, { x: 170, y: 400 }, 1)).toBe(0);
    expect(photoSwipeStep({ x: 200, y: 400 }, { x: 120, y: 600 }, 1)).toBe(0);
    expect(photoSwipeStep({ x: 320, y: 400 }, { x: 80, y: 400 }, 2)).toBe(0);
  });
});
