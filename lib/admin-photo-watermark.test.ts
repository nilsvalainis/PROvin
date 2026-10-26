import { describe, expect, it } from "vitest";

import {
  formRequestsWatermarkCover,
  hidePhotoWatermarksFromCcVinWorkspace,
  parseCcVinHidePhotoWatermarks,
  parseHidePhotoWatermarks,
} from "@/lib/admin-photo-watermark";
import { emptyCcVinBlock, normalizeCcVinBlock } from "@/lib/cc-vin-report";

describe("admin photo watermark toggle", () => {
  it("visās sadaļās noklusējumā neslēpj ūdenszīmi, ja lauks nav saglabāts", () => {
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

  it("Izsoļu portālu arhīvs noklusējumā neslēpj ūdenszīmi", () => {
    expect(parseCcVinHidePhotoWatermarks(undefined)).toBe(false);
    expect(parseCcVinHidePhotoWatermarks({})).toBe(false);
    expect(parseCcVinHidePhotoWatermarks({ hidePhotoWatermarks: false })).toBe(false);
    expect(parseCcVinHidePhotoWatermarks({ hidePhotoWatermarks: true })).toBe(true);
  });

  it("Izsoļu portālu arhīva slēdzi lasa no darba zonas bloka un saglabāto vērtību nemaina", () => {
    expect(hidePhotoWatermarksFromCcVinWorkspace(null)).toBe(false);
    expect(hidePhotoWatermarksFromCcVinWorkspace({ sourceBlocks: {} })).toBe(false);
    expect(
      hidePhotoWatermarksFromCcVinWorkspace({
        sourceBlocks: { cc_vin: { hidePhotoWatermarks: false } },
      }),
    ).toBe(false);
    expect(
      hidePhotoWatermarksFromCcVinWorkspace({
        sourceBlocks: { cc_vin: { hidePhotoWatermarks: true } },
      }),
    ).toBe(true);
  });

  it("Izsoļu portālu arhīva normalizācija trūkstošu slēdzi uzskata par izslēgtu, saglabāto true atstāj", () => {
    expect(emptyCcVinBlock().hidePhotoWatermarks).toBeUndefined();
    expect(normalizeCcVinBlock({}).hidePhotoWatermarks).toBe(false);
    expect(normalizeCcVinBlock({ hidePhotoWatermarks: false }).hidePhotoWatermarks).toBe(false);
    expect(normalizeCcVinBlock({ hidePhotoWatermarks: true }).hidePhotoWatermarks).toBe(true);
  });
});
