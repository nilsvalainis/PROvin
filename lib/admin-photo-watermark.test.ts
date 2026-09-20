import { describe, expect, it } from "vitest";

import {
  formRequestsWatermarkCover,
  hidePhotoWatermarksFromCcVinWorkspace,
  parseHidePhotoWatermarks,
} from "@/lib/admin-photo-watermark";

describe("admin photo watermark toggle", () => {
  it("noklusējumā slēpj ūdenszīmi, ja lauks nav saglabāts", () => {
    expect(parseHidePhotoWatermarks(undefined)).toBe(true);
    expect(parseHidePhotoWatermarks({})).toBe(true);
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

    expect(formRequestsWatermarkCover(new FormData())).toBe(true);
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
