import { describe, expect, it } from "vitest";

import {
  formRequestsWatermarkCover,
  hidePhotoWatermarksFromCcVinWorkspace,
  parseCcVinHidePhotoWatermarks,
  parseHidePhotoWatermarks,
} from "@/lib/admin-photo-watermark";

describe("admin photo watermark toggle", () => {
  it("ārpus CC.VIN noklusējumā neslēpj ūdenszīmi, ja lauks nav saglabāts", () => {
    expect(parseHidePhotoWatermarks(undefined)).toBe(false);
    expect(parseHidePhotoWatermarks({})).toBe(false);
    expect(parseHidePhotoWatermarks({ hidePhotoWatermarks: true })).toBe(true);
    expect(parseHidePhotoWatermarks({ hidePhotoWatermarks: false })).toBe(false);
  });

  it("FormData hideWatermarks nosaka, vai slēpt pirms saglabāšanas", () => {
    const on = new FormData();
    on.set("hideWatermarks", "1");
    expect(formRequestsWatermarkCover(on)).toBe(true);

    const off = new FormData();
    off.set("hideWatermarks", "0");
    expect(formRequestsWatermarkCover(off)).toBe(false);

    expect(formRequestsWatermarkCover(new FormData())).toBe(false);
  });

  it("CC.VIN noklusējumā slēpj ūdenszīmi", () => {
    expect(parseCcVinHidePhotoWatermarks(undefined)).toBe(true);
    expect(parseCcVinHidePhotoWatermarks({})).toBe(true);
    expect(parseCcVinHidePhotoWatermarks({ hidePhotoWatermarks: false })).toBe(false);
  });

  it("CC.VIN slēdzi lasa no darba zonas bloka", () => {
    expect(hidePhotoWatermarksFromCcVinWorkspace(null)).toBe(true);
    expect(
      hidePhotoWatermarksFromCcVinWorkspace({
        sourceBlocks: { cc_vin: { hidePhotoWatermarks: false } },
      }),
    ).toBe(false);
  });
});
