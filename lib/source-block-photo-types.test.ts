import { describe, expect, it } from "vitest";
import {
  SOURCE_BLOCK_MAX_PHOTOS,
  syncedSourceBlockPhotos,
  emptySourceBlockPhotoGroup,
  isSourceBlockPhotoId,
  mergeSourceBlockPhotoGroups,
  normalizeSourceBlockPhotoGroups,
  sourceBlockPhotosHaveContent,
} from "@/lib/source-block-photo-types";

describe("source-block photo types", () => {
  it("keeps a 50-photo cap and accepts generated group ids", () => {
    expect(SOURCE_BLOCK_MAX_PHOTOS).toBe(50);
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
    const next = syncedSourceBlockPhotos({ comments: "ok" });
    expect(next.photos).toEqual([]);
    expect(next.photoGroups).toEqual([]);
  });
});
