import { describe, expect, it } from "vitest";
import { isIosWebKit, isModalImage } from "@/components/admin/iriss-autoparks-v2/FileModal";
import { isBlackFrame } from "@/components/admin/iriss-autoparks-v2/Scanner";

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_3_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.3 Mobile/15E148 Safari/604.1";
const MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.3 Safari/605.1.15";

/** Kanvas aizstājējs: visi punkti vienā krāsā. */
function ctxOf(rgb: [number, number, number]) {
  return { getImageData: () => ({ data: new Uint8ClampedArray([...rgb, 255]) }) } as unknown as CanvasRenderingContext2D;
}

describe("iOS 18 (Nils 27.10): skeneris un priekšskats", () => {
  it("melns kadrs tiek atpazīts (tad atveras telefona kamera), normāls - nē", () => {
    expect(isBlackFrame(ctxOf([0, 0, 0]), 1920, 1080)).toBe(true);
    expect(isBlackFrame(ctxOf([120, 110, 100]), 1920, 1080)).toBe(false);
    expect(isBlackFrame(ctxOf([200, 200, 200]), 0, 0)).toBe(true);
  });

  it("bilde arī pēc nosaukuma, ja tips vispārīgs (HEIC no iPhone)", () => {
    expect(isModalImage({ contentType: "application/octet-stream", title: "IMG_0412.HEIC" })).toBe(true);
    expect(isModalImage({ contentType: "image/jpeg", title: "rēķins" })).toBe(true);
    expect(isModalImage({ contentType: "application/pdf", title: "Rēķins.pdf" })).toBe(false);
  });

  it("iPhone un iPad (Mac ar skārienu) - PDF atver Safari skatītājā; dators - iframe", () => {
    expect(isIosWebKit(IPHONE)).toBe(true);
    expect(isIosWebKit(MAC, 5)).toBe(true);
    expect(isIosWebKit(MAC, 0)).toBe(false);
  });
});
