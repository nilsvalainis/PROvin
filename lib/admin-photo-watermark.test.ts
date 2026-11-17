import { describe, expect, it } from "vitest";

import {
  formRequestsWatermarkCover,
  hidePhotoWatermarksFromCcVinWorkspace,
  parseCcVinHidePhotoWatermarks,
  parseHidePhotoWatermarks,
  retainSavedHidePhotoWatermarks,
} from "@/lib/admin-photo-watermark";
import {
  createDefaultSourceBlocks,
  emptyAutoRecordsBlock,
  emptyCsddFields,
  emptyListingAnalysisBlock,
  emptyLtabBlock,
  emptyTirgusFields,
  emptyVendorAvotuBlock,
  emptyVinRegistryBlock,
  mergeSourceBlocksWithDefaults,
} from "@/lib/admin-source-blocks";
import { emptyAsvBlock } from "@/lib/asv-report";
import { emptyCcVinBlock, normalizeCcVinBlock } from "@/lib/cc-vin-report";

function hideFlagsFromBlocks(blocks: ReturnType<typeof createDefaultSourceBlocks>): Array<boolean | undefined> {
  return [
    blocks.csdd.hidePhotoWatermarks,
    blocks.tirgus.hidePhotoWatermarks,
    blocks.autodna.hidePhotoWatermarks,
    blocks.carvertical.hidePhotoWatermarks,
    blocks.auto_records.hidePhotoWatermarks,
    blocks.cc_vin.hidePhotoWatermarks,
    blocks.asv.hidePhotoWatermarks,
    blocks.tjekbil.hidePhotoWatermarks,
    blocks.finnik.hidePhotoWatermarks,
    blocks.mnt_ee.hidePhotoWatermarks,
    blocks.lkf_ee.hidePhotoWatermarks,
    blocks.carinfo.hidePhotoWatermarks,
    blocks.traficom_fi.hidePhotoWatermarks,
    blocks.ltab.hidePhotoWatermarks,
    ...blocks.citi_avoti.sections.map((section) => section.hidePhotoWatermarks),
    blocks.listing_analysis.hidePhotoWatermarks,
  ];
}

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
    expect(emptyCcVinBlock().hidePhotoWatermarks).toBe(false);
    expect(normalizeCcVinBlock({}).hidePhotoWatermarks).toBe(false);
    expect(normalizeCcVinBlock({ hidePhotoWatermarks: false }).hidePhotoWatermarks).toBe(false);
    expect(normalizeCcVinBlock({ hidePhotoWatermarks: true }).hidePhotoWatermarks).toBe(true);
  });

  it("tukšo avotu konstruktori un jauns pasūtījums slēdzi atstāj izslēgtu", () => {
    expect(emptyCsddFields().hidePhotoWatermarks).toBe(false);
    expect(emptyTirgusFields().hidePhotoWatermarks).toBe(false);
    expect(emptyVendorAvotuBlock().hidePhotoWatermarks).toBe(false);
    expect(emptyAutoRecordsBlock().hidePhotoWatermarks).toBe(false);
    expect(emptyAsvBlock().hidePhotoWatermarks).toBe(false);
    expect(emptyVinRegistryBlock().hidePhotoWatermarks).toBe(false);
    expect(emptyLtabBlock().hidePhotoWatermarks).toBe(false);
    expect(emptyListingAnalysisBlock().hidePhotoWatermarks).toBe(false);
    expect(hideFlagsFromBlocks(createDefaultSourceBlocks()).every((flag) => flag === false)).toBe(true);
    expect(hideFlagsFromBlocks(mergeSourceBlocksWithDefaults({})).every((flag) => flag === false)).toBe(true);
  });

  it("ielāde neieslēdz slēdzi, bet saglabāto true nemaina", () => {
    expect(retainSavedHidePhotoWatermarks(undefined)).toBe(false);
    expect(retainSavedHidePhotoWatermarks({})).toBe(false);
    expect(retainSavedHidePhotoWatermarks({ hidePhotoWatermarks: false })).toBe(false);
    expect(retainSavedHidePhotoWatermarks({ hidePhotoWatermarks: true })).toBe(true);
  });

  it("jau saglabātu true avota blokā merge nepārraksta", () => {
    const merged = mergeSourceBlocksWithDefaults({
      cc_vin: { ...emptyCcVinBlock(), hidePhotoWatermarks: true },
      autodna: { ...emptyVendorAvotuBlock(), hidePhotoWatermarks: true },
      listing_analysis: { ...emptyListingAnalysisBlock(), hidePhotoWatermarks: true },
    });
    expect(merged.cc_vin.hidePhotoWatermarks).toBe(true);
    expect(merged.autodna.hidePhotoWatermarks).toBe(true);
    expect(merged.listing_analysis.hidePhotoWatermarks).toBe(true);
    expect(merged.csdd.hidePhotoWatermarks).toBe(false);
    expect(merged.asv.hidePhotoWatermarks).toBe(false);
  });
});
