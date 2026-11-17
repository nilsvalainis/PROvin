import { describe, expect, it } from "vitest";
import {
  LISTING_HISTORY_MAX_PHOTOS,
  SOURCE_BLOCK_MAX_PHOTOS,
  SOURCE_BLOCK_PHOTO_WORKSPACE_MAX,
  syncedSourceBlockPhotos,
  emptySourceBlockPhotoGroup,
  isSourceBlockPhotoId,
  mergeSourceBlockPhotoGroups,
  normalizeSourceBlockPhotoGroups,
  sourceBlockPhotoMaxForKey,
  sourceBlockPhotosHaveContent,
} from "@/lib/source-block-photo-types";

describe("source-block photo types", () => {
  it("keeps a 50-photo cap for other avoti and 100 for listing history", () => {
    expect(SOURCE_BLOCK_MAX_PHOTOS).toBe(50);
    expect(LISTING_HISTORY_MAX_PHOTOS).toBe(100);
    expect(sourceBlockPhotoMaxForKey("tirgus")).toBe(LISTING_HISTORY_MAX_PHOTOS);
    expect(SOURCE_BLOCK_PHOTO_WORKSPACE_MAX).toBeGreaterThan(SOURCE_BLOCK_MAX_PHOTOS * 12);
    const group = emptySourceBlockPhotoGroup();
    expect(group.id.startsWith("sbp_phg_")).toBe(true);
    expect(isSourceBlockPhotoId("sbp_ph_0123456789abcdef01234567")).toBe(true);
    expect(isSourceBlockPhotoId("la_ph_0123456789abcdef01234567")).toBe(false);
  });

  it("normalizes a flat photos list into one untitled group", () => {
    const groups = normalizeSourceBlockPhotoGroups(undefined, [
      { id: "sbp_ph_0123456789abcdef01234567" },
      { id: "not-a-photo" },
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.photos).toEqual([{ id: "sbp_ph_0123456789abcdef01234567" }]);
  });

  it("prefers the richer photo set when merging persist snapshots", () => {
    const incoming = [{ id: emptySourceBlockPhotoGroup().id, title: "MNT", photos: [] }];
    const baseline = [
      {
        id: emptySourceBlockPhotoGroup().id,
        title: "LKF",
        photos: [{ id: "sbp_ph_0123456789abcdef01234567" }],
      },
    ];
    const merged = mergeSourceBlockPhotoGroups(incoming, [], baseline, []);
    expect(merged[0]?.title).toBe("LKF");
    expect(sourceBlockPhotosHaveContent({ photoGroups: merged })).toBe(true);
  });

  it("syncs empty blocks to empty photo arrays", () => {
    const next = syncedSourceBlockPhotos({});
    expect(next.photos).toEqual([]);
    expect(next.photoGroups).toEqual([]);
    expect(next.hidePhotoWatermarks).toBe(false);
  });

  it("keeps an explicit hidePhotoWatermarks off flag", () => {
    const next = syncedSourceBlockPhotos({ hidePhotoWatermarks: false });
    expect(next.hidePhotoWatermarks).toBe(false);
  });

  it("keeps an explicit hidePhotoWatermarks on flag", () => {
    const next = syncedSourceBlockPhotos({ hidePhotoWatermarks: true });
    expect(next.hidePhotoWatermarks).toBe(true);
  });
});
