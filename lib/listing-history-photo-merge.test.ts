import { describe, expect, it } from "vitest";
import {
  coalesceOrderWorkspacePersistBody,
  normalizeOrderWorkspacePersistBody,
} from "@/lib/admin-order-workspace-persist";
import {
  collectWorkspaceSourceBlockPhotoIds,
  createDefaultSourceBlocks,
} from "@/lib/admin-source-blocks";
import {
  LISTING_HISTORY_MAX_PHOTOS,
  SOURCE_BLOCK_MAX_PHOTOS,
  SOURCE_BLOCK_PHOTO_WORKSPACE_MAX,
  countSourceBlockPhotos,
  flattenSourceBlockPhotoGroups,
  normalizeListingHistoryPhotoGroups,
  normalizeSourceBlockPhotoGroups,
  sourceBlockPhotoMaxForKey,
  syncedListingHistoryPhotos,
  syncedSourceBlockPhotos,
} from "@/lib/source-block-photo-types";

function sbpId(n: number): string {
  return `sbp_ph_${n.toString(16).padStart(24, "0")}`;
}

function sbpGroupId(n: number): string {
  return `sbp_phg_${n.toString(16).padStart(24, "0")}`;
}

function photos(from: number, count: number) {
  return Array.from({ length: count }, (_, i) => ({ id: sbpId(from + i) }));
}

function emptyPersist(sourceBlocks = createDefaultSourceBlocks()) {
  return normalizeOrderWorkspacePersistBody({
    sourceBlocks,
    iriss: "",
    apskatesPlāns: "",
    tehniskoRiskuAnalize: "",
    cenasAtbilstiba: "",
    previewConfirmed: false,
    vehicleAiExtraction: null,
    vehicleAiExtractionMeta: null,
  });
}

describe("listing-history photo cap", () => {
  it("keeps other source blocks at 50 and listing history at 100", () => {
    expect(SOURCE_BLOCK_MAX_PHOTOS).toBe(50);
    expect(LISTING_HISTORY_MAX_PHOTOS).toBe(100);
    expect(sourceBlockPhotoMaxForKey("tirgus")).toBe(100);
    expect(sourceBlockPhotoMaxForKey("csdd")).toBe(50);
    expect(sourceBlockPhotoMaxForKey("ltab")).toBe(50);
    expect(sourceBlockPhotoMaxForKey(undefined)).toBe(50);
    expect(SOURCE_BLOCK_PHOTO_WORKSPACE_MAX).toBe(650);
  });

  it("default source-block normalize still truncates at 50", () => {
    const groups = normalizeSourceBlockPhotoGroups([
      { id: sbpGroupId(1), title: "A", photos: photos(0, 29) },
      { id: sbpGroupId(2), title: "B", photos: photos(29, 33) },
    ]);
    expect(countSourceBlockPhotos(groups)).toBe(50);
    expect(groups[0]?.photos).toHaveLength(29);
    expect(groups[1]?.photos).toHaveLength(21);
  });

  it("listing-history normalize keeps 68 unique photos across three archive groups", () => {
    const groups = normalizeListingHistoryPhotoGroups([
      { id: sbpGroupId(1), title: "CarVertical 01.2022", photos: photos(0, 29) },
      { id: sbpGroupId(2), title: "AutoDNA 03.01.2022", photos: photos(29, 33) },
      { id: sbpGroupId(3), title: "AutoDNA 05.01.2022", photos: photos(62, 6) },
    ]);
    expect(countSourceBlockPhotos(groups, LISTING_HISTORY_MAX_PHOTOS)).toBe(68);
    expect(groups.map((g) => g.photos.length)).toEqual([29, 33, 6]);
    expect(flattenSourceBlockPhotoGroups(groups, LISTING_HISTORY_MAX_PHOTOS)).toHaveLength(68);
  });

  it("listing-history normalize caps at 100, not 50", () => {
    const groups = normalizeListingHistoryPhotoGroups(undefined, photos(0, 101));
    expect(countSourceBlockPhotos(groups, LISTING_HISTORY_MAX_PHOTOS)).toBe(100);
    expect(syncedListingHistoryPhotos({ photos: photos(0, 101) }).photos).toHaveLength(100);
    expect(syncedSourceBlockPhotos({ photos: photos(0, 101) }).photos).toHaveLength(50);
  });

  it("persist hydrate keeps 68 listing-history photos and still caps CSDD at 50", () => {
    const base = createDefaultSourceBlocks();
    const body = emptyPersist({
      ...base,
      tirgus: {
        ...base.tirgus,
        comments: "Arhīvs",
        photoGroups: [
          { id: sbpGroupId(1), title: "CarVertical 01.2022", photos: photos(0, 29) },
          { id: sbpGroupId(2), title: "AutoDNA 03.01.2022", photos: photos(29, 33) },
          { id: sbpGroupId(3), title: "AutoDNA 05.01.2022", photos: photos(62, 6) },
        ],
        photos: photos(0, 68),
      },
      csdd: {
        ...base.csdd,
        comments: "CSDD",
        photoGroups: [{ id: sbpGroupId(9), title: "CSDD", photos: photos(200, 51) }],
        photos: photos(200, 51),
      },
    });
    expect(body.sourceBlocks.tirgus.photos).toHaveLength(68);
    expect(body.sourceBlocks.tirgus.photoGroups.map((g) => g.photos.length)).toEqual([29, 33, 6]);
    expect(body.sourceBlocks.csdd.photos).toHaveLength(50);
    expect(collectWorkspaceSourceBlockPhotoIds(body.sourceBlocks).filter((id) => id.startsWith("sbp_ph_"))).toHaveLength(
      118,
    );
  });

  it("coalesce keeps the longer listing-history set when a stale PATCH omits new uploads", () => {
    const base = createDefaultSourceBlocks();
    const baseline = emptyPersist({
      ...base,
      tirgus: {
        ...base.tirgus,
        comments: "Arhīvs",
        photoGroups: [
          { id: sbpGroupId(1), title: "CarVertical 01.2022", photos: photos(0, 29) },
          { id: sbpGroupId(2), title: "AutoDNA 03.01.2022", photos: photos(29, 33) },
          { id: sbpGroupId(3), title: "AutoDNA 05.01.2022", photos: photos(62, 6) },
        ],
        photos: photos(0, 68),
      },
    });
    const incoming = emptyPersist({
      ...base,
      tirgus: { ...base.tirgus, comments: "Arhīvs", photoGroups: [], photos: [] },
    });
    const merged = coalesceOrderWorkspacePersistBody(incoming, baseline);
    expect(merged.sourceBlocks.tirgus.photos).toHaveLength(68);
    expect(merged.sourceBlocks.tirgus.photoGroups.map((g) => g.title)).toEqual([
      "CarVertical 01.2022",
      "AutoDNA 03.01.2022",
      "AutoDNA 05.01.2022",
    ]);
  });
});
